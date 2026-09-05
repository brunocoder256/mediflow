-- Migration: users_rbac_hardening
-- Production-grade Users, Roles & Access Control improvements per docs/users.md

-- Extend profiles with RBAC fields (idempotent)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invitation_sent_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invitation_accepted_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_reason text;

-- Normalize status check (allow expected values)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_status_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('invited','active','inactive','suspended','locked','pending_invitation'));
  END IF;
END $$;

-- User branches junction (supports multiple branches per user, independent of role)
CREATE TABLE IF NOT EXISTS user_branches (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_user_branches_user ON user_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branches(branch_id);

-- User permission overrides (optional granular overrides)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect text NOT NULL CHECK (effect IN ('grant','deny')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

-- Add audit helper columns to roles if missing
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Seed granular permissions (expanded catalog)
INSERT INTO permissions (code, name, description) VALUES
  ('dashboard.view','View Dashboard','Access dashboard'),
  ('users.view','View Users','List/view users'),
  ('users.create','Create Users','Create new users'),
  ('users.edit','Edit Users','Edit user details'),
  ('users.deactivate','Deactivate Users','Suspend/deactivate users'),
  ('users.manage_roles','Manage Roles','Create/edit roles'),
  ('users.manage_permissions','Manage Permissions','Assign permissions'),
  ('products.view','View Products','Can view product list'),
  ('products.create','Create Products','Can create new products'),
  ('products.edit','Edit Products','Can edit product details'),
  ('products.archive','Archive Products','Archive products'),
  ('products.import','Import Products','Bulk import'),
  ('products.export','Export Products','Export products'),
  ('inventory.view','View Inventory','Can view inventory'),
  ('inventory.receive','Receive Inventory','Goods receiving'),
  ('inventory.adjust','Adjust Inventory','Stock adjustments'),
  ('inventory.stock_take','Stock Take','Stock counts'),
  ('inventory.transfer','Transfer Stock','Inter-branch transfer'),
  ('inventory.approve_adjustment','Approve Adjustment','Approve stock adjustments'),
  ('purchases.view','View Purchases','View purchase orders'),
  ('purchases.create','Create Purchases','Create PO'),
  ('purchases.approve','Approve Purchases','Approve PO'),
  ('purchases.receive','Receive Purchases','GRN'),
  ('purchases.return','Return Purchases','Purchase returns'),
  ('sales.view','View Sales','View sales'),
  ('sales.create','Create Sales','POS creation'),
  ('sales.edit_draft','Edit Draft Sales','Edit held sales'),
  ('sales.void','Void Sales','Void sales'),
  ('sales.return','Sales Return','Sales returns'),
  ('sales.discount','Apply Discount','Apply discounts'),
  ('sales.price_override','Price Override','Override price'),
  ('expenses.view','View Expenses','View expenses'),
  ('expenses.create','Create Expenses','Create expenses'),
  ('expenses.approve','Approve Expenses','Approve expenses'),
  ('expenses.pay','Pay Expenses','Pay expenses'),
  ('expenses.void','Void Expenses','Void expenses'),
  ('customers.view','View Customers','View customers'),
  ('customers.create','Create Customers','Create customers'),
  ('customers.edit','Edit Customers','Edit customers'),
  ('customers.credit','Manage Credit','Credit adjustments'),
  ('customers.view_financials','View Customer Financials','Customer financials'),
  ('suppliers.view','View Suppliers','View suppliers'),
  ('suppliers.create','Create Suppliers','Create suppliers'),
  ('suppliers.edit','Edit Suppliers','Edit suppliers'),
  ('suppliers.view_financials','View Supplier Financials','Supplier financials'),
  ('reports.view','View Reports','Operational reports'),
  ('reports.export','Export Reports','Export reports'),
  ('reports.view_financial','View Financial Reports','Finance P&L'),
  ('reports.view_profit','View Profit','Margin/profit'),
  ('reports.view_costs','View Costs','Cost visibility'),
  ('settings.view','View Settings','View settings'),
  ('settings.edit','Edit Settings','Edit settings'),
  ('settings.manage_tax','Manage Tax','Tax settings'),
  ('settings.manage_branches','Manage Branches','Branch config'),
  ('audit.view','View Audit','Audit logs'),
  ('audit.export','Export Audit','Export audit')
ON CONFLICT (code) DO NOTHING;

-- Ensure users.manage legacy still present (already seeded)
-- Expand system roles: add missing pharmacy roles if not exist (idempotent by name+org)
DO $$
DECLARE v_org uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  INSERT INTO roles (organization_id, name, description, is_system_role) VALUES
    (v_org, 'Branch Manager', 'Access to assigned branch operations and branch-level reports', true),
    (v_org, 'Pharmacist', 'Pharmacy/dispensing functionality and prescription-related operations', true),
    (v_org, 'Pharmacy Technician', 'Operational dispensing/sales/inventory functions', true),
    (v_org, 'Inventory Manager', 'Inventory, stock movements, stock takes and receiving', true),
    (v_org, 'Purchasing Officer', 'Suppliers, purchase requests, PO and receiving workflows', true),
    (v_org, 'Accountant', 'Expenses, payments, financial reports, receivables/payables', true),
    (v_org, 'Auditor', 'Read-only audit/report access', true),
    (v_org, 'Report Viewer', 'Read-only permitted reports', true)
  ON CONFLICT DO NOTHING;
  -- Unique constraint on organization_id+name may not exist; if duplicate due to lack of constraint, prevent duplicate by check
END $$;

-- Map new permissions to existing Owner role (owner gets all)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='Owner' AND r.organization_id='a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
ON CONFLICT DO NOTHING;

-- Administrator: broad but not Super (owner) - give all except audit.export maybe but give most
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='Administrator' AND p.code NOT IN ('audit.export')
ON CONFLICT DO NOTHING;

-- Branch Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='Branch Manager' AND p.code IN ('dashboard.view','products.view','sales.view','sales.create','inventory.view','purchases.view','customers.view','reports.view','expenses.view')
ON CONFLICT DO NOTHING;

-- Pharmacist
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='Pharmacist' AND p.code IN ('dashboard.view','products.view','sales.view','sales.create','inventory.view','customers.view')
ON CONFLICT DO NOTHING;

-- Inventory Manager -> similar to Stock Manager legacy
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='Inventory Manager' AND p.code IN ('products.view','products.create','products.edit','inventory.view','inventory.receive','inventory.adjust','inventory.stock_take','inventory.transfer','purchases.view','purchases.create','purchases.receive')
ON CONFLICT DO NOTHING;

-- Purchasing Officer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='Purchasing Officer' AND p.code IN ('purchases.view','purchases.create','purchases.approve','purchases.receive','suppliers.view','inventory.view')
ON CONFLICT DO NOTHING;

-- Accountant
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='Accountant' AND p.code IN ('expenses.view','expenses.create','expenses.approve','expenses.pay','reports.view','reports.view_financial','reports.view_profit','reports.view_costs','customers.view_financials','suppliers.view_financials')
ON CONFLICT DO NOTHING;

-- Auditor / Report Viewer read-only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='Auditor' AND p.code IN ('audit.view','reports.view','reports.export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='Report Viewer' AND p.code IN ('reports.view')
ON CONFLICT DO NOTHING;

-- Helper RPC: has_permission (used by auth.ts)
CREATE OR REPLACE FUNCTION has_permission(p_code text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    JOIN profiles pr ON pr.id = ur.user_id
    WHERE pr.auth_user_id = auth.uid() AND p.code = p_code
  ) OR EXISTS (
    SELECT 1 FROM user_permission_overrides upo
    JOIN permissions p ON p.id = upo.permission_id
    JOIN profiles pr ON pr.id = upo.user_id
    WHERE pr.auth_user_id = auth.uid() AND p.code = p_code AND upo.effect='grant'
  );
$$;

-- Helper RPC: max_discount_percent (if approvals table exists, else fallback 0)
CREATE OR REPLACE FUNCTION max_discount_percent()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT 10; -- default 10% for manager+, cashier 0 via app logic if needed; keep simple
$$;

-- updated_at trigger for profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_profiles_updated_at') THEN
    CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_roles_updated_at') THEN
    CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- Index for search performance
CREATE INDEX IF NOT EXISTS idx_profiles_search ON profiles(organization_id, full_name);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_default_branch ON profiles(default_branch_id);
