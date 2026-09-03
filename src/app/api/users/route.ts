import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';

export async function GET(req: Request) {
  try {
    const sb: any = await getSB();
    const search = new URL(req.url).searchParams.get('search') ?? '';
    // Fetch profiles with roles via user_roles join
    const query = sb.from('profiles').select('id, full_name, phone, avatar_url, is_active, last_login_at, created_at, organization_id, auth_user_id').order('created_at', { ascending: false }).limit(100);
    const { data: profiles, error } = await query;
    if (error) throw new Error(error.message);
    // Enrich with user_roles -> roles
    let filtered = profiles ?? [];
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((p: any) => p.full_name?.toLowerCase().includes(s) || p.phone?.includes(s));
    }
    // Attach roles
    const ids = filtered.map((p: any) => p.id);
    const rolesByUser: Record<string, string[]> = {};
    if (ids.length) {
      const { data: urs } = await sb.from('user_roles').select('user_id, roles(name)').in('user_id', ids);
      for (const ur of (urs ?? [])) {
        const name = (ur as any).roles?.name ?? 'unknown';
        if (!rolesByUser[ur.user_id]) rolesByUser[ur.user_id] = [];
        rolesByUser[ur.user_id].push(name);
      }
    }
    const enriched = filtered.map((p: any) => ({ ...p, roles: rolesByUser[p.id] ?? [] }));
    return NextResponse.json(enriched);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sb: any = await getSB();
    // Validate via existing profiles logic - create profile placeholder (auth handled via supabase auth elsewhere)
    // For V1, allow creating profile directly (service role would be needed for auth user, but we create profile only)
    const { data: user } = await sb.auth.getUser();
    const { data: selfProf } = await sb.from('profiles').select('organization_id').eq('auth_user_id', user.user.id).single();
    const { data, error } = await sb.from('profiles').insert({
      auth_user_id: body.auth_user_id ?? `temp-${Date.now()}`, // placeholder if not provided
      organization_id: selfProf.organization_id,
      full_name: body.full_name,
      phone: body.phone ?? null,
      is_active: body.is_active ?? true,
    }).select().single();
    if (error) throw new Error(error.message);
    if (body.role_id) {
      await sb.from('user_roles').insert({ user_id: data.id, role_id: body.role_id, branch_id: body.branch_id ?? null });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...patch } = body;
    const sb: any = await getSB();
    const allowed = ['full_name', 'phone', 'is_active', 'avatar_url'];
    const updates: any = {};
    for (const k of allowed) if (patch[k] !== undefined) updates[k] = patch[k];
    const { data, error } = await sb.from('profiles').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    if (patch.role_id !== undefined) {
      await sb.from('user_roles').delete().eq('user_id', id);
      if (patch.role_id) await sb.from('user_roles').insert({ user_id: id, role_id: patch.role_id, branch_id: patch.branch_id ?? null });
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
