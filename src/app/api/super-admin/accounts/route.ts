import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { isSuperAdmin } from '@/lib/super-admin';

const VALID_STATUS = ['pending', 'active', 'suspended', 'rejected', 'trial_expired'];

/** Super Admin: list account registrations with server-side search/filter/pagination. */
export async function GET(req: Request) {
  try {
    const sb: any = await createServerSupabaseClient();
    if (!(await isSuperAdmin(sb))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // registrations has no direct SELECT grant for app roles (Super Admin only),
    // so reads use the service-role client after the authenticated guard above.
    const admin = createAdminSupabaseClient();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim();
    const status = searchParams.get('status') ?? 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('perPage') ?? '15', 10) || 15));

    let query: any = admin.from('registrations').select('*', { count: 'exact', head: true });
    if (status !== 'all' && VALID_STATUS.includes(status)) {
      if (status === 'trial_expired') query = query.eq('organizations.status', 'trial_expired');
      else query = query.eq('status', status);
    }
    if (q) {
      query = query.or(
        `reference.ilike.%${q}%,business_name.ilike.%${q}%,owner_full_name.ilike.%${q}%,owner_email.ilike.%${q}%,owner_phone.ilike.%${q}%`,
      );
    }
    const { count } = await query;

    let rowsQ: any = admin
      .from('registrations')
      .select('*, organizations(id, name, plan, status, trial_ends_at)');
    if (status !== 'all' && VALID_STATUS.includes(status)) {
      if (status === 'trial_expired') rowsQ = rowsQ.eq('organizations.status', 'trial_expired');
      else rowsQ = rowsQ.eq('status', status);
    }
    if (q) {
      rowsQ = rowsQ.or(
        `reference.ilike.%${q}%,business_name.ilike.%${q}%,owner_full_name.ilike.%${q}%,owner_email.ilike.%${q}%,owner_phone.ilike.%${q}%`,
      );
    }
    rowsQ = rowsQ.order('created_at', { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
    const { data: rows } = await rowsQ;

    const counts: Record<string, number> = { pending: 0, active: 0, suspended: 0, rejected: 0, trial_expired: 0 };
    const qCount = async (s: string) => {
      const { count } = await admin.from('registrations').select('*', { count: 'exact', head: true }).eq('status', s);
      return count ?? 0;
    };
    const [pending, active, suspended, rejected, trialExpired] = await Promise.all([
      qCount('pending'),
      qCount('active'),
      qCount('suspended'),
      qCount('rejected'),
      admin.from('registrations').select('*', { count: 'exact', head: true }).eq('organizations.status', 'trial_expired').then((r) => r.count ?? 0),
    ]);
    counts.pending = pending;
    counts.active = active;
    counts.suspended = suspended;
    counts.rejected = rejected;
    counts.trial_expired = trialExpired;

    return NextResponse.json({ data: rows ?? [], total: count ?? 0, page, perPage, counts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load accounts' }, { status: 500 });
  }
}