import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export function createBrowserClient() {
  return createSupabaseBrowserClient<Database>(supabaseUrl, supabaseKey);
}
