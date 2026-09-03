import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';

export async function GET(req: Request) {
  try {
    const sb: any = await getSB();
    const params = new URL(req.url).searchParams;
    const search = params.get('search') ?? '';
    const type = params.get('type') ?? 'all';
    const page = Number(params.get('page') ?? 1);
    const perPage = Number(params.get('perPage') ?? 20);
    const from = (page - 1) * perPage;

    let query = sb.from('audit_logs').select('id, action, entity_type, entity_id, old_values, new_values, created_at, user_id, branch_id, organization_id', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + perPage - 1);

    if (type !== 'all') {
      // map type to entity_type prefix or action
      const map: Record<string, string> = { auth: 'auth', sale: 'sale', inventory: 'inventory', system: 'system', security: 'security' };
      // fallback: filter by entity_type ilike type
      query = query.ilike('entity_type', `%${type}%`);
    }
    if (search) {
      query = query.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%,entity_id.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    // enrich with profile names where user_id exists
    const userIds = [...new Set((data ?? []).map((d: any) => d.user_id).filter(Boolean))];
    const names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await sb.from('profiles').select('id, full_name').in('id', userIds);
      for (const p of (profs ?? [])) names[p.id] = p.full_name;
    }
    const enriched = (data ?? []).map((d: any) => ({ ...d, user_name: d.user_id ? (names[d.user_id] ?? d.user_id.slice(0, 8)) : 'System' }));
    return NextResponse.json({ data: enriched, count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
