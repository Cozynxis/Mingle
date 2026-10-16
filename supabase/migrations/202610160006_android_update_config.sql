-- Public read-only Android update settings, writable only through existing admin_save_setting RPC.
CREATE OR REPLACE FUNCTION public.mingle_android_update_config()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public
AS $body$
 SELECT COALESCE(
   (SELECT CASE WHEN value IS NOT NULL AND left(trim(value),1)='{' THEN value::jsonb ELSE NULL END
    FROM public.admin_settings WHERE key='android_update' LIMIT 1),
   '{"enabled":false,"required":false,"versionCode":1,"versionName":"1.0.0","title":"Mingle update","description":"","color":"#9465f5","apkUrl":""}'::jsonb
 );
$body$;
REVOKE ALL ON FUNCTION public.mingle_android_update_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mingle_android_update_config() TO anon, authenticated;

-- Dedicated admin publishing endpoint with server-side validation.
CREATE OR REPLACE FUNCTION public.mingle_admin_publish_android_update(config jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $body$
DECLARE url text := config->>'apkUrl'; code integer;
BEGIN
 IF NOT public.mingle_is_admin() THEN RAISE EXCEPTION 'Geen adminrechten'; END IF;
 IF jsonb_typeof(config) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Ongeldig updatebericht'; END IF;
 IF (config->>'versionCode') !~ '^[0-9]{1,9}$' THEN RAISE EXCEPTION 'Ongeldige versiecode'; END IF;
 code := (config->>'versionCode')::integer;
 IF code<1 OR length(config::text)>4000 OR length(coalesce(config->>'title',''))>90 OR length(coalesce(config->>'description',''))>1200
 OR coalesce(config->>'color','#9465f5') !~ '^#[0-9a-fA-F]{6}$'
 OR url !~ '^https://github[.]com/Cozynxis/Mingle/releases/download/[A-Za-z0-9._/-]+[.]apk$'
 OR jsonb_typeof(config->'required') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(config->'enabled') IS DISTINCT FROM 'boolean'
 THEN RAISE EXCEPTION 'Ongeldige Android-updateconfiguratie'; END IF;
 INSERT INTO public.admin_settings(key,value,updated_at) VALUES('android_update',config::text,now())
 ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now();
 INSERT INTO public.admin_audit_logs(actor_id,action,details) VALUES(auth.uid(),'android_update_published',jsonb_build_object('versionCode',code));
END;
$body$;
REVOKE ALL ON FUNCTION public.mingle_admin_publish_android_update(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mingle_admin_publish_android_update(jsonb) TO authenticated;
