-- Premium redemption codes replace all Mollie payments.
-- Run in Supabase SQL Editor AFTER 202610160001_premium_foundation.sql.
create extension if not exists pgcrypto;
create table if not exists public.premium_codes (
 id uuid primary key default gen_random_uuid(),
 label text not null,
 code_hash text not null unique,
 code_hint text not null,
 duration_days integer not null check(duration_days=-1 or duration_days between 1 and 3650),
 max_uses integer check(max_uses is null or max_uses between 1 and 1000000),
 used_count integer not null default 0 check(used_count>=0),
 expires_at timestamptz,
 enabled boolean not null default true,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint premium_code_limit check(max_uses is null or used_count<=max_uses)
);
create table if not exists public.premium_code_redemptions (
 id uuid primary key default gen_random_uuid(),
 code_id uuid not null references public.premium_codes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 redeemed_at timestamptz not null default now(),
 granted_until timestamptz,
 unique(code_id,user_id)
);
create index if not exists premium_code_redemptions_user_idx on public.premium_code_redemptions(user_id);
alter table public.premium_codes enable row level security;
alter table public.premium_code_redemptions enable row level security;
drop policy if exists "premium_codes_admin_read" on public.premium_codes;
create policy "premium_codes_admin_read" on public.premium_codes for select to authenticated using(public.mingle_is_admin());
drop policy if exists "premium_redemptions_admin_read" on public.premium_code_redemptions;
create policy "premium_redemptions_admin_read" on public.premium_code_redemptions for select to authenticated using(public.mingle_is_admin());
-- Never grant client INSERT, UPDATE or DELETE on either table.
-- Codes are stored as SHA-256 digests and revealed only at creation.
create or replace function public.admin_create_premium_code(
 p_label text,p_code text,p_duration_days integer,p_max_uses integer default null,p_expires_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=public,extensions as $body$
declare v_id uuid;v_code text:=upper(trim(p_code));
begin
 if not public.mingle_is_admin() then raise exception 'Geen toegang';end if;
 if length(trim(p_label)) not between 1 and 80 or v_code !~ '^[A-Z0-9-]{8,64}$'
 or (p_duration_days<>-1 and p_duration_days not between 1 and 3650)
 or (p_max_uses is not null and p_max_uses not between 1 and 1000000)
 or (p_expires_at is not null and p_expires_at<=now())
 then raise exception 'Ongeldige code-instellingen';end if;
 insert into public.premium_codes(label,code_hash,code_hint,duration_days,max_uses,expires_at,created_by)
 values(trim(p_label),encode(digest(v_code,'sha256'),'hex'),right(v_code,4),p_duration_days,p_max_uses,p_expires_at,auth.uid()) returning id into v_id;
 insert into public.admin_audit_logs(actor_id,action,target_id,details)
 values(auth.uid(),'premium_code_created',v_id,jsonb_build_object('label',trim(p_label),'duration_days',p_duration_days,'max_uses',p_max_uses));
 return v_id;
end $body$;

create or replace function public.admin_update_premium_code(
 p_id uuid,p_label text,p_max_uses integer,p_expires_at timestamptz,p_enabled boolean
) returns void language plpgsql security definer set search_path=public,extensions as $body$
declare v_used integer;
begin
 if not public.mingle_is_admin() then raise exception 'Geen toegang';end if;
 select used_count into v_used from public.premium_codes where id=p_id for update;
 if not found then raise exception 'Code niet gevonden';end if;
 if length(trim(p_label)) not between 1 and 80
 or (p_max_uses is not null and (p_max_uses<v_used or p_max_uses>1000000 or p_max_uses<1))
 then raise exception 'Ongeldige instellingen';end if;
 update public.premium_codes set label=trim(p_label),max_uses=p_max_uses,expires_at=p_expires_at,enabled=p_enabled,updated_at=now() where id=p_id;
 insert into public.admin_audit_logs(actor_id,action,target_id,details)
 values(auth.uid(),'premium_code_updated',p_id,jsonb_build_object('enabled',p_enabled,'max_uses',p_max_uses));
end $body$;

create or replace function public.admin_delete_premium_code(p_id uuid)
returns void language plpgsql security definer set search_path=public,extensions as $body$
begin
 if not public.mingle_is_admin() then raise exception 'Geen toegang';end if;
 -- Preserve redemption history: deleting a code means disabling it.
 update public.premium_codes set enabled=false,updated_at=now() where id=p_id;
 if not found then raise exception 'Code niet gevonden';end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,details)
 values(auth.uid(),'premium_code_disabled',p_id,'{}'::jsonb);
end $body$;

create or replace function public.redeem_premium_code(p_code text)
returns timestamptz language plpgsql security definer set search_path=public,extensions as $body$
declare v_code public.premium_codes%rowtype;v_current public.premium_subscriptions%rowtype;v_until timestamptz;v_base timestamptz;
begin
 if auth.uid() is null then raise exception 'Log eerst in';end if;
 if p_code is null or length(p_code)>128 then raise exception 'Ongeldige code';end if;
 select * into v_code from public.premium_codes
 where code_hash=encode(digest(upper(trim(p_code)),'sha256'),'hex') for update;
 if not found or not v_code.enabled or (v_code.expires_at is not null and v_code.expires_at<=now())
 then raise exception 'Deze code is ongeldig of verlopen';end if;
 if v_code.max_uses is not null and v_code.used_count>=v_code.max_uses
 then raise exception 'Deze code is volledig gebruikt';end if;
 if exists(select 1 from public.premium_code_redemptions where code_id=v_code.id and user_id=auth.uid())
 then raise exception 'Je hebt deze code al gebruikt';end if;
 select * into v_current from public.premium_subscriptions where user_id=auth.uid() for update;
 if v_current.user_id is not null and v_current.status='active' and v_current.expires_at is null
 then raise exception 'Je hebt al onbeperkt Premium';end if;
 v_base:=greatest(now(),coalesce(case when v_current.status='active' then v_current.expires_at end,now()));
 if v_code.duration_days=-1 then v_until:=null;
 else v_until:=v_base+make_interval(days=>v_code.duration_days);end if;
 insert into public.premium_code_redemptions(code_id,user_id,granted_until)
 values(v_code.id,auth.uid(),v_until);
 update public.premium_codes set used_count=used_count+1,updated_at=now() where id=v_code.id;
 insert into public.premium_subscriptions(user_id,status,expires_at,granted_by,updated_at)
 values(auth.uid(),'active',v_until,v_code.created_by,now())
 on conflict(user_id) do update set status='active',expires_at=excluded.expires_at,granted_by=excluded.granted_by,updated_at=now();
 return v_until;
end $body$;
revoke all on function public.admin_create_premium_code(text,text,integer,integer,timestamptz) from public;
revoke all on function public.admin_update_premium_code(uuid,text,integer,timestamptz,boolean) from public;
revoke all on function public.admin_delete_premium_code(uuid) from public;
revoke all on function public.redeem_premium_code(text) from public;
grant execute on function public.admin_create_premium_code(text,text,integer,integer,timestamptz) to authenticated;
grant execute on function public.admin_update_premium_code(uuid,text,integer,timestamptz,boolean) to authenticated;
grant execute on function public.admin_delete_premium_code(uuid) to authenticated;
grant execute on function public.redeem_premium_code(text) to authenticated;
-- Remove unused Mollie test tables. No payment keys are used by the code system.
drop table if exists public.mollie_payment_events;
drop table if exists public.mollie_billing;
