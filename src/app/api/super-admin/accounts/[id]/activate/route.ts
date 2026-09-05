import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';

/** Reactivate a suspended client account: users can log in again. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb: any = await createServerSupabaseClient();
    if (!(await isSuperAdmin(sb))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const actorId = await superAdminProfileId(sb);

    const admin = createAdminSupabaseClient();
    const { data: reg } = await admin.from('registrations').select('*').eq('id', id).single();
    if (!reg) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (reg.status !== 'suspended') {
      return NextResponse.json({ error: 'Only suspended accounts can be activated.' }, { status: 409 });
    }

    const { data: updated, error } = await admin
      .from('registrations')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('status', 'suspended')
      .select()
      .single();
    if (error || !updated) return NextResponse.json({ error: 'This account was already updated.' }, { status: 409 });

    if (reg.organization_id) {
      await admin.from('organizations').update({ status: 'active' }).eq('id', reg.organization_id);
    }

    if (actorId) {
      await platformAudit(actorId, {
        action: 'ACCOUNT_ACTIVATED',
        entityType: 'registrations',
        entityId: id,
        oldValues: { status: 'suspended' },
        newValues: { status: 'active', organization_id: reg.organization_id },
      });
    }

    return NextResponse.json({ ok: true, status: 'active' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Activation failed' }, { status: 500 });
  }
}