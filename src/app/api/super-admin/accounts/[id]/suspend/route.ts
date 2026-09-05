import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';

/** Suspend an active client account: blocks all logins for its organization. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb: any = await createServerSupabaseClient();
    if (!(await isSuperAdmin(sb))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const actorId = await superAdminProfileId(sb);

    const admin = createAdminSupabaseClient();
    const { data: reg } = await admin.from('registrations').select('*').eq('id', id).single();
    if (!reg) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (reg.status !== 'active') {
      return NextResponse.json({ error: 'Only active accounts can be suspended.' }, { status: 409 });
    }

    const { data: updated, error } = await admin
      .from('registrations')
      .update({ status: 'suspended' })
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .single();
    if (error || !updated) return NextResponse.json({ error: 'This account was already updated.' }, { status: 409 });

    if (reg.organization_id) {
      await admin.from('organizations').update({ status: 'suspended' }).eq('id', reg.organization_id);
    }

    if (actorId) {
      await platformAudit(actorId, {
        action: 'ACCOUNT_SUSPENDED',
        entityType: 'registrations',
        entityId: id,
        oldValues: { status: 'active' },
        newValues: { status: 'suspended', organization_id: reg.organization_id },
      });
    }

    return NextResponse.json({ ok: true, status: 'suspended' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Suspension failed' }, { status: 500 });
  }
}