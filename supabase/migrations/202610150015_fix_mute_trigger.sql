-- Fix mute trigger field lookup and make restriction status readable.
create or replace function public.mingle_mute_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor_field text; actor_id uuid;
begin
 actor_field:=case TG_TABLE_NAME
 when 'posts' then 'author_id'
 when 'post_replies' then 'author_id'
 when 'post_likes' then 'user_id'
 when 'reply_likes' then 'user_id'
 when 'post_reposts' then 'user_id'
 when 'post_bookmarks' then 'user_id'
 when 'community_posts' then 'author_id'
 when 'community_replies' then 'author_id'
 when 'dm_messages' then 'sender_id'
 when 'follows' then 'follower_id'
 when 'community_members' then 'user_id'
 else null end;
 if actor_field is not null then
  actor_id:=nullif(to_jsonb(NEW)->>actor_field,'')::uuid;
  if actor_id is not null then perform public.mingle_check_mute(actor_id);end if;
 end if;
 return NEW;
end $$;
-- Replace triggers to ensure all tables run the corrected function.
do $$ declare t text;begin
 foreach t in array array['posts','post_replies','post_likes','reply_likes','post_reposts','post_bookmarks','community_posts','community_replies','dm_messages','follows','community_members'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop trigger if exists mingle_mute_guard on public.%I',t);
   execute format('create trigger mingle_mute_guard before insert or update on public.%I for each row execute function public.mingle_mute_trigger()',t);
  end if;
 end loop;
end $$;
