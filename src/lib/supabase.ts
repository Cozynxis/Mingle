import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { supabaseConfig } from "./config";

const { url, publishableKey } = supabaseConfig;
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && publishableKey.startsWith("sb_publishable_") && publishableKey !== "sb_publishable_REPLACE_ME";

const nativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const TAB_KEY = "mingle-v3-tab-identity";
const id = () => crypto.randomUUID();

// sessionStorage can be COPIED when opening/duplicating a tab. Detect another
// live document owning the copied ID before initializing Supabase Auth.
// Initialize synchronously for the supported Vite browser targets. A new tab
// gets a fresh session; refreshing an existing tab keeps its own session.
const tabId = (() => {
  try {
    const existing = sessionStorage.getItem(TAB_KEY);
    if (existing) return existing;
    const fresh = id();
    sessionStorage.setItem(TAB_KEY, fresh);
    return fresh;
  } catch {
    return id();
  }
})();
const storageEntry = nativeAndroid ? "mingle-v3-android-auth" : `mingle-v3-auth-${tabId}`;
const authStorage: Storage = nativeAndroid ? localStorage : sessionStorage;
// Restore sessions saved by the previous Mingle auth implementation during
// the migration to stable per-tab storage. Keep the same key on refresh.
try {
  if (!authStorage.getItem(storageEntry)) {
    const previous = sessionStorage.getItem("mingle-auth-current-session");
    if (previous) {
      authStorage.setItem(storageEntry, previous);
      sessionStorage.removeItem("mingle-auth-current-session");
    }
  }
} catch { /* private browsing or disabled storage */ }
const tabStorage = {
  getItem: (_key: string): string | null => {
    try { return authStorage.getItem(storageEntry); } catch { return null; }
  },
  setItem: (_key: string, value: string): void => {
    try { authStorage.setItem(storageEntry, value); } catch { /* storage disabled */ }
  },
  removeItem: (_key: string): void => {
    try { authStorage.removeItem(storageEntry); } catch { /* storage disabled */ }
  },
};

// Each tab has its own storage AND its own Supabase auth broadcast channel.
// This preserves login on refresh but never syncs login/logout between tabs.
export const supabase: SupabaseClient | null = configured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: tabStorage,
        storageKey: nativeAndroid ? "mingle-v3-android-supabase" : `mingle-v3-supabase-${tabId}`,
      },
    })
  : null;
