import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { TrialGate } from '@/lib/trial-utils';

/**
 * Server-side trial gate for the signed-in user.
 * Uses get_my_trial_status() which lazily flips an expired active trial to
 * trial_expired. Returns null when the client (or RPC) fails so callers can
 * fall back to allowing the request.
 */
export async function getTrialGate(): Promise<TrialGate | null> {
  try {
    const sb: any = await createServerSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.rpc('get_my_trial_status');
    return data ?? null;
  } catch {
    return null;
  }
}