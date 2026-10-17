-- Public read-only group icons; uploads only for authenticated group admins in their own group folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mingle-group-icons','mingle-group-icons',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
create policy "Group admins upload icons" on storage.objects for insert to authenticated
with check(bucket_id='mingle-group-icons' and public.mingle_group_admin((storage.foldername(name))[1]::uuid));
-- Existing images remain readable through the public bucket URL.
