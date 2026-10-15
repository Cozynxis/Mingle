import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

const { url, publishableKey } = supabaseConfig;
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && publishableKey.startsWith("sb_publishable_") && publishableKey !== "sb_publishable_REPLACE_ME";

const TAB_KEY = "mingle-v3-tab-identity";
const CHANNEL = "mingle-v3-tab-ownership";
const id = () => crypto.randomUUID();

// sessionStorage can be COPIED when opening/duplicating a tab. Detect another
// live document owning the copied ID before initializing Supabase Auth.
async function establishTabIdentity(): Promise<string> {
  let tabId: string;
  try {
    tabId = sessionStorage.getItem(TAB_KEY) || id();
    sessionStorage.setItem(TAB_KEY, tabId);
  } catch {
    return id();
  }
  if (typeof BroadcastChannel === "undefined") return tabId;
  const channel = new BroadcastChannel(CHANNEL);
  const instanceId = id();
  let duplicate = false;
  channel.onmessage = (event: MessageEvent) => {
    const msg = event.data as { type?: string; tabId?: string; instanceId?: string };
    if (!msg || msg.instanceId === instanceId) return;
    if (msg.type === "probe" && msg.tabId === tabId) {
      channel.postMessage({ type: "present", tabId, instanceId });
    } else if (msg.type === "present" && msg.tabId === tabId) {
      duplicate = true;
    }
  };
  channel.postMessage({ type: "probe", tabId, instanceId });
  await new Promise<void>(resolve => setTimeout(resolve, 200));
  if (duplicate) {
    // This document is a NEW copy of an existing tab. Never reuse its
    // inherited refresh token, which could invalidate the original session.
    tabId = id();
    try {
      sessionStorage.setItem(TAB_KEY, tabId);
      sessionStorage.removeItem("mingle-auth-current-session");
    } catch { /* storage disabled */ }
  }
  // Keep responding to probes for this tab's lifetime.
  channel.onmessage = (event: MessageEvent) => {
    const msg = event.data as { type?: string; tabId?: string; instanceId?: string };
    if (msg?.type === "probe" && msg.tabId === tabId && msg.instanceId !== instanceId) {
      channel.postMessage({ type: "present", tabId, instanceId });
    }
  };
  window.addEventListener("pagehide", () => channel.close(), { once: true });
  return tabId;
}

const tabId = await establishTabIdentity();
const storageEntry = `mingle-v3-auth-${tabId}`;
const tabStorage = {
  getItem: (_key: string): string | null => {
    try { return sessionStorage.getItem(storageEntry); } catch { return null; }
  },
  setItem: (_key: string, value: string): void => {
    try { sessionStorage.setItem(storageEntry, value); } catch { /* storage disabled */ }
  },
  removeItem: (_key: string): void => {
    try { sessionStorage.removeItem(storageEntry); } catch { /* storage disabled */ }
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
        storageKey: `mingle-v3-supabase-${tabId}`,
      },
    })
  : null;
