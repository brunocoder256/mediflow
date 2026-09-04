-- Migration: 00041_purchases_grn_attachments.sql
-- 1) Expand purchase_orders status CHECK to full pharmacy workflow
-- 2) Goods Received Note (GRN) documents — one per receive transaction
-- 3) Purchase attachments for supplier invoices / delivery notes
-- 4) Server-side search helpers (trigram not required; use ilike + indexes)

-- 1) Expand status CHECK
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status IN (
  'DRAFT','PENDING_APPROVAL','APPROVED','SENT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CLOSED','CANCELLED'
));

-- Optional lifecycle timestamps already in 00040, ensure closed_at etc.

-- 2) GRN — Goods Received Note (one per receive, links to batches via stock_movements.reference_id = grn.id alternative)
CREATE TABLE IF NOT EXISTS goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  grn_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('DRAFT','RECEIVED','CANCELLED')),
  received_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  total_quantity integer NOT NULL DEFAULT 0,
  total_value numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_item_id uuid NOT NULL REFERENCES purchase_items(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES product_batches(id) ON DELETE SET NULL,
  quantity_received integer NOT NULL CHECK (quantity_received > 0),
  unit_cost numeric(14,2) NOT NULL,
  batch_number text,
  expiry_date date,
  amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_branch_isolation_goods_receipts ON goods_receipts
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND branch_id IN (SELECT get_user_branch_ids())
  );
CREATE POLICY org_isolation_goods_receipt_items ON goods_receipt_items
  FOR ALL USING (
    goods_receipt_id IN (SELECT id FROM goods_receipts WHERE organization_id = get_user_org_id())
  );

CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON goods_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_grn ON goods_receipts(grn_number);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_org_branch ON goods_receipts(organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_grn ON goods_receipt_items(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_product ON goods_receipt_items(product_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_batch ON goods_receipt_items(batch_id);

-- GRN number generation (GRN-YYYYMMDD-XXXXXX daily sequence, server-authoritative)
CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS trigger AS $$
DECLARE
  v_date text;
  v_seq integer;
  v_last text;
BEGIN
  v_date := to_char(NEW.received_at, 'YYYYMMDD');
  SELECT grn_number INTO v_last FROM goods_receipts
  WHERE grn_number LIKE 'GRN-' || v_date || '-%'
  ORDER BY grn_number DESC LIMIT 1;
  IF v_last IS NULL THEN v_seq := 1;
  ELSE v_seq := substring(v_last from 12 for 6)::integer + 1;
  END IF;
  NEW.grn_number := 'GRN-' || v_date || '-' || lpad(v_seq::text, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grn_number ON goods_receipts;
CREATE TRIGGER trg_grn_number BEFORE INSERT ON goods_receipts
  FOR EACH ROW EXECUTE FUNCTION generate_grn_number();

CREATE TRIGGER trg_goods_receipts_updated_at BEFORE UPDATE ON goods_receipts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- 3) Purchase attachments (reuse existing storage if bucket exists; keep table for metadata)
CREATE TABLE IF NOT EXISTS purchase_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  goods_receipt_id uuid REFERENCES goods_receipts(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  document_type text NOT NULL CHECK (document_type IN ('SUPPLIER_INVOICE','DELIVERY_NOTE','PURCHASE_ORDER','CREDIT_NOTE','OTHER')),
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation_purchase_attachments ON purchase_attachments
  FOR ALL USING (organization_id = get_user_org_id());

CREATE INDEX IF NOT EXISTS idx_purchase_attachments_po ON purchase_attachments(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_attachments_grn ON purchase_attachments(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_attachments_org ON purchase_attachments(organization_id);

-- 4) Helper for server-side search (optional view for fast po+supplier ilike)
-- No extra view needed; indexes on purchase_number + supplier_id cover it.
-- Ensure trigram extension if available (safe if not)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
