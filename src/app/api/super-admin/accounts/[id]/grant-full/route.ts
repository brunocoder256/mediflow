import { NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/security';
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
    const { data: reg } = await admin.from('registrations').select('*, organizations(id, plan, status)').eq('id', id).single();
    if (!reg) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!reg.organization_id) {
      return NextResponse.json({ error: 'This account has no organization.' }, { status: 409 });
    }
    const prevOrg = (reg.organizations as any) ?? null;
    // Abuse guard: full access may only be granted to an account that is
    // currently active (trial or paid) or trial-expired. Never re-open a
    // suspended, rejected, or pending account through this route.
    const orgStatus = prevOrg?.status;
    if (orgStatus && !['active', 'trial_expired'].includes(orgStatus)) {
      return NextResponse.json({ error: `Cannot grant full access to a ${orgStatus} organization.` }, { status: 409 });
    }

    const { data: credit, error: creditErr } = await admin.rpc('credit_paid_cycles', {
      p_organization_id: reg.organization_id,
      p_months: months,
    });
    if (creditErr || !credit) {
      return NextResponse.json({ error: sanitizeError(creditErr?.message ?? '') || 'Failed to grant access' }, { status: 500 });
    }

    if (actorId) {
      await platformAudit(actorId, {
        action: 'FULL_ACCESS_GRANTED',
        entityType: 'registrations',
        entityId: id,
        oldValues: { plan: prevOrg?.plan ?? null, status: prevOrg?.status ?? null },
        newValues: { plan: 'full', status: 'active', months_paid: months, paid_cycles: credit.paid_cycles, access_ends_at: credit.access_ends_at },
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
    return NextResponse.json({ error: sanitizeError(e?.message ?? '') || 'Failed to grant access' }, { status: 500 });
  }
}