-- Migration: 00024_rls.sql
-- Row Level Security policies

-- Helper function: Get current user's organization_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT organization_id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Helper function: Get current user's branch IDs
CREATE OR REPLACE FUNCTION get_user_branch_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT branch_id FROM user_roles WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid());
$$;

-- Enable RLS on all business tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_settings ENABLE ROW LEVEL SECURITY;

-- Organization-scoped tables RLS policies
CREATE POLICY org_isolation_branches ON branches
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_profiles ON profiles
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_roles ON roles
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_categories ON categories
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_units ON units
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_products ON products
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_suppliers ON suppliers
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_customers ON customers
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_expenses ON expenses
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_audit_logs ON audit_logs
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY org_isolation_organization_settings ON organization_settings
    FOR ALL USING (organization_id = get_user_org_id());

-- Branch-scoped tables RLS policies
CREATE POLICY org_branch_isolation_product_batches ON product_batches
    FOR ALL USING (organization_id = get_user_org_id() AND branch_id IN (SELECT get_user_branch_ids()));

CREATE POLICY org_branch_isolation_stock_movements ON stock_movements
    FOR ALL USING (organization_id = get_user_org_id() AND branch_id IN (SELECT get_user_branch_ids()));

CREATE POLICY org_branch_isolation_purchase_orders ON purchase_orders
    FOR ALL USING (organization_id = get_user_org_id() AND branch_id IN (SELECT get_user_branch_ids()));

CREATE POLICY org_branch_isolation_sales ON sales
    FOR ALL USING (organization_id = get_user_org_id() AND branch_id IN (SELECT get_user_branch_ids()));

CREATE POLICY org_branch_isolation_payments ON payments
    FOR ALL USING (organization_id = get_user_org_id() AND branch_id IN (SELECT get_user_branch_ids()));

CREATE POLICY org_branch_isolation_returns ON returns
    FOR ALL USING (organization_id = get_user_org_id() AND branch_id IN (SELECT get_user_branch_ids()));

CREATE POLICY org_branch_isolation_devices ON devices
    FOR ALL USING (organization_id = get_user_org_id() AND branch_id IN (SELECT get_user_branch_ids()));

CREATE POLICY org_branch_isolation_sync_queue ON sync_queue
    FOR ALL USING (organization_id = get_user_org_id() AND branch_id IN (SELECT get_user_branch_ids()));

CREATE POLICY org_branch_isolation_branch_settings ON branch_settings
    FOR ALL USING (branch_id IN (SELECT get_user_branch_ids()));

-- Notification and user_roles policies (user-specific)
CREATE POLICY user_isolation_notifications ON notifications
    FOR ALL USING (user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY user_isolation_user_roles ON user_roles
    FOR ALL USING (user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

-- Purchase items inherit from purchase_orders
CREATE POLICY org_isolation_purchase_items ON purchase_items
    FOR ALL USING (purchase_order_id IN (SELECT id FROM purchase_orders WHERE organization_id = get_user_org_id()));

-- Sale items inherit from sales
CREATE POLICY org_isolation_sale_items ON sale_items
    FOR ALL USING (sale_id IN (SELECT id FROM sales WHERE organization_id = get_user_org_id()));

-- Return items inherit from returns
CREATE POLICY org_isolation_return_items ON return_items
    FOR ALL USING (return_id IN (SELECT id FROM returns WHERE organization_id = get_user_org_id()));

-- Role permissions (org-scoped through roles)
CREATE POLICY org_isolation_role_permissions ON role_permissions
    FOR ALL USING (role_id IN (SELECT id FROM roles WHERE organization_id = get_user_org_id()));

-- Permissions are global
CREATE POLICY global_read_permissions ON permissions
    FOR SELECT USING (true);
