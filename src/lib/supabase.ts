import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
const { url, publishableKey } = supabaseConfig;
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && publishableKey.startsWith("sb_publishable_") && publishableKey !== "sb_publishable_REPLACE_ME";
export const supabase: SupabaseClient | null = configured ? createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
