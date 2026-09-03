import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! ||
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined)!;

export function createBrowserClient() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or PUBLISHABLE_KEY');
  }
  return createSupabaseBrowserClient<Database>(supabaseUrl, supabaseKey);
}
