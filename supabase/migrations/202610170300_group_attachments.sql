-- Group attachments are private to members, with server-side authorization.
alter table public.mingle_group_messages add column if not exists attachment_path text, add column if not exists attachment_type text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mingle-group-files','mingle-group-files',false,20971520,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','audio/webm','audio/mp4','audio/ogg','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;
create policy "Members upload group files" on storage.objects for insert to authenticated
with check(bucket_id='mingle-group-files' and public.mingle_group_member((storage.foldername(name))[1]::uuid) and (storage.foldername(name))[2]=auth.uid()::text);
create policy "Members view group files" on storage.objects for select to authenticated
using(bucket_id='mingle-group-files' and public.mingle_group_member((storage.foldername(name))[1]::uuid));
create or replace function public.mingle_group_send_file(g uuid, content text, file_path text, file_type text) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid;
begin
 if not public.mingle_group_member(g) then raise exception 'Geen groepslid'; end if;
 if file_path is null or file_path not like g::text||'/'||auth.uid()::text||'/%' then raise exception 'Ongeldig bestandspad'; end if;
 if not exists(select 1 from storage.objects where bucket_id='mingle-group-files' and name=file_path) then raise exception 'Bijlage niet gevonden'; end if;
 insert into public.mingle_group_messages(group_id,sender_id,body,attachment_path,attachment_type)
 values(g,auth.uid(),left(coalesce(content,''),4000),file_path,file_type) returning id into mid;
 return mid;
end $$;
grant execute on function public.mingle_group_send_file(uuid,text,text,text) to authenticated;
