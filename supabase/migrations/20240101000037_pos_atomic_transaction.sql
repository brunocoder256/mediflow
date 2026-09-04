-- Migration: 00037_pos_atomic_transaction.sql
-- True PostgreSQL transaction atomicity for POS sales (FEFO, idempotency, audit)
-- Also: discount permission helper

-- Helper: does current user have permission code?
CREATE OR REPLACE FUNCTION has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    JOIN profiles pr ON pr.id = ur.user_id
    WHERE pr.auth_user_id = auth.uid()
      AND p.code = p_code
      AND pr.organization_id = r.organization_id
  );
$$;

-- Helper: max discount percent allowed for current user
-- Owner/Admin unlimited, Manager 20%, Cashier 5%, others 0
CREATE OR REPLACE FUNCTION max_discount_percent()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_max numeric := 0;
  v_role text;
BEGIN
  SELECT r.name INTO v_role
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  JOIN profiles pr ON pr.id = ur.user_id
  WHERE pr.auth_user_id = auth.uid()
  ORDER BY CASE r.name WHEN 'Owner' THEN 1 WHEN 'Administrator' THEN 2 WHEN 'Manager' THEN 3 WHEN 'Cashier' THEN 4 ELSE 5 END
  LIMIT 1;

  IF v_role IN ('Owner','Administrator') THEN RETURN 100; END IF;
  IF has_permission('pos.discount.unlimited') THEN RETURN 100; END IF;
  IF has_permission('pos.discount.20') OR v_role='Manager' THEN RETURN 20; END IF;
  IF has_permission('pos.discount.5') OR v_role='Cashier' THEN RETURN 5; END IF;
  IF has_permission('pos.discount') THEN RETURN 5; END IF;
  RETURN 0;
END;
$$;

-- Atomic POS sale creation
-- p_items: jsonb array of {product_id uuid, quantity int, discount numeric, discount_type text}
-- p_payments: jsonb array of {method text, amount numeric, reference text, provider text}
CREATE OR REPLACE FUNCTION create_pos_sale(
  p_branch_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_operation_id text,
  p_held boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_profile_id uuid;
  v_sale_id uuid;
  v_sale_number text;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_payment_total numeric(14,2) := 0;
  v_cash_session_id uuid;
  v_has_cash boolean := false;
  v_existing_id uuid;
  v_existing_number text;
  v_existing_status text;
  v_item jsonb;
  v_product_id uuid;
  v_quantity int;
  v_discount numeric;
  v_discount_type text;
  v_unit_price numeric;
  v_purchase_price numeric;
  v_line_disc numeric;
  v_line_total numeric;
  v_remaining int;
  v_batch record;
  v_alloc_qty int;
  v_is_active boolean;
  v_allowed boolean;
  v_max_disc numeric;
BEGIN
  -- Resolve profile/org
  SELECT id, organization_id INTO v_profile_id, v_org_id
  FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Branch authorization
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_profile_id AND branch_id = p_branch_id) INTO v_allowed;
  IF NOT v_allowed THEN
    -- also allow if user has org-wide branch null? fallback to get_user_branch_ids check
    PERFORM 1 FROM user_roles WHERE user_id = v_profile_id AND branch_id = p_branch_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized branch'; END IF;
  END IF;

  -- Idempotency
  IF p_operation_id IS NOT NULL THEN
    SELECT id, sale_number, status INTO v_existing_id, v_existing_number, v_existing_status
    FROM sales WHERE operation_id = p_operation_id LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('sale_id', v_existing_id, 'sale_number', v_existing_number, 'status', v_existing_status, 'duplicate', true);
    END IF;
  END IF;

  -- Held sale: simpler (no stock decrement)
  IF p_held THEN
    -- Validate discounts against permission even for held
    v_max_disc := max_discount_percent();
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_discount := COALESCE((v_item->>'discount')::numeric, 0);
      v_discount_type := COALESCE(v_item->>'discount_type', 'fixed');
      IF v_discount > 0 AND v_max_disc = 0 THEN RAISE EXCEPTION 'Discount not permitted for your role (max 0%%)'; END IF;
      IF v_discount_type = 'percent' AND v_discount > v_max_disc THEN RAISE EXCEPTION 'Discount %% exceeds your limit (max %%)', v_max_disc; END IF;
    END LOOP;

    INSERT INTO sales (organization_id, branch_id, sale_number, status, subtotal, discount, tax, total, customer_id, cashier_id, operation_id, sold_at)
    VALUES (v_org_id, p_branch_id, 'HLD-' || upper(substring(gen_random_uuid()::text,1,8)), 'HELD', 0, 0, 0, 0, p_customer_id, v_profile_id, p_operation_id, now())
    RETURNING id, sale_number INTO v_sale_id, v_sale_number;

    -- For held, still resolve FEFO prices for sale_items (no stock change)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::int;
      v_discount := COALESCE((v_item->>'discount')::numeric, 0);
      v_discount_type := COALESCE(v_item->>'discount_type','fixed');
      SELECT is_active INTO v_is_active FROM products WHERE id = v_product_id;
      IF v_is_active = false OR v_is_active IS NULL THEN RAISE EXCEPTION 'Product inactive or not found: %', v_product_id; END IF;

      v_remaining := v_quantity;
      FOR v_batch IN SELECT id, selling_price, purchase_price, quantity_available FROM product_batches
                     WHERE product_id = v_product_id AND branch_id = p_branch_id AND is_active = true
                       AND expiry_date > CURRENT_DATE AND quantity_available > 0
                     ORDER BY expiry_date ASC FOR UPDATE LOOP
        EXIT WHEN v_remaining <= 0;
        v_alloc_qty := LEAST(v_remaining, v_batch.quantity_available);
        v_unit_price := v_batch.selling_price;
        v_purchase_price := v_batch.purchase_price;
        IF v_discount_type = 'percent' THEN
          v_line_disc := round(v_alloc_qty * v_unit_price * v_discount / 100, 2);
        ELSE
          -- fixed discount proportionally split
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

    -- Update held totals
    UPDATE sales SET subtotal = round(v_subtotal,2), total = round(v_subtotal,2) WHERE id = v_sale_id;
    INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, old_values, new_values, created_by)
    VALUES (v_org_id, 'SALE_HELD', 'sales', v_sale_id, NULL, jsonb_build_object('sale_number', v_sale_number, 'branch_id', p_branch_id), v_profile_id);
    RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number, 'status', 'HELD', 'subtotal', v_subtotal, 'total', v_subtotal, 'duplicate', false);
  END IF;

  -- Regular sale: lock and decrement batches atomically within transaction
  v_max_disc := max_discount_percent();

  -- First pass: validate all items and compute subtotal (also lock batches)
  -- We will allocate and decrement per batch in same loop
  -- Payment total
  SELECT COALESCE(sum((elem->>'amount')::numeric),0) INTO v_payment_total FROM jsonb_array_elements(p_payments) elem;
  v_subtotal := 0;

  -- Create sale placeholder to get id; will update totals after
  INSERT INTO sales (organization_id, branch_id, sale_number, status, subtotal, discount, tax, total, customer_id, cashier_id, operation_id, sold_at)
  VALUES (v_org_id, p_branch_id, 'TMP', 'COMPLETED', 0, 0, 0, 0, p_customer_id, v_profile_id, p_operation_id, now())
  RETURNING id, sale_number INTO v_sale_id, v_sale_number;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;
    v_discount := COALESCE((v_item->>'discount')::numeric, 0);
    v_discount_type := COALESCE(v_item->>'discount_type','fixed');
    IF v_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be >0'; END IF;
    IF v_discount < 0 THEN RAISE EXCEPTION 'Discount cannot be negative'; END IF;
    IF v_discount > 0 AND v_max_disc = 0 THEN RAISE EXCEPTION 'Discount not permitted for your role (max 0%%)'; END IF;
    IF v_discount_type = 'percent' AND v_discount > v_max_disc THEN RAISE EXCEPTION 'Discount %% exceeds your limit (max %%)', v_max_disc; END IF;
    IF v_discount_type = 'percent' AND v_discount > 100 THEN RAISE EXCEPTION 'Discount percent >100'; END IF;

    SELECT is_active INTO v_is_active FROM products WHERE id = v_product_id;
    IF v_is_active = false OR v_is_active IS NULL THEN RAISE EXCEPTION 'Product inactive or not found: %', v_product_id; END IF;

    v_remaining := v_quantity;
    FOR v_batch IN SELECT id, selling_price, purchase_price, quantity_available FROM product_batches
                   WHERE product_id = v_product_id AND branch_id = p_branch_id AND is_active = true
                     AND expiry_date > CURRENT_DATE AND quantity_available > 0
                   ORDER BY expiry_date ASC FOR UPDATE LOOP
      EXIT WHEN v_remaining <= 0;
      v_alloc_qty := LEAST(v_remaining, v_batch.quantity_available);
      v_unit_price := v_batch.selling_price;
      v_purchase_price := v_batch.purchase_price;

      IF v_discount_type = 'percent' THEN
        v_line_disc := round(v_alloc_qty * v_unit_price * v_discount / 100, 2);
      ELSE
        v_line_disc := round(v_discount * v_alloc_qty::numeric / v_quantity, 2);
      END IF;
      IF v_line_disc > v_alloc_qty * v_unit_price THEN RAISE EXCEPTION 'Discount exceeds line total'; END IF;
      v_line_total := round(v_alloc_qty * v_unit_price - v_line_disc, 2);

      -- Decrement batch (FOR UPDATE ensures atomic)
      UPDATE product_batches SET quantity_available = quantity_available - v_alloc_qty, updated_at = now()
      WHERE id = v_batch.id AND quantity_available >= v_alloc_qty;
      IF NOT FOUND THEN RAISE EXCEPTION 'Concurrent stock conflict for batch %', v_batch.id; END IF;

      -- Insert sale item
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, discount, tax, subtotal)
      VALUES (v_sale_id, v_product_id, v_batch.id, v_alloc_qty, v_unit_price, v_line_disc, 0, v_line_total);

      -- Stock movement
      INSERT INTO stock_movements (organization_id, branch_id, product_id, batch_id, movement_type, quantity, reference_type, reference_id, unit_cost, operation_id, created_by)
      VALUES (v_org_id, p_branch_id, v_product_id, v_batch.id, 'SALE', -v_alloc_qty, 'SALE', v_sale_id, v_purchase_price, CASE WHEN p_operation_id IS NOT NULL THEN p_operation_id || '-' || v_batch.id::text ELSE NULL END, v_profile_id);

      v_subtotal := v_subtotal + v_line_total;
      v_remaining := v_remaining - v_alloc_qty;
    END LOOP;
    IF v_remaining > 0 THEN RAISE EXCEPTION 'Insufficient stock for product %: need %, available %', v_product_id, v_quantity, v_quantity - v_remaining; END IF;
  END LOOP;

  v_total := round(v_subtotal,2);
  IF v_payment_total < v_total - 0.01 THEN RAISE EXCEPTION 'Payment total % < sale total %', v_payment_total, v_total; END IF;

  -- Cash session validation
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(p_payments) elem WHERE elem->>'method' = 'CASH') INTO v_has_cash;
  IF v_has_cash THEN
    SELECT id INTO v_cash_session_id FROM cash_sessions WHERE branch_id = p_branch_id AND status = 'OPEN' LIMIT 1;
    IF v_cash_session_id IS NULL THEN RAISE EXCEPTION 'No open cash session for this branch - open a session first'; END IF;
  END IF;

  -- Update sale totals
  UPDATE sales SET subtotal = v_subtotal, total = v_total WHERE id = v_sale_id;

  -- Payments + cash movements
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
    INSERT INTO payments (organization_id, branch_id, sale_id, payment_method, amount, reference, status, paid_at, operation_id, provider, reconciliation_status, session_id, payer_reference)
    VALUES (v_org_id, p_branch_id, v_sale_id, v_item->>'method', round((v_item->>'amount')::numeric,2), v_item->>'reference', 'completed', now(),
            CASE WHEN p_operation_id IS NOT NULL THEN p_operation_id || '-' || (v_item->>'method') ELSE NULL END,
            v_item->>'provider', 'UNRECONCILED',
            CASE WHEN v_item->>'method' = 'CASH' THEN v_cash_session_id ELSE NULL END,
            v_item->>'reference');
    IF v_item->>'method' = 'CASH' THEN
      INSERT INTO cash_movements (organization_id, branch_id, session_id, type, amount, direction, reference_type, reference_id, created_by)
      VALUES (v_org_id, p_branch_id, v_cash_session_id, 'SALE', round((v_item->>'amount')::numeric,2), 'IN', 'SALE', v_sale_id, v_profile_id);
    END IF;
  END LOOP;

  INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, old_values, new_values, created_by)
  VALUES (v_org_id, 'SALE_COMPLETED', 'sales', v_sale_id, NULL, jsonb_build_object('sale_number', v_sale_number, 'total', v_total, 'operation_id', p_operation_id), v_profile_id);

  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number, 'status', 'COMPLETED', 'subtotal', v_subtotal, 'total', v_total, 'duplicate', false);
EXCEPTION WHEN OTHERS THEN
  -- Transaction will rollback automatically; re-raise
  RAISE;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION create_pos_sale(uuid, uuid, jsonb, jsonb, text, boolean) TO authenticated;

-- Permissions for discount
INSERT INTO permissions (code, name, description) VALUES
  ('pos.discount', 'POS Discount', 'Apply any discount (legacy, max 5%)'),
  ('pos.discount.5', 'POS Discount 5%', 'Discount up to 5%'),
  ('pos.discount.20', 'POS Discount 20%', 'Discount up to 20%'),
  ('pos.discount.unlimited', 'POS Unlimited Discount', 'Discount up to 100%')
ON CONFLICT (code) DO NOTHING;

-- Assign to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='Owner' AND p.code='pos.discount.unlimited' ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='Administrator' AND p.code='pos.discount.unlimited' ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='Manager' AND p.code='pos.discount.20' ON CONFLICT DO NOTHING;
-- Cashier gets 5% (allow small discount)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='Cashier' AND p.code='pos.discount.5' ON CONFLICT DO NOTHING;

COMMENT ON FUNCTION create_pos_sale IS 'Atomic POS transaction: FEFO, expiry, branch auth, discount permission, idempotency';
COMMENT ON FUNCTION has_permission IS 'Check current user permission';
COMMENT ON FUNCTION max_discount_percent IS 'Max discount for current role';
