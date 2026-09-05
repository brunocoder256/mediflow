import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';

/** Grant full (paid) access to a client organization: permanent, no trial deadline and no renewal cycle. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb: any = await createServerSupabaseClient();
    if (!(await isSuperAdmin(sb))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const actorId = await superAdminProfileId(sb);

    const admin = createAdminSupabaseClient();
    const { data: reg } = await admin.from('registrations').select('*').eq('id', id).single();
    if (!reg) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!reg.organization_id) {
      return NextResponse.json({ error: 'This account has no organization.' }, { status: 409 });
    }

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .update({ plan: 'full', status: 'active', trial_ends_at: null, paid_until: null, updated_at: new Date().toISOString() })
      .eq('id', reg.organization_id)
      .select('id, plan, status, trial_ends_at, paid_until')
      .single();
    if (orgErr || !org) return NextResponse.json({ error: orgErr?.message || 'Failed to grant access' }, { status: 500 });

    if (actorId) {
      await platformAudit(actorId, {
        action: 'FULL_ACCESS_GRANTED',
        entityType: 'registrations',
        entityId: id,
        oldValues: { plan: org.plan, status: org.status },
        newValues: { plan: 'full', status: 'active', paid_until: null },
      });
    }

    return NextResponse.json({ ok: true, plan: 'full', status: 'active', trial_ends_at: null, paid_until: null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to grant access' }, { status: 500 });
  }
}