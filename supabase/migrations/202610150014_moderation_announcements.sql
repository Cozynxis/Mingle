-- Mingle moderation + global announcements. Run after previous admin migrations.
create table if not exists public.user_restrictions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 muted_until timestamptz,
 reason text not null default '',
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.platform_announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 100),
 body text not null check(length(trim(body)) between 1 and 1200),
 tone text not null default 'purple' check(tone in ('purple','blue','green','orange','red')),
 active boolean not null default true,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.user_restrictions enable row level security;
alter table public.platform_announcements enable row level security;
drop policy if exists "Admins and owner read restrictions" on public.user_restrictions;
create policy "Admins and owner read restrictions" on public.user_restrictions for select to authenticated using(user_id=auth.uid() or public.mingle_is_admin());
drop policy if exists "Read active announcements" on public.platform_announcements;
create policy "Read active announcements" on public.platform_announcements for select to authenticated using(active or public.mingle_is_admin());
create or replace function public.mingle_check_mute(uid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.user_restrictions where user_id=uid and (muted_until='infinity'::timestamptz or muted_until>now())) then
  raise exception 'Je account is tijdelijk beperkt. Je kunt nu geen berichten, reacties of interacties plaatsen.';
 end if;
end $$;
create or replace function public.mingle_mute_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare uid uuid;
begin
 uid:=case TG_TABLE_NAME
 when 'posts' then NEW.author_id
 when 'post_replies' then NEW.author_id
 when 'post_likes' then NEW.user_id
 when 'reply_likes' then NEW.user_id
 when 'post_reposts' then NEW.user_id
 when 'post_bookmarks' then NEW.user_id
 when 'community_posts' then NEW.author_id
 when 'community_replies' then NEW.author_id
 when 'dm_messages' then NEW.sender_id
 when 'follows' then NEW.follower_id
 when 'community_members' then NEW.user_id
 else null end;
 if uid is not null then perform public.mingle_check_mute(uid); end if;
 return NEW;
end $$;
do $$ declare t text; begin
 foreach t in array array['posts','post_replies','post_likes','reply_likes','post_reposts','post_bookmarks','community_posts','community_replies','dm_messages','follows','community_members'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop trigger if exists mingle_mute_guard on public.%I',t);
   execute format('create trigger mingle_mute_guard before insert or update on public.%I for each row execute function public.mingle_mute_trigger()',t);
  end if;
 end loop;
end $$;
create or replace function public.admin_set_mute(target uuid, duration_minutes integer, mute_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare until_at timestamptz;
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 if target=auth.uid() then raise exception 'Je kunt jezelf niet muten';end if;
 if not exists(select 1 from public.profiles where id=target) then raise exception 'Account niet gevonden';end if;
 if exists(select 1 from public.profiles where id=target and role='admin') then raise exception 'Adminaccounts kunnen niet worden gemutet';end if;
 if duration_minutes not in(0,60,1440,10080,43200,-1) then raise exception 'Ongeldige duur';end if;
 until_at:=case when duration_minutes=0 then null when duration_minutes=-1 then 'infinity'::timestamptz else now()+make_interval(mins=>duration_minutes) end;
 insert into public.user_restrictions(user_id,muted_until,reason,updated_by,updated_at)
 values(target,until_at,left(coalesce(mute_reason,''),300),auth.uid(),now())
 on conflict(user_id) do update set muted_until=excluded.muted_until,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=now();
 insert into public.admin_audit_logs(actor_id,action,target_id,details)
 values(auth.uid(),case when duration_minutes=0 then 'user_unmuted' else 'user_muted' end,target,jsonb_build_object('duration_minutes',duration_minutes,'reason',left(coalesce(mute_reason,''),300)));
end $$;
create or replace function public.admin_create_announcement(a_title text,a_body text,a_tone text)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 insert into public.platform_announcements(title,body,tone,created_by) values(trim(a_title),trim(a_body),a_tone,auth.uid()) returning id into new_id;
 insert into public.admin_audit_logs(actor_id,action,target_id,details) values(auth.uid(),'announcement_created',new_id,jsonb_build_object('title',left(a_title,100),'tone',a_tone));
 return new_id;
end $$;
create or replace function public.admin_set_announcement_active(a_id uuid,a_active boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 update public.platform_announcements set active=a_active where id=a_id;
 if not found then raise exception 'Aankondiging niet gevonden';end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,details) values(auth.uid(),'announcement_status',a_id,jsonb_build_object('active',a_active));
end $$;
revoke all on function public.mingle_check_mute(uuid),public.admin_set_mute(uuid,integer,text),public.admin_create_announcement(text,text,text),public.admin_set_announcement_active(uuid,boolean) from public;
grant execute on function public.admin_set_mute(uuid,integer,text),public.admin_create_announcement(text,text,text),public.admin_set_announcement_active(uuid,boolean) to authenticated;
grant select on public.user_restrictions,public.platform_announcements to authenticated;
-- Realtime updates: polling fallback remains available in the UI.
do $$ begin
 begin alter publication supabase_realtime add table public.platform_announcements; exception when duplicate_object then null; end;
end $$;
