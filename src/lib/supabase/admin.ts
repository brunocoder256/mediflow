import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for privileged admin operations
 * (invite users, manage other profiles' roles/branches).
 * Never import this into client components.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Server misconfigured: SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required for user administration',
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
