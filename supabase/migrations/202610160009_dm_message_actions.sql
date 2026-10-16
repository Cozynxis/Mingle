-- Mingle v1.7.0: edit, soft-delete, and clear a complete DM conversation.
alter table public.dm_messages add column if not exists edited_at timestamptz;
alter table public.dm_messages add column if not exists deleted_at timestamptz;
-- Soft-deleted messages cannot keep media references.
alter table public.dm_messages drop constraint if exists dm_messages_check;
alter table public.dm_messages drop constraint if exists dm_messages_check1;
alter table public.dm_messages add constraint dm_messages_max_body_length check(char_length(body)<=4000);
alter table public.dm_messages add constraint dm_messages_nonempty_or_deleted check (deleted_at is not null or char_length(trim(body))>0 or attachment_path is not null);
create or replace function public.dm_edit_message(message_id uuid, new_body text)
returns void language plpgsql security definer set search_path=public as $$
declare m public.dm_messages; me uuid:=auth.uid();
begin
 select * into m from public.dm_messages where id=message_id for update;
 if not found or m.sender_id is distinct from me or m.deleted_at is not null then raise exception 'Je kunt dit bericht niet bewerken'; end if;
 if m.attachment_path is not null then raise exception 'Bijlagen kunnen niet worden bewerkt'; end if;
 if char_length(trim(coalesce(new_body,'')))=0 or char_length(new_body)>4000 then raise exception 'Voer een bericht van maximaal 4000 tekens in'; end if;
 if not exists(select 1 from public.dm_connections c where c.id=m.connection_id and c.status='accepted' and me in(c.requester_id,c.recipient_id)) then raise exception 'Geen toegang'; end if;
 update public.dm_messages set body=trim(new_body),edited_at=now() where id=message_id;
end $$;
create or replace function public.dm_delete_message(message_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare m public.dm_messages; me uuid:=auth.uid(); removed_path text;
begin
 select * into m from public.dm_messages where id=message_id for update;
 if not found or m.sender_id is distinct from me or m.deleted_at is not null then raise exception 'Je kunt dit bericht niet verwijderen'; end if;
 if not exists(select 1 from public.dm_connections c where c.id=m.connection_id and c.status='accepted' and me in(c.requester_id,c.recipient_id)) then raise exception 'Geen toegang'; end if;
 removed_path:=m.attachment_path;
 update public.dm_messages set body='',attachment_path=null,attachment_type=null,deleted_at=now(),edited_at=null where id=message_id;
 return removed_path;
end $$;
create or replace function public.dm_clear_chat(connection uuid)
returns text[] language plpgsql security definer set search_path=public as $$
declare c public.dm_connections; me uuid:=auth.uid(); paths text[];
begin
 select * into c from public.dm_connections where id=connection for update;
 if not found or me not in(c.requester_id,c.recipient_id) then raise exception 'Geen toegang'; end if;
 select coalesce(array_agg(attachment_path) filter(where attachment_path is not null),array[]::text[]) into paths from public.dm_messages where connection_id=connection;
 delete from public.dm_messages where connection_id=connection;
 return paths;
end $$;
revoke all on function public.dm_edit_message(uuid,text),public.dm_delete_message(uuid),public.dm_clear_chat(uuid) from public;
grant execute on function public.dm_edit_message(uuid,text),public.dm_delete_message(uuid),public.dm_clear_chat(uuid) to authenticated;
