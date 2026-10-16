-- Run once in Supabase SQL Editor
create table if not exists public.mingle_ai_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('user','assistant')),
 body text not null default '',
 image_path text,
 created_at timestamptz not null default now()
);
create index if not exists mingle_ai_messages_user_time on public.mingle_ai_messages(user_id,created_at desc);
alter table public.mingle_ai_messages enable row level security;
drop policy if exists "ai_messages_select_own" on public.mingle_ai_messages;
create policy "ai_messages_select_own" on public.mingle_ai_messages for select to authenticated using (auth.uid()=user_id);
-- Writes only through Edge Function service-role, never directly from the browser.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('mingle-ai-media','mingle-ai-media',false,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
drop policy if exists "ai_media_read_own" on storage.objects;
create policy "ai_media_read_own" on storage.objects for select to authenticated using (bucket_id='mingle-ai-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "ai_media_upload_own" on storage.objects;
create policy "ai_media_upload_own" on storage.objects for insert to authenticated with check (bucket_id='mingle-ai-media' and (storage.foldername(name))[1]=auth.uid()::text);
