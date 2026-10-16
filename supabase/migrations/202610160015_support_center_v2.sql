-- Support Center v2: private admin notes and user self-service closing.
create table if not exists public.support_internal_notes (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 body text not null check (char_length(trim(body)) between 1 and 3000),
 created_at timestamptz not null default now()
);
alter table public.support_internal_notes enable row level security;
drop policy if exists "Only admins see support notes" on public.support_internal_notes;
create policy "Only admins see support notes" on public.support_internal_notes
 for select to authenticated using (public.mingle_is_admin());
create index if not exists support_internal_notes_ticket on public.support_internal_notes(ticket_id,created_at);
create or replace function public.support_add_internal_note(p_ticket uuid,p_body text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten'; end if;
 if not exists(select 1 from public.support_tickets where id=p_ticket) then raise exception 'Ticket niet gevonden'; end if;
 if char_length(trim(p_body)) not between 1 and 3000 then raise exception 'Notitie moet 1-3000 tekens bevatten';end if;
 insert into public.support_internal_notes(ticket_id,author_id,body) values(p_ticket,auth.uid(),trim(p_body));
end $$;
create or replace function public.support_user_close(p_ticket uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.support_tickets set status='closed',updated_at=now()
 where id=p_ticket and user_id=auth.uid() and status<>'closed';
 if not found then raise exception 'Ticket niet gevonden of al gesloten';end if;
end $$;
revoke all on function public.support_add_internal_note(uuid,text) from public,anon;
revoke all on function public.support_user_close(uuid) from public,anon;
grant execute on function public.support_add_internal_note(uuid,text) to authenticated;
grant execute on function public.support_user_close(uuid) to authenticated;
