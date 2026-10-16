-- Mingle Mollie billing. Apply after Premium foundation and visuals.
create table if not exists public.mollie_billing (
 user_id uuid primary key references auth.users(id) on delete cascade,
 customer_id text unique,
 subscription_id text unique,
 first_payment_id text unique,
 mode text not null default 'test' check(mode in ('test','live')),
 state text not null default 'new',
 paid_through timestamptz,
 cancel_at_period_end boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.mollie_payment_events (
 payment_id text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 subscription_id text,
 status text not null,
 amount text,
 processed_at timestamptz not null default now()
);
alter table public.mollie_billing enable row level security;
alter table public.mollie_payment_events enable row level security;
drop policy if exists "billing_read_own" on public.mollie_billing;
create policy "billing_read_own" on public.mollie_billing for select to authenticated using (user_id=auth.uid());
drop policy if exists "payment_events_read_own" on public.mollie_payment_events;
create policy "payment_events_read_own" on public.mollie_payment_events for select to authenticated using (user_id=auth.uid());
-- No client INSERT/UPDATE/DELETE policies: service role only.
-- Never give test-mode payments production Premium entitlements.
