import { NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/security';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';
import { isPlanTier } from '@/lib/plans';

/**
 * Approve a client account after its trial / expired subscription (payment
 * confirmed): credit the paid cycles (months) the owner paid upfront and
 * extend their access accordingly. The trial deadline is removed. Used for
 * accounts whose trial/paid window has expired while the owner awaits approval.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const months = Math.min(24, Math.max(1, parseInt(body.months ?? '1', 10) || 1));
    const planTier = isPlanTier(body.plan_tier) ? body.plan_tier : undefined;

    const sb: any = await createServerSupabaseClient();
    if (!(await isSuperAdmin(sb))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const actorId = await superAdminProfileId(sb);

    const admin = createAdminSupabaseClient();
    const { data: reg } = await admin.from('registrations').select('*, organizations(id, plan, plan_tier, status)').eq('id', id).single();
    if (!reg) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!reg.organization_id) {
      return NextResponse.json({ error: 'This account has no organization.' }, { status: 409 });
    }
    const prevOrg = (reg.organizations as any) ?? null;
    // Abuse guard: only a trial-expired (or active) account may be re-approved
    // after payment. Never silently re-open suspended/rejected/pending accounts.
    const orgStatus = prevOrg?.status;
    if (orgStatus && !['active', 'trial_expired'].includes(orgStatus)) {
      return NextResponse.json({ error: `Cannot approve a ${orgStatus} organization.` }, { status: 409 });
    }

    const { data: credit, error: creditErr } = await admin.rpc('credit_paid_cycles', {
      p_organization_id: reg.organization_id,
      p_months: months,
      p_plan_tier: planTier ?? reg.plan_tier ?? prevOrg?.plan_tier ?? 'starter',
    });
    if (creditErr || !credit) {
      return NextResponse.json({ error: sanitizeError(creditErr?.message ?? '') || 'Failed to credit payment' }, { status: 500 });
    }

    const now = new Date().toISOString();
    await admin
      .from('registrations')
      .update({ status: 'active', plan_tier: credit.plan_tier ?? planTier ?? reg.plan_tier, approved_by: actorId, approved_at: now })
      .eq('id', id);

    if (actorId) {
      await platformAudit(actorId, {
        action: 'ACCOUNT_APPROVED_AFTER_TRIAL',
        entityType: 'registrations',
        entityId: id,
        oldValues: { plan: prevOrg?.plan ?? null, plan_tier: prevOrg?.plan_tier ?? null, status: prevOrg?.status ?? null },
        newValues: { plan: 'full', plan_tier: credit.plan_tier ?? planTier ?? null, status: 'active', months_paid: months, paid_cycles: credit.paid_cycles, access_ends_at: credit.access_ends_at, approved_at: now },
      });
    }

    return NextResponse.json({
      ok: true,
      plan: 'full',
      plan_tier: credit.plan_tier ?? planTier ?? null,
      status: 'active',
      trial_ends_at: null,
      paid_cycles: credit.paid_cycles,
      access_ends_at: credit.access_ends_at,
      months,
    });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e?.message ?? '') || 'Failed to approve account' }, { status: 500 });
  }
}