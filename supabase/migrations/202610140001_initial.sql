-- Mingle Phase 1: secure user profiles and basic posts
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null default 'Mingle member',
  bio text not null default '',
  avatar_url text,
  banner_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index posts_created_at_idx on public.posts(created_at desc);
create index posts_author_id_idx on public.posts(author_id);
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
create policy "Read public profiles or own" on public.profiles for select to authenticated using (not is_private or auth.uid() = id);
create policy "Update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Read public posts or own" on public.posts for select to authenticated using (author_id = auth.uid() or exists (select 1 from public.profiles p where p.id = author_id and not p.is_private));
create policy "Create own posts" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "Edit own posts" on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Delete own posts" on public.posts for delete to authenticated using (author_id = auth.uid());
create or replace function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare base_username text;
begin
  base_username := 'user_' || replace(new.id::text,'-','');
  insert into public.profiles(id,username,display_name)
  values (new.id, left(base_username,30), left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(coalesce(new.email,''),'@',1),'Mingle member'),60));
  return new;
end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile_for_new_user();
