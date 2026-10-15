import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

const { url, publishableKey } = supabaseConfig;
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && publishableKey.startsWith("sb_publishable_") && publishableKey !== "sb_publishable_REPLACE_ME";

// Each browser tab has a separate storage key AND sessionStorage.
// Supabase's auth BroadcastChannel is scoped to the storage key, so a sign-out
// or sign-in in one tab won't overwrite the session in another tab.
const TAB_ID_KEY = "mingle-auth-tab-id";
function getTabId(): string {
  try {
    let id = sessionStorage.getItem(TAB_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(TAB_ID_KEY, id);
    }
    return id;
  } catch {
    // sessionStorage may be unavailable in restricted browser contexts.
    return crypto.randomUUID();
  }
}
const tabStorageKey = `mingle-auth-${getTabId()}`;

export const supabase: SupabaseClient | null = configured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: sessionStorage,
        storageKey: tabStorageKey,
      },
    })
  : null;
