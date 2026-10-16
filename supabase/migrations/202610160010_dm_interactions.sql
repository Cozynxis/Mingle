-- Mingle DM interactions: secure reply, emoji toggles, forwarding, presence and unread counters.
alter table public.dm_messages add column if not exists reply_to uuid references public.dm_messages(id) on delete set null;
create table if not exists public.dm_message_reactions(
 message_id uuid not null references public.dm_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check(char_length(emoji) between 1 and 12),
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,emoji)
);
alter table public.dm_message_reactions enable row level security;
drop policy if exists "DM participants see reactions" on public.dm_message_reactions;
create policy "DM participants see reactions" on public.dm_message_reactions for select to authenticated using(
 exists(select 1 from public.dm_messages m join public.dm_connections c on c.id=m.connection_id where m.id=message_id and c.status='accepted' and auth.uid() in(c.requester_id,c.recipient_id))
);
create table if not exists public.dm_presence(
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_seen timestamptz not null default now()
);
alter table public.dm_presence enable row level security;
drop policy if exists "Signed in users see presence" on public.dm_presence;
create policy "Signed in users see presence" on public.dm_presence for select to authenticated using(true);
create or replace function public.dm_heartbeat()
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Niet ingelogd';end if;
 insert into public.dm_presence(user_id,last_seen) values(auth.uid(),now())
 on conflict(user_id) do update set last_seen=excluded.last_seen;
end $$;
create or replace function public.dm_toggle_reaction(message_id uuid, reaction text)
returns void language plpgsql security definer set search_path=public as $$
declare m public.dm_messages; me uuid:=auth.uid();
begin
 select * into m from public.dm_messages where id=message_id;
 if not found or m.deleted_at is not null or not exists(select 1 from public.dm_connections c where c.id=m.connection_id and c.status='accepted' and me in(c.requester_id,c.recipient_id)) then raise exception 'Geen toegang';end if;
 if reaction not in ('👍','❤️','😂','🔥','😮','😢','🎉','💜') then raise exception 'Ongeldige emoji';end if;
 if exists(select 1 from public.dm_message_reactions where dm_message_reactions.message_id=dm_toggle_reaction.message_id and user_id=me and emoji=reaction) then
  delete from public.dm_message_reactions where dm_message_reactions.message_id=dm_toggle_reaction.message_id and user_id=me and emoji=reaction;
 else
  insert into public.dm_message_reactions(message_id,user_id,emoji) values(message_id,me,reaction);
 end if;
end $$;
create or replace function public.dm_send_reply(connection uuid,message_body text,reply_message uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare parent public.dm_messages; result uuid;
begin
 select * into parent from public.dm_messages where id=reply_message;
 if not found or parent.connection_id<>connection or parent.deleted_at is not null then raise exception 'Ongeldig antwoordbericht';end if;
 result:=public.dm_send(connection,message_body,null,null);
 update public.dm_messages set reply_to=reply_message where id=result;
 return result;
end $$;
create or replace function public.dm_forward_message(message_id uuid,target_connection uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare m public.dm_messages; me uuid:=auth.uid(); result uuid;
begin
 select * into m from public.dm_messages where id=message_id;
 if not found or m.deleted_at is not null or not exists(select 1 from public.dm_connections c where c.id=m.connection_id and c.status='accepted' and me in(c.requester_id,c.recipient_id)) then raise exception 'Geen toegang tot bronbericht';end if;
 if not exists(select 1 from public.dm_connections c where c.id=target_connection and c.status='accepted' and me in(c.requester_id,c.recipient_id)) then raise exception 'Geen toegang tot ontvanger';end if;
 if m.attachment_path is not null then raise exception 'Doorsturen van bijlagen is nog niet beschikbaar';end if;
 if length(trim(m.body))=0 then raise exception 'Leeg bericht';end if;
 result:=public.dm_send(target_connection,m.body,null,null);
 return result;
end $$;
create or replace function public.dm_unread_counts()
returns table(connection_id uuid,unread_count bigint) language sql stable security definer set search_path=public as $$
 select m.connection_id,count(*) from public.dm_messages m join public.dm_connections c on c.id=m.connection_id
 where auth.uid() in(c.requester_id,c.recipient_id) and c.status='accepted' and m.sender_id<>auth.uid() and m.read_at is null and m.deleted_at is null
 group by m.connection_id
$$;
revoke all on function public.dm_heartbeat(),public.dm_toggle_reaction(uuid,text),public.dm_send_reply(uuid,text,uuid),public.dm_forward_message(uuid,uuid),public.dm_unread_counts() from public;
grant execute on function public.dm_heartbeat(),public.dm_toggle_reaction(uuid,text),public.dm_send_reply(uuid,text,uuid),public.dm_forward_message(uuid,uuid),public.dm_unread_counts() to authenticated;
do $$ begin alter publication supabase_realtime add table public.dm_message_reactions; exception when duplicate_object then null; end $$;
