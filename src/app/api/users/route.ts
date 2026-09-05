import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  hasPermission,
  isLastAdmin,
  syncUserBranches,
  writeAudit,
  getEffectivePermissions,
} from '@/lib/auth';

async function getActor(sb: any) {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb
    .from('profiles')
    .select('id, organization_id, full_name, status, is_active')
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

    const canView = await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.view');
    const canManage = await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage');
    if (!canView && !canManage) {
      return NextResponse.json({ error: 'Forbidden: users.view required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get('search') ?? '').trim();
    const status = url.searchParams.get('status');
    const roleId = url.searchParams.get('role_id');
    const branchId = url.searchParams.get('branch_id');
    const detailId = url.searchParams.get('id');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('perPage') ?? 50)));

    // Single-user detail enrichment
    if (detailId) {
      const { data: profile, error } = await sb
        .from('profiles')
        .select(
          `id, full_name, phone, email, username, avatar_url, is_active, last_login_at, created_at,
           organization_id, auth_user_id, status, default_branch_id, failed_login_attempts,
           invited_by, invitation_sent_at, invitation_accepted_at, suspended_reason, deactivated_reason, locked_until`,
        )
        .eq('id', detailId)
        .eq('organization_id', actor.profile.organization_id)
        .single();
      if (error || !profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const { data: urs } = await sb.from('user_roles').select('role_id, branch_id, roles(id, name)').eq('user_id', detailId);
      const { data: ubs } = await sb.from('user_branches').select('branch_id, is_default, branches(id, name, code)').eq('user_id', detailId);
      const perms = await getEffectivePermissions(sb, detailId, actor.profile.organization_id);
      const { data: activity } = await sb
        .from('audit_logs')
        .select('id, action, entity_type, entity_id, old_values, new_values, created_at, user_id')
        .or(`entity_id.eq.${detailId},user_id.eq.${detailId}`)
        .order('created_at', { ascending: false })
        .limit(30);

      return NextResponse.json({
        ...profile,
        roles: (urs ?? []).map((u: any) => u.roles?.name).filter(Boolean),
        role_ids: (urs ?? []).map((u: any) => u.role_id),
        role_entries: urs ?? [],
        branches: (ubs ?? []).map((b: any) => ({
          id: b.branch_id,
          name: b.branches?.name,
          code: b.branches?.code,
          is_default: b.is_default,
        })),
        branch_ids: (ubs ?? []).map((b: any) => b.branch_id),
        permissions: [...perms],
        activity: activity ?? [],
      });
    }

    let query = sb
      .from('profiles')
      .select(
        `id, full_name, phone, email, username, avatar_url, is_active, last_login_at, created_at,
         organization_id, auth_user_id, status, default_branch_id, failed_login_attempts,
         invited_by, invitation_sent_at, invitation_accepted_at`,
        { count: 'exact' },
      )
      .eq('organization_id', actor.profile.organization_id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (branchId && branchId !== 'all') query = query.eq('default_branch_id', branchId);
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`,
      );
    }

    const from = (page - 1) * perPage;
    query = query.range(from, from + perPage - 1);

    const { data: profiles, error, count } = await query;
    if (error) throw new Error(error.message);

    let filtered = profiles ?? [];
    const ids = filtered.map((p: any) => p.id);
    const rolesByUser: Record<string, string[]> = {};
    const roleIdsByUser: Record<string, string[]> = {};
    const branchesByUser: Record<string, string[]> = {};

    if (ids.length) {
      const { data: urs } = await sb.from('user_roles').select('user_id, role_id, roles(name)').in('user_id', ids);
      for (const ur of urs ?? []) {
        const name = (ur as any).roles?.name ?? 'unknown';
        if (!rolesByUser[ur.user_id]) rolesByUser[ur.user_id] = [];
        if (!roleIdsByUser[ur.user_id]) roleIdsByUser[ur.user_id] = [];
        rolesByUser[ur.user_id].push(name);
        roleIdsByUser[ur.user_id].push(ur.role_id);
      }
      const { data: ubs } = await sb.from('user_branches').select('user_id, branch_id').in('user_id', ids);
      for (const ub of ubs ?? []) {
        if (!branchesByUser[ub.user_id]) branchesByUser[ub.user_id] = [];
        branchesByUser[ub.user_id].push(ub.branch_id);
      }
    }

    if (roleId && roleId !== 'all') {
      filtered = filtered.filter((p: any) => (roleIdsByUser[p.id] ?? []).includes(roleId));
    }

    const enriched = filtered.map((p: any) => ({
      ...p,
      roles: rolesByUser[p.id] ?? [],
      role_ids: roleIdsByUser[p.id] ?? [],
      branch_ids: branchesByUser[p.id] ?? [],
      statusDisplay:
        p.status === 'active'
          ? 'Active'
          : p.status === 'inactive'
            ? 'Inactive'
            : p.status === 'invited' || p.status === 'pending_invitation'
              ? 'Invited'
              : (p.status ?? 'Active'),
    }));

    return NextResponse.json({ data: enriched, count: count ?? enriched.length, page, perPage });
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

    const canCreate =
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.create')) ||
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage'));
    if (!canCreate) return NextResponse.json({ error: 'Forbidden: users.create required' }, { status: 403 });

    const fullName = (body.full_name ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    if (!fullName) return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });

    let admin: ReturnType<typeof createAdminSupabaseClient>;
    try {
      admin = createAdminSupabaseClient();
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }

    // Invite via Supabase Auth (user sets password from email link)
    const redirectTo =
      body.redirect_to ||
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''}/auth/reset-password`;

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        organization_id: actor.profile.organization_id,
      },
      redirectTo: redirectTo || undefined,
    });

    let authUserId: string;
    let invitationSent = false;

    if (!inviteErr && invited?.user) {
      authUserId = invited.user.id;
      invitationSent = true;
    } else {
      // Fallback: create user without invite email if invite fails (e.g. SMTP not configured)
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: {
          full_name: fullName,
          organization_id: actor.profile.organization_id,
        },
      });
      if (createErr || !created.user) {
        return NextResponse.json(
          { error: inviteErr?.message || createErr?.message || 'Unable to create auth user' },
          { status: 400 },
        );
      }
      authUserId = created.user.id;
      invitationSent = false;
    }

    const now = new Date().toISOString();
    const { data: newProfile, error: profileErr } = await admin
      .from('profiles')
      .insert({
        auth_user_id: authUserId,
        organization_id: actor.profile.organization_id,
        full_name: fullName,
        email,
        phone: body.phone ?? null,
        username: body.username ?? email.split('@')[0],
        avatar_url: body.avatar_url ?? null,
        status: invitationSent ? 'invited' : 'active',
        is_active: true,
        default_branch_id: body.default_branch_id ?? body.branch_ids?.[0] ?? null,
        failed_login_attempts: 0,
        invited_by: actor.profile.id,
        invitation_sent_at: invitationSent ? now : null,
        invitation_accepted_at: null,
      })
      .select()
      .single();

    if (profileErr) {
      // Cleanup orphan auth user
      try {
        await admin.auth.admin.deleteUser(authUserId);
      } catch {
        /* ignore */
      }
      throw new Error(profileErr.message);
    }

    const roleId = body.role_id || null;
    const branchIds: string[] = Array.isArray(body.branch_ids)
      ? body.branch_ids
      : body.branch_id
        ? [body.branch_id]
        : body.default_branch_id
          ? [body.default_branch_id]
          : [];

    if (roleId) {
      const defaultBranch = body.default_branch_id ?? branchIds[0] ?? null;
      await admin.from('user_roles').insert({
        user_id: newProfile.id,
        role_id: roleId,
        branch_id: defaultBranch,
      });
    }

    if (branchIds.length) {
      await syncUserBranches(admin, newProfile.id, branchIds, body.default_branch_id ?? branchIds[0], roleId);
    }

    await writeAudit(admin, {
      organizationId: actor.profile.organization_id,
      actorProfileId: actor.profile.id,
      action: invitationSent ? 'USER_INVITED' : 'USER_CREATED',
      entityType: 'profiles',
      entityId: newProfile.id,
      newValues: {
        full_name: fullName,
        email,
        role_id: roleId,
        branch_ids: branchIds,
        status: newProfile.status,
      },
    });

    return NextResponse.json(
      { ...newProfile, invitation_sent: invitationSent, roles: roleId ? [roleId] : [] },
      { status: 201 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const id = body.id || url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const sb: any = await createServerSupabaseClient();
    const actor = await getActor(sb);
    if (!actor) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const admin = createAdminSupabaseClient();
    const { data: existing } = await admin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .eq('organization_id', actor.profile.organization_id)
      .single();
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isSelf = actor.profile.id === id;
    const canEdit =
      isSelf ||
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.edit')) ||
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage'));
    const canDeactivate =
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.deactivate')) ||
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage'));
    const canManageRoles =
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage_roles')) ||
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage'));

    if (!canEdit && !(body.status !== undefined && canDeactivate)) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    // Self-edit: never allow privilege escalation
    if (isSelf && (body.role_id !== undefined || body.branch_ids !== undefined || body.permission_overrides !== undefined)) {
      return NextResponse.json({ error: 'You cannot change your own role, branches, or permission overrides' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    const allowedSelf = ['full_name', 'phone', 'avatar_url'];
    const allowedAdmin = [...allowedSelf, 'email', 'username', 'status', 'default_branch_id', 'suspended_reason', 'deactivated_reason'];
    const allowed = isSelf && !canEdit ? allowedSelf : allowedAdmin;

    for (const k of allowed) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    if (body.status !== undefined) {
      if (!canDeactivate && !canEdit) {
        return NextResponse.json({ error: 'Forbidden: users.deactivate required' }, { status: 403 });
      }
      if (body.status === 'inactive' || body.status === 'suspended') {
        if (await isLastAdmin(admin, actor.profile.organization_id, id)) {
          return NextResponse.json({ error: 'Cannot deactivate the last administrator' }, { status: 403 });
        }
        if (isSelf) return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 403 });
        updates.is_active = false;
      }
      if (body.status === 'active') {
        updates.is_active = true;
        updates.failed_login_attempts = 0;
        updates.locked_until = null;
      }
      if (body.status === 'locked' && body.unlock === true) {
        updates.status = 'active';
        updates.failed_login_attempts = 0;
        updates.locked_until = null;
        updates.is_active = true;
      }
    }

    if (body.role_id !== undefined) {
      if (!canManageRoles) return NextResponse.json({ error: 'Forbidden: manage_roles permission required' }, { status: 403 });
      await admin.from('user_roles').delete().eq('user_id', id);
      if (body.role_id) {
        const def = body.default_branch_id ?? existing.default_branch_id ?? null;
        await admin.from('user_roles').insert({ user_id: id, role_id: body.role_id, branch_id: def });
      }
    }

    if (body.branch_ids && Array.isArray(body.branch_ids)) {
      if (!canManageRoles && !canEdit) {
        return NextResponse.json({ error: 'Forbidden: manage_roles required for branch assignments' }, { status: 403 });
      }
      const roleId = body.role_id ?? (await admin.from('user_roles').select('role_id').eq('user_id', id).limit(1).maybeSingle()).data?.role_id;
      const def = await syncUserBranches(admin, id, body.branch_ids, body.default_branch_id ?? existing.default_branch_id, roleId);
      if (def) updates.default_branch_id = def;
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error } = await admin.from('profiles').update(updates).eq('id', id);
      if (error) throw new Error(error.message);
    }

    await writeAudit(admin, {
      organizationId: actor.profile.organization_id,
      actorProfileId: actor.profile.id,
      action: 'USER_EDITED',
      entityType: 'profiles',
      entityId: id,
      oldValues: {
        status: existing.status,
        full_name: existing.full_name,
        default_branch_id: existing.default_branch_id,
      },
      newValues: { ...updates, role_id: body.role_id, branch_ids: body.branch_ids },
    });

    const { data: refreshed } = await admin.from('profiles').select('*').eq('id', id).single();
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

    const canDeactivate =
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.deactivate')) ||
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'users.manage'));
    if (!canDeactivate) return NextResponse.json({ error: 'Forbidden: users.deactivate required' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (actor.profile.id === id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();
    const { data: target } = await admin
      .from('profiles')
      .select('id, status, is_active, organization_id')
      .eq('id', id)
      .eq('organization_id', actor.profile.organization_id)
      .single();
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (await isLastAdmin(admin, actor.profile.organization_id, id)) {
      return NextResponse.json({ error: 'Cannot deactivate the last administrator' }, { status: 403 });
    }

    const { data, error } = await admin
      .from('profiles')
      .update({
        status: 'inactive',
        is_active: false,
        deactivated_reason: 'Deactivated by administrator',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, full_name, status, is_active')
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(admin, {
      organizationId: actor.profile.organization_id,
      actorProfileId: actor.profile.id,
      action: 'USER_DEACTIVATED',
      entityType: 'profiles',
      entityId: id,
      oldValues: { status: target.status, is_active: target.is_active },
      newValues: { status: 'inactive', is_active: false },
    });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
