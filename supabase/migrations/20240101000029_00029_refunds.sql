-- Migration: 00029_refunds.sql
-- Refund tracking for returned sales payments

CREATE TABLE IF NOT EXISTS refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    return_id uuid REFERENCES returns(id) ON DELETE CASCADE,
    refund_number text NOT NULL,
    amount numeric(14,2) NOT NULL,
    payment_method text NOT NULL CHECK (payment_method IN ('CASH','MOBILE_MONEY','CARD','BANK','OTHER')),
    reference text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
    processed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    reason text,
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_branch_isolation_refunds ON refunds
    FOR ALL USING (
        organization_id = get_user_org_id()
        AND branch_id IN (get_user_branch_ids())
    );

CREATE INDEX idx_refunds_sale_id ON refunds(sale_id);
CREATE INDEX idx_refunds_return_id ON refunds(return_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_processed_at ON refunds(processed_at);