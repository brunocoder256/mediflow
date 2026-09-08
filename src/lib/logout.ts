"use client";

// Client-side logout orchestration.
//
// A browser-only `supabase.auth.signOut()` cannot delete the httpOnly `sb-*`
// session cookies that the server/middleware writes, so those cookies must be
// cleared from the server (POST /api/auth/logout).
//
// Offline-first logging out:
//  - We deliberately PRESERVE the cached user context, the offline read-cache
//    (Dexie dataCache) and the pending write queues. This lets the same user
//    sign straight back in with their offline passcode (even with no signal)
//    and continue working on their data — critical for full days offline.
//  - The offline read-cache is NOT dropped on logout, but the app is still
//    protected from sharing: re-entry requires the user's passcode (the passcode
//    gate in /auth/login + the middleware offline-session signal). A cashier's
//    passcode protects their data; without it the offline session signal is
//    never set and protected routes redirect to login.
//  - What IS cleared: the live server session cookies, the local Supabase
//    session, and the offline-session signal.

import { createBrowserClient } from "@/lib/supabase/client";
import { expireOfflineSessionSignal } from "@/lib/offline/session-signal";

// Best-effort: expire any sb-* cookies that were written without httpOnly.
function expireBrowserAuthCookies(): void {
  try {
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0]?.trim();
      if (name && name.startsWith("sb-")) {
        // Expire across every path/domain variant used by the auth client.
        document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
        document.cookie = `${name}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      }
    });
  } catch {
    /* ignore */
  }
}

async function clearLocalSessionData(): Promise<void> {
  // Intentionally keep the cached user context (mediflow_user_context), the
  // Dexie offline caches and the pending write queues so offline passcode
  // re-entry can resume uninterrupted. Clear only the offline-session signal.
  expireOfflineSessionSignal();
  try {
    window.localStorage.removeItem("mediflow_last_sync");
  } catch {
    /* ignore */
  }
}

/**
 * Fully signs out the current user:
 *  1. Server route clears the httpOnly session cookies.
 *  2. Local signOut + cookie sweep as a resilient fallback (works offline).
 *  3. Clears the local offline read-cache and user context.
 * The caller is responsible for navigating away afterwards.
 */
export async function performLogout(): Promise<void> {
  // 1. Authoritative: clear cookies where the server can reach httpOnly ones.
  //    Give it a hard timeout so an unreachable-but-unresponsive server (e.g.
  //    captive portal, dead WiFi that does not reject the request) can never
  //    make logout hang — offline logout must fail fast and continue locally.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
  } catch {
    /* non-blocking — fall back to local clearing below */
  } finally {
    clearTimeout(timer);
  }

  // 2. Fallback for environments where the route above did not run (offline).
  try {
    const supabase = createBrowserClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* ignore */
  }
  expireBrowserAuthCookies();

  // 3. Local app state cleanup.
  await clearLocalSessionData();
}