import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

let client: ReturnType<typeof createClient<Database>> | null = null;

export function createBrowserClient() {
  if (client) return client;
  client = createClient<Database>(supabaseUrl, supabaseKey);
  return client;
}
