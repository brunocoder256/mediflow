export type TrialGate = {
  organization_id: string | null;
  organization_name: string | null;
  status: string;
  plan: string;
  blocked: boolean;
  reason: string | null;
  trial_ends_at: string | null;
  paid_cycles: number;
  access_ends_at: string | null;
  trial_days: number;
  contact_phone_1: string;
  contact_phone_2: string;
};

export function isTrialActive(gate: TrialGate | null): boolean {
  return !!gate && gate.status === 'active' && gate.plan === 'trial' && !gate.blocked;
}

export function isPaidActive(gate: TrialGate | null): boolean {
  return !!gate && gate.status === 'active' && gate.plan === 'full' && !gate.blocked;
}

/** Start-of-day (local) for a date string so the countdown rolls over at midnight. */
function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

/**
 * Whole calendar days remaining until the given end timestamp.
 *
 * This rolls over at local midnight: on the day an order/trial starts it reports
 * the full remaining days (e.g. 3), the next calendar day reports 2, then 1, then
 * 0 once the end date is reached. Unlike a naive `Math.ceil(ms / 86400000)` it does
 * NOT keep showing "3" late on day two just because fewer than 48h have elapsed.
 */
function calendarDaysLeft(endISO: string | null): number {
  if (!endISO) return 0;
  const end = new Date(endISO);
  if (isNaN(end.getTime())) return 0;
  const today = new Date();
  const diffDays = Math.round((startOfDay(end) - startOfDay(today)) / 86_400_000);
  return Math.max(0, diffDays);
}

export function daysLeftInTrial(gate: TrialGate | null): number {
  if (!isTrialActive(gate) || !gate?.trial_ends_at) return 0;
  return calendarDaysLeft(gate.trial_ends_at);
}

export function daysLeftInAccess(gate: TrialGate | null): number {
  if (!gate?.access_ends_at || gate.blocked) return 0;
  return calendarDaysLeft(gate.access_ends_at);
}

// ---------------------------------------------------------------------------
// Offline persistence for the trial/access gate.
//
// The banner counts down from a fixed end date; that only works offline if we
// remember the last-known gate. We keep it in localStorage so the countdown (and
// the locked/expired state) still render when there is no network, and refresh
// it whenever a fresh server response arrives.
// ---------------------------------------------------------------------------

const GATE_CACHE_KEY = 'mediflow_gate_cache';

export function cacheGate(gate: TrialGate | null): void {
  if (typeof window === 'undefined' || !gate) return;
  try {
    localStorage.setItem(GATE_CACHE_KEY, JSON.stringify({ ...gate, _cached_at: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}

export function readCachedGate(): TrialGate | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.organization_id) return null;
    return parsed as TrialGate;
  } catch {
    return null;
  }
}

export function clearCachedGate(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GATE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}