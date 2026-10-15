import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

const { url, publishableKey } = supabaseConfig;
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && publishableKey.startsWith("sb_publishable_") && publishableKey !== "sb_publishable_REPLACE_ME";

// Store the current account only in this tab's sessionStorage. Unlike
// localStorage, sessionStorage is not shared between independent tabs.
// A fixed storage entry survives refreshes within this tab.
const SESSION_ENTRY = "mingle-auth-current-session";
const tabSessionStorage = {
  getItem: (_key: string): string | null => {
    try { return sessionStorage.getItem(SESSION_ENTRY); } catch { return null; }
  },
  setItem: (_key: string, value: string): void => {
    try { sessionStorage.setItem(SESSION_ENTRY, value); } catch { /* storage disabled */ }
  },
  removeItem: (_key: string): void => {
    try { sessionStorage.removeItem(SESSION_ENTRY); } catch { /* storage disabled */ }
  },
};

// Supabase uses storageKey as its cross-tab BroadcastChannel name.
// A fresh key on EVERY page load prevents duplicated tabs (which can copy
// sessionStorage) from sharing auth events. Storage itself remains stable.
const isolatedAuthChannelKey = `mingle-auth-isolated-${crypto.randomUUID()}`;

export const supabase: SupabaseClient | null = configured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: tabSessionStorage,
        storageKey: isolatedAuthChannelKey,
      },
    })
  : null;
