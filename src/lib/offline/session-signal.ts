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
const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — long offline windows

/** Marks this device as passcode-authorized for offline use (survives page loads). */
export function authorizeOfflineSessionSignal(): void {
  try {
    window.localStorage.setItem(SESSION_LOCAL_KEY, new Date().toISOString());
    const expires = new Date(Date.now() + COOKIE_TTL_MS).toUTCString();
    document.cookie = `${OFFLINE_SESSION_COOKIE}=1; Path=/; Expires=${expires}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function isOfflineSessionAuthorized(): boolean {
  try {
    return window.localStorage.getItem(SESSION_LOCAL_KEY) !== null;
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
