-- Run in Supabase SQL Editor once, after the Admin Center migration.
create table if not exists public.badge_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 preferred_badge text not null check(preferred_badge in ('verified','official','premium')),
 updated_at timestamptz not null default now()
);
alter table public.badge_preferences enable row level security;
drop policy if exists "Read badge preferences" on public.badge_preferences;
create policy "Read badge preferences" on public.badge_preferences for select to authenticated using(true);
drop policy if exists "Choose own awarded badge" on public.badge_preferences;
create policy "Choose own awarded badge" on public.badge_preferences for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profile_badges where user_id=auth.uid() and badge=preferred_badge));
drop policy if exists "Update own awarded badge" on public.badge_preferences;
create policy "Update own awarded badge" on public.badge_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.profile_badges where user_id=auth.uid() and badge=preferred_badge));
grant select,insert,update on public.badge_preferences to authenticated;
