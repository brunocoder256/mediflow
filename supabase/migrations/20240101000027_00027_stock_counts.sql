-- Migration: 00027_stock_counts.sql
-- Physical stock counting system

CREATE TABLE IF NOT EXISTS stock_counts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_PROGRESS','COUNTED','REVIEW','APPROVED','POSTED','CANCELLED')),
    scope_type text NOT NULL DEFAULT 'PRODUCT' CHECK (scope_type IN ('PRODUCT','CATEGORY','ALL')),
    scope_id uuid,
    counted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    approval_reason text,
    posted_at timestamptz,
    variance_total integer DEFAULT 0,
    financial_impact numeric(14,2) DEFAULT 0,
    notes text,
    created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_count_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_count_id uuid NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id uuid REFERENCES product_batches(id) ON DELETE SET NULL,
    system_quantity integer NOT NULL DEFAULT 0,
    counted_quantity integer NOT NULL DEFAULT 0,
    variance integer NOT NULL DEFAULT 0,
    reason text,
    notes text,
    created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_branch_isolation_stock_counts ON stock_counts
    FOR ALL USING (
        organization_id = get_user_org_id()
        AND branch_id IN (SELECT get_user_branch_ids())
    );

CREATE POLICY org_branch_isolation_stock_count_items ON stock_count_items
    FOR ALL USING (
        stock_count_id IN (
            SELECT id FROM stock_counts
            WHERE organization_id = get_user_org_id()
            AND branch_id IN (SELECT get_user_branch_ids())
        )
    );