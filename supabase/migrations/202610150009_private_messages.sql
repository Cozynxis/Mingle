-- Private direct messages. Run in Supabase SQL Editor.
alter table public.profiles add column if not exists allow_messages boolean not null default true;
create table if not exists public.dm_connections(
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','blocked')),
 blocked_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(requester_id<>recipient_id),
 check(blocked_by is null or blocked_by=requester_id or blocked_by=recipient_id)
);
create unique index if not exists dm_pair_unique on public.dm_connections(least(requester_id,recipient_id),greatest(requester_id,recipient_id));
create index if not exists dm_connections_requester_idx on public.dm_connections(requester_id);
create index if not exists dm_connections_recipient_idx on public.dm_connections(recipient_id);
create table if not exists public.dm_messages(
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null references public.dm_connections(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null default '',
 attachment_path text,
 attachment_type text,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 check(char_length(body)<=4000),
 check(char_length(trim(body))>0 or attachment_path is not null)
);
create index if not exists dm_messages_thread_idx on public.dm_messages(connection_id,created_at);
alter table public.dm_connections enable row level security;
alter table public.dm_messages enable row level security;
drop policy if exists "DM participants see connections" on public.dm_connections;
create policy "DM participants see connections" on public.dm_connections for select to authenticated using(auth.uid() in(requester_id,recipient_id));
drop policy if exists "DM participants see messages" on public.dm_messages;
create policy "DM participants see messages" on public.dm_messages for select to authenticated using(exists(select 1 from public.dm_connections c where c.id=connection_id and auth.uid() in(c.requester_id,c.recipient_id) and c.status='accepted'));
-- All writes to connections/messages go through server-side functions, not direct table writes.
create or replace function public.dm_request(other_user uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); existing public.dm_connections; result_id uuid;
begin
 if me is null then raise exception 'Log eerst in';end if;
 if other_user is null or other_user=me then raise exception 'Ongeldige gebruiker';end if;
 if not exists(select 1 from public.profiles where id=other_user and allow_messages=true) then raise exception 'Deze gebruiker accepteert geen berichtverzoeken';end if;
 select * into existing from public.dm_connections where least(requester_id,recipient_id)=least(me,other_user) and greatest(requester_id,recipient_id)=greatest(me,other_user) for update;
 if found then
  if existing.status='blocked' then raise exception 'Dit gesprek is geblokkeerd';end if;
  return existing.id;
 end if;
 insert into public.dm_connections(requester_id,recipient_id) values(me,other_user) returning id into result_id;
 return result_id;
end $$;
create or replace function public.dm_respond(connection uuid, action text)
returns void language plpgsql security definer set search_path=public as $$
declare c public.dm_connections; me uuid:=auth.uid();
begin
 select * into c from public.dm_connections where id=connection for update;
 if not found or me not in(c.requester_id,c.recipient_id) then raise exception 'Geen toegang';end if;
 if action='accept' then
  if c.status<>'pending' or c.recipient_id<>me then raise exception 'Verzoek kan niet worden geaccepteerd';end if;
  update public.dm_connections set status='accepted',updated_at=now() where id=connection;
 elsif action='reject' then
  if c.status<>'pending' or c.recipient_id<>me then raise exception 'Verzoek kan niet worden geweigerd';end if;
  delete from public.dm_connections where id=connection;
 elsif action='remove' then
  if c.status='blocked' and c.blocked_by<>me then raise exception 'Geblokkeerd gesprek kan niet verwijderd worden';end if;
  delete from public.dm_connections where id=connection;
 elsif action='block' then
  update public.dm_connections set status='blocked',blocked_by=me,updated_at=now() where id=connection;
 elsif action='unblock' then
  if c.status<>'blocked' or c.blocked_by<>me then raise exception 'Je kunt dit gesprek niet deblokkeren';end if;
  delete from public.dm_connections where id=connection;
 else raise exception 'Ongeldige actie';end if;
end $$;
create or replace function public.dm_send(connection uuid, message_body text, file_path text default null, file_type text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.dm_connections; me uuid:=auth.uid(); new_id uuid;
begin
 select * into c from public.dm_connections where id=connection for update;
 if not found or c.status<>'accepted' or me not in(c.requester_id,c.recipient_id) then raise exception 'Geen toestemming om berichten te sturen';end if;
 if char_length(coalesce(message_body,''))>4000 or (char_length(trim(coalesce(message_body,'')))=0 and file_path is null) then raise exception 'Ongeldig bericht';end if;
 if file_path is not null and (split_part(file_path,'/',1)<>me::text or split_part(file_path,'/',2)<>connection::text) then raise exception 'Ongeldig bijlagepad';end if;
 insert into public.dm_messages(connection_id,sender_id,body,attachment_path,attachment_type) values(connection,me,coalesce(message_body,''),file_path,file_type) returning id into new_id;
 return new_id;
end $$;
create or replace function public.dm_mark_read(connection uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c public.dm_connections; me uuid:=auth.uid();
begin
 select * into c from public.dm_connections where id=connection;
 if not found or c.status<>'accepted' or me not in(c.requester_id,c.recipient_id) then raise exception 'Geen toegang';end if;
 update public.dm_messages set read_at=now() where connection_id=connection and sender_id<>me and read_at is null;
end $$;
revoke all on function public.dm_request(uuid) from public;
revoke all on function public.dm_respond(uuid,text) from public;
revoke all on function public.dm_send(uuid,text,text,text) from public;
revoke all on function public.dm_mark_read(uuid) from public;
grant execute on function public.dm_request(uuid),public.dm_respond(uuid,text),public.dm_send(uuid,text,text,text),public.dm_mark_read(uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dm-attachments','dm-attachments',false,20971520,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "DM private file read" on storage.objects;
create policy "DM private file read" on storage.objects for select to authenticated using(
 bucket_id='dm-attachments' and exists(select 1 from public.dm_connections c where c.id=(case when (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' then (storage.foldername(name))[2]::uuid else null end) and c.status='accepted' and auth.uid() in(c.requester_id,c.recipient_id))
);
drop policy if exists "DM own file upload" on storage.objects;
create policy "DM own file upload" on storage.objects for insert to authenticated with check(
 bucket_id='dm-attachments' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.dm_connections c where c.id=(case when (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' then (storage.foldername(name))[2]::uuid else null end) and c.status='accepted' and auth.uid() in(c.requester_id,c.recipient_id))
);
do $$ begin alter publication supabase_realtime add table public.dm_messages;exception when duplicate_object then null;end $$;
do $$ begin alter publication supabase_realtime add table public.dm_connections;exception when duplicate_object then null;end $$;
