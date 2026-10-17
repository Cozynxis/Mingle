-- Invitations are opt-in: group admins cannot directly add members.
create table if not exists public.mingle_group_invite_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 allow_invites boolean not null default true
);
create table if not exists public.mingle_group_invitations (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.mingle_groups(id) on delete cascade,
 invited_user uuid not null references auth.users(id) on delete cascade,
 invited_by uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 unique(group_id,invited_user)
);
alter table public.mingle_group_invite_preferences enable row level security;
alter table public.mingle_group_invitations enable row level security;
create policy "Own group invite settings" on public.mingle_group_invite_preferences for select to authenticated using(user_id=auth.uid());
create policy "Own group invitations" on public.mingle_group_invitations for select to authenticated using(invited_user=auth.uid());
create or replace function public.mingle_group_invite_settings(enabled boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
 insert into public.mingle_group_invite_preferences(user_id,allow_invites) values(auth.uid(),enabled)
 on conflict(user_id) do update set allow_invites=excluded.allow_invites;
end $$;
create or replace function public.mingle_group_invite(g uuid, target uuid) returns void language plpgsql security definer set search_path=public as $$
declare member_count integer;
begin
 if not public.mingle_group_admin(g) then raise exception 'Alleen groepsbeheerders kunnen uitnodigen'; end if;
 if target is null or not exists(select 1 from public.profiles where id=target) then raise exception 'Gebruiker niet gevonden'; end if;
 if target=auth.uid() then raise exception 'Je zit al in deze groep'; end if;
 if exists(select 1 from public.mingle_group_members where group_id=g and user_id=target) then raise exception 'Deze persoon is al lid'; end if;
 if exists(select 1 from public.mingle_group_invite_preferences where user_id=target and not allow_invites) then raise exception 'Deze gebruiker accepteert geen groepsuitnodigingen'; end if;
 select count(*) into member_count from public.mingle_group_members where group_id=g;
 if member_count>=20 then raise exception 'De groep is vol (20 leden)'; end if;
 insert into public.mingle_group_invitations(group_id,invited_user,invited_by,status,responded_at)
 values(g,target,auth.uid(),'pending',null)
 on conflict(group_id,invited_user) do update set status='pending',invited_by=auth.uid(),created_at=now(),responded_at=null;
end $$;
create or replace function public.mingle_group_respond(invitation uuid, accept boolean) returns void language plpgsql security definer set search_path=public as $$
declare inv public.mingle_group_invitations%rowtype; member_count integer;
begin
 select * into inv from public.mingle_group_invitations where id=invitation for update;
 if inv.id is null or inv.invited_user<>auth.uid() or inv.status<>'pending' then raise exception 'Uitnodiging niet beschikbaar'; end if;
 if accept then
  perform 1 from public.mingle_groups where id=inv.group_id for update;
  select count(*) into member_count from public.mingle_group_members where group_id=inv.group_id;
  if member_count>=20 then raise exception 'De groep is inmiddels vol'; end if;
  insert into public.mingle_group_members(group_id,user_id,is_admin) values(inv.group_id,auth.uid(),false) on conflict do nothing;
 end if;
 update public.mingle_group_invitations set status=case when accept then 'accepted' else 'declined' end,responded_at=now() where id=invitation;
end $$;
-- Remove direct member addition from legacy management RPC, including old clients.
create or replace function public.mingle_group_manage(g uuid, action text, target uuid default null, new_value text default null) returns void language plpgsql security definer set search_path=public as $$
declare admins integer;
begin
 if not public.mingle_group_admin(g) then raise exception 'Alleen groepsbeheerders'; end if;
 if action='add' then
  raise exception 'Stuur een groepsuitnodiging; direct toevoegen is niet toegestaan';
 elsif action='kick' then
  if target=(select created_by from public.mingle_groups where id=g) then raise exception 'De oprichter kan niet worden verwijderd'; end if;
  delete from public.mingle_group_members where group_id=g and user_id=target;
 elsif action='promote' then
  update public.mingle_group_members set is_admin=true where group_id=g and user_id=target;
 elsif action='demote' then
  if target=(select created_by from public.mingle_groups where id=g) then raise exception 'De oprichter blijft beheerder'; end if;
  select count(*) into admins from public.mingle_group_members where group_id=g and is_admin;
  if admins<=1 then raise exception 'Minstens één beheerder vereist'; end if;
  update public.mingle_group_members set is_admin=false where group_id=g and user_id=target;
 elsif action='name' then update public.mingle_groups set name=trim(new_value) where id=g;
 elsif action='description' then update public.mingle_groups set description=coalesce(new_value,'') where id=g;
 elsif action='icon' then
  if new_value is not null and new_value !~ '^https://' then raise exception 'Alleen veilige HTTPS-afbeeldingen'; end if;
  update public.mingle_groups set icon_url=new_value where id=g;
 else raise exception 'Onbekende actie'; end if;
end $$;
grant execute on function public.mingle_group_invite_settings(boolean),public.mingle_group_invite(uuid,uuid),public.mingle_group_respond(uuid,boolean) to authenticated;
