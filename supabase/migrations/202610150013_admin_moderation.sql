-- Mingle Admin Center expansion. Run once after 202610150011_admin_center.sql
create or replace function public.admin_delete_reply(rid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten'; end if;
 delete from public.post_replies where id=rid;
 if not found then raise exception 'Reactie niet gevonden'; end if;
 insert into public.admin_audit_logs(actor_id,action,target_id) values(auth.uid(),'reply_deleted',rid);
end $$;
create or replace function public.admin_delete_community_post(pid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten'; end if;
 delete from public.community_posts where id=pid;
 if not found then raise exception 'Communitybericht niet gevonden'; end if;
 insert into public.admin_audit_logs(actor_id,action,target_id) values(auth.uid(),'community_post_deleted',pid);
end $$;
create or replace function public.admin_delete_community_reply(rid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten'; end if;
 delete from public.community_replies where id=rid;
 if not found then raise exception 'Communityreactie niet gevonden'; end if;
 insert into public.admin_audit_logs(actor_id,action,target_id) values(auth.uid(),'community_reply_deleted',rid);
end $$;
create or replace function public.admin_update_community(cid uuid, changes jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten'; end if;
 if changes ? 'privacy' and changes->>'privacy' not in ('public','private','hidden') then raise exception 'Ongeldige zichtbaarheid'; end if;
 if changes ? 'name' and char_length(trim(changes->>'name')) not between 3 and 60 then raise exception 'Ongeldige naam'; end if;
 update public.communities set name=coalesce(changes->>'name',name), privacy=coalesce(changes->>'privacy',privacy)
 where id=cid;
 if not found then raise exception 'Community niet gevonden'; end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,details) values(auth.uid(),'community_updated',cid,changes);
end $$;
revoke all on function public.admin_delete_reply(uuid),public.admin_delete_community_post(uuid),public.admin_delete_community_reply(uuid),public.admin_update_community(uuid,jsonb) from public;
grant execute on function public.admin_delete_reply(uuid),public.admin_delete_community_post(uuid),public.admin_delete_community_reply(uuid),public.admin_update_community(uuid,jsonb) to authenticated;
drop policy if exists "Admin view replies" on public.post_replies;
create policy "Admin view replies" on public.post_replies for select to authenticated using(public.mingle_is_admin());
drop policy if exists "Admin view community posts" on public.community_posts;
create policy "Admin view community posts" on public.community_posts for select to authenticated using(public.mingle_is_admin());
drop policy if exists "Admin view community replies" on public.community_replies;
create policy "Admin view community replies" on public.community_replies for select to authenticated using(public.mingle_is_admin());
