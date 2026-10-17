-- Temporary, opt-in group location sharing. Apply after the group chat migrations.
create table if not exists public.mingle_group_locations (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.mingle_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 expires_at timestamptz not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists mingle_group_locations_group_idx on public.mingle_group_locations(group_id,expires_at);
alter table public.mingle_group_locations enable row level security;
create policy "group members can view active shared locations" on public.mingle_group_locations for select to authenticated
 using (public.mingle_group_member(group_id) and active and expires_at>now());
create or replace function public.mingle_group_location_start(g uuid, lat double precision, lon double precision, minutes integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare loc uuid;
begin
 if not public.mingle_group_member(g) then raise exception 'Geen toegang tot deze groep'; end if;
 if minutes not in (15,60,480) then raise exception 'Ongeldige duur'; end if;
 if lat is null or lon is null or lat not between -90 and 90 or lon not between -180 and 180 then raise exception 'Ongeldige locatie'; end if;
 update public.mingle_group_locations set active=false where group_id=g and user_id=auth.uid() and active;
 insert into public.mingle_group_locations(group_id,user_id,latitude,longitude,expires_at)
 values(g,auth.uid(),round(lat::numeric,3)::double precision,round(lon::numeric,3)::double precision,now()+make_interval(mins=>minutes)) returning id into loc;
 return loc;
end $$;
create or replace function public.mingle_group_location_update(loc uuid,lat double precision,lon double precision)
returns void language plpgsql security definer set search_path=public as $$
begin
 if lat is null or lon is null or lat not between -90 and 90 or lon not between -180 and 180 then raise exception 'Ongeldige locatie'; end if;
 update public.mingle_group_locations
 set latitude=round(lat::numeric,3)::double precision,longitude=round(lon::numeric,3)::double precision,updated_at=now()
 where id=loc and user_id=auth.uid() and active and expires_at>now()
 and public.mingle_group_member(group_id);
 if not found then raise exception 'Deelsessie verlopen of gestopt'; end if;
end $$;
create or replace function public.mingle_group_location_stop(loc uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.mingle_group_locations set active=false where id=loc and user_id=auth.uid();
end $$;
revoke all on function public.mingle_group_location_start(uuid,double precision,double precision,integer),public.mingle_group_location_update(uuid,double precision,double precision),public.mingle_group_location_stop(uuid) from public;
grant execute on function public.mingle_group_location_start(uuid,double precision,double precision,integer),public.mingle_group_location_update(uuid,double precision,double precision),public.mingle_group_location_stop(uuid) to authenticated;
-- Clean up expired or stopped coordinates using Supabase scheduled maintenance:
-- delete from public.mingle_group_locations where not active or expires_at<=now();
