import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Public: create a pharmacy account application (Create Account page). No account is created until Super Admin approval. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sb: any = await createServerSupabaseClient();
    const { data, error } = await sb.rpc('register_account', {
      p_business_name: body.business_name,
      p_business_type: body.business_type,
      p_owner_full_name: body.owner_full_name,
      p_owner_email: body.owner_email,
      p_owner_phone: body.owner_phone,
      p_location: body.location,
    });
    if (error) {
      const msg = String(error.message || '');
      if (msg.includes('EMAIL_ALREADY_REGISTERED')) {
        return NextResponse.json(
          { error: 'This email already has an application in progress. Please wait for the MediFlow team to contact you.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ registration: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unable to submit your application' }, { status: 400 });
  }
}