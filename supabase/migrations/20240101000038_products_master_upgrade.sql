-- Migration: 00038_products_master_upgrade.sql
-- Transform Products into Pharmacy Product Master & Catalog

-- 1. Extend products with pharmacy master fields (backward-compatible)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type text DEFAULT 'Human Medicine';
ALTER TABLE products ADD COLUMN IF NOT EXISTS strength text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS strength_unit text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dosage_form text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS route text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_size integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_pack integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS country_of_origin text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS classification text DEFAULT 'OTC';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS alternative_names text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock integer DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_stock integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_quantity integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS storage_location text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shelf text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rack text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bin text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_batch boolean DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_expiry boolean DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS fefo_enabled boolean DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_negative_stock boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_purchase_cost numeric(14,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_selling_price numeric(14,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_selling_price numeric(14,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_category text DEFAULT 'standard';
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_inclusive boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
-- Note: organization_id already exists, keep as is

-- Constraints & indexes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_strength_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_strength_check CHECK (strength IS NULL OR char_length(strength) <= 50);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_products_org_active ON products(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_dosage_form ON products(dosage_form);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL AND barcode <> '';
CREATE INDEX IF NOT EXISTS idx_products_sku_unique ON products(organization_id, sku) WHERE sku IS NOT NULL AND sku <> '';
CREATE INDEX IF NOT EXISTS idx_products_generic_name ON products(generic_name);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer);

-- 2. Product-Supplier junction (many-to-many)
CREATE TABLE IF NOT EXISTS product_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_product_code text,
  last_purchase_price numeric(14,2),
  is_preferred boolean DEFAULT false,
  lead_time_days integer,
  minimum_order_quantity integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, supplier_id)
);
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation_product_suppliers ON product_suppliers;
CREATE POLICY org_isolation_product_suppliers ON product_suppliers FOR ALL USING (organization_id = get_user_org_id());
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON product_suppliers(supplier_id);

-- 3. Ensure price_history covers product master pricing audit
-- price_history already exists (00034) but ensure RLS
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation_price_history ON price_history;
CREATE POLICY org_isolation_price_history ON price_history FOR ALL USING (organization_id = get_user_org_id());

-- 4. Trigger for updated_at
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS trg_product_suppliers_updated_at ON product_suppliers;
CREATE TRIGGER trg_product_suppliers_updated_at BEFORE UPDATE ON product_suppliers FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- 5. Seed additional therapeutic categories (if missing)
INSERT INTO categories (id, organization_id, name, description) VALUES
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd390a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Analgesics / Pain Relief', 'Pain management'),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd390a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd390a03', 'Immunological', 'Vaccines and immunoglobulins')
ON CONFLICT DO NOTHING;

-- 6. Permissions for products master
INSERT INTO permissions (code, name, description) VALUES
  ('products.view', 'View Products', 'Can view product list') ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code, name, description) VALUES
  ('products.create', 'Create Products', 'Can create new products') ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code, name, description) VALUES
  ('products.edit', 'Edit Products', 'Can edit product details') ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code, name, description) VALUES
  ('products.deactivate', 'Archive Products', 'Can deactivate/archive products') ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code, name, description) VALUES
  ('products.import', 'Import Products', 'Can bulk import products') ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code, name, description) VALUES
  ('products.manage_suppliers', 'Manage Product Suppliers', 'Can link suppliers to products') ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code, name, description) VALUES
  ('products.view_cost', 'View Cost Price', 'Can view purchase cost information') ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code, name, description) VALUES
  ('categories.manage', 'Manage Categories', 'Can manage categories') ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE product_suppliers IS 'Many-to-many product-supplier with pricing/lead time';
COMMENT ON COLUMN products.product_type IS 'Human Medicine | Medical Device | Diagnostic | Personal Care | Hygiene | First Aid | Nutrition | Baby & Maternal | Other';
COMMENT ON COLUMN products.dosage_form IS 'Tablet | Capsule | Syrup | Suspension | Cream | etc';
