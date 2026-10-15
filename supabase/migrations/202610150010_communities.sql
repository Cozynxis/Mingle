-- Mingle Communities: run once in Supabase SQL Editor
create table if not exists public.communities(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 3 and 60),
 slug text not null unique check(slug ~ '^[a-z0-9_]{3,32}$'),
 description text not null default '' check(char_length(description)<=1000),
 category text not null default 'Overig',
 privacy text not null default 'public' check(privacy in('public','private','hidden')),
 logo_url text, banner_url text,
 allow_posts boolean not null default true,
 allow_replies boolean not null default true,
 allow_images boolean not null default true,
 require_approval boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.community_members(
 community_id uuid not null references public.communities(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'member' check(status in('pending','member','banned')),
 joined_at timestamptz not null default now(),
 primary key(community_id,user_id)
);
create table if not exists public.community_posts(
 id uuid primary key default gen_random_uuid(),
 community_id uuid not null references public.communities(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000),
 image_url text,
 status text not null default 'published' check(status in('pending','published')),
 pinned boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists community_posts_feed on public.community_posts(community_id,status,pinned desc,created_at desc);
create table if not exists public.community_replies(
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.community_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create table if not exists public.community_invites(
 token uuid primary key default gen_random_uuid(),
 community_id uuid not null references public.communities(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_invites enable row level security;
-- Helper functions bypass recursive membership RLS checks
create or replace function public.community_access(cid uuid, uid uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.communities c where c.id=cid and (c.owner_id=uid or (c.privacy='public' and not exists(select 1 from public.community_members m where m.community_id=cid and m.user_id=uid and m.status='banned')) or exists(select 1 from public.community_members m where m.community_id=cid and m.user_id=uid and m.status='member')))
$$;
create or replace function public.community_is_owner(cid uuid, uid uuid)
returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.communities where id=cid and owner_id=uid)$$;
drop policy if exists "community browse" on public.communities;
create policy "community browse" on public.communities for select to authenticated using(privacy<>'hidden' or public.community_access(id,auth.uid()));
drop policy if exists "community members read" on public.community_members;
create policy "community members read" on public.community_members for select to authenticated using(user_id=auth.uid() or public.community_access(community_id,auth.uid()));
drop policy if exists "community posts read" on public.community_posts;
create policy "community posts read" on public.community_posts for select to authenticated using(public.community_access(community_id,auth.uid()) and (status='published' or author_id=auth.uid() or public.community_is_owner(community_id,auth.uid())));
drop policy if exists "community replies read" on public.community_replies;
create policy "community replies read" on public.community_replies for select to authenticated using(exists(select 1 from public.community_posts p where p.id=post_id and p.status='published' and public.community_access(p.community_id,auth.uid())));
drop policy if exists "community invite read" on public.community_invites;
create policy "community invite read" on public.community_invites for select to authenticated using(public.community_is_owner(community_id,auth.uid()));
-- All writes use validated RPC functions. Do not allow direct client writes.
create or replace function public.community_create(n text,s text,d text,cat text,priv text)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;begin
 if auth.uid() is null then raise exception 'Log eerst in';end if;
 insert into public.communities(owner_id,name,slug,description,category,privacy)
 values(auth.uid(),trim(n),lower(trim(s)),trim(coalesce(d,'')),coalesce(nullif(trim(cat),''),'Overig'),priv) returning id into cid;
 insert into public.community_members(community_id,user_id) values(cid,auth.uid());
 return cid;
end $$;
create or replace function public.community_join(cid uuid, invite uuid default null)
returns text language plpgsql security definer set search_path=public as $$
declare c public.communities; st text;begin
 select * into c from public.communities where id=cid;
 if not found then raise exception 'Community bestaat niet';end if;
 if auth.uid()=c.owner_id then return 'member';end if;
 if exists(select 1 from public.community_members where community_id=cid and user_id=auth.uid() and status='banned') then raise exception 'Je bent geblokkeerd';end if;
 if c.privacy='hidden' and not exists(select 1 from public.community_invites where community_id=cid and token=invite) then raise exception 'Uitnodiging vereist';end if;
 st:=case when c.privacy='private' then 'pending' else 'member' end;
 insert into public.community_members(community_id,user_id,status) values(cid,auth.uid(),st)
 on conflict(community_id,user_id) do update set status=excluded.status where community_members.status<>'banned';
 return st;
end $$;
create or replace function public.community_manage_member(cid uuid, target uuid, action text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if action='leave' and target=auth.uid() and not public.community_is_owner(cid,target) then
 delete from public.community_members where community_id=cid and user_id=target;
 elsif public.community_is_owner(cid,auth.uid()) and target<>auth.uid() then
 if action='approve' then update public.community_members set status='member',joined_at=now() where community_id=cid and user_id=target and status='pending';
 elsif action='reject' or action='kick' then delete from public.community_members where community_id=cid and user_id=target;
 elsif action='ban' then insert into public.community_members(community_id,user_id,status) values(cid,target,'banned') on conflict(community_id,user_id) do update set status='banned';
 elsif action='unban' then delete from public.community_members where community_id=cid and user_id=target and status='banned';
 else raise exception 'Ongeldige actie';end if;
 else raise exception 'Geen toestemming';end if;
end $$;
create or replace function public.community_update(cid uuid, changes jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.community_is_owner(cid,auth.uid()) then raise exception 'Geen toestemming';end if;
 if changes ? 'name' and char_length(trim(changes->>'name')) not between 3 and 60 then raise exception 'Naam moet 3-60 tekens zijn';end if;
 update public.communities set
 name=coalesce(changes->>'name',name),description=coalesce(changes->>'description',description),
 category=coalesce(changes->>'category',category),privacy=coalesce(changes->>'privacy',privacy),
 allow_posts=coalesce((changes->>'allow_posts')::boolean,allow_posts),
 allow_replies=coalesce((changes->>'allow_replies')::boolean,allow_replies),
 allow_images=coalesce((changes->>'allow_images')::boolean,allow_images),
 require_approval=coalesce((changes->>'require_approval')::boolean,require_approval),
 logo_url=coalesce(changes->>'logo_url',logo_url),banner_url=coalesce(changes->>'banner_url',banner_url)
 where id=cid;
end $$;
create or replace function public.community_publish(cid uuid, txt text, img text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.communities; pid uuid;begin
 select * into c from public.communities where id=cid;
 if not found then raise exception 'Community bestaat niet';end if;
 if auth.uid()<>c.owner_id and (not c.allow_posts or not exists(select 1 from public.community_members where community_id=cid and user_id=auth.uid() and status='member')) then raise exception 'Je mag hier geen posts plaatsen';end if;
 if img is not null and not c.allow_images and auth.uid()<>c.owner_id then raise exception 'Afbeeldingen zijn uitgeschakeld';end if;
 insert into public.community_posts(community_id,author_id,body,image_url,status) values(cid,auth.uid(),trim(txt),img,case when c.require_approval and auth.uid()<>c.owner_id then 'pending' else 'published' end) returning id into pid;
 return pid;
end $$;
create or replace function public.community_reply(pid uuid, txt text)
returns uuid language plpgsql security definer set search_path=public as $$
declare p public.community_posts;c public.communities;rid uuid;begin
 select * into p from public.community_posts where id=pid;
 if not found or p.status<>'published' then raise exception 'Post niet beschikbaar';end if;
 select * into c from public.communities where id=p.community_id;
 if auth.uid()<>c.owner_id and (not c.allow_replies or not exists(select 1 from public.community_members where community_id=c.id and user_id=auth.uid() and status='member')) then raise exception 'Reageren is niet toegestaan';end if;
 insert into public.community_replies(post_id,author_id,body) values(pid,auth.uid(),trim(txt)) returning id into rid;
 return rid;
end $$;
create or replace function public.community_manage_post(pid uuid, action text)
returns void language plpgsql security definer set search_path=public as $$
declare p public.community_posts;begin
 select * into p from public.community_posts where id=pid;
 if not found or not public.community_is_owner(p.community_id,auth.uid()) then raise exception 'Geen toestemming';end if;
 if action='delete' then delete from public.community_posts where id=pid;
 elsif action='approve' then update public.community_posts set status='published' where id=pid;
 elsif action='pin' then update public.community_posts set pinned=true where id=pid;
 elsif action='unpin' then update public.community_posts set pinned=false where id=pid;
 else raise exception 'Ongeldige actie';end if;
end $$;
create or replace function public.community_invite_create(cid uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare tok uuid;begin
 if not public.community_is_owner(cid,auth.uid()) then raise exception 'Geen toestemming';end if;
 insert into public.community_invites(community_id,created_by) values(cid,auth.uid()) returning token into tok;
 return tok;
end $$;
create or replace function public.community_invite_lookup(tok uuid)
returns table(community_id uuid,name text,description text,privacy text) language sql stable security definer set search_path=public as $$
 select c.id,c.name,c.description,c.privacy from public.community_invites i join public.communities c on c.id=i.community_id where i.token=tok
$$;
create or replace function public.community_delete(cid uuid, confirmation text)
returns void language plpgsql security definer set search_path=public as $$
declare c public.communities;begin
 select * into c from public.communities where id=cid for update;
 if not found or c.owner_id<>auth.uid() or c.name<>confirmation then raise exception 'Naam komt niet overeen of geen toestemming';end if;
 delete from public.communities where id=cid;
end $$;
revoke all on function public.community_create(text,text,text,text,text),public.community_join(uuid,uuid),public.community_manage_member(uuid,uuid,text),public.community_update(uuid,jsonb),public.community_publish(uuid,text,text),public.community_reply(uuid,text),public.community_manage_post(uuid,text),public.community_invite_create(uuid),public.community_invite_lookup(uuid),public.community_delete(uuid,text) from public;
grant execute on function public.community_create(text,text,text,text,text),public.community_join(uuid,uuid),public.community_manage_member(uuid,uuid,text),public.community_update(uuid,jsonb),public.community_publish(uuid,text,text),public.community_reply(uuid,text),public.community_manage_post(uuid,text),public.community_invite_create(uuid),public.community_invite_lookup(uuid),public.community_delete(uuid,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-media','community-media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do nothing;
drop policy if exists "community media upload" on storage.objects;
create policy "community media upload" on storage.objects for insert to authenticated with check(bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text);
