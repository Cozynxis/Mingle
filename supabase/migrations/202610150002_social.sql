-- Mingle Social V1: run in Supabase SQL Editor after earlier migrations.
create table if not exists public.post_likes (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.post_bookmarks (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.post_reposts (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.follows (
 follower_id uuid not null references public.profiles(id) on delete cascade,
 following_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,following_id),
 constraint cannot_follow_self check (follower_id <> following_id)
);
create table if not exists public.post_replies (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists post_likes_user_idx on public.post_likes(user_id);
create index if not exists post_reposts_user_idx on public.post_reposts(user_id);
create index if not exists post_bookmarks_user_idx on public.post_bookmarks(user_id);
create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists post_replies_post_idx on public.post_replies(post_id,created_at);
alter table public.post_likes enable row level security;
alter table public.post_bookmarks enable row level security;
alter table public.post_reposts enable row level security;
alter table public.follows enable row level security;
alter table public.post_replies enable row level security;
-- Public engagement counts; private bookmarks remain visible only to their owner.
create policy "Read likes" on public.post_likes for select to authenticated using (true);
create policy "Like as self" on public.post_likes for insert to authenticated with check (user_id=auth.uid());
create policy "Unlike as self" on public.post_likes for delete to authenticated using (user_id=auth.uid());
create policy "Read reposts" on public.post_reposts for select to authenticated using (true);
create policy "Repost as self" on public.post_reposts for insert to authenticated with check (user_id=auth.uid());
create policy "Undo repost as self" on public.post_reposts for delete to authenticated using (user_id=auth.uid());
create policy "Read own bookmarks" on public.post_bookmarks for select to authenticated using (user_id=auth.uid());
create policy "Bookmark as self" on public.post_bookmarks for insert to authenticated with check (user_id=auth.uid());
create policy "Remove own bookmark" on public.post_bookmarks for delete to authenticated using (user_id=auth.uid());
create policy "Read follows" on public.follows for select to authenticated using (true);
create policy "Follow as self" on public.follows for insert to authenticated with check (follower_id=auth.uid());
create policy "Unfollow as self" on public.follows for delete to authenticated using (follower_id=auth.uid());
create policy "Read replies to accessible posts" on public.post_replies for select to authenticated using (
 exists(select 1 from public.posts p join public.profiles u on u.id=p.author_id where p.id=post_id and (not u.is_private or u.id=auth.uid()))
);
create policy "Reply as self to accessible posts" on public.post_replies for insert to authenticated with check (
 author_id=auth.uid() and exists(select 1 from public.posts p join public.profiles u on u.id=p.author_id where p.id=post_id and (not u.is_private or u.id=auth.uid()))
);
create policy "Delete own replies" on public.post_replies for delete to authenticated using(author_id=auth.uid());
-- Protect interaction metadata on private posts; ensure private accounts cannot be accessed through joins.
drop policy if exists "Read likes" on public.post_likes;
create policy "Read likes" on public.post_likes for select to authenticated using (
 exists(select 1 from public.posts p join public.profiles u on u.id=p.author_id where p.id=post_id and (not u.is_private or u.id=auth.uid()))
);
drop policy if exists "Read reposts" on public.post_reposts;
create policy "Read reposts" on public.post_reposts for select to authenticated using (
 exists(select 1 from public.posts p join public.profiles u on u.id=p.author_id where p.id=post_id and (not u.is_private or u.id=auth.uid()))
);
