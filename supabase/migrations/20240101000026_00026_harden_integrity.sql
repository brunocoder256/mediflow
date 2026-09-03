-- Migration: 00026_harden_integrity.sql
-- Phase 2: Security hardening, data integrity constraints, indexes, and seed improvements
-- This migration fixes RLS gaps, adds missing constraints, indexes, and enhances seed data.

-- =============================================================================
-- 1. RLS FIXES
-- =============================================================================

-- Enable RLS on missing tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- Organizations policy: org-scoped isolation
CREATE POLICY org_isolation_organizations ON organizations
    FOR ALL USING (id = get_user_org_id());

-- Permissions: global read-only (no INSERT/UPDATE/DELETE policy = denied by default)
-- The existing global_read_permissions policy in 00024 handles SELECT.
-- With RLS now enabled on permissions, that policy becomes active.

-- Role permissions: existing policy in 00024 is org-scoped through roles.
-- With RLS now enabled, it becomes active. Do NOT recreate it (would error).

-- Fix audit_logs to be append-only (INSERT + SELECT only, no UPDATE/DELETE)
DROP POLICY IF EXISTS org_isolation_audit_logs ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT USING (organization_id = get_user_org_id());

-- Fix branch_settings to include org check via branches join
DROP POLICY IF EXISTS org_branch_isolation_branch_settings ON branch_settings;
CREATE POLICY org_branch_isolation_branch_settings ON branch_settings
    FOR ALL USING (
        branch_id IN (
            SELECT b.id FROM branches b
            WHERE b.organization_id = get_user_org_id()
            AND b.id IN (SELECT get_user_branch_ids())
        )
    );

-- Fix get_user_branch_ids() to be org-scoped
CREATE OR REPLACE FUNCTION get_user_branch_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT ur.branch_id
    FROM user_roles ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE p.auth_user_id = auth.uid()
    AND ur.branch_id IS NOT NULL
    AND p.organization_id = get_user_org_id();
$$;

-- Fix profiles: split into granular policies to prevent self-modification of sensitive fields
DROP POLICY IF EXISTS org_isolation_profiles ON profiles;

CREATE POLICY org_isolation_profiles_select ON profiles
    FOR SELECT USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_profiles_update_own ON profiles
    FOR UPDATE USING (
        auth_user_id = auth.uid()
        AND organization_id = get_user_org_id()
    ) WITH CHECK (
        auth_user_id = auth.uid()
        AND organization_id = get_user_org_id()
    );

CREATE POLICY org_isolation_profiles_insert ON profiles
    FOR INSERT WITH CHECK (organization_id = get_user_org_id());

-- =============================================================================
-- 2. MISSING UNIQUE CONSTRAINTS
-- =============================================================================

ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role_id);
ALTER TABLE roles ADD CONSTRAINT roles_org_name_unique UNIQUE (organization_id, name);
ALTER TABLE categories ADD CONSTRAINT categories_org_name_unique UNIQUE (organization_id, name);
ALTER TABLE units ADD CONSTRAINT units_org_name_unique UNIQUE (organization_id, name);
ALTER TABLE units ADD CONSTRAINT units_org_abbreviation_unique UNIQUE (organization_id, abbreviation);

-- =============================================================================
-- 3. MISSING FOREIGN KEYS
-- =============================================================================

ALTER TABLE product_batches ADD CONSTRAINT product_batches_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE product_batches ADD CONSTRAINT product_batches_purchase_item_id_fkey
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE SET NULL;

ALTER TABLE sales ADD CONSTRAINT sales_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- =============================================================================
-- 4. FINANCIAL CHECK CONSTRAINTS
-- =============================================================================

ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
ALTER TABLE expenses ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);
ALTER TABLE return_items ADD CONSTRAINT return_items_quantity_positive CHECK (quantity > 0);
ALTER TABLE return_items ADD CONSTRAINT return_items_amount_non_negative CHECK (amount >= 0);
ALTER TABLE product_batches ADD CONSTRAINT product_batches_prices_non_negative CHECK (purchase_price >= 0 AND selling_price >= 0);
ALTER TABLE organization_settings ADD CONSTRAINT org_settings_tax_rate_non_negative CHECK (default_tax_rate >= 0);
ALTER TABLE organization_settings ADD CONSTRAINT org_settings_low_stock_non_negative CHECK (low_stock_threshold >= 0);
ALTER TABLE organization_settings ADD CONSTRAINT org_settings_expiry_days_non_negative CHECK (expiry_warning_days >= 0);

-- =============================================================================
-- 5. STATUS CHECK CONSTRAINTS
-- =============================================================================

ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));
ALTER TABLE returns ADD CONSTRAINT returns_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'completed'));
ALTER TABLE sync_queue ADD CONSTRAINT sync_queue_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE sync_queue ADD CONSTRAINT sync_queue_attempts_non_negative CHECK (attempts >= 0);
ALTER TABLE expenses ADD CONSTRAINT expenses_payment_method_check CHECK (payment_method IN ('CASH', 'MOBILE_MONEY', 'CARD', 'BANK', 'OTHER'));

-- =============================================================================
-- 6. MISSING INDEXES
-- =============================================================================

-- Composite index for POS batch lookup (most critical)
CREATE INDEX idx_product_batches_branch_product_expiry ON product_batches(branch_id, product_id, expiry_date);

-- FK lookup indexes
CREATE INDEX idx_purchase_items_purchase_order_id ON purchase_items(purchase_order_id);
CREATE INDEX idx_return_items_return_id ON return_items(return_id);
CREATE INDEX idx_return_items_sale_item_id ON return_items(sale_item_id);
CREATE INDEX idx_returns_sale_id ON returns(sale_id);
CREATE INDEX idx_payments_sale_id ON payments(sale_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_devices_user_id ON devices(user_id);

-- Search indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- =============================================================================
-- 7. SEED DATA IMPROVEMENTS
-- =============================================================================

-- Add missing permissions
INSERT INTO permissions (id, code, name, description) VALUES
    ('f0eebc99-9001-4000-8000-000000000030', 'dashboard.view', 'View Dashboard', 'Access the main dashboard'),
    ('f0eebc99-9001-4000-8000-000000000031', 'pos.use', 'Use POS', 'Operate the point of sale'),
    ('f0eebc99-9001-4000-8000-000000000032', 'sales.return', 'Process Sales Returns', 'Process customer returns on sales'),
    ('f0eebc99-9001-4000-8000-000000000033', 'suppliers.view', 'View Suppliers', 'View supplier records'),
    ('f0eebc99-9001-4000-8000-000000000034', 'suppliers.manage', 'Manage Suppliers', 'Create, edit, and deactivate suppliers'),
    ('f0eebc99-9001-4000-8000-000000000035', 'users.view', 'View Users', 'View user accounts'),
    ('f0eebc99-9001-4000-8000-000000000036', 'roles.manage', 'Manage Roles', 'Create and manage roles and permissions'),
    ('f0eebc99-9001-4000-8000-000000000037', 'audit.view', 'View Audit Logs', 'View audit trail records')
ON CONFLICT (code) DO NOTHING;

-- Add missing role-permission mappings for Cashier
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Cashier' AND p.code IN ('dashboard.view', 'pos.use', 'sales.view', 'sales.create')
AND r.organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
ON CONFLICT DO NOTHING;

-- Add dashboard.view to all roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.code = 'dashboard.view'
AND r.organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
ON CONFLICT DO NOTHING;

-- Sample product batches
INSERT INTO product_batches (id, organization_id, branch_id, product_id, batch_number, expiry_date, purchase_price, selling_price, quantity_received, quantity_available, received_at, is_active)
SELECT
    gen_random_uuid(),
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    p.id,
    'BATCH-' || SUBSTRING(p.id::text, 1, 8),
    CURRENT_DATE + INTERVAL '6 months',
    CASE WHEN p.name LIKE '%Amoxicillin%' THEN 8000 WHEN p.name LIKE '%Paracetamol%' THEN 2000 WHEN p.name LIKE '%Vitamin%' THEN 5000 ELSE 3000 END,
    CASE WHEN p.name LIKE '%Amoxicillin%' THEN 12000 WHEN p.name LIKE '%Paracetamol%' THEN 3500 WHEN p.name LIKE '%Vitamin%' THEN 8000 ELSE 5000 END,
    100,
    85,
    CURRENT_DATE - INTERVAL '1 month',
    true
FROM products p
WHERE p.organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
LIMIT 10
ON CONFLICT DO NOTHING;

-- Sample customers
INSERT INTO customers (id, organization_id, name, phone, email, is_active)
VALUES
    ('c0eebc99-9001-4000-8000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Walk-in Customer', NULL, NULL, true),
    ('c0eebc99-9001-4000-8000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'John Doe', '+256700000001', 'john@example.com', true),
    ('c0eebc99-9001-4000-8000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Jane Smith', '+256700000002', 'jane@example.com', true)
ON CONFLICT DO NOTHING;
