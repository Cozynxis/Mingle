-- Mingle Support Center: run once in Supabase SQL Editor.
create table if not exists public.support_tickets(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 username text not null,
 subject text not null check(char_length(subject) between 5 and 120),
 category text not null default 'other' check(category in('account','bug','premium','safety','other')),
 priority text not null default 'normal' check(priority in('low','normal','high','urgent')),
 status text not null default 'open' check(status in('open','in_progress','waiting','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.support_messages(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index if not exists support_tickets_owner on public.support_tickets(user_id,created_at desc);
create index if not exists support_tickets_status on public.support_tickets(status,updated_at desc);
create index if not exists support_messages_ticket on public.support_messages(ticket_id,created_at);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
drop policy if exists "Support read tickets" on public.support_tickets;
create policy "Support read tickets" on public.support_tickets for select to authenticated
 using(user_id=auth.uid() or public.mingle_is_admin());
drop policy if exists "Support read messages" on public.support_messages;
create policy "Support read messages" on public.support_messages for select to authenticated
 using(exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.mingle_is_admin())));
-- All writes use validated RPCs. Users cannot edit ticket ownership, status or other accounts.
create or replace function public.support_create_ticket(p_username text,p_subject text,p_category text,p_priority text,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid; uname text;
begin
 if auth.uid() is null then raise exception 'Log eerst in'; end if;
 select username into uname from public.profiles where id=auth.uid();
 if uname is null or lower(trim(both '@' from trim(p_username)))<>lower(uname) then raise exception 'Gebruik je eigen Mingle @gebruikersnaam'; end if;
 if length(trim(p_subject)) not between 5 and 120 then raise exception 'Onderwerp moet 5-120 tekens bevatten';end if;
 if p_category not in('account','bug','premium','safety','other') then raise exception 'Ongeldige categorie';end if;
 if p_priority not in('low','normal','high','urgent') then raise exception 'Ongeldige prioriteit';end if;
 if length(trim(p_body)) not between 10 and 5000 then raise exception 'Bericht moet 10-5000 tekens bevatten';end if;
 if (select count(*) from public.support_tickets where user_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Maximaal 5 tickets per uur';end if;
 insert into public.support_tickets(user_id,username,subject,category,priority) values(auth.uid(),uname,trim(p_subject),p_category,p_priority) returning id into tid;
 insert into public.support_messages(ticket_id,author_id,body) values(tid,auth.uid(),trim(p_body));
 return tid;
end $$;
create or replace function public.support_reply(p_ticket uuid,p_body text)
returns void language plpgsql security definer set search_path=public as $$
declare owner uuid; state text;
begin
 select user_id,status into owner,state from public.support_tickets where id=p_ticket for update;
 if owner is null or (owner<>auth.uid() and not public.mingle_is_admin()) then raise exception 'Geen toegang tot ticket';end if;
 if state='closed' then raise exception 'Ticket is gesloten';end if;
 if length(trim(p_body)) not between 1 and 5000 then raise exception 'Bericht moet 1-5000 tekens bevatten';end if;
 insert into public.support_messages(ticket_id,author_id,body) values(p_ticket,auth.uid(),trim(p_body));
 update public.support_tickets set updated_at=now(),status=case when public.mingle_is_admin() then 'waiting' else 'open' end where id=p_ticket;
end $$;
create or replace function public.support_admin_update(p_ticket uuid,p_status text,p_priority text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_is_admin() then raise exception 'Geen adminrechten';end if;
 if p_status not in('open','in_progress','waiting','closed') or p_priority not in('low','normal','high','urgent') then raise exception 'Ongeldige status of prioriteit';end if;
 update public.support_tickets set status=p_status,priority=p_priority,updated_at=now() where id=p_ticket;
 if not found then raise exception 'Ticket niet gevonden';end if;
end $$;
revoke all on function public.support_create_ticket(text,text,text,text,text) from public,anon;
revoke all on function public.support_reply(uuid,text) from public,anon;
revoke all on function public.support_admin_update(uuid,text,text) from public,anon;
grant execute on function public.support_create_ticket(text,text,text,text,text) to authenticated;
grant execute on function public.support_reply(uuid,text) to authenticated;
grant execute on function public.support_admin_update(uuid,text,text) to authenticated;
