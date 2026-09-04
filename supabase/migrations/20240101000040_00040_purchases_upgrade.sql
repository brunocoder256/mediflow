-- Migration: 00040_purchases_upgrade.sql
-- Pharmacy procurement upgrades: PO lifecycle fields, indexes, GRN support
-- Safe to run if columns already exist (idempotent via IF NOT EXISTS)

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date date;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency text DEFAULT 'UGX';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- product_batches manufacturing_date for full traceability
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS manufacturing_date date;

-- Indexes for server-side search & filters (performance per spec)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch_id ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_purchase_number ON purchase_orders(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_purchase_item_id ON product_batches(purchase_item_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_supplier_id ON product_batches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_id ON stock_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_purchase_order_id ON supplier_payments(purchase_order_id);

-- Ensure purchase_number uniqueness already handled by trigger; keep RLS
