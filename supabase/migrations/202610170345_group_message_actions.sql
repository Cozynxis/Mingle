-- Group message actions, available to members on web and Android.
alter table public.mingle_group_messages add column if not exists edited_at timestamptz;
alter table public.mingle_group_messages add column if not exists deleted_at timestamptz;
alter table public.mingle_group_messages add column if not exists reply_to uuid references public.mingle_group_messages(id) on delete set null;
create table if not exists public.mingle_group_reactions (
 message_id uuid not null references public.mingle_group_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check (char_length(emoji) between 1 and 16),
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,emoji)
);
alter table public.mingle_group_reactions enable row level security;
create policy "group members view reactions" on public.mingle_group_reactions for select to authenticated using (
 exists(select 1 from public.mingle_group_messages m where m.id=message_id and public.mingle_group_member(m.group_id))
);
create or replace function public.mingle_group_message_action(mid uuid, action text, content text default null)
returns void language plpgsql security definer set search_path=public as $$
declare m public.mingle_group_messages%rowtype;
begin
 select * into m from public.mingle_group_messages where id=mid for update;
 if m.id is null or not public.mingle_group_member(m.group_id) then raise exception 'Bericht niet gevonden'; end if;
 if action='edit' then
  if m.sender_id<>auth.uid() or m.deleted_at is not null or exists(select 1 from public.mingle_group_polls where message_id=mid) then raise exception 'Dit bericht kun je niet bewerken'; end if;
  if content is null or length(trim(content))<1 or length(content)>4000 then raise exception 'Ongeldige berichttekst'; end if;
  update public.mingle_group_messages set body=trim(content),edited_at=now() where id=mid;
 elsif action='delete' then
  if m.sender_id<>auth.uid() and not public.mingle_group_admin(m.group_id) then raise exception 'Geen toestemming'; end if;
  update public.mingle_group_messages set body='',deleted_at=now(),pinned=false,attachment_path=null,attachment_type=null where id=mid;
  delete from public.mingle_group_reactions where message_id=mid;
 elsif action='react' then
  if m.deleted_at is not null or content is null or length(content)>16 or length(content)<1 then raise exception 'Ongeldige reactie'; end if;
  if exists(select 1 from public.mingle_group_reactions where message_id=mid and user_id=auth.uid() and emoji=content) then
   delete from public.mingle_group_reactions where message_id=mid and user_id=auth.uid() and emoji=content;
  else
   insert into public.mingle_group_reactions(message_id,user_id,emoji) values(mid,auth.uid(),content);
  end if;
 else raise exception 'Onbekende actie'; end if;
end $$;
create or replace function public.mingle_group_send_reply(g uuid, content text, reply_mid uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid;
begin
 if not public.mingle_group_member(g) then raise exception 'Geen groepslid'; end if;
 if content is null or length(trim(content))<1 or length(content)>4000 then raise exception 'Ongeldig bericht'; end if;
 if not exists(select 1 from public.mingle_group_messages where id=reply_mid and group_id=g and deleted_at is null) then raise exception 'Oorspronkelijk bericht niet gevonden'; end if;
 insert into public.mingle_group_messages(group_id,sender_id,body,reply_to) values(g,auth.uid(),trim(content),reply_mid) returning id into mid;
 return mid;
end $$;
revoke all on function public.mingle_group_message_action(uuid,text,text),public.mingle_group_send_reply(uuid,text,uuid) from public;
grant execute on function public.mingle_group_message_action(uuid,text,text),public.mingle_group_send_reply(uuid,text,uuid) to authenticated;
