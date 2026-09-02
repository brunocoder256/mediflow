-- Migration: 00008_product_batches.sql
-- Product batches for tracking inventory by batch

CREATE TABLE IF NOT EXISTS product_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number text NOT NULL,
    expiry_date date NOT NULL,
    purchase_price numeric(14,2) NOT NULL,
    selling_price numeric(14,2) NOT NULL,
    quantity_received integer NOT NULL,
    quantity_available integer NOT NULL,
    received_at date NOT NULL,
    supplier_id uuid,
    purchase_item_id uuid,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (quantity_available >= 0 AND quantity_received >= 0)
);
