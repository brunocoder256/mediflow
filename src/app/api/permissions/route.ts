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
    const search = new URL(req.url).searchParams.get('search') ?? '';
    const permissionModule = new URL(req.url).searchParams.get('module') ?? '';
    let query = sb.from('permissions').select('id, code, name, description').order('code');
    if (search) query = query.ilike('code', `%${search}%`).or(`name.ilike.%${search}%`).or(`description.ilike.%${search}%`);
    if (permissionModule && permissionModule !== 'all') {
      const moduleMap: Record<string, string[]> = {
        dashboard: ['dashboard.view'],
        users: ['users.view', 'users.create', 'users.edit', 'users.deactivate', 'users.manage_roles', 'users.manage_permissions', 'users.manage'],
        products: ['products.view', 'products.create', 'products.edit', 'products.archive', 'products.import', 'products.export'],
        inventory: ['inventory.view', 'inventory.receive', 'inventory.adjust', 'inventory.stock_take', 'inventory.transfer', 'inventory.approve_adjustment'],
        purchases: ['purchases.view', 'purchases.create', 'purchases.approve', 'purchases.receive', 'purchases.return'],
        sales: ['sales.view', 'sales.create', 'sales.edit_draft', 'sales.void', 'sales.return', 'sales.discount', 'sales.price_override'],
        expenses: ['expenses.view', 'expenses.create', 'expenses.approve', 'expenses.pay', 'expenses.void'],
        customers: ['customers.view', 'customers.create', 'customers.edit', 'customers.credit', 'customers.view_financials', 'customers.manage'],
        suppliers: ['suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.view_financials'],
        reports: ['reports.view', 'reports.export', 'reports.view_financial', 'reports.view_profit', 'reports.view_costs'],
        settings: ['settings.view', 'settings.edit', 'settings.manage_tax', 'settings.manage_branches'],
        audit: ['audit.view', 'audit.export'],
      };
      const allowed = moduleMap[permissionModule] ?? [];
      if (allowed.length) query = query.in('code', allowed);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json(data ?? []);
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
    const canManage = await hasPermission(sb, prof.id, prof.organization_id, 'users.manage_permissions');
    if (!canManage) return NextResponse.json({ error: 'Forbidden: manage_permissions permission required' }, { status: 403 });
    const { code, name } = body;
    if (!code) return NextResponse.json({ error: 'Permission code required' }, { status: 400 });
    const { data: existing } = await sb.from('permissions').select('id').eq('code', code).maybeSingle();
    if (existing) return NextResponse.json({ error: 'Permission code already exists' }, { status: 409 });
    const { data, error } = await sb.from('permissions').insert({ code, name, description: body.description ?? null }).select().single();
    if (error) throw new Error(error.message);
    await sb.from('audit_logs').insert({ action: 'PERMISSION_CREATED', entity_type: 'permissions', entity_id: data.id, old_values: null, new_values: { code, name }, created_by: prof.id });
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
    const canManage = await hasPermission(sb, prof.id, prof.organization_id, 'users.manage_permissions');
    if (!canManage) return NextResponse.json({ error: 'Forbidden: manage_permissions permission required' }, { status: 403 });
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await sb.from('permissions').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    await sb.from('audit_logs').insert({ action: 'PERMISSION_EDITED', entity_type: 'permissions', entity_id: id, old_values: {}, new_values: patch, created_by: prof.id });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}