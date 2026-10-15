-- Enable realtime updates for Mingle social tables.
-- Run once in Supabase SQL Editor. Existing policies still apply.
do $$
declare t text;
begin
 foreach t in array array['follows','post_likes','post_reposts','post_replies','reply_likes','posts'] loop
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=t)
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
