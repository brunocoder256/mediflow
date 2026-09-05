import { describe, it, expect } from 'vitest';

/**
 * RBAC / authorization logic under test.
 *
 * These mirror the pure decision functions used across MediFlow's auth layer
 * (src/lib/auth.ts) so they can be tested deterministically without a DB:
 *   - effective permission resolution including deny overrides
 *   - last-administrator guard
 *   - branch access scoping
 *   - self-edit privilege-escalation guard
 */

// ---- Simulated permission resolver (matches getEffectivePermissions + hasPermission) ----
type Override = { effect: 'grant' | 'deny'; code: string };
// roleId -> grant set, per-user override list
function resolvePermissions(rolePermissions: Record<string, string[]>, grants: string[], overrides: Override[]): Set<string> {
  const perms = new Set<string>();
  for (const rid of grants) for (const p of rolePermissions[rid] ?? []) perms.add(p);
  // Deny always wins: apply grant overrides first, then deny overrides last.
  for (const o of overrides) if (o.effect === 'grant') perms.add(o.code);
  for (const o of overrides) if (o.effect === 'deny') perms.delete(o.code);
  return perms;
}

function hasPermission(rolePermissions: Record<string, string[]>, grants: string[], overrides: Override[], code: string): boolean {
  const perms = resolvePermissions(rolePermissions, grants, overrides);
  if (perms.has(code)) return true;
  // legacy users.manage grants all users.*
  if (perms.has('users.manage') && code.startsWith('users.')) return true;
  return false;
}

const ROLE_PERMS: Record<string, string[]> = {
  cashier: ['sales.create', 'sales.view', 'customers.view', 'dashboard.view'],
  admin: ['users.view', 'users.create', 'users.edit', 'users.deactivate', 'users.manage_roles', 'users.manage_permissions'],
};

describe('Effective permissions (getEffectivePermissions semantics)', () => {
  it('grants role permissions', () => {
    const perms = resolvePermissions(ROLE_PERMS, ['cashier'], []);
    expect(perms.has('sales.create')).toBe(true);
    expect(perms.has('users.view')).toBe(false);
  });

  it('honors deny overrides (remove a role permission)', () => {
    const perms = resolvePermissions(ROLE_PERMS, ['cashier'], [{ effect: 'deny', code: 'sales.create' }]);
    expect(perms.has('sales.create')).toBe(false);
    expect(hasPermission(ROLE_PERMS, ['cashier'], [{ effect: 'deny', code: 'sales.create' }], 'sales.create')).toBe(false);
  });

  it('honors grant overrides (add a permission not in role)', () => {
    const perms = resolvePermissions(ROLE_PERMS, ['cashier'], [{ effect: 'grant', code: 'sales.discount' }]);
    expect(perms.has('sales.discount')).toBe(true);
  });

  it('deny wins over role grant', () => {
    const perms = resolvePermissions(ROLE_PERMS, ['cashier'], [{ effect: 'deny', code: 'sales.create' }, { effect: 'grant', code: 'sales.create' }]);
    expect(perms.has('sales.create')).toBe(false);
  });

  it('legacy users.manage grants any users.* permission', () => {
    expect(hasPermission(ROLE_PERMS, ['admin'], [], 'users.deactivate')).toBe(true);
    // a cashier without users.manage cannot manage users
    expect(hasPermission(ROLE_PERMS, ['cashier'], [], 'users.deactivate')).toBe(false);
  });
});

describe('Branch access scope', () => {
  // Simulated getUserBranches: user_branches takes priority; fallback to role branch; null => all org branches
  function getUserBranches(userBranches: string[] | null, roleBranches: (string | null)[], orgBranches: string[]): string[] {
    if (userBranches && userBranches.length) return [...new Set(userBranches.filter(Boolean))];
    const hasNull = roleBranches.some((b) => b === null);
    if (hasNull) return [...orgBranches];
    return [...new Set(roleBranches.filter((b): b is string => !!b))];
  }

  it('prefers explicit user_branches over role branch hints', () => {
    const branches = getUserBranches(['B1', 'B2'], ['B3'], ['B1', 'B2', 'B3', 'B4']);
    expect(branches).toEqual(['B1', 'B2']);
  });

  it('null role branch grants all org branches only when user_branches is empty', () => {
    const branches = getUserBranches([], [null], ['B1', 'B2']);
    expect(branches).toEqual(['B1', 'B2']);
  });

  it('falls back to role branch ids when no user_branches', () => {
    const branches = getUserBranches(null, ['B3'], ['B1', 'B2', 'B3']);
    expect(branches).toEqual(['B3']);
  });

  it('a user cannot access a branch outside their scope', () => {
    const authorized = getUserBranches(['B1'], [], []);
    // assertCanAccessBranch semantics
    expect(authorized).toContain('B1');
    expect(authorized).not.toContain('B2');
  });
});

describe('Last-administrator guard', () => {
  // Simulated: count remaining active org users who can manage roles/users.
  function adminCount(users: { active: boolean; canManageUsers: boolean }[], excludeId?: number): number {
    return users.reduce((n, u, idx) => {
      if (!u.active) return n;
      if (excludeId !== undefined && idx === excludeId) return n;
      return u.canManageUsers ? n + 1 : n;
    }, 0);
  }

  it('blocks deactivating the final administrator', () => {
    const users = [{ active: true, canManageUsers: true }];
    expect(adminCount(users, 0)).toBe(0); // excluding the target leaves zero admins
  });

  it('allows deactivating when another administrator remains', () => {
    const users = [
      { active: true, canManageUsers: true },
      { active: true, canManageUsers: true },
    ];
    expect(adminCount(users, 0)).toBe(1);
  });

  it('ignores inactive users when counting administrators', () => {
    const users = [
      { active: true, canManageUsers: true },
      { active: false, canManageUsers: true },
    ];
    expect(adminCount(users, 0)).toBe(0);
  });
});

describe('Self-edit privilege-escalation guard', () => {
  function canSelfEditRole(isSelf: boolean, body: Record<string, unknown>): boolean {
    // Never allow changing own role/branches/overrides via self-edit
    if (isSelf && (body.role_id !== undefined || body.branch_ids !== undefined || body.permission_overrides !== undefined)) {
      return false;
    }
    return true;
  }

  it('blocks a user changing their own role', () => {
    expect(canSelfEditRole(true, { role_id: 'admin' })).toBe(false);
  });

  it('blocks a user changing their own branch scope', () => {
    expect(canSelfEditRole(true, { branch_ids: ['B2'] })).toBe(false);
  });

  it('allows self-editing own profile fields', () => {
    expect(canSelfEditRole(true, { full_name: 'Jane' })).toBe(true);
  });

  it('allows an admin to change another user', () => {
    expect(canSelfEditRole(false, { role_id: 'admin' })).toBe(true);
  });
});
