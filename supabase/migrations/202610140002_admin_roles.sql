-- Admin role is server-controlled; never assign from browser code.
alter table public.profiles add column if not exists role text not null default 'member' check (role in ('member','admin'));
-- Prevent regular users from changing their own role or privileged badges.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Only server administrators can change account roles';
  end if;
  return new;
end;$$;
drop trigger if exists protect_profile_role_update on public.profiles;
create trigger protect_profile_role_update before update on public.profiles
for each row execute function public.protect_profile_role();
-- Assign your own admin role in Supabase SQL Editor using your auth.users id:
-- update public.profiles set role = 'admin' where id = 'YOUR_AUTH_USER_UUID';
