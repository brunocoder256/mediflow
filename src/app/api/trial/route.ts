import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTrialGate } from '@/lib/trial';

/** Current user's trial status — contact info, plan, deadline, lazy expiry flip. */
export async function GET() {
  const sb: any = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const gate = await getTrialGate();
  if (!gate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(gate);
}