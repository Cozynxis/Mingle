-- Premium v2: enforce animated uploads, active badge, gradient and name effects.
alter table public.premium_styles add column if not exists profile_accent_secondary text not null default '#6d48d8';
alter table public.premium_styles add column if not exists gradient_angle integer not null default 135;
alter table public.premium_styles add column if not exists gradient_strength integer not null default 30;
alter table public.premium_styles add column if not exists gradient_motion boolean not null default false;

create or replace function public.premium_save_style(
 a_frame text, a_profile_accent text, a_app_theme text, a_app_accent text, a_name_effect text, a_presets jsonb,
 a_profile_accent_secondary text default '#6d48d8', a_gradient_angle integer default 135,
 a_gradient_strength integer default 30, a_gradient_motion boolean default false
) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mingle_has_premium(auth.uid()) then raise exception 'Premium is vereist'; end if;
 if a_frame not in ('none','gold','neon','galaxy')
 or a_app_theme not in ('default','midnight','aurora','ocean','royal')
 or a_name_effect not in ('none','gradient','glow','shimmer','neon','rainbow','holographic','outline','fire')
 or a_profile_accent !~ '^#[0-9a-fA-F]{6}$' or a_profile_accent_secondary !~ '^#[0-9a-fA-F]{6}$'
 or a_app_accent !~ '^#[0-9a-fA-F]{6}$' or a_gradient_angle not between 0 and 360
 or a_gradient_strength not between 0 and 100
 or jsonb_typeof(a_presets)<>'array' or jsonb_array_length(a_presets)>5
 then raise exception 'Ongeldige Premium-stijl'; end if;
 insert into public.premium_styles(user_id,frame,profile_accent,profile_accent_secondary,gradient_angle,gradient_strength,gradient_motion,app_theme,app_accent,name_effect,presets,updated_at)
 values(auth.uid(),a_frame,a_profile_accent,a_profile_accent_secondary,a_gradient_angle,a_gradient_strength,a_gradient_motion,a_app_theme,a_app_accent,a_name_effect,a_presets,now())
 on conflict(user_id) do update set frame=excluded.frame,profile_accent=excluded.profile_accent,
 profile_accent_secondary=excluded.profile_accent_secondary,gradient_angle=excluded.gradient_angle,
 gradient_strength=excluded.gradient_strength,gradient_motion=excluded.gradient_motion,
 app_theme=excluded.app_theme,app_accent=excluded.app_accent,name_effect=excluded.name_effect,
 presets=excluded.presets,updated_at=now();
end $$;
revoke all on function public.premium_save_style(text,text,text,text,text,jsonb,text,integer,integer,boolean) from public;
grant execute on function public.premium_save_style(text,text,text,text,text,jsonb,text,integer,integer,boolean) to authenticated;
-- Remove obsolete 6-argument function so no bypass of updated validation remains.
drop function if exists public.premium_save_style(text,text,text,text,text,jsonb);

-- Existing badges stay intact. Premium is calculated from the subscription and expires automatically.
create or replace function public.mingle_active_badges(uid uuid)
returns text[] language sql stable security definer set search_path=public as $$
 select array(
 select badge::text from public.profile_badges where user_id=uid and badge::text <> 'premium'
 union all select 'premium' where public.mingle_has_premium(uid)
 ) $$;
revoke all on function public.mingle_active_badges(uuid) from public;
grant execute on function public.mingle_active_badges(uuid) to authenticated;

-- Profile media upload guard: all GIFs and animated WebP files are Premium-only.
-- Storage metadata can be spoofed: inspect the actual file bytes on a trusted backend
-- before making an uploaded file publicly visible. Until that backend is deployed,
-- deny ALL WebP to non-Premium to prevent animated WebP bypass.
drop policy if exists "premium_profile_media_upload" on storage.objects;
-- IMPORTANT: inspect existing profile-media INSERT policies and replace permissive ones:
-- RLS policies are OR-combined, so an old permissive policy can bypass a new restriction.
-- Use the Supabase Storage dashboard to enforce this rule on every existing upload path.
