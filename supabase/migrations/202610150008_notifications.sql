-- Mingle notifications: run in Supabase SQL Editor.
create table if not exists public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 follows boolean not null default true,
 post_likes boolean not null default true,
 reply_likes boolean not null default true,
 replies boolean not null default true,
 poll_votes boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('follow','post_like','reply_like','reply','poll_vote')),
 post_id uuid references public.posts(id) on delete cascade,
 reply_id uuid references public.post_replies(id) on delete cascade,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id,created_at desc);
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
drop policy if exists "Own notification preferences read" on public.notification_preferences;
create policy "Own notification preferences read" on public.notification_preferences for select to authenticated using(user_id=auth.uid());
drop policy if exists "Own notification preferences insert" on public.notification_preferences;
create policy "Own notification preferences insert" on public.notification_preferences for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "Own notification preferences update" on public.notification_preferences;
create policy "Own notification preferences update" on public.notification_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "Own notifications read" on public.notifications;
create policy "Own notifications read" on public.notifications for select to authenticated using(recipient_id=auth.uid());
drop policy if exists "Own notifications mark read" on public.notifications;
create policy "Own notifications mark read" on public.notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
drop policy if exists "Own notifications delete" on public.notifications;
create policy "Own notifications delete" on public.notifications for delete to authenticated using(recipient_id=auth.uid());
-- Trigger uses definer rights so clients cannot forge notifications.
create or replace function public.mingle_notify()
returns trigger language plpgsql security definer set search_path=public as $$
declare target uuid; source_user uuid; event_kind text; related_post uuid; related_reply uuid; permitted boolean;
begin
 if TG_TABLE_NAME='follows' then
  target:=NEW.following_id;source_user:=NEW.follower_id;event_kind:='follow';
 elsif TG_TABLE_NAME='post_likes' then
  select author_id into target from public.posts where id=NEW.post_id;
  source_user:=NEW.user_id;event_kind:='post_like';related_post:=NEW.post_id;
 elsif TG_TABLE_NAME='reply_likes' then
  select r.author_id,r.post_id into target,related_post from public.post_replies r where r.id=NEW.reply_id;
  source_user:=NEW.user_id;event_kind:='reply_like';related_reply:=NEW.reply_id;
 elsif TG_TABLE_NAME='post_replies' then
  if NEW.parent_id is not null then
   select author_id into target from public.post_replies where id=NEW.parent_id;
  else
   select author_id into target from public.posts where id=NEW.post_id;
  end if;
  source_user:=NEW.author_id;event_kind:='reply';related_post:=NEW.post_id;related_reply:=NEW.id;
 elsif TG_TABLE_NAME='post_poll_votes' then
  select author_id into target from public.posts where id=NEW.post_id;
  source_user:=NEW.user_id;event_kind:='poll_vote';related_post:=NEW.post_id;
 end if;
 if target is null or source_user is null or target=source_user then return NEW;end if;
 select coalesce((select case event_kind
  when 'follow' then enabled and follows
  when 'post_like' then enabled and post_likes
  when 'reply_like' then enabled and reply_likes
  when 'reply' then enabled and replies
  when 'poll_vote' then enabled and poll_votes
  else false end
 from public.notification_preferences where user_id=target),true) into permitted;
 if permitted then
  insert into public.notifications(recipient_id,actor_id,kind,post_id,reply_id)
  values(target,source_user,event_kind,related_post,related_reply);
 end if;
 return NEW;
end $$;
drop trigger if exists mingle_follow_notify on public.follows;
create trigger mingle_follow_notify after insert on public.follows for each row execute function public.mingle_notify();
drop trigger if exists mingle_post_like_notify on public.post_likes;
create trigger mingle_post_like_notify after insert on public.post_likes for each row execute function public.mingle_notify();
drop trigger if exists mingle_reply_like_notify on public.reply_likes;
create trigger mingle_reply_like_notify after insert on public.reply_likes for each row execute function public.mingle_notify();
drop trigger if exists mingle_reply_notify on public.post_replies;
create trigger mingle_reply_notify after insert on public.post_replies for each row execute function public.mingle_notify();
drop trigger if exists mingle_poll_vote_notify on public.post_poll_votes;
create trigger mingle_poll_vote_notify after insert on public.post_poll_votes for each row execute function public.mingle_notify();
do $$ begin
 alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
