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
