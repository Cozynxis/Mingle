-- Mingle Premium foundation. Run manually in Supabase SQL Editor.
create table if not exists public.premium_subscriptions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'active' check(status in ('active','cancelled','expired')),
 expires_at timestamptz,
 granted_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.premium_subscriptions enable row level security;
drop policy if exists "premium_subscriptions_read_own" on public.premium_subscriptions;
create policy "premium_subscriptions_read_own" on public.premium_subscriptions for select to authenticated using (user_id=auth.uid() or public.mingle_is_admin());

create table if not exists public.premium_styles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 frame text not null default 'none',
 profile_accent text not null default '#9068e8',
 app_theme text not null default 'default',
 app_accent text not null default '#9068e8',
 name_effect text not null default 'none',
 presets jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.premium_styles enable row level security;
drop policy if exists "premium_styles_read" on public.premium_styles;
create policy "premium_styles_read" on public.premium_styles for select to authenticated using (true);

create or replace function public.mingle_has_premium(uid uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.premium_subscriptions where user_id=uid and status='active' and (expires_at is null or expires_at>now()))
$$;
revoke all on function public.mingle_has_premium(uuid) from public;
grant execute on function public.mingle_has_premium(uuid) to authenticated;

create or replace function public.premium_save_style(
 a_frame text, a_profile_accent text, a_app_theme text, a_app_accent text, a_name_effect text, a_presets jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_has_premium(auth.uid()) then raise exception 'Premium is vereist';end if;
 if a_frame not in ('none','gold','neon','galaxy') or a_app_theme not in ('default','midnight','aurora','ocean','royal') or a_name_effect not in ('none','gradient','glow') or
 a_profile_accent !~ '^#[0-9a-fA-F]{6}$' or a_app_accent !~ '^#[0-9a-fA-F]{6}$' or jsonb_typeof(a_presets) <> 'array' or jsonb_array_length(a_presets)>5 then raise exception 'Ongeldige Premium-stijl';end if;
 insert into public.premium_styles(user_id,frame,profile_accent,app_theme,app_accent,name_effect,presets,updated_at)
 values(auth.uid(),a_frame,a_profile_accent,a_app_theme,a_app_accent,a_name_effect,a_presets,now())
 on conflict(user_id) do update set frame=excluded.frame,profile_accent=excluded.profile_accent,app_theme=excluded.app_theme,app_accent=excluded.app_accent,name_effect=excluded.name_effect,presets=excluded.presets,updated_at=now();
end $$;
revoke all on function public.premium_save_style(text,text,text,text,text,jsonb) from public;
grant execute on function public.premium_save_style(text,text,text,text,text,jsonb) to authenticated;

create or replace function public.admin_set_premium(target uuid, duration_days integer)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen toegang';end if;
 if duration_days < -1 or duration_days > 3650 then raise exception 'Ongeldige duur';end if;
 if duration_days=0 then
  update public.premium_subscriptions set status='cancelled',expires_at=now(),updated_at=now(),granted_by=auth.uid() where user_id=target;
 else
  insert into public.premium_subscriptions(user_id,status,expires_at,granted_by)
  values(target,'active',case when duration_days=-1 then null else now()+make_interval(days=>duration_days) end,auth.uid())
  on conflict(user_id) do update set status='active',expires_at=excluded.expires_at,granted_by=auth.uid(),updated_at=now();
 end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,details) values(auth.uid(),'premium_access_changed',target,jsonb_build_object('duration_days',duration_days));
end $$;
revoke all on function public.admin_set_premium(uuid,integer) from public;
grant execute on function public.admin_set_premium(uuid,integer) to authenticated;

-- Future billing must be implemented with a payment provider's verified server-side webhooks.
-- Never allow clients to write premium_subscriptions or activate paid access directly.
