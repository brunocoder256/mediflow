import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { TrialGate } from '@/lib/trial-utils';

/**
 * Server-side access/trial gate for the signed-in user.
 * Uses get_my_access_status() which lazily flips an expired active trial (or an
 * expired paid access window) to trial_expired and reports data-access blocking
 * + remaining paid cycles. Returns null when the client (or RPC) fails so
 * callers can fall back to allowing the request.
 */
export async function getTrialGate(): Promise<TrialGate | null> {
  try {
    const sb: any = await createServerSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.rpc('get_my_access_status');
    return data ?? null;
  } catch {
    return null;
  }
}