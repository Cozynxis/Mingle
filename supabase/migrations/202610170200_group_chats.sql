-- Mingle group chats: max 20 members, server-enforced admin privileges and polls
create table if not exists public.mingle_groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 70),
 description text not null default '' check (char_length(description)<=500),
 icon_url text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.mingle_group_members (
 group_id uuid not null references public.mingle_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 is_admin boolean not null default false,
 joined_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create table if not exists public.mingle_group_messages (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.mingle_groups(id) on delete cascade,
 sender_id uuid not null references auth.users(id),
 body text not null default '' check(char_length(body)<=4000),
 pinned boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.mingle_group_polls (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.mingle_groups(id) on delete cascade,
 message_id uuid unique not null references public.mingle_group_messages(id) on delete cascade,
 question text not null check(char_length(question) between 1 and 250),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 8),
 expires_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.mingle_group_votes (
 poll_id uuid not null references public.mingle_group_polls(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 option_index integer not null check(option_index between 0 and 7),
 primary key(poll_id,user_id)
);
create index if not exists mingle_group_messages_idx on public.mingle_group_messages(group_id,created_at);
create index if not exists mingle_group_members_user_idx on public.mingle_group_members(user_id);
create or replace function public.mingle_group_member(g uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.mingle_group_members where group_id=g and user_id=auth.uid())
$$;
create or replace function public.mingle_group_admin(g uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.mingle_group_members where group_id=g and user_id=auth.uid() and is_admin)
$$;
alter table public.mingle_groups enable row level security;
alter table public.mingle_group_members enable row level security;
alter table public.mingle_group_messages enable row level security;
alter table public.mingle_group_polls enable row level security;
alter table public.mingle_group_votes enable row level security;
create policy "groups visible to members" on public.mingle_groups for select to authenticated using (public.mingle_group_member(id));
create policy "members visible to members" on public.mingle_group_members for select to authenticated using (public.mingle_group_member(group_id));
create policy "messages visible to members" on public.mingle_group_messages for select to authenticated using (public.mingle_group_member(group_id));
create policy "polls visible to members" on public.mingle_group_polls for select to authenticated using (public.mingle_group_member(group_id));
create policy "votes visible to members" on public.mingle_group_votes for select to authenticated using (exists(select 1 from public.mingle_group_polls p where p.id=poll_id and public.mingle_group_member(p.group_id)));
create or replace function public.mingle_group_create(group_name text, group_description text default '') returns uuid language plpgsql security definer set search_path=public as $$
declare gid uuid;
begin
 if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
 insert into public.mingle_groups(name,description,created_by) values(trim(group_name),left(coalesce(group_description,''),500),auth.uid()) returning id into gid;
 insert into public.mingle_group_members(group_id,user_id,is_admin) values(gid,auth.uid(),true);
 return gid;
end $$;
create or replace function public.mingle_group_manage(g uuid, action text, target uuid default null, new_value text default null) returns void language plpgsql security definer set search_path=public as $$
declare total integer; admins integer;
begin
 if not public.mingle_group_admin(g) then raise exception 'Alleen groepsbeheerders'; end if;
 if action='add' then
  if target is null or not exists(select 1 from public.profiles where id=target) then raise exception 'Gebruiker niet gevonden'; end if;
  select count(*) into total from public.mingle_group_members where group_id=g;
  if total>=20 then raise exception 'Maximaal 20 groepsleden'; end if;
  insert into public.mingle_group_members(group_id,user_id) values(g,target) on conflict do nothing;
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
 elsif action='name' then
  update public.mingle_groups set name=trim(new_value) where id=g;
 elsif action='description' then
  update public.mingle_groups set description=coalesce(new_value,'') where id=g;
 elsif action='icon' then
  if new_value is not null and new_value !~ '^https://' then raise exception 'Alleen veilige HTTPS-afbeeldingen'; end if;
  update public.mingle_groups set icon_url=new_value where id=g;
 else raise exception 'Onbekende actie'; end if;
end $$;
create or replace function public.mingle_group_send(g uuid, content text) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid;
begin
 if not public.mingle_group_member(g) then raise exception 'Geen groepslid'; end if;
 if char_length(trim(coalesce(content,'')))<1 then raise exception 'Leeg bericht'; end if;
 insert into public.mingle_group_messages(group_id,sender_id,body) values(g,auth.uid(),trim(content)) returning id into mid;
 return mid;
end $$;
create or replace function public.mingle_group_pin(mid uuid, pin boolean) returns void language plpgsql security definer set search_path=public as $$
declare g uuid;
begin
 select group_id into g from public.mingle_group_messages where id=mid;
 if not public.mingle_group_admin(g) then raise exception 'Alleen beheerders kunnen vastzetten'; end if;
 update public.mingle_group_messages set pinned=pin where id=mid;
end $$;
create or replace function public.mingle_group_poll_create(g uuid, poll_question text, poll_options text[], duration_minutes integer default null) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid; pid uuid;
begin
 if not public.mingle_group_member(g) then raise exception 'Geen groepslid'; end if;
 if array_length(poll_options,1) not between 2 and 8 or exists(select 1 from unnest(poll_options) o where length(trim(o))<1 or length(o)>100) then raise exception '2 tot 8 geldige opties vereist'; end if;
 if duration_minutes is not null and duration_minutes not between 1 and 10080 then raise exception 'Ongeldige looptijd'; end if;
 insert into public.mingle_group_messages(group_id,sender_id,body) values(g,auth.uid(),'📊 '||poll_question) returning id into mid;
 insert into public.mingle_group_polls(group_id,message_id,question,options,expires_at) values(g,mid,poll_question,to_jsonb(poll_options),case when duration_minutes is null then null else now()+make_interval(mins=>duration_minutes) end) returning id into pid;
 return pid;
end $$;
create or replace function public.mingle_group_vote(pid uuid, choice integer) returns void language plpgsql security definer set search_path=public as $$
declare p public.mingle_group_polls%rowtype;
begin
 select * into p from public.mingle_group_polls where id=pid;
 if p.id is null or not public.mingle_group_member(p.group_id) then raise exception 'Geen toegang'; end if;
 if p.expires_at is not null and p.expires_at<=now() then raise exception 'Poll is gesloten'; end if;
 if choice<0 or choice>=jsonb_array_length(p.options) then raise exception 'Ongeldige keuze'; end if;
 insert into public.mingle_group_votes(poll_id,user_id,option_index) values(pid,auth.uid(),choice) on conflict(poll_id,user_id) do update set option_index=excluded.option_index;
end $$;
revoke all on function public.mingle_group_member(uuid),public.mingle_group_admin(uuid) from public;
grant execute on function public.mingle_group_member(uuid),public.mingle_group_admin(uuid) to authenticated;
grant execute on function public.mingle_group_create(text,text),public.mingle_group_manage(uuid,text,uuid,text),public.mingle_group_send(uuid,text),public.mingle_group_pin(uuid,boolean),public.mingle_group_poll_create(uuid,text,text[],integer),public.mingle_group_vote(uuid,integer) to authenticated;
