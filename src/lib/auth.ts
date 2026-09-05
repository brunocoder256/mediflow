// Central auth / RBAC helper for MediFlow
// Production-grade: enforces organization isolation, permission checks, branch scope, last-admin guard
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PERMISSION_CATALOG as CATALOG } from '@/lib/permissions-catalog';

export type AuthContext = {
  userId: string; // auth.users.id
  profileId: string; // profiles.id
  organizationId: string;
  email?: string | null;
  fullName?: string;
  status?: string;
};

export async function requireAuth(sb?: any): Promise<{ sb: Awaited<ReturnType<typeof createServerSupabaseClient>>; ctx: AuthContext }> {
  const client = sb ?? (await createServerSupabaseClient());
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error('Unauthenticated');
  const { data: profile } = await client
    .from('profiles')
    .select('id, organization_id, full_name, is_active, status')
    .eq('auth_user_id', user.id)
    .single();
  if (!profile) throw new Error('Profile not found');
  if (profile.is_active === false || profile.status === 'inactive' || profile.status === 'suspended' || profile.status === 'locked') {
    throw new Error('Account deactivated');
  }
  if (!profile.organization_id) throw new Error('No organization');
  const { data: org } = await client
    .from('organizations')
    .select('status')
    .eq('id', profile.organization_id)
    .maybeSingle();
  if (!org || org.status !== 'active') throw new Error('Organization account deactivated');
  return {
    sb: client,
    ctx: {
      userId: user.id,
      profileId: profile.id,
      organizationId: profile.organization_id,
      email: user.email,
      fullName: profile.full_name,
      status: profile.status,
    },
  };
}

export async function getUserBranches(sb: any, profileId: string): Promise<string[]> {
  const { data: ub } = await sb.from('user_branches').select('branch_id').eq('user_id', profileId);
  if (ub?.length) return ub.map((r: any) => r.branch_id).filter(Boolean);

  const { data } = await sb.from('user_roles').select('branch_id').eq('user_id', profileId);
  const hasNull = (data ?? []).some((r: any) => r.branch_id === null);
  if (hasNull) {
    const { data: prof } = await sb.from('profiles').select('organization_id').eq('id', profileId).single();
    if (prof?.organization_id) {
      const { data: branches } = await sb.from('branches').select('id').eq('organization_id', prof.organization_id);
      return (branches ?? []).map((b: any) => b.id);
    }
  }
  return (data ?? []).map((r: any) => r.branch_id).filter(Boolean);
}

export async function getEffectivePermissions(sb: any, profileId: string, _organizationId: string): Promise<Set<string>> {
  const perms = new Set<string>();
  const { data: userRoles } = await sb.from('user_roles').select('role_id').eq('user_id', profileId);
  const roleIds = (userRoles ?? []).map((r: any) => r.role_id);
  if (roleIds.length) {
    const { data: rp } = await sb.from('role_permissions').select('permission_id, permissions(code)').in('role_id', roleIds);
    for (const row of rp ?? []) {
      const code = (row as any).permissions?.code;
      if (code) perms.add(code);
    }
  }

  const { data: overrides } = await sb
    .from('user_permission_overrides')
    .select('effect, permissions(code)')
    .eq('user_id', profileId);
  for (const row of overrides ?? []) {
    const code = (row as any).permissions?.code;
    if (!code) continue;
    if (row.effect === 'grant') perms.add(code);
    if (row.effect === 'deny') perms.delete(code);
  }
  return perms;
}

export async function hasPermission(sb: any, profileId: string, organizationId: string, code: string): Promise<boolean> {
  try {
    const { data } = await sb.rpc('has_permission', { p_code: code });
    if (typeof data === 'boolean') return data;
  } catch {
    /* fall through */
  }
  const perms = await getEffectivePermissions(sb, profileId, organizationId);
  if (perms.has(code)) return true;
  if (perms.has('users.manage') && code.startsWith('users.')) return true;
  return false;
}

export async function requirePermission(sb: any, profileId: string, organizationId: string, code: string) {
  const ok = await hasPermission(sb, profileId, organizationId, code);
  if (!ok) throw new Error(`Forbidden: missing permission ${code}`);
}

export async function isLastAdmin(sb: any, organizationId: string, excludeProfileId?: string) {
  const { data: allProfiles } = await sb
    .from('profiles')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .neq('status', 'inactive');
  const ids = (allProfiles ?? []).map((p: any) => p.id);
  if (!ids.length) return false;
  let adminCount = 0;
  for (const pid of ids) {
    if (excludeProfileId && pid === excludeProfileId) continue;
    const perms = await getEffectivePermissions(sb, pid, organizationId);
    if (perms.has('users.manage') || perms.has('users.manage_roles')) adminCount++;
  }
  return adminCount === 0;
}

export async function assertCanAccessBranch(sb: any, profileId: string, branchId: string) {
  const branches = await getUserBranches(sb, profileId);
  if (!branches.includes(branchId)) throw new Error('Unauthorized branch access');
}

/** Write an audit log with required organization_id + user_id. */
export async function writeAudit(
  sb: any,
  opts: {
    organizationId: string;
    actorProfileId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    branchId?: string | null;
  },
) {
  await sb.from('audit_logs').insert({
    organization_id: opts.organizationId,
    user_id: opts.actorProfileId,
    created_by: opts.actorProfileId,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId ?? null,
    old_values: opts.oldValues ?? null,
    new_values: opts.newValues ?? null,
    branch_id: opts.branchId ?? null,
  });
}

/** Sync user_branches and keep a legacy user_roles.branch_id hint for RLS. */
export async function syncUserBranches(
  sb: any,
  userId: string,
  branchIds: string[],
  defaultBranchId?: string | null,
  roleId?: string | null,
) {
  await sb.from('user_branches').delete().eq('user_id', userId);
  const unique = [...new Set(branchIds.filter(Boolean))];
  const def = defaultBranchId && unique.includes(defaultBranchId) ? defaultBranchId : unique[0] ?? null;
  if (unique.length) {
    await sb.from('user_branches').insert(
      unique.map((bid) => ({
        user_id: userId,
        branch_id: bid,
        is_default: bid === def,
      })),
    );
  }
  if (def) {
    await sb.from('profiles').update({ default_branch_id: def }).eq('id', userId);
  }
  // Keep user_roles.branch_id aligned to default for legacy RLS consumers
  if (roleId) {
    await sb.from('user_roles').update({ branch_id: def }).eq('user_id', userId).eq('role_id', roleId);
  } else {
    await sb.from('user_roles').update({ branch_id: def }).eq('user_id', userId);
  }
  return def;
}

export const PERMISSION_CATALOG = CATALOG;
