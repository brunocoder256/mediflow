-- Migration: 00028_purchase_returns.sql
-- Purchase return workflow

CREATE TABLE IF NOT EXISTS purchase_returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    return_number text NOT NULL,
    reason text,
    total numeric(14,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','completed','cancelled')),
    approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    processed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_return_id uuid NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    purchase_item_id uuid NOT NULL REFERENCES purchase_items(id) ON DELETE RESTRICT,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id uuid REFERENCES product_batches(id) ON DELETE SET NULL,
    quantity integer NOT NULL,
    unit_cost numeric(14,2) NOT NULL,
    amount numeric(14,2) NOT NULL,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_branch_isolation_purchase_returns ON purchase_returns
    FOR ALL USING (
        organization_id = get_user_org_id()
        AND branch_id IN (get_user_branch_ids())
    );

CREATE POLICY org_isolation_purchase_return_items ON purchase_return_items
    FOR ALL USING (
        purchase_return_id IN (
            SELECT id FROM purchase_returns
            WHERE organization_id = get_user_org_id()
        )
    );

CREATE INDEX idx_purchase_returns_purchase_order_id ON purchase_returns(purchase_order_id);
CREATE INDEX idx_purchase_returns_supplier_id ON purchase_returns(supplier_id);
CREATE INDEX idx_purchase_return_items_purchase_return_id ON purchase_return_items(purchase_return_id);
CREATE INDEX idx_purchase_return_items_product_id ON purchase_return_items(product_id);