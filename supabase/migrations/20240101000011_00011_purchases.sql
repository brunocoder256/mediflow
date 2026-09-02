-- Migration: 00011_purchases.sql
-- Purchase orders

CREATE TABLE IF NOT EXISTS purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_number text UNIQUE NOT NULL,
    status text NOT NULL CHECK (status IN ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
    subtotal numeric(14,2) NOT NULL,
    discount numeric(14,2) NOT NULL DEFAULT 0,
    tax numeric(14,2) NOT NULL DEFAULT 0,
    total numeric(14,2) NOT NULL,
    ordered_at timestamptz,
    received_at timestamptz,
    created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
