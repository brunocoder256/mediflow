-- Migration: 00016_returns.sql
-- Returns and return items

CREATE TABLE IF NOT EXISTS returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    return_number text UNIQUE NOT NULL,
    sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    reason text,
    status text NOT NULL DEFAULT 'pending',
    total numeric(14,2) NOT NULL,
    processed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id uuid NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    sale_item_id uuid NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id uuid NOT NULL REFERENCES product_batches(id) ON DELETE RESTRICT,
    quantity integer NOT NULL,
    amount numeric(14,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
