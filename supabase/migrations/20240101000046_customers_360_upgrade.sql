-- Migration: customers 360 upgrade - ERP-grade Customer Management Module
-- Extends existing customers table, adds supporting tables, indexes, triggers

-- 1. Extend customers table with master data fields (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='customer_code') THEN
    ALTER TABLE customers ADD COLUMN customer_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='customer_type') THEN
    ALTER TABLE customers ADD COLUMN customer_type text NOT NULL DEFAULT 'INDIVIDUAL' CHECK (customer_type IN ('INDIVIDUAL','WALK_IN','CORPORATE','CLINIC','HOSPITAL','ORGANIZATION','INSURANCE','OTHER'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='first_name') THEN
    ALTER TABLE customers ADD COLUMN first_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='middle_name') THEN
    ALTER TABLE customers ADD COLUMN middle_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='last_name') THEN
    ALTER TABLE customers ADD COLUMN last_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='display_name') THEN
    ALTER TABLE customers ADD COLUMN display_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='company_name') THEN
    ALTER TABLE customers ADD COLUMN company_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='alternate_phone') THEN
    ALTER TABLE customers ADD COLUMN alternate_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='address') THEN
    ALTER TABLE customers ADD COLUMN address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='city') THEN
    ALTER TABLE customers ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='branch_id') THEN
    ALTER TABLE customers ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='status') THEN
    ALTER TABLE customers ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','BLOCKED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='external_reference') THEN
    ALTER TABLE customers ADD COLUMN external_reference text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tax_id') THEN
    ALTER TABLE customers ADD COLUMN tax_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='credit_limit') THEN
    ALTER TABLE customers ADD COLUMN credit_limit numeric(14,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='payment_terms') THEN
    ALTER TABLE customers ADD COLUMN payment_terms text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='loyalty_points') THEN
    ALTER TABLE customers ADD COLUMN loyalty_points integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='preferred_contact') THEN
    ALTER TABLE customers ADD COLUMN preferred_contact text DEFAULT 'PHONE' CHECK (preferred_contact IN ('PHONE','SMS','EMAIL','WHATSAPP','NONE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='sms_opt_in') THEN
    ALTER TABLE customers ADD COLUMN sms_opt_in boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='email_opt_in') THEN
    ALTER TABLE customers ADD COLUMN email_opt_in boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='marketing_opt_in') THEN
    ALTER TABLE customers ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='contact_person') THEN
    ALTER TABLE customers ADD COLUMN contact_person text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='created_by') THEN
    ALTER TABLE customers ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='updated_by') THEN
    ALTER TABLE customers ADD COLUMN updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='merged_into_id') THEN
    ALTER TABLE customers ADD COLUMN merged_into_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill display_name and customer_code for existing rows
UPDATE customers SET display_name = COALESCE(display_name, name) WHERE display_name IS NULL;
-- Generate customer_code for rows missing it (CUS-YYYY-XXXX)
DO $$ DECLARE r RECORD; n int := 0; BEGIN
  FOR r IN SELECT id FROM customers WHERE customer_code IS NULL ORDER BY created_at LOOP
    n := n + 1;
    UPDATE customers SET customer_code = 'CUS-' || to_char(now(),'YYYYMMDD') || '-' || lpad(n::text,4,'0') WHERE id = r.id;
  END LOOP;
END $$;

-- 2. Unique indexes (organization-scoped)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_code_org ON customers(organization_id, customer_code) WHERE customer_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_org ON customers(organization_id, phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm ON customers USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_email_org ON customers(organization_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_type_status ON customers(customer_type, status);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

-- Enable pg_trgm if not exists (for ilike performance)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. Customer notes
CREATE TABLE IF NOT EXISTS customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'INTERNAL' CHECK (visibility IN ('INTERNAL','SHARED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_org ON customer_notes(organization_id);
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation_customer_notes ON customer_notes;
CREATE POLICY org_isolation_customer_notes ON customer_notes FOR ALL USING (organization_id = get_user_org_id());

-- 4. Customer merges audit (permanent record)
CREATE TABLE IF NOT EXISTS customer_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  master_customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  merged_customer_id uuid NOT NULL,
  merged_customer_snapshot jsonb NOT NULL,
  merged_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reason text,
  sales_moved integer NOT NULL DEFAULT 0,
  payments_moved integer NOT NULL DEFAULT 0,
  returns_moved integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_merges_master ON customer_merges(master_customer_id);
ALTER TABLE customer_merges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation_customer_merges ON customer_merges;
CREATE POLICY org_isolation_customer_merges ON customer_merges FOR ALL USING (organization_id = get_user_org_id());

-- 5. Customer loyalty ledger (transactional, not just balance)
CREATE TABLE IF NOT EXISTS customer_loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  points integer NOT NULL,
  type text NOT NULL CHECK (type IN ('EARNED','REDEEMED','ADJUSTMENT','EXPIRED')),
  reference text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON customer_loyalty_ledger(customer_id);
ALTER TABLE customer_loyalty_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation_loyalty ON customer_loyalty_ledger;
CREATE POLICY org_isolation_loyalty ON customer_loyalty_ledger FOR ALL USING (organization_id = get_user_org_id());

-- 6. Trigger: updated_at
CREATE OR REPLACE FUNCTION update_customers_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); IF NEW.display_name IS NULL OR NEW.display_name = '' THEN NEW.display_name := COALESCE(NEW.company_name, NEW.name); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_customers_updated_at();

CREATE OR REPLACE FUNCTION update_customer_notes_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_customer_notes_updated_at ON customer_notes;
CREATE TRIGGER trg_customer_notes_updated_at BEFORE UPDATE ON customer_notes FOR EACH ROW EXECUTE FUNCTION update_customer_notes_updated_at();

-- 7. Helper function for customer balance (transaction-driven AR)
-- Balance = sum(COMPLETED sales total) - sum(payments for those sales) - credits via refunds where applicable
-- Simplified: outstanding = sum completed sales minus sum payments (refunds decrease sale total via void logic)
CREATE OR REPLACE FUNCTION get_customer_balance(p_customer_id uuid) RETURNS numeric AS $$
DECLARE bal numeric := 0;
BEGIN
  SELECT COALESCE(SUM(total),0) INTO bal FROM sales WHERE customer_id = p_customer_id AND status='COMPLETED';
  RETURN COALESCE(bal,0) - (
    SELECT COALESCE(SUM(p.amount),0) FROM payments p
    JOIN sales s ON p.sale_id = s.id
    WHERE s.customer_id = p_customer_id AND s.status='COMPLETED'
  );
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
