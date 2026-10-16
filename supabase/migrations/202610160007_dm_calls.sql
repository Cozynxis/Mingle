-- Run in Supabase SQL editor before using Mingle calls.
create table if not exists public.dm_call_signals (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null references public.dm_connections(id) on delete cascade,
 call_id uuid not null,
 sender_id uuid not null references auth.users(id),
 recipient_id uuid not null references auth.users(id),
 kind text not null check(kind in ('offer','answer','ice','hangup')),
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists dm_call_signals_recipient_idx on public.dm_call_signals(recipient_id,created_at desc);
alter table public.dm_call_signals enable row level security;
revoke all on public.dm_call_signals from anon;
grant select,insert on public.dm_call_signals to authenticated;
drop policy if exists "dm_call_signals_read" on public.dm_call_signals;
create policy "dm_call_signals_read" on public.dm_call_signals for select to authenticated using (
 recipient_id=auth.uid() and exists(select 1 from public.dm_connections c where c.id=connection_id and c.status='accepted' and auth.uid() in(c.requester_id,c.recipient_id))
);
drop policy if exists "dm_call_signals_send" on public.dm_call_signals;
create policy "dm_call_signals_send" on public.dm_call_signals for insert to authenticated with check (
 sender_id=auth.uid() and sender_id<>recipient_id and kind in('offer','answer','ice','hangup')
 and exists(select 1 from public.dm_connections c where c.id=connection_id and c.status='accepted' and sender_id in(c.requester_id,c.recipient_id) and recipient_id in(c.requester_id,c.recipient_id))
);
-- Existing dm-attachments storage policies must allow audio uploads (audio/webm, audio/mp4, audio/ogg).
