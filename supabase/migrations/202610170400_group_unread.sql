-- Per-member group read cursors, with server-authorized unread counts.
alter table public.mingle_group_members add column if not exists last_read_at timestamptz not null default now();
create or replace function public.mingle_group_mark_read(g uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.mingle_group_members set last_read_at=greatest(last_read_at,now())
 where group_id=g and user_id=auth.uid();
 if not found then raise exception 'Geen toegang tot groep'; end if;
end $$;
create or replace function public.mingle_group_unread()
returns table(group_id uuid, unread_count bigint) language sql stable security definer set search_path=public as $$
 select gm.group_id,count(msg.id)::bigint
 from public.mingle_group_members gm
 left join public.mingle_group_messages msg on msg.group_id=gm.group_id
  and msg.created_at>gm.last_read_at and msg.sender_id<>auth.uid()
  and (msg.deleted_at is null)
 where gm.user_id=auth.uid()
 group by gm.group_id
$$;
revoke all on function public.mingle_group_mark_read(uuid),public.mingle_group_unread() from public;
grant execute on function public.mingle_group_mark_read(uuid),public.mingle_group_unread() to authenticated;
