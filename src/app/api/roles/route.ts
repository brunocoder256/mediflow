import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hasPermission, writeAudit } from '@/lib/auth';

async function getActor(sb: any) {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from('profiles').select('id, organization_id').eq('auth_user_id', user.id).single();
  if (!profile) return null;
  return { user, profile };
}

export async function GET(req: Request) {
  try {
    const sb: any = await createServerSupabaseClient();
    const actor = await getActor(sb);
    if (!actor) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const search = new URL(req.url).searchParams.get('search') ?? '';
    const type = new URL(req.url).searchParams.get('type') ?? '';
    const withPerms = new URL(req.url).searchParams.get('with_permissions') === '1';
    const roleId = new URL(req.url).searchParams.get('id');

    if (roleId) {
      const { data: role, error } = await sb
        .from('roles')
        .select('id, name, description, is_system_role, is_active, created_at, updated_at, organization_id')
        .eq('id', roleId)
        .eq('organization_id', actor.profile.organization_id)
        .single();
      if (error || !role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
      const { data: rp } = await sb
        .from('role_permissions')
        .select('permission_id, permissions(id, code, name, description)')
        .eq('role_id', roleId);
      const { count } = await sb
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role_id', roleId);
      return NextResponse.json({
        ...role,
        permissions: (rp ?? []).map((r: any) => r.permissions).filter(Boolean),
        permission_ids: (rp ?? []).map((r: any) => r.permission_id),
        userCount: count ?? 0,
      });
    }

    let query = sb
      .from('roles')
      .select('id, name, description, is_system_role, is_active, created_at, updated_at')
      .eq('organization_id', actor.profile.organization_id)
      .order('is_system_role', { ascending: false })
      .order('name');

    if (type === 'system') query = query.eq('is_system_role', true);
    else if (type === 'custom') query = query.eq('is_system_role', false);
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

    const { data: roles, error } = await query;
    if (error) throw new Error(error.message);

    const roleIds = (roles ?? []).map((r: any) => r.id);
    const permCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    const permsByRole: Record<string, string[]> = {};

    if (roleIds.length) {
      const { data: rp } = await sb.from('role_permissions').select('role_id, permission_id').in('role_id', roleIds);
      for (const r of rp ?? []) {
        permCounts[r.role_id] = (permCounts[r.role_id] ?? 0) + 1;
        if (withPerms) {
          if (!permsByRole[r.role_id]) permsByRole[r.role_id] = [];
          permsByRole[r.role_id].push(r.permission_id);
        }
      }
      const { data: urs } = await sb.from('user_roles').select('role_id').in('role_id', roleIds);
      for (const u of urs ?? []) {
        userCounts[u.role_id] = (userCounts[u.role_id] ?? 0) + 1;
      }
    }

    const enriched = (roles ?? []).map((r: any) => ({
      ...r,
      permissionCount: permCounts[r.id] ?? 0,
      userCount: userCounts[r.id] ?? 0,
      ...(withPerms ? { permission_ids: permsByRole[r.id] ?? [] } : {}),
    }));
    return NextResponse.json(enriched);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sb: any = await createServerSupabaseClient();
    const actor = await getActor(sb);
    if (!actor) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const canManage = await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage_roles');
    if (!canManage) return NextResponse.json({ error: 'Forbidden: manage_roles permission required' }, { status: 403 });

    const { name, description, permission_ids } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Role name required' }, { status: 400 });

    const { data: existing } = await sb
      .from('roles')
      .select('id')
      .eq('name', name.trim())
      .eq('organization_id', actor.profile.organization_id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: 'Role name already exists' }, { status: 409 });

    const { data, error } = await sb
      .from('roles')
      .insert({
        organization_id: actor.profile.organization_id,
        name: name.trim(),
        description: description ?? null,
        is_system_role: false,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (Array.isArray(permission_ids) && permission_ids.length) {
      await sb.from('role_permissions').insert(
        permission_ids.map((permission_id: string) => ({ role_id: data.id, permission_id })),
      );
    }

    await writeAudit(sb, {
      organizationId: actor.profile.organization_id,
      actorProfileId: actor.profile.id,
      action: 'ROLE_CREATED',
      entityType: 'roles',
      entityId: data.id,
      newValues: { name, description, permission_ids: permission_ids ?? [] },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, permission_ids, ...patch } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const sb: any = await createServerSupabaseClient();
    const actor = await getActor(sb);
    if (!actor) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const canManageRoles = await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage_roles');
    const canManagePerms = await hasPermission(
      sb,
      actor.profile.id,
      actor.profile.organization_id,
      'users.manage_permissions',
    );
    if (!canManageRoles && !canManagePerms) {
      return NextResponse.json({ error: 'Forbidden: manage_roles or manage_permissions required' }, { status: 403 });
    }

    const { data: role } = await sb
      .from('roles')
      .select('*')
      .eq('id', id)
      .eq('organization_id', actor.profile.organization_id)
      .single();
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

    // System roles: allow permission edits, block rename/delete of protected identity
    if (role.is_system_role && (patch.name !== undefined || patch.is_active === false)) {
      return NextResponse.json({ error: 'Cannot rename or deactivate a protected system role' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (canManageRoles) {
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.description !== undefined) updates.description = patch.description;
      if (patch.is_active !== undefined) updates.is_active = patch.is_active;
    }

    if (Object.keys(updates).length > 1) {
      const { error } = await sb.from('roles').update(updates).eq('id', id);
      if (error) throw new Error(error.message);
    }

    if (permission_ids !== undefined) {
      if (!canManagePerms && !canManageRoles) {
        return NextResponse.json({ error: 'Forbidden: manage_permissions required' }, { status: 403 });
      }
      // Owner / Super Admin system roles: still allow permission updates carefully
      const { data: oldRp } = await sb.from('role_permissions').select('permission_id').eq('role_id', id);
      const oldIds = (oldRp ?? []).map((r: any) => r.permission_id);
      await sb.from('role_permissions').delete().eq('role_id', id);
      if (Array.isArray(permission_ids) && permission_ids.length) {
        await sb.from('role_permissions').insert(
          permission_ids.map((permission_id: string) => ({ role_id: id, permission_id })),
        );
      }
      await writeAudit(sb, {
        organizationId: actor.profile.organization_id,
        actorProfileId: actor.profile.id,
        action: 'ROLE_PERMISSIONS_CHANGED',
        entityType: 'roles',
        entityId: id,
        oldValues: { permission_ids: oldIds },
        newValues: { permission_ids },
      });
    }

    await writeAudit(sb, {
      organizationId: actor.profile.organization_id,
      actorProfileId: actor.profile.id,
      action: 'ROLE_EDITED',
      entityType: 'roles',
      entityId: id,
      oldValues: { name: role.name, description: role.description, is_active: role.is_active },
      newValues: patch,
    });

    const { data: refreshed } = await sb.from('roles').select('*').eq('id', id).single();
    return NextResponse.json(refreshed);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sb: any = await createServerSupabaseClient();
    const actor = await getActor(sb);
    if (!actor) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const canManage = await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage_roles');
    if (!canManage) return NextResponse.json({ error: 'Forbidden: manage_roles permission required' }, { status: 403 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: role } = await sb
      .from('roles')
      .select('id, name, is_system_role')
      .eq('id', id)
      .eq('organization_id', actor.profile.organization_id)
      .single();
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    if (role.is_system_role) return NextResponse.json({ error: 'Cannot delete a protected system role' }, { status: 403 });

    const { data: ur } = await sb.from('user_roles').select('user_id').eq('role_id', id).limit(1).maybeSingle();
    if (ur) return NextResponse.json({ error: 'Cannot delete role assigned to users. Reassign first.' }, { status: 409 });

    const { error } = await sb.from('roles').delete().eq('id', id);
    if (error) throw new Error(error.message);

    await writeAudit(sb, {
      organizationId: actor.profile.organization_id,
      actorProfileId: actor.profile.id,
      action: 'ROLE_DELETED',
      entityType: 'roles',
      entityId: id,
      oldValues: { name: role.name },
    });

    return NextResponse.json({ id, deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
