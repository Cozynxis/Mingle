-- Mingle onboarding and profile images (run once in Supabase SQL Editor).
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
-- Existing accounts should see the welcome flow once; existing profile data is preserved.
create index if not exists profiles_username_idx on public.profiles(username);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-media','profile-media',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
-- Public images can be displayed in profiles. Users can only upload inside their own ID folder.
create policy "Profile media public read" on storage.objects for select to public using (bucket_id='profile-media');
create policy "Profile media upload own folder" on storage.objects for insert to authenticated
with check (bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "Profile media delete own folder" on storage.objects for delete to authenticated
using (bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
