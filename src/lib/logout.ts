"use client";

// Client-side logout orchestration.
//
// A browser-only `supabase.auth.signOut()` cannot delete the httpOnly `sb-*`
// session cookies that the server/middleware writes, so those cookies must be
// cleared from the server (POST /api/auth/logout). We also wipe the local
// offline read-cache and user context so a shared terminal never leaks the
// previous cashier's cached profile/products to the next sign-in. Pending
// offline writes (queued sales, purchases, suppliers, etc.) are intentionally
// PRESERVED so unsynced transactions are never lost by logging out.

import { createBrowserClient } from "@/lib/supabase/client";
import { clearUserContext } from "@/lib/offline/user-context";
import { db } from "@/lib/offline/db";

const BRANCH_STORAGE_KEY = "mediflow.active_branch";

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
  try {
    clearUserContext();
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(BRANCH_STORAGE_KEY);
    window.localStorage.removeItem("mediflow_last_sync");
  } catch {
    /* ignore */
  }
  // Drop the generic read-cache so a different user/org never sees stale data,
  // but keep the pending write-queue tables (syncQueue, pendingSales,
  // cachedPurchases/Suppliers/Returns/Expenses/Customers).
  try {
    await db.dataCache.clear();
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
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    /* non-blocking — fall back to local clearing below */
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