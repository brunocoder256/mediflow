"use client";

// Offline-session signal.
//
// A browser signal (localStorage + a non-httpOnly cookie) that records that the
// on-device user has successfully entered their passcode and is authorized to use
// the app while offline (no live Supabase session yet). The middleware reads the
// cookie on navigation so it can let the passcode-authorized user into the app
// shell; real server APIs still require a live session and will reject when
// offline-without-session (offline reads come from the local Dexie cache).
//
// This module MUST only be imported from "use client" code. The middleware reads
// the cookie itself via request.cookies (server-side) — it does not import this.

const SESSION_LOCAL_KEY = "mediflow_offline_session";
export const OFFLINE_SESSION_COOKIE = "mediflow_offline_session";
// Offline access is a shift-length grant: re-enter the passcode daily rather
// than staying unlocked for a month (stolen/loaned device risk).
const COOKIE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface OfflineGrant {
  exp: number;
  granted_at: string;
  nonce: string;
}

/** Marks this device as passcode-authorized for offline use (survives page loads). */
export function authorizeOfflineSessionSignal(ttlMs: number = COOKIE_TTL_MS): void {
  try {
    const exp = Date.now() + ttlMs;
    const grant: OfflineGrant = {
      exp,
      granted_at: new Date().toISOString(),
      nonce: crypto.randomUUID(),
    };
    window.localStorage.setItem(SESSION_LOCAL_KEY, JSON.stringify(grant));
    const expires = new Date(exp).toUTCString();
    document.cookie = `${OFFLINE_SESSION_COOKIE}=1; Path=/; Expires=${expires}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function isOfflineSessionAuthorized(): boolean {
  try {
    const raw = window.localStorage.getItem(SESSION_LOCAL_KEY);
    if (!raw) return false;
    // Backwards-compat: legacy value was an ISO timestamp string.
    if (!raw.startsWith("{")) return true;
    const grant = JSON.parse(raw) as OfflineGrant;
    if (!grant?.exp || Date.now() > grant.exp) {
      expireOfflineSessionSignal();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function expireOfflineSessionSignal(): void {
  try {
    window.localStorage.removeItem(SESSION_LOCAL_KEY);
    document.cookie = `${OFFLINE_SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
