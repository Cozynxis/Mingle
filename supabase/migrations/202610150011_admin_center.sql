-- Mingle Admin Center. Run once in Supabase SQL Editor.
-- Grant admin to your existing account first:
-- UPDATE public.profiles SET role='admin' WHERE id='YOUR_AUTH_USER_UUID';
create table if not exists public.profile_badges(
 user_id uuid not null references public.profiles(id) on delete cascade,
 badge text not null check(badge in('verified','official','premium')),
 granted_at timestamptz not null default now(),
 granted_by uuid references public.profiles(id),
 primary key(user_id,badge)
);
create table if not exists public.admin_audit_logs(
 id bigint generated always as identity primary key,
 actor_id uuid not null references public.profiles(id),
 action text not null,
 target_id uuid,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.admin_settings(
 key text primary key,
 value text not null,
 updated_at timestamptz not null default now()
);
insert into public.admin_settings(key,value) values('maintenance_notice',''),('registration_enabled','true') on conflict(key) do nothing;
alter table public.profile_badges enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_settings enable row level security;
create or replace function public.mingle_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin')
$$;
revoke all on function public.mingle_is_admin() from public;
grant execute on function public.mingle_is_admin() to authenticated;
drop policy if exists "Read profile badges" on public.profile_badges;
create policy "Read profile badges" on public.profile_badges for select to authenticated using(true);
drop policy if exists "Admins read audit logs" on public.admin_audit_logs;
create policy "Admins read audit logs" on public.admin_audit_logs for select to authenticated using(public.mingle_is_admin());
drop policy if exists "Admins read settings" on public.admin_settings;
create policy "Admins read settings" on public.admin_settings for select to authenticated using(public.mingle_is_admin());
-- All admin mutations use narrowly scoped security-definer RPCs.
create or replace function public.admin_set_badge(target uuid,badge_name text,enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 if badge_name not in('verified','official','premium') then raise exception 'Ongeldige badge';end if;
 if enabled then
 insert into public.profile_badges(user_id,badge,granted_by) values(target,badge_name,auth.uid())
 on conflict(user_id,badge) do nothing;
 else
 delete from public.profile_badges where user_id=target and badge=badge_name;
 end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,details) values(auth.uid(),'badge_changed',target,jsonb_build_object('badge',badge_name,'enabled',enabled));
end $$;
create or replace function public.admin_update_profile(target uuid,changes jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 if changes ? 'display_name' and (char_length(trim(changes->>'display_name'))<1 or char_length(changes->>'display_name')>80) then raise exception 'Ongeldige naam';end if;
 if changes ? 'bio' and char_length(changes->>'bio')>500 then raise exception 'Bio is te lang';end if;
 update public.profiles set
 display_name=coalesce(changes->>'display_name',display_name),
 bio=coalesce(changes->>'bio',bio)
 where id=target;
 if not found then raise exception 'Profiel niet gevonden';end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,details) values(auth.uid(),'profile_updated',target,changes);
end $$;
create or replace function public.admin_delete_post(pid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 delete from public.posts where id=pid;
 if not found then raise exception 'Post niet gevonden';end if;
 insert into public.admin_audit_logs(actor_id,action,target_id) values(auth.uid(),'post_deleted',pid);
end $$;
create or replace function public.admin_delete_community(cid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 delete from public.communities where id=cid;
 if not found then raise exception 'Community niet gevonden';end if;
 insert into public.admin_audit_logs(actor_id,action,target_id) values(auth.uid(),'community_deleted',cid);
end $$;
create or replace function public.admin_save_setting(setting_key text,setting_value text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 if setting_key not in('maintenance_notice','registration_enabled') then raise exception 'Onbekende instelling';end if;
 if setting_key='registration_enabled' and setting_value not in('true','false') then raise exception 'Ongeldige waarde';end if;
 if char_length(setting_value)>1000 then raise exception 'Waarde te lang';end if;
 insert into public.admin_settings(key,value,updated_at) values(setting_key,setting_value,now())
 on conflict(key) do update set value=excluded.value,updated_at=now();
 insert into public.admin_audit_logs(actor_id,action,details) values(auth.uid(),'setting_changed',jsonb_build_object('key',setting_key));
end $$;
revoke all on function public.admin_set_badge(uuid,text,boolean),public.admin_update_profile(uuid,jsonb),public.admin_delete_post(uuid),public.admin_delete_community(uuid),public.admin_save_setting(text,text) from public;
grant execute on function public.admin_set_badge(uuid,text,boolean),public.admin_update_profile(uuid,jsonb),public.admin_delete_post(uuid),public.admin_delete_community(uuid),public.admin_save_setting(text,text) to authenticated;
-- Admin-only reads are protected by RLS (not by UI).
drop policy if exists "Admin view profiles" on public.profiles;
create policy "Admin view profiles" on public.profiles for select to authenticated using(public.mingle_is_admin());
drop policy if exists "Admin view posts" on public.posts;
create policy "Admin view posts" on public.posts for select to authenticated using(public.mingle_is_admin());
drop policy if exists "Admin view communities" on public.communities;
create policy "Admin view communities" on public.communities for select to authenticated using(public.mingle_is_admin());
