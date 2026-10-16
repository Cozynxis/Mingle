-- Run in Supabase SQL editor after the stories migration.
-- pg_cron is supported on hosted Supabase projects; this removes expired rows.
create extension if not exists pg_cron with schema pg_catalog;
create or replace function public.mingle_cleanup_expired_stories()
returns void language plpgsql security definer set search_path=public as $$
begin
 delete from public.mingle_stories where expires_at <= now();
end $$;
revoke all on function public.mingle_cleanup_expired_stories() from public,anon,authenticated;
do $$
begin
 if not exists(select 1 from cron.job where jobname='mingle-expired-stories') then
  perform cron.schedule('mingle-expired-stories','*/5 * * * *','select public.mingle_cleanup_expired_stories()');
 end if;
end $$;
