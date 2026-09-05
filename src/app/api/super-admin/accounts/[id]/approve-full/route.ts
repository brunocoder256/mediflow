import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';

/**
 * Approve a client account after its trial (payment confirmed): the trial
 * deadline is removed and the organization is set back to full, active access.
 * Used for accounts whose trial has expired while the owner awaits approval.
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

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .update({ plan: 'full', status: 'active', trial_ends_at: null, updated_at: new Date().toISOString() })
      .eq('id', reg.organization_id)
      .select('id, plan, status, trial_ends_at')
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
        oldValues: { plan: org.plan, status: org.status },
        newValues: { plan: 'full', status: 'active', approved_at: now },
      });
    }

    return NextResponse.json({ ok: true, plan: 'full', status: 'active', trial_ends_at: null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to approve account' }, { status: 500 });
  }
}