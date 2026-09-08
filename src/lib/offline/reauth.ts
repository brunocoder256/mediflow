"use client";

// Silent online re-authentication for offline-passcode sessions.
//
// When a user signs in with their passcode while offline, there is no live
// Supabase server session (the app renders from the offline Dexie cache). As
// soon as the device regains connectivity, this module silently re-establishes
// the REAL server session from the stored Supabase refresh token + email
// (see storeReauthToken in lib/passcode), without prompting or losing any data.
// Once the server session is restored, the existing auto-sync (setupAutoSync)
// flushes all queued offline writes.

import { createBrowserClient } from "@/lib/supabase/client";
import { readReauthToken, clearReauthToken } from "@/lib/passcode";

export interface ReauthResult {
  restored: boolean;
  reason: "online-session" | "refresh" | "login-fallback" | "none";
}

/**
 * Attempt to restore a live Supabase server session when we detect we came in
 * via offline passcode and are now online. Safe to call repeatedly; it is a
 * no-op when a live session already exists or no reauth token is present.
 */
export async function tryRestoreServerSession(): Promise<ReauthResult> {
  if (typeof window === "undefined") return { restored: false, reason: "none" };
  if (!navigator.onLine) return { restored: false, reason: "none" };

  const supabase = createBrowserClient();

  // If we already have a live local/session, nothing to do.
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { restored: true, reason: "online-session" };
    }
  } catch {
    /* continue */
  }

  const creds = readReauthToken();
  if (!creds) return { restored: false, reason: "none" };

  // Fast path: exchange the stored refresh token for a fresh server session.
  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: "",
      refresh_token: creds.refresh_token,
    });
    if (!error && data.session?.access_token) {
      return { restored: true, reason: "refresh" };
    }
  } catch {
    /* fall through to clearing stale token below */
  }

  // The refresh token was expired/revoked (long offline window). Drop it so we
  // don't attempt endlessly; the user can sign in normally when convenient.
  clearReauthToken();
  return { restored: false, reason: "none" };
}
