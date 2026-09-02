-- Migration: 00009_stock_movements.sql
-- Stock movement tracking

CREATE TABLE IF NOT EXISTS stock_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_id uuid NOT NULL REFERENCES product_batches(id) ON DELETE CASCADE,
    movement_type text NOT NULL CHECK (movement_type IN (
        'PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN',
        'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT',
        'OPENING_BALANCE', 'EXPIRED', 'DAMAGED'
    )),
    quantity integer NOT NULL,
    reference_type text,
    reference_id uuid,
    unit_cost numeric(14,2),
    notes text,
    created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
