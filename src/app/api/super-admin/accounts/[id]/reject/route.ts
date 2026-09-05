import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb: any = await createServerSupabaseClient();
    if (!(await isSuperAdmin(sb))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const actorId = await superAdminProfileId(sb);

    const body = await req.json();
    const reason = String(body.reason ?? '').trim();
    if (!reason) return NextResponse.json({ error: 'A rejection reason is required.' }, { status: 400 });

    const admin = createAdminSupabaseClient();
    const { data: reg } = await admin.from('registrations').select('*').eq('id', id).single();
    if (!reg) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    if (reg.status !== 'pending') {
      return NextResponse.json({ error: 'This application is no longer pending approval.' }, { status: 409 });
    }

    const { data: updated, error } = await admin
      .from('registrations')
      .update({ status: 'rejected', rejection_reason: reason, rejected_by: actorId, rejected_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();
    if (error || !updated) return NextResponse.json({ error: 'This application was already processed.' }, { status: 409 });

    if (actorId) {
      await platformAudit(actorId, {
        action: 'ACCOUNT_REJECTED',
        entityType: 'registrations',
        entityId: id,
        oldValues: { status: 'pending' },
        newValues: { status: 'rejected', reason },
      });
    }

    return NextResponse.json({ ok: true, status: 'rejected' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Rejection failed' }, { status: 500 });
  }
}