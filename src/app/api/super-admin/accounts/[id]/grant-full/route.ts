import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';

/** Grant full (paid) access to a client organization based on months paid. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const months = Math.min(24, Math.max(1, parseInt(body.months ?? '1', 10) || 1));

    const sb: any = await createServerSupabaseClient();
    if (!(await isSuperAdmin(sb))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const actorId = await superAdminProfileId(sb);

    const admin = createAdminSupabaseClient();
    const { data: reg } = await admin.from('registrations').select('*').eq('id', id).single();
    if (!reg) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!reg.organization_id) {
      return NextResponse.json({ error: 'This account has no organization.' }, { status: 409 });
    }

    const { data: credit, error: creditErr } = await admin.rpc('credit_paid_cycles', {
      p_organization_id: reg.organization_id,
      p_months: months,
    });
    if (creditErr || !credit) {
      return NextResponse.json({ error: creditErr?.message || 'Failed to grant access' }, { status: 500 });
    }

    if (actorId) {
      await platformAudit(actorId, {
        action: 'FULL_ACCESS_GRANTED',
        entityType: 'registrations',
        entityId: id,
        oldValues: { plan: reg.organizations?.plan ?? null, status: reg.organizations?.status ?? null },
        newValues: { plan: 'full', status: 'active', months_paid: months },
      });
    }

    return NextResponse.json({
      ok: true,
      plan: 'full',
      status: 'active',
      trial_ends_at: null,
      paid_cycles: credit.paid_cycles,
      access_ends_at: credit.access_ends_at,
      months,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to grant access' }, { status: 500 });
  }
}