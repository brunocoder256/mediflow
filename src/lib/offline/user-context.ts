"use client";

// Offline user-context cache.
//
// The signed-in user's identity (profile, organization, branches) is cached in
// localStorage so that the POS's cashier name (and the dashboard shell) can be
// rendered even while offline. This is a best-effort cache: when online the live
// values are used and the cache is refreshed.

const KEY = "mediflow_user_context";
// Cached user context must survive long offline sessions (a full day or more in
// low-connectivity areas). It is only removed on explicit logout (which now
// preserves it for offline passcode re-entry) or when overwritten — so no TTL.
const TTL_MS = Number.POSITIVE_INFINITY;

interface UserContext {
  full_name: string;
  email?: string | null;
  organization_id?: string | null;
  branch?: string | null;
  branches?: Array<{ id: string; name: string; code: string }>;
  organization_settings?: Record<string, unknown>;
  cached_at: string;
}

function isFresh(ctx: UserContext | null): boolean {
  if (!ctx) return false;
  try {
    const cached = new Date(ctx.cached_at).getTime();
    return Date.now() - cached < TTL_MS;
  } catch {
    return false;
  }
}

export function readUserContext(): UserContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserContext;
  } catch {
    return null;
  }
}

export function writeUserContext(patch: Partial<UserContext>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readUserContext() ?? ({} as UserContext);
    const next: UserContext = {
      ...existing,
      ...patch,
      cached_at: new Date().toISOString(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function clearUserContext(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Returns cached user context as a fallback cashier name (best-effort, may be "").
export function getCachedCashierName(): string {
  const ctx = readUserContext();
  return ctx?.full_name ?? "";
}
