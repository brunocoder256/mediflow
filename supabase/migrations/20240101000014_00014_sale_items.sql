-- Migration: 00014_sale_items.sql
-- Sale line items

CREATE TABLE IF NOT EXISTS sale_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id uuid NOT NULL REFERENCES product_batches(id) ON DELETE RESTRICT,
    quantity integer NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    discount numeric(14,2) NOT NULL DEFAULT 0,
    tax numeric(14,2) NOT NULL DEFAULT 0,
    subtotal numeric(14,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
