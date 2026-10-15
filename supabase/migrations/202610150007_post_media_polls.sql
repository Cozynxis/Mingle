-- Run in Supabase SQL Editor before deploying media and polls.
alter table public.posts add column if not exists image_url text;
create table if not exists public.post_polls (
 post_id uuid primary key references public.posts(id) on delete cascade,
 question text not null check(char_length(trim(question)) between 1 and 200),
 created_at timestamptz not null default now()
);
create table if not exists public.post_poll_options (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.post_polls(post_id) on delete cascade,
 label text not null check(char_length(trim(label)) between 1 and 100),
 position smallint not null check(position between 0 and 3),
 unique(post_id,position),
 unique(id,post_id)
);
create table if not exists public.post_poll_votes (
 post_id uuid not null references public.post_polls(post_id) on delete cascade,
 option_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id),
 foreign key(option_id,post_id) references public.post_poll_options(id,post_id) on delete cascade
);
create index if not exists post_poll_votes_option_idx on public.post_poll_votes(option_id);
alter table public.post_polls enable row level security;
alter table public.post_poll_options enable row level security;
alter table public.post_poll_votes enable row level security;
drop policy if exists "Polls visible on accessible posts" on public.post_polls;
create policy "Polls visible on accessible posts" on public.post_polls for select to authenticated using (
 exists(select 1 from public.posts p join public.profiles u on u.id=p.author_id where p.id=post_id and (not u.is_private or u.id=auth.uid()))
);
drop policy if exists "Authors create polls" on public.post_polls;
create policy "Authors create polls" on public.post_polls for insert to authenticated with check (
 exists(select 1 from public.posts p where p.id=post_id and p.author_id=auth.uid())
);
drop policy if exists "Poll options visible" on public.post_poll_options;
create policy "Poll options visible" on public.post_poll_options for select to authenticated using (
 exists(select 1 from public.post_polls q where q.post_id=post_id)
);
drop policy if exists "Authors create poll options" on public.post_poll_options;
create policy "Authors create poll options" on public.post_poll_options for insert to authenticated with check (
 exists(select 1 from public.posts p where p.id=post_id and p.author_id=auth.uid())
);
drop policy if exists "Poll votes visible" on public.post_poll_votes;
create policy "Poll votes visible" on public.post_poll_votes for select to authenticated using (
 exists(select 1 from public.post_polls q where q.post_id=post_id)
);
drop policy if exists "Vote once as self" on public.post_poll_votes;
create policy "Vote once as self" on public.post_poll_votes for insert to authenticated with check (
 user_id=auth.uid() and exists(select 1 from public.post_polls q where q.post_id=post_id)
);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('post-images','post-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Public read post images" on storage.objects;
create policy "Public read post images" on storage.objects for select to public using(bucket_id='post-images');
drop policy if exists "Users upload own post images" on storage.objects;
create policy "Users upload own post images" on storage.objects for insert to authenticated with check(bucket_id='post-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users remove own post images" on storage.objects;
create policy "Users remove own post images" on storage.objects for delete to authenticated using(bucket_id='post-images' and (storage.foldername(name))[1]=auth.uid()::text);
-- Optional realtime publication for votes. Polls also refresh by polling.
do $$ begin
 alter publication supabase_realtime add table public.post_poll_votes;
exception when duplicate_object then null;
end $$;
