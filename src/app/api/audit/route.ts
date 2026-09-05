import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hasPermission, getUserBranches } from '@/lib/auth';

async function getActor(sb: any) {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb
    .from('profiles')
    .select('id, organization_id, full_name')
    .eq('auth_user_id', user.id)
    .single();
  if (!profile) return null;
  return { user, profile };
}

export async function GET(req: Request) {
  try {
    const sb: any = await createServerSupabaseClient();
    const actor = await getActor(sb);
    if (!actor) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const canView = await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'audit.view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden: audit.view required' }, { status: 403 });
    }

    const params = new URL(req.url).searchParams;
    const search = params.get('search') ?? '';
    const type = params.get('type') ?? 'all';
    const page = Number(params.get('page') ?? 1);
    const perPage = Number(params.get('perPage') ?? 20);
    const from = (page - 1) * perPage;

    let query = sb
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, old_values, new_values, created_at, user_id, branch_id, organization_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1);

    // Optional explicit branch filter — never allow filtering to a branch the
    // actor is not authorized for (org-scope is also enforced by RLS).
    const branchId = params.get('branch_id');
    if (branchId && branchId !== 'all') {
      const authorized = await getUserBranches(sb, actor.profile.id);
      if (!authorized.includes(branchId)) {
        return NextResponse.json({ error: 'Unauthorized branch scope' }, { status: 403 });
      }
      query = query.eq('branch_id', branchId);
    }

    if (type !== 'all') {
      query = query.ilike('entity_type', `%${type}%`);
    }
    if (search) {
      query = query.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%,entity_id.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const userIds = [...new Set((data ?? []).map((d: any) => d.user_id).filter(Boolean))];
    const names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await sb.from('profiles').select('id, full_name').in('id', userIds);
      for (const p of profs ?? []) names[p.id] = p.full_name;
    }
    const enriched = (data ?? []).map((d: any) => ({ ...d, user_name: d.user_id ? (names[d.user_id] ?? d.user_id.slice(0, 8)) : 'System' }));
    return NextResponse.json({ data: enriched, count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
