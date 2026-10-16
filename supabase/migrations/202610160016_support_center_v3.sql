-- Support Center 2.1: admin deletion and category management.
create or replace function public.support_admin_delete(p_ticket uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 if not exists(select 1 from public.support_tickets where id=p_ticket) then raise exception 'Ticket niet gevonden';end if;
 delete from public.support_internal_notes where ticket_id=p_ticket;
 delete from public.support_messages where ticket_id=p_ticket;
 delete from public.support_tickets where id=p_ticket;
end $$;
create or replace function public.support_admin_category(p_ticket uuid,p_category text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 if p_category not in ('account','bug','premium','safety','other') then raise exception 'Ongeldige categorie';end if;
 update public.support_tickets set category=p_category,updated_at=now() where id=p_ticket;
 if not found then raise exception 'Ticket niet gevonden';end if;
end $$;
revoke all on function public.support_admin_delete(uuid) from public,anon;
revoke all on function public.support_admin_category(uuid,text) from public,anon;
grant execute on function public.support_admin_delete(uuid) to authenticated;
grant execute on function public.support_admin_category(uuid,text) to authenticated;
