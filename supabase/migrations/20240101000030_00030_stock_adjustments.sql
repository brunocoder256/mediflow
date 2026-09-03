-- Migration: 00030_stock_adjustments.sql
-- Controlled stock adjustment workflow

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    adjustment_number text NOT NULL,
    reason text NOT NULL,
    notes text,
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','POSTED','CANCELLED')),
    total_variance integer DEFAULT 0,
    financial_impact numeric(14,2) DEFAULT 0,
    requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at timestamptz,
    approval_reason text,
    posted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adjustment_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_adjustment_id uuid NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id uuid REFERENCES product_batches(id) ON DELETE SET NULL,
    adjustment_type text NOT NULL CHECK (adjustment_type IN ('ADJUSTMENT_IN','ADJUSTMENT_OUT')),
    quantity integer NOT NULL,
    unit_cost numeric(14,2) NOT NULL,
    amount numeric(14,2) NOT NULL,
    reason text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjustment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_branch_isolation_stock_adjustments ON stock_adjustments
    FOR ALL USING (
        organization_id = get_user_org_id()
        AND branch_id IN (get_user_branch_ids())
    );

CREATE POLICY org_isolation_adjustment_items ON adjustment_items
    FOR ALL USING (
        stock_adjustment_id IN (
            SELECT id FROM stock_adjustments
            WHERE organization_id = get_user_org_id()
        )
    );

CREATE INDEX idx_stock_adjustments_organization_id ON stock_adjustments(organization_id);
CREATE INDEX idx_stock_adjustments_branch_id ON stock_adjustments(branch_id);
CREATE INDEX idx_stock_adjustments_status ON stock_adjustments(status);
CREATE INDEX idx_adjustment_items_stock_adjustment_id ON adjustment_items(stock_adjustment_id);
CREATE INDEX idx_adjustment_items_product_id ON adjustment_items(product_id);