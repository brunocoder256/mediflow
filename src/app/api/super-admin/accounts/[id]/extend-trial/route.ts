import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';

/** Extend a trial-expired (or trialing) client account by N more days. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const days = Math.min(90, Math.max(1, parseInt(body.trial_days ?? '3', 10) || 3));

    const sb: any = await createServerSupabaseClient();
    if (!(await isSuperAdmin(sb))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const actorId = await superAdminProfileId(sb);

    const admin = createAdminSupabaseClient();
    const { data: reg } = await admin.from('registrations').select('*').eq('id', id).single();
    if (!reg) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!reg.organization_id) {
      return NextResponse.json({ error: 'This account has no organization to extend.' }, { status: 409 });
    }
    if (reg.status !== 'active') {
      return NextResponse.json({ error: 'Only active accounts can have their trial extended.' }, { status: 409 });
    }

    const { data: org } = await admin.from('organizations').select('id, plan, status, trial_ends_at').eq('id', reg.organization_id).single();
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    if (org.status !== 'trial_expired' && org.status !== 'active') {
      return NextResponse.json({ error: `Cannot extend a ${org.status} organization.` }, { status: 409 });
    }

    const now = new Date();
    const base = org.status === 'active' && org.trial_ends_at && new Date(org.trial_ends_at) > now
      ? new Date(org.trial_ends_at)
      : now;
    const trialEndsAt = new Date(base.getTime() + days * 86_400_000).toISOString();

    const { data: updated, error } = await admin
      .from('organizations')
      .update({ plan: 'trial', status: 'active', trial_ends_at: trialEndsAt, updated_at: new Date().toISOString() })
      .eq('id', org.id)
      .select('id, plan, status, trial_ends_at')
      .single();
    if (error || !updated) return NextResponse.json({ error: error?.message || 'Failed to extend trial' }, { status: 500 });

    if (actorId) {
      await platformAudit(actorId, {
        action: 'TRIAL_EXTENDED',
        entityType: 'registrations',
        entityId: id,
        oldValues: { plan: org.plan, status: org.status, trial_ends_at: org.trial_ends_at },
        newValues: { plan: 'trial', status: 'active', trial_ends_at: trialEndsAt, extended_days: days },
      });
    }

    return NextResponse.json({ ok: true, plan: 'trial', status: 'active', trial_ends_at: trialEndsAt, trial_days: days });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to extend trial' }, { status: 500 });
  }
}