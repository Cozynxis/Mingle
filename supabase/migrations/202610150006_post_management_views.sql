-- Post management and unique authenticated views. Run once in Supabase SQL Editor.
create table if not exists public.post_views (
 post_id uuid not null references public.posts(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 viewed_at timestamptz not null default now(),
 primary key(post_id,viewer_id)
);
create index if not exists post_views_viewer_idx on public.post_views(viewer_id);
alter table public.post_views enable row level security;
drop policy if exists "Read post views" on public.post_views;
create policy "Read post views" on public.post_views for select to authenticated using (
 exists(select 1 from public.posts p join public.profiles u on u.id=p.author_id where p.id=post_id and (not u.is_private or u.id=auth.uid()))
);
drop policy if exists "Record own view" on public.post_views;
create policy "Record own view" on public.post_views for insert to authenticated with check (
 viewer_id=auth.uid() and exists(select 1 from public.posts p join public.profiles u on u.id=p.author_id where p.id=post_id and (not u.is_private or u.id=auth.uid()))
);
drop policy if exists "Edit own posts" on public.posts;
create policy "Edit own posts" on public.posts for update to authenticated using (author_id=auth.uid()) with check (author_id=auth.uid());
drop policy if exists "Delete own posts" on public.posts;
create policy "Delete own posts" on public.posts for delete to authenticated using (author_id=auth.uid());
-- Existing views count one unique signed-in user per post, not repeated refreshes.
