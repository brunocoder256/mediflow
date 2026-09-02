-- Migration: 00015_payments.sql
-- Payment records for sales

CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
    payment_method text NOT NULL CHECK (payment_method IN ('CASH', 'MOBILE_MONEY', 'CARD', 'BANK', 'OTHER')),
    amount numeric(14,2) NOT NULL,
    reference text,
    status text NOT NULL DEFAULT 'completed',
    paid_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);
