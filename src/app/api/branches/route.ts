import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';
import { hasPermission } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const sb: any = await getSB();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { data: prof } = await sb.from('profiles').select('id, organization_id').eq('auth_user_id', user.id).single();
    if (!prof) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const { data: branches, error } = await sb.from('branches').select('id, name, code, phone, address, is_active, created_at').eq('organization_id', prof.organization_id).order('name');
    if (error) throw new Error(error.message);
    return NextResponse.json(branches ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sb: any = await getSB();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { data: prof } = await sb.from('profiles').select('id, organization_id').eq('auth_user_id', user.id).single();
    if (!prof) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const canManage = await hasPermission(sb, prof.id, prof.organization_id, 'settings.manage_branches');
    if (!canManage) return NextResponse.json({ error: 'Forbidden: manage_branches permission required' }, { status: 403 });
    const { name, code, phone, address } = body;
    if (!name) return NextResponse.json({ error: 'Branch name required' }, { status: 400 });
    const { data, error } = await sb.from('branches').insert({ organization_id: prof.organization_id, name, code: code ?? null, phone: phone ?? null, address: address ?? null, is_active: body.isActive ?? true }).select().single();
    if (error) throw new Error(error.message);
    await sb.from('audit_logs').insert({ action: 'BRANCH_CREATED', entity_type: 'branches', entity_id: data.id, old_values: null, new_values: { name, code }, created_by: prof.id });
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
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { data: prof } = await sb.from('profiles').select('id, organization_id').eq('auth_user_id', user.id).single();
    if (!prof) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const canManage = await hasPermission(sb, prof.id, prof.organization_id, 'settings.manage_branches');
    if (!canManage) return NextResponse.json({ error: 'Forbidden: manage_branches permission required' }, { status: 403 });
    const { data, error } = await sb.from('branches').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    await sb.from('audit_logs').insert({ action: 'BRANCH_EDITED', entity_type: 'branches', entity_id: id, old_values: {}, new_values: patch, created_by: prof.id });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sb: any = await getSB();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { data: prof } = await sb.from('profiles').select('id, organization_id').eq('auth_user_id', user.id).single();
    if (!prof) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const canManage =
      (await hasPermission(sb, prof.id, prof.organization_id, 'settings.manage_branches')) ||
      (await hasPermission(sb, prof.id, prof.organization_id, 'settings.manage'));
    if (!canManage) return NextResponse.json({ error: 'Forbidden: manage_branches permission required' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data: ub } = await sb.from('user_branches').select('user_id').eq('branch_id', id).maybeSingle();
    if (ub) return NextResponse.json({ error: 'Cannot delete branch with assigned users. Reassign first.' }, { status: 409 });
    const { data: orgBranches } = await sb.from('branches').select('id').eq('organization_id', prof.organization_id);
    if ((orgBranches ?? []).length <= 1) return NextResponse.json({ error: 'Cannot delete the last branch' }, { status: 403 });
    const { data, error } = await sb.from('branches').delete().eq('id', id).select().single();
    if (error) throw new Error(error.message);
    await sb.from('audit_logs').insert({ action: 'BRANCH_DELETED', entity_type: 'branches', entity_id: id, old_values: { name: data?.name }, new_values: null, created_by: prof.id });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}