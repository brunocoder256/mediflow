-- Migration: users_rbac_finish
-- Unify branch scope on user_branches, admin profile policies, deny overrides, audit helper

-- 1) Branch IDs: prefer user_branches, keep legacy user_roles.branch_id
CREATE OR REPLACE FUNCTION get_user_branch_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT branch_id FROM (
    SELECT ub.branch_id
    FROM user_branches ub
    JOIN profiles p ON p.id = ub.user_id
    WHERE p.auth_user_id = auth.uid()
      AND p.organization_id = get_user_org_id()

    UNION ALL

    SELECT ur.branch_id
    FROM user_roles ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE p.auth_user_id = auth.uid()
      AND ur.branch_id IS NOT NULL
      AND p.organization_id = get_user_org_id()

    UNION ALL

    -- Legacy: null branch_id on user_roles means all org branches (only when no user_branches rows)
    SELECT b.id
    FROM branches b
    JOIN profiles p ON p.organization_id = b.organization_id
    JOIN user_roles ur ON ur.user_id = p.id AND ur.branch_id IS NULL
    WHERE p.auth_user_id = auth.uid()
      AND p.organization_id = get_user_org_id()
      AND NOT EXISTS (SELECT 1 FROM user_branches ub2 WHERE ub2.user_id = p.id)
  ) scoped
  WHERE branch_id IS NOT NULL;
$$;

-- 2) has_permission: honor deny overrides
CREATE OR REPLACE FUNCTION has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1
      FROM user_permission_overrides upo
      JOIN permissions p ON p.id = upo.permission_id
      JOIN profiles pr ON pr.id = upo.user_id
      WHERE pr.auth_user_id = auth.uid()
        AND p.code = p_code
        AND upo.effect = 'deny'
    )
    AND (
      EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        JOIN profiles pr ON pr.id = ur.user_id
        WHERE pr.auth_user_id = auth.uid()
          AND p.code = p_code
      )
      OR EXISTS (
        SELECT 1
        FROM user_permission_overrides upo
        JOIN permissions p ON p.id = upo.permission_id
        JOIN profiles pr ON pr.id = upo.user_id
        WHERE pr.auth_user_id = auth.uid()
          AND p.code = p_code
          AND upo.effect = 'grant'
      )
    );
$$;

-- 3) Allow org admins to update other profiles (status, identity fields)
DROP POLICY IF EXISTS org_isolation_profiles_update_admin ON profiles;
CREATE POLICY org_isolation_profiles_update_admin ON profiles
  FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND (
      has_permission('users.edit')
      OR has_permission('users.deactivate')
      OR has_permission('users.manage')
    )
  )
  WITH CHECK (organization_id = get_user_org_id());

-- 4) Allow admins to manage user_roles for org users
DROP POLICY IF EXISTS user_isolation_user_roles ON user_roles;
CREATE POLICY user_roles_select_own_or_admin ON user_roles
  FOR SELECT USING (
    user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1)
    OR has_permission('users.view')
    OR has_permission('users.manage')
    OR has_permission('users.manage_roles')
  );
CREATE POLICY user_roles_manage_admin ON user_roles
  FOR ALL USING (
    has_permission('users.manage_roles')
    OR has_permission('users.manage')
    OR has_permission('users.create')
    OR has_permission('users.edit')
  )
  WITH CHECK (
    has_permission('users.manage_roles')
    OR has_permission('users.manage')
    OR has_permission('users.create')
    OR has_permission('users.edit')
  );

-- 5) RLS for user_branches
ALTER TABLE user_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_branches_select ON user_branches;
DROP POLICY IF EXISTS user_branches_manage ON user_branches;
CREATE POLICY user_branches_select ON user_branches
  FOR SELECT USING (
    user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1)
    OR has_permission('users.view')
    OR has_permission('users.manage')
  );
CREATE POLICY user_branches_manage ON user_branches
  FOR ALL USING (
    has_permission('users.manage_roles')
    OR has_permission('users.manage')
    OR has_permission('users.create')
    OR has_permission('users.edit')
  )
  WITH CHECK (
    has_permission('users.manage_roles')
    OR has_permission('users.manage')
    OR has_permission('users.create')
    OR has_permission('users.edit')
  );

-- 6) RLS for user_permission_overrides
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_permission_overrides_select ON user_permission_overrides;
DROP POLICY IF EXISTS user_permission_overrides_manage ON user_permission_overrides;
CREATE POLICY user_permission_overrides_select ON user_permission_overrides
  FOR SELECT USING (
    user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1)
    OR has_permission('users.view')
    OR has_permission('users.manage_permissions')
  );
CREATE POLICY user_permission_overrides_manage ON user_permission_overrides
  FOR ALL USING (
    has_permission('users.manage_permissions') OR has_permission('users.manage')
  )
  WITH CHECK (
    has_permission('users.manage_permissions') OR has_permission('users.manage')
  );

-- 7) Ensure audit_logs accepts inserts with organization_id + user_id (column already exists)
-- Add created_by alias column if some code paths still use it
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
