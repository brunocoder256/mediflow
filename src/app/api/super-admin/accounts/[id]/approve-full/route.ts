import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';

/**
 * Approve a client account after its trial (payment confirmed): the trial
 * deadline is removed and the organization is set back to full, active access
 * for a new paid cycle (paid_until = max(now, current paid_until) + cycle_days).
 * The account will lazily lapse again when the new cycle ends, so the owner
 * must be re-approved each month (monthly auto-cycle).
 */
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

    const { data: ps } = await admin.from('platform_settings').select('cycle_days').eq('id', 1).single();
    const cycleDays = Math.max(1, ps?.cycle_days ?? 30);

    const { data: current } = await admin
      .from('organizations')
      .select('id, plan, status, paid_until')
      .eq('id', reg.organization_id)
      .single();

    const base = Math.max(
      Date.now(),
      current?.paid_until ? new Date(current.paid_until).getTime() : 0,
    );
    const paidUntil = new Date(base + cycleDays * 86_400_000).toISOString();

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .update({ plan: 'full', status: 'active', trial_ends_at: null, paid_until: paidUntil, updated_at: new Date().toISOString() })
      .eq('id', reg.organization_id)
      .select('id, plan, status, trial_ends_at, paid_until')
      .single();
    if (orgErr || !org) return NextResponse.json({ error: orgErr?.message || 'Failed to approve account' }, { status: 500 });

    const now = new Date().toISOString();
    await admin
      .from('registrations')
      .update({ status: 'active', approved_by: actorId, approved_at: now })
      .eq('id', id);

    if (actorId) {
      await platformAudit(actorId, {
        action: 'ACCOUNT_APPROVED_AFTER_TRIAL',
        entityType: 'registrations',
        entityId: id,
        oldValues: { plan: current?.plan ?? org.plan, status: current?.status ?? org.status },
        newValues: { plan: 'full', status: 'active', paid_until: paidUntil, approved_at: now },
      });
    }

    return NextResponse.json({ ok: true, plan: 'full', status: 'active', trial_ends_at: null, paid_until: paidUntil, cycle_days: cycleDays });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to approve account' }, { status: 500 });
  }
}