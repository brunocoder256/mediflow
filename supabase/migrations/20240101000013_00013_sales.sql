-- Migration: 00013_sales.sql
-- Sales transactions

CREATE TABLE IF NOT EXISTS sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    sale_number text UNIQUE NOT NULL,
    status text NOT NULL CHECK (status IN ('COMPLETED', 'HELD', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
    subtotal numeric(14,2) NOT NULL,
    discount numeric(14,2) NOT NULL DEFAULT 0,
    tax numeric(14,2) NOT NULL DEFAULT 0,
    total numeric(14,2) NOT NULL,
    customer_id uuid,
    cashier_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    sold_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
