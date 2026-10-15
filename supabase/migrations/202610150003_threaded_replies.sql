-- Mingle threaded replies and reaction likes
alter table public.post_replies add column if not exists parent_id uuid references public.post_replies(id) on delete cascade;
create index if not exists post_replies_parent_idx on public.post_replies(parent_id);
create table if not exists public.reply_likes (
 reply_id uuid not null references public.post_replies(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(reply_id,user_id)
);
create index if not exists reply_likes_user_idx on public.reply_likes(user_id);
alter table public.reply_likes enable row level security;
drop policy if exists "Read accessible reply likes" on public.reply_likes;
create policy "Read accessible reply likes" on public.reply_likes for select to authenticated using (
 exists (select 1 from public.post_replies r join public.posts p on p.id=r.post_id join public.profiles u on u.id=p.author_id where r.id=reply_id and (not u.is_private or u.id=auth.uid()))
);
drop policy if exists "Like accessible reply" on public.reply_likes;
create policy "Like accessible reply" on public.reply_likes for insert to authenticated with check (
 user_id=auth.uid() and exists (select 1 from public.post_replies r join public.posts p on p.id=r.post_id join public.profiles u on u.id=p.author_id where r.id=reply_id and (not u.is_private or u.id=auth.uid()))
);
drop policy if exists "Unlike own reply like" on public.reply_likes;
create policy "Unlike own reply like" on public.reply_likes for delete to authenticated using (user_id=auth.uid());
