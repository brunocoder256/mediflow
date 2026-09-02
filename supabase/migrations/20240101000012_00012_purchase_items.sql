-- Migration: 00012_purchase_items.sql
-- Purchase order line items

CREATE TABLE IF NOT EXISTS purchase_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_ordered integer NOT NULL,
    quantity_received integer NOT NULL DEFAULT 0,
    unit_cost numeric(14,2) NOT NULL,
    discount numeric(14,2) NOT NULL DEFAULT 0,
    tax numeric(14,2) NOT NULL DEFAULT 0,
    subtotal numeric(14,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
