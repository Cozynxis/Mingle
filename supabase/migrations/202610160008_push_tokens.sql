-- FCM device registrations, private to each account.
create table if not exists public.mingle_push_tokens(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 token text not null unique,
 platform text not null default 'android' check(platform in ('android','web')),
 updated_at timestamptz not null default now()
);
create index if not exists mingle_push_tokens_user_idx on public.mingle_push_tokens(user_id);
alter table public.mingle_push_tokens enable row level security;
revoke all on public.mingle_push_tokens from anon;
grant select,insert,update,delete on public.mingle_push_tokens to authenticated;
drop policy if exists "push_own_select" on public.mingle_push_tokens;
create policy "push_own_select" on public.mingle_push_tokens for select to authenticated using(user_id=auth.uid());
drop policy if exists "push_own_insert" on public.mingle_push_tokens;
create policy "push_own_insert" on public.mingle_push_tokens for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "push_own_update" on public.mingle_push_tokens;
create policy "push_own_update" on public.mingle_push_tokens for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "push_own_delete" on public.mingle_push_tokens;
create policy "push_own_delete" on public.mingle_push_tokens for delete to authenticated using(user_id=auth.uid());
