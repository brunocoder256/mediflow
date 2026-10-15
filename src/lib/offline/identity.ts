"use client";

// Current-session identity for offline writes.
//
// The offline write queue lives in a single browser-scoped IndexedDB that is
// shared by every account that signs in on the same device. To keep one
// organization's queued work from being shown/replayed under another's session,
// every queued entry is stamped with the owning organization_id (and user_id for
// provenance) at enqueue time, and both the Sync Center and the replay engine
// are scoped to the current owner.
//
// The owner is resolved from an in-memory value (populated from /api/me by the
// dashboard shell) with the persisted offline user-context as a fallback, so
// stamping still works while offline.

import { readUserContext } from "./user-context";

export interface SyncOwner {
  organization_id: string | null;
  user_id: string | null;
}

let memoryOwner: Partial<SyncOwner> = {};

/** Cache the signed-in owner in memory (called when /api/me resolves). */
export function setSyncOwner(owner: Partial<SyncOwner>): void {
  memoryOwner = { ...memoryOwner, ...owner };
}

/** Clear the cached owner (on logout, so a new session cannot inherit it). */
export function clearSyncOwner(): void {
  memoryOwner = {};
}

/**
 * Resolve the owner to stamp queued writes with. Prefers the freshly-fetched
 * in-memory identity, falling back to the persisted offline user-context.
 */
export function getSyncOwner(): SyncOwner {
  let ctx: { organization_id?: string | null; user_id?: string | null } | null = null;
  try {
    ctx = readUserContext();
  } catch {
    ctx = null;
  }
  return {
    organization_id: memoryOwner.organization_id ?? ctx?.organization_id ?? null,
    user_id: memoryOwner.user_id ?? ctx?.user_id ?? null,
  };
}

export function getSyncOrgId(): string | null {
  return getSyncOwner().organization_id;
}
