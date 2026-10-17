-- Only an authenticated group administrator may permanently delete a group.
-- Cascading foreign keys remove messages, members, polls and votes.
create or replace function public.mingle_group_delete(g uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.mingle_group_admin(g) then
  raise exception 'Alleen groepsbeheerders kunnen deze groep verwijderen';
 end if;
 delete from public.mingle_groups where id=g;
 if not found then raise exception 'Groep niet gevonden'; end if;
end $$;
revoke all on function public.mingle_group_delete(uuid) from public;
grant execute on function public.mingle_group_delete(uuid) to authenticated;
