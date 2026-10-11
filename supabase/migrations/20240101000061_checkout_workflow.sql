-- Migration: 00061_checkout_workflow.sql
-- Optional separate Salesperson + Cashier checkout workflow.
--
-- AVAILABILITY: only the Pharmacy (plan_tier = 'pro') and Enterprise
-- ('enterprise') plans may use a multi-person checkout. The Drug Shop / Starter
-- plan is always single-person. This is enforced in three layers:
--   1. The organization setting can only be switched on via the settings API
--      (which checks the plan) and via the RPCs below (which re-check it).
--   2. Every bill RPC re-validates the plan + workflow server-side.
--   3. A trigger blocks a direct API/RPC attempt to insert a COMPLETED sale
--      while a separate workflow is enabled (no bypass, see test 16).
--
-- Workflow A (single_person) is unchanged: create_pos_sale remains the single
-- authoritative transaction for a one-person POS.
--
-- A pending bill is a `sales` row with status 'AWAITING_PAYMENT' and
-- cashier_id = NULL. Because every report filters status = 'COMPLETED', a
-- pending bill is never counted as a paid sale or collected cash.

-- ---------------------------------------------------------------------------
-- 1) Organization setting: checkout workflow
-- ---------------------------------------------------------------------------
ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS checkout_workflow text NOT NULL DEFAULT 'single_person';

ALTER TABLE organization_settings DROP CONSTRAINT IF EXISTS organization_settings_checkout_workflow_check;
ALTER TABLE organization_settings ADD CONSTRAINT organization_settings_checkout_workflow_check
  CHECK (checkout_workflow IN ('single_person', 'salesperson_cashier', 'three_stage'));

UPDATE organization_settings SET checkout_workflow = 'single_person' WHERE checkout_workflow IS NULL;

-- ---------------------------------------------------------------------------
-- 2) sales: bill submission + cashier attribution + handover columns
-- ---------------------------------------------------------------------------
ALTER TABLE sales ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_operation_id text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS handover_status text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS handover_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS handover_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_handover_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_handover_status_check
  CHECK (handover_status IS NULL OR handover_status IN ('PENDING', 'CONFIRMED'));

-- A bill exists before any cashier has been assigned.
ALTER TABLE sales ALTER COLUMN cashier_id DROP NOT NULL;

-- Extend the sale status lifecycle (existing values preserved).
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN ('COMPLETED', 'HELD', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'AWAITING_PAYMENT', 'CANCELLED'));

-- Backfill: attribute existing completed sales to their cashier as salesperson.
UPDATE sales SET salesperson_id = cashier_id WHERE salesperson_id IS NULL AND cashier_id IS NOT NULL;

-- Indexes for the cashier queue and reporting.
CREATE INDEX IF NOT EXISTS idx_sales_branch_status ON sales(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_salesperson ON sales(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_sales_submitted_at ON sales(submitted_at);
-- Belt-and-suspenders idempotency: one completion per payment operation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_payment_operation
  ON sales(payment_operation_id) WHERE payment_operation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Helpers (server-side authorization primitives)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_pos_workflow()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(os.checkout_workflow, 'single_person')
  FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  LEFT JOIN organization_settings os ON os.organization_id = o.id
  WHERE p.auth_user_id = auth.uid()
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION current_pos_workflow() TO authenticated;

CREATE OR REPLACE FUNCTION org_plan_allows_separate_checkout()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT o.plan_tier IN ('pro', 'enterprise')
       FROM profiles p
       JOIN organizations o ON o.id = p.organization_id
      WHERE p.auth_user_id = auth.uid()
      LIMIT 1),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION org_plan_allows_separate_checkout() TO authenticated;

-- Reject a direct completed-sale insert while a separate workflow is enabled.
-- Completing a bill uses an UPDATE (not an INSERT), so the bill RPCs are not
-- affected. Service-role/background inserts (no auth.uid()) are not blocked.
CREATE OR REPLACE FUNCTION enforce_checkout_workflow_on_sale_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'COMPLETED'
     AND COALESCE(current_pos_workflow(), 'single_person') <> 'single_person' THEN
    RAISE EXCEPTION 'Direct POS payment is disabled while a separate salesperson/cashier checkout workflow is enabled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_enforce_checkout_workflow ON sales;
CREATE TRIGGER trg_sales_enforce_checkout_workflow
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION enforce_checkout_workflow_on_sale_insert();

-- ---------------------------------------------------------------------------
-- 4) submit_bill: salesperson prepares a bill (no stock decrement)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_bill(
  p_branch_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_operation_id text,
  p_sold_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_profile_id uuid;
  v_sale_id uuid;
  v_sale_number text;
  v_subtotal numeric(14,2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity int;
  v_discount numeric;
  v_discount_type text;
  v_unit_price numeric;
  v_line_disc numeric;
  v_line_total numeric;
  v_remaining int;
  v_batch record;
  v_alloc_qty int;
  v_is_active boolean;
  v_max_disc numeric;
  v_sale_time timestamptz;
  v_existing_id uuid;
  v_existing_number text;
  v_existing_status text;
BEGIN
  SELECT id, organization_id INTO v_profile_id, v_org_id
  FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT org_plan_allows_separate_checkout() THEN
    RAISE EXCEPTION 'Separate salesperson/cashier checkout is available on the Pharmacy and Enterprise plans only';
  END IF;
  IF COALESCE(current_pos_workflow(), 'single_person') = 'single_person' THEN
    RAISE EXCEPTION 'Separate salesperson/cashier checkout is not enabled for this organization';
  END IF;
  IF NOT has_permission('sales.submit_bill') THEN
    RAISE EXCEPTION 'Forbidden: sales.submit_bill required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_profile_id AND branch_id = p_branch_id) THEN
    RAISE EXCEPTION 'Unauthorized branch';
  END IF;

  -- Idempotency: a repeated submit returns the original bill.
  IF p_operation_id IS NOT NULL THEN
    SELECT id, sale_number, status INTO v_existing_id, v_existing_number, v_existing_status
    FROM sales WHERE operation_id = p_operation_id LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('sale_id', v_existing_id, 'sale_number', v_existing_number, 'status', v_existing_status, 'duplicate', true);
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A bill must contain at least one item';
  END IF;

  v_sale_time := COALESCE(p_sold_at, now());
  v_max_disc := max_discount_percent();

  -- Validate discounts against the salesperson's permission.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_discount := COALESCE((v_item->>'discount')::numeric, 0);
    v_discount_type := COALESCE(v_item->>'discount_type', 'fixed');
    IF v_discount < 0 THEN RAISE EXCEPTION 'Discount cannot be negative'; END IF;
    IF v_discount > 0 AND v_max_disc = 0 THEN RAISE EXCEPTION 'Discount not permitted for your role (max 0%%)'; END IF;
    IF v_discount_type = 'percent' AND v_discount > v_max_disc THEN RAISE EXCEPTION 'Discount % exceeds your limit (max %)', v_discount, v_max_disc; END IF;
    IF v_discount_type = 'percent' AND v_discount > 100 THEN RAISE EXCEPTION 'Discount percent >100'; END IF;
  END LOOP;

  INSERT INTO sales (organization_id, branch_id, sale_number, status, subtotal, discount, tax, total,
                     customer_id, cashier_id, salesperson_id, submitted_at, submitted_by, operation_id, sold_at)
  VALUES (v_org_id, p_branch_id, 'BILL-' || upper(substring(gen_random_uuid()::text, 1, 8)),
          'AWAITING_PAYMENT', 0, 0, 0, 0, p_customer_id, NULL, v_profile_id, now(), v_profile_id, p_operation_id, v_sale_time)
  RETURNING id, sale_number INTO v_sale_id, v_sale_number;

  -- Resolve FEFO lines for display/pricing WITHOUT reserving or decrementing stock.
  -- Stock is re-validated atomically when the cashier completes payment.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;
    v_discount := COALESCE((v_item->>'discount')::numeric, 0);
    v_discount_type := COALESCE(v_item->>'discount_type', 'fixed');
    IF v_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be >0'; END IF;

    SELECT is_active INTO v_is_active FROM products WHERE id = v_product_id;
    IF v_is_active = false OR v_is_active IS NULL THEN RAISE EXCEPTION 'Product inactive or not found: %', v_product_id; END IF;

    v_remaining := v_quantity;
    FOR v_batch IN SELECT id, selling_price, quantity_available FROM product_batches
                   WHERE product_id = v_product_id AND branch_id = p_branch_id AND is_active = true
                     AND expiry_date > CURRENT_DATE AND quantity_available > 0
                   ORDER BY expiry_date ASC LOOP
      EXIT WHEN v_remaining <= 0;
      v_alloc_qty := LEAST(v_remaining, v_batch.quantity_available);
      v_unit_price := v_batch.selling_price;
      IF v_discount_type = 'percent' THEN
        v_line_disc := round(v_alloc_qty * v_unit_price * v_discount / 100, 2);
      ELSE
        v_line_disc := round(v_discount * v_alloc_qty::numeric / v_quantity, 2);
      END IF;
      IF v_line_disc > v_alloc_qty * v_unit_price THEN RAISE EXCEPTION 'Discount exceeds line total'; END IF;
      v_line_total := round(v_alloc_qty * v_unit_price - v_line_disc, 2);
      v_subtotal := v_subtotal + v_line_total;
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, discount, tax, subtotal)
      VALUES (v_sale_id, v_product_id, v_batch.id, v_alloc_qty, v_unit_price, v_line_disc, 0, v_line_total);
      v_remaining := v_remaining - v_alloc_qty;
    END LOOP;
    IF v_remaining > 0 THEN RAISE EXCEPTION 'Insufficient stock for product %: need %, available %', v_product_id, v_quantity, v_quantity - v_remaining; END IF;
  END LOOP;

  UPDATE sales SET subtotal = round(v_subtotal, 2), total = round(v_subtotal, 2) WHERE id = v_sale_id;

  INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, old_values, new_values, created_by)
  VALUES (v_org_id, 'SALE_SUBMITTED', 'sales', v_sale_id, NULL,
          jsonb_build_object('sale_number', v_sale_number, 'branch_id', p_branch_id, 'total', v_subtotal, 'operation_id', p_operation_id),
          v_profile_id);

  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number, 'status', 'AWAITING_PAYMENT',
                            'subtotal', v_subtotal, 'total', v_subtotal, 'duplicate', false);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_bill(uuid, uuid, jsonb, text, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) complete_bill_payment: cashier completes the original transaction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_bill_payment(
  p_sale_id uuid,
  p_payments jsonb,
  p_payment_operation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_profile_id uuid;
  v_workflow text;
  v_sale sales%ROWTYPE;
  v_payment_total numeric(14,2);
  v_total numeric(14,2);
  v_cash_session_id uuid;
  v_has_cash boolean := false;
  v_item jsonb;
  v_si record;
  v_purchase_price numeric;
BEGIN
  SELECT id, organization_id INTO v_profile_id, v_org_id
  FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT org_plan_allows_separate_checkout() THEN
    RAISE EXCEPTION 'Separate salesperson/cashier checkout is available on the Pharmacy and Enterprise plans only';
  END IF;
  v_workflow := COALESCE(current_pos_workflow(), 'single_person');
  IF v_workflow = 'single_person' THEN
    RAISE EXCEPTION 'Separate salesperson/cashier checkout is not enabled for this organization';
  END IF;
  IF NOT has_permission('cashier.process_payment') THEN
    RAISE EXCEPTION 'Forbidden: cashier.process_payment required';
  END IF;

  -- Lock the bill so two cashiers cannot process it concurrently.
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF v_sale.organization_id <> v_org_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_profile_id AND branch_id = v_sale.branch_id) THEN
    RAISE EXCEPTION 'Unauthorized branch';
  END IF;

  -- Idempotent replay of the same payment attempt.
  IF p_payment_operation_id IS NOT NULL
     AND v_sale.status = 'COMPLETED'
     AND v_sale.payment_operation_id = p_payment_operation_id THEN
    RETURN jsonb_build_object('sale_id', v_sale.id, 'sale_number', v_sale.sale_number, 'status', v_sale.status,
                              'subtotal', v_sale.subtotal, 'total', v_sale.total, 'duplicate', true);
  END IF;

  IF v_sale.status <> 'AWAITING_PAYMENT' THEN
    RAISE EXCEPTION 'Bill is not awaiting payment (status %)', v_sale.status;
  END IF;

  v_total := v_sale.total;
  SELECT COALESCE(sum((elem->>'amount')::numeric), 0) INTO v_payment_total FROM jsonb_array_elements(p_payments) elem;
  IF v_payment_total < v_total - 0.01 THEN
    RAISE EXCEPTION 'Payment total % is less than the bill total %', v_payment_total, v_total;
  END IF;

  -- Cash session validation (same rule as create_pos_sale).
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(p_payments) elem WHERE elem->>'method' = 'CASH') INTO v_has_cash;
  IF v_has_cash THEN
    SELECT id INTO v_cash_session_id FROM cash_sessions WHERE branch_id = v_sale.branch_id AND status = 'OPEN' LIMIT 1;
    IF v_cash_session_id IS NULL THEN RAISE EXCEPTION 'No open cash session for this branch - open a session first'; END IF;
  END IF;

  -- Re-validate and consume the pre-resolved bill lines atomically (FEFO batches
  -- chosen at submit time). Any RAISE rolls back the whole function.
  FOR v_si IN SELECT * FROM sale_items WHERE sale_id = p_sale_id ORDER BY id LOOP
    SELECT purchase_price INTO v_purchase_price
      FROM product_batches
     WHERE id = v_si.batch_id AND is_active = true AND expiry_date > CURRENT_DATE
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A bill item batch is no longer available or has expired — cancel and resubmit the bill';
    END IF;

    UPDATE product_batches SET quantity_available = quantity_available - v_si.quantity, updated_at = now()
      WHERE id = v_si.batch_id AND quantity_available >= v_si.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock to complete this bill — cancel and resubmit';
    END IF;

    INSERT INTO stock_movements (organization_id, branch_id, product_id, batch_id, movement_type, quantity,
                                 reference_type, reference_id, unit_cost, operation_id, created_by)
    VALUES (v_org_id, v_sale.branch_id, v_si.product_id, v_si.batch_id, 'SALE', -v_si.quantity, 'SALE', p_sale_id,
            v_purchase_price,
            CASE WHEN p_payment_operation_id IS NOT NULL THEN p_payment_operation_id || '-' || v_si.id::text ELSE NULL END,
            v_profile_id);
  END LOOP;

  -- Commit the transition. The conditional status guard is the final concurrency
  -- check (the row is already locked above).
  UPDATE sales
     SET status = 'COMPLETED',
         cashier_id = v_profile_id,
         payment_operation_id = p_payment_operation_id,
         paid_at = now(),
         handover_status = CASE WHEN v_workflow = 'three_stage' THEN 'PENDING' ELSE NULL END,
         updated_at = now()
   WHERE id = p_sale_id AND status = 'AWAITING_PAYMENT';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill was already processed by another cashier';
  END IF;

  -- Payments + cash movements (payment attributed to the authenticated cashier).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
    INSERT INTO payments (organization_id, branch_id, sale_id, payment_method, amount, reference, status, paid_at,
                          operation_id, provider, reconciliation_status, session_id, payer_reference)
    VALUES (v_org_id, v_sale.branch_id, p_sale_id, v_item->>'method', round((v_item->>'amount')::numeric, 2),
            v_item->>'reference', 'completed', now(),
            CASE WHEN p_payment_operation_id IS NOT NULL THEN p_payment_operation_id || '-' || (v_item->>'method') ELSE NULL END,
            v_item->>'provider', 'UNRECONCILED',
            CASE WHEN v_item->>'method' = 'CASH' THEN v_cash_session_id ELSE NULL END,
            v_item->>'reference');
    IF v_item->>'method' = 'CASH' THEN
      INSERT INTO cash_movements (organization_id, branch_id, session_id, type, amount, direction, reference_type, reference_id, created_by)
      VALUES (v_org_id, v_sale.branch_id, v_cash_session_id, 'SALE', round((v_item->>'amount')::numeric, 2), 'IN', 'SALE', p_sale_id, v_profile_id);
    END IF;
  END LOOP;

  INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, old_values, new_values, created_by)
  VALUES (v_org_id, 'SALE_COMPLETED', 'sales', p_sale_id, NULL,
          jsonb_build_object('sale_number', v_sale.sale_number, 'total', v_total, 'salesperson_id', v_sale.salesperson_id,
                             'cashier_id', v_profile_id, 'payment_operation_id', p_payment_operation_id),
          v_profile_id);

  RETURN jsonb_build_object('sale_id', p_sale_id, 'sale_number', v_sale.sale_number, 'status', 'COMPLETED',
                            'subtotal', v_sale.subtotal, 'total', v_total, 'duplicate', false);
END;
$$;
GRANT EXECUTE ON FUNCTION complete_bill_payment(uuid, jsonb, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) cancel_bill: cancel an unpaid bill (no stock was reserved)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_bill(
  p_sale_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_profile_id uuid;
  v_sale sales%ROWTYPE;
BEGIN
  SELECT id, organization_id INTO v_profile_id, v_org_id
  FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT org_plan_allows_separate_checkout() THEN
    RAISE EXCEPTION 'Separate salesperson/cashier checkout is available on the Pharmacy and Enterprise plans only';
  END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF v_sale.organization_id <> v_org_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_profile_id AND branch_id = v_sale.branch_id) THEN
    RAISE EXCEPTION 'Unauthorized branch';
  END IF;

  -- A void-capable user, or the salesperson who submitted the bill, may cancel it.
  IF NOT (has_permission('sales.void') OR (has_permission('sales.submit_bill') AND v_sale.salesperson_id = v_profile_id)) THEN
    RAISE EXCEPTION 'Forbidden: sales.void required';
  END IF;

  IF v_sale.status <> 'AWAITING_PAYMENT' THEN
    RAISE EXCEPTION 'Only bills awaiting payment can be cancelled (status %)', v_sale.status;
  END IF;

  UPDATE sales
     SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_profile_id,
         cancel_reason = p_reason, updated_at = now()
   WHERE id = p_sale_id AND status = 'AWAITING_PAYMENT';
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill was already processed'; END IF;

  INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, old_values, new_values, created_by)
  VALUES (v_org_id, 'SALE_CANCELLED', 'sales', p_sale_id,
          jsonb_build_object('status', 'AWAITING_PAYMENT'),
          jsonb_build_object('status', 'CANCELLED', 'reason', p_reason, 'sale_number', v_sale.sale_number),
          v_profile_id);

  RETURN jsonb_build_object('sale_id', p_sale_id, 'sale_number', v_sale.sale_number, 'status', 'CANCELLED');
END;
$$;
GRANT EXECUTE ON FUNCTION cancel_bill(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6b) confirm_handover: three-stage dispensing confirmation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirm_handover(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_profile_id uuid;
  v_sale sales%ROWTYPE;
BEGIN
  SELECT id, organization_id INTO v_profile_id, v_org_id
  FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT org_plan_allows_separate_checkout() THEN
    RAISE EXCEPTION 'Separate salesperson/cashier checkout is available on the Pharmacy and Enterprise plans only';
  END IF;
  IF COALESCE(current_pos_workflow(), 'single_person') <> 'three_stage' THEN
    RAISE EXCEPTION 'Three-stage handover is not enabled';
  END IF;
  IF NOT has_permission('sales.handover') THEN
    RAISE EXCEPTION 'Forbidden: sales.handover required';
  END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.organization_id <> v_org_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_profile_id AND branch_id = v_sale.branch_id) THEN
    RAISE EXCEPTION 'Unauthorized branch';
  END IF;
  IF v_sale.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Handover requires a completed (paid) sale';
  END IF;

  IF v_sale.handover_status = 'CONFIRMED' THEN
    RETURN jsonb_build_object('sale_id', p_sale_id, 'sale_number', v_sale.sale_number, 'handover_status', 'CONFIRMED', 'duplicate', true);
  END IF;

  UPDATE sales SET handover_status = 'CONFIRMED', handover_at = now(), handover_by = v_profile_id, updated_at = now()
   WHERE id = p_sale_id AND handover_status IS DISTINCT FROM 'CONFIRMED';
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover already recorded'; END IF;

  INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, old_values, new_values, created_by)
  VALUES (v_org_id, 'SALE_HANDOVER_CONFIRMED', 'sales', p_sale_id, NULL,
          jsonb_build_object('sale_number', v_sale.sale_number), v_profile_id);

  RETURN jsonb_build_object('sale_id', p_sale_id, 'sale_number', v_sale.sale_number, 'handover_status', 'CONFIRMED');
END;
$$;
GRANT EXECUTE ON FUNCTION confirm_handover(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Permissions + role assignments (extend existing RBAC, no parallel system)
-- ---------------------------------------------------------------------------
INSERT INTO permissions (code, name, description) VALUES
  ('sales.submit_bill', 'Submit Bills', 'Prepare and submit a bill to the cashier (salesperson)'),
  ('cashier.process_payment', 'Process Bill Payment', 'Collect and record payment for a pending bill (cashier)'),
  ('sales.handover', 'Confirm Handover', 'Confirm medicine handover in the three-stage workflow')
ON CONFLICT (code) DO NOTHING;

-- Owner / Administrator: full checkout control.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('Owner', 'Administrator')
  AND p.code IN ('sales.submit_bill', 'cashier.process_payment', 'sales.handover')
ON CONFLICT DO NOTHING;

-- Branch Manager: full checkout control.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Branch Manager'
  AND p.code IN ('sales.submit_bill', 'cashier.process_payment', 'sales.handover')
ON CONFLICT DO NOTHING;

-- Pharmacist: prepare, collect payment, and dispense.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Pharmacist'
  AND p.code IN ('sales.submit_bill', 'cashier.process_payment', 'sales.handover')
ON CONFLICT DO NOTHING;

-- Pharmacy Technician: prepare and collect payment.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Pharmacy Technician'
  AND p.code IN ('sales.submit_bill', 'cashier.process_payment')
ON CONFLICT DO NOTHING;

-- Cashier: collect payment and (where needed) prepare bills.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Cashier'
  AND p.code IN ('sales.submit_bill', 'cashier.process_payment')
ON CONFLICT DO NOTHING;

COMMENT ON FUNCTION submit_bill(uuid, uuid, jsonb, text, timestamptz) IS 'Salesperson submits a pending bill (AWAITING_PAYMENT); no stock decrement';
COMMENT ON FUNCTION complete_bill_payment(uuid, jsonb, text) IS 'Cashier completes a pending bill atomically: revalidates stock, records payment, completes the original sale';
COMMENT ON FUNCTION cancel_bill(uuid, text) IS 'Cancel a pending bill that has not been paid (nothing to release)';
COMMENT ON FUNCTION confirm_handover(uuid) IS 'Three-stage workflow: authorised staff confirm medicine handover';
COMMENT ON FUNCTION current_pos_workflow() IS 'Current organization checkout workflow (default single_person)';
COMMENT ON FUNCTION org_plan_allows_separate_checkout() IS 'Whether the org plan (pro/enterprise) permits separate checkout';
