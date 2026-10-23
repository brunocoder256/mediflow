-- Migration: harden the expired/damaged stock disposal workflow
--
-- The original disposal implementation updated product_batches, stock_movements
-- and disposals as separate client requests. That allowed over-disposal
-- (quantity clamped to zero), disposals without a batch (stock never reduced),
-- re-approving a completed disposal and a second disposal pass that decremented
-- stock twice. It also never enforced the seeded `stock.dispose` permission.
--
-- This migration makes disposal writes authoritative and atomic:
--   * create_disposal        PENDING   (validates batch, branch, quantity)
--   * approve_disposal       APPROVED  (permission + status guard)
--   * dispose_stock          DISPOSED  (locks batch, decrements once, movement,
--                                        audit; idempotent when replayed)
--
-- Direct INSERT/UPDATE/DELETE on `disposals` is revoked so every client must go
-- through these RPCs. Reads stay RLS-scoped by organization + branch.

-- 1) Idempotency key for offline/retried creations ------------------------------------------
ALTER TABLE disposals ADD COLUMN IF NOT EXISTS operation_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_disposals_org_operation
  ON disposals(organization_id, operation_id)
  WHERE operation_id IS NOT NULL;

-- 2) Create (PENDING) ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_disposal(
  p_branch_id uuid,
  p_type text,
  p_product_id uuid,
  p_batch_id uuid,
  p_quantity integer,
  p_unit_cost numeric,
  p_reason text,
  p_condition text,
  p_operation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_org uuid;
  v_batch record;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_existing disposals%ROWTYPE;
  v_row disposals%ROWTYPE;
BEGIN
  SELECT p.id, p.organization_id INTO v_profile_id, v_org_id
  FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.auth_user_id = auth.uid()
    AND p.is_active = true
    AND COALESCE(p.status, 'active') NOT IN ('inactive', 'suspended', 'locked')
    AND o.status = 'active'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT has_permission_in_org('stock.dispose', v_org_id) THEN
    RAISE EXCEPTION 'Forbidden: missing permission stock.dispose';
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required';
  END IF;
  IF NOT COALESCE(user_has_branch_access(p_branch_id), false) THEN
    RAISE EXCEPTION 'Unauthorized branch access';
  END IF;

  SELECT organization_id INTO v_branch_org
  FROM branches
  WHERE id = p_branch_id AND is_active = true;

  IF v_branch_org IS NULL OR v_branch_org IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'Invalid or inactive branch';
  END IF;

  IF p_type NOT IN ('EXPIRED', 'DAMAGED', 'OTHER') THEN
    RAISE EXCEPTION 'Invalid disposal type';
  END IF;
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product_id is required';
  END IF;
  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'A batch is required to dispose stock';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;
  IF p_operation_id IS NULL OR btrim(p_operation_id) = '' THEN
    RAISE EXCEPTION 'operation_id is required';
  END IF;
  IF length(p_operation_id) > 100 THEN
    RAISE EXCEPTION 'operation_id is too long';
  END IF;

  -- Idempotency is checked after authorization so a known operation id cannot
  -- be used to read another organization's disposal.
  SELECT * INTO v_existing
  FROM disposals
  WHERE organization_id = v_org_id AND operation_id = p_operation_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.batch_id IS DISTINCT FROM p_batch_id THEN
      RAISE EXCEPTION 'This operation_id was already used for a different batch';
    END IF;
    RETURN to_jsonb(v_existing) || jsonb_build_object('duplicate', true);
  END IF;

  SELECT id, organization_id, branch_id, product_id, quantity_available
    INTO v_batch
  FROM product_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;
  IF v_batch.organization_id IS DISTINCT FROM v_org_id
     OR v_batch.branch_id IS DISTINCT FROM p_branch_id
     OR v_batch.product_id IS DISTINCT FROM p_product_id THEN
    RAISE EXCEPTION 'Batch does not belong to the selected product and branch';
  END IF;
  IF p_quantity > v_batch.quantity_available THEN
    RAISE EXCEPTION 'Quantity exceeds available batch stock (% available)', v_batch.quantity_available;
  END IF;

  INSERT INTO disposals (
    organization_id, branch_id, type, status, product_id, batch_id,
    quantity, unit_cost, reason, condition, reported_by, operation_id
  ) VALUES (
    v_org_id, p_branch_id, p_type, 'PENDING', p_product_id, p_batch_id,
    p_quantity, p_unit_cost,
    COALESCE(v_reason, CASE p_type WHEN 'EXPIRED' THEN 'Expired stock' WHEN 'DAMAGED' THEN 'Damaged stock' ELSE 'Disposal' END),
    NULLIF(btrim(COALESCE(p_condition, '')), ''),
    v_profile_id, btrim(p_operation_id)
  )
  RETURNING * INTO v_row;

  INSERT INTO audit_logs (organization_id, branch_id, user_id, created_by, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_org_id, p_branch_id, v_profile_id, v_profile_id, 'DISPOSAL_CREATED', 'disposals', v_row.id, NULL, to_jsonb(v_row));

  RETURN to_jsonb(v_row);
END;
$$;

-- 3) Approve (PENDING -> APPROVED) ---------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_disposal(p_disposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_disp disposals%ROWTYPE;
  v_row disposals%ROWTYPE;
BEGIN
  SELECT p.id, p.organization_id INTO v_profile_id, v_org_id
  FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.auth_user_id = auth.uid()
    AND p.is_active = true
    AND COALESCE(p.status, 'active') NOT IN ('inactive', 'suspended', 'locked')
    AND o.status = 'active'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_disp
  FROM disposals
  WHERE id = p_disposal_id AND organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disposal not found';
  END IF;
  IF NOT COALESCE(user_has_branch_access(v_disp.branch_id), false) THEN
    RAISE EXCEPTION 'Unauthorized branch access';
  END IF;
  IF NOT has_permission_in_org('stock.dispose', v_org_id) THEN
    RAISE EXCEPTION 'Forbidden: missing permission stock.dispose';
  END IF;

  IF v_disp.status = 'APPROVED' THEN
    RETURN to_jsonb(v_disp) || jsonb_build_object('duplicate', true);
  END IF;
  IF v_disp.status = 'DISPOSED' THEN
    RAISE EXCEPTION 'Disposal has already been completed';
  END IF;
  IF v_disp.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Disposal has been cancelled';
  END IF;

  UPDATE disposals
  SET status = 'APPROVED', approved_by = v_profile_id, approved_at = now()
  WHERE id = p_disposal_id
  RETURNING * INTO v_row;

  INSERT INTO audit_logs (organization_id, branch_id, user_id, created_by, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_org_id, v_row.branch_id, v_profile_id, v_profile_id, 'DISPOSAL_APPROVED', 'disposals', v_row.id, to_jsonb(v_disp), to_jsonb(v_row));

  RETURN to_jsonb(v_row);
END;
$$;

-- 4) Dispose (APPROVED -> DISPOSED) --------------------------------------------------------
CREATE OR REPLACE FUNCTION dispose_stock(p_disposal_id uuid, p_method text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_disp disposals%ROWTYPE;
  v_batch record;
  v_row disposals%ROWTYPE;
  v_movement_type text;
  v_method text := NULLIF(btrim(COALESCE(p_method, '')), '');
BEGIN
  SELECT p.id, p.organization_id INTO v_profile_id, v_org_id
  FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.auth_user_id = auth.uid()
    AND p.is_active = true
    AND COALESCE(p.status, 'active') NOT IN ('inactive', 'suspended', 'locked')
    AND o.status = 'active'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_disp
  FROM disposals
  WHERE id = p_disposal_id AND organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disposal not found';
  END IF;
  IF NOT COALESCE(user_has_branch_access(v_disp.branch_id), false) THEN
    RAISE EXCEPTION 'Unauthorized branch access';
  END IF;
  IF NOT has_permission_in_org('stock.dispose', v_org_id) THEN
    RAISE EXCEPTION 'Forbidden: missing permission stock.dispose';
  END IF;

  -- Replayed offline/network retry: never decrement the batch twice.
  IF v_disp.status = 'DISPOSED' THEN
    RETURN to_jsonb(v_disp) || jsonb_build_object('duplicate', true);
  END IF;
  IF v_disp.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Disposal has been cancelled';
  END IF;
  IF v_disp.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Must be approved before disposal';
  END IF;
  IF v_disp.batch_id IS NULL THEN
    RAISE EXCEPTION 'Disposal has no batch and cannot reduce stock';
  END IF;

  SELECT id, organization_id, branch_id, product_id, quantity_available
    INTO v_batch
  FROM product_batches
  WHERE id = v_disp.batch_id
  FOR UPDATE;

  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;
  IF v_batch.organization_id IS DISTINCT FROM v_org_id
     OR v_batch.branch_id IS DISTINCT FROM v_disp.branch_id
     OR v_batch.product_id IS DISTINCT FROM v_disp.product_id THEN
    RAISE EXCEPTION 'Batch does not match the disposal record';
  END IF;
  IF v_disp.quantity > v_batch.quantity_available THEN
    RAISE EXCEPTION 'Quantity exceeds available batch stock (% available)', v_batch.quantity_available;
  END IF;

  UPDATE product_batches
  SET quantity_available = quantity_available - v_disp.quantity
  WHERE id = v_disp.batch_id;

  v_movement_type := CASE WHEN v_disp.type = 'EXPIRED' THEN 'EXPIRED' ELSE 'DAMAGED' END;

  INSERT INTO stock_movements (
    organization_id, branch_id, product_id, batch_id, movement_type,
    quantity, reference_type, reference_id, unit_cost, notes, created_by
  ) VALUES (
    v_org_id, v_disp.branch_id, v_disp.product_id, v_disp.batch_id, v_movement_type,
    -v_disp.quantity, 'DISPOSAL', v_disp.id, v_disp.unit_cost,
    'Disposal ' || v_disp.type || COALESCE(' ' || v_method, ''), v_profile_id
  );

  UPDATE disposals
  SET status = 'DISPOSED', disposed_at = now(), disposal_method = v_method
  WHERE id = v_disp.id
  RETURNING * INTO v_row;

  INSERT INTO audit_logs (organization_id, branch_id, user_id, created_by, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_org_id, v_row.branch_id, v_profile_id, v_profile_id, 'DISPOSAL_COMPLETED', 'disposals', v_row.id, to_jsonb(v_disp), to_jsonb(v_row));

  RETURN to_jsonb(v_row);
END;
$$;

-- 5) Writes only through the authoritative RPCs ---------------------------------------------
DROP POLICY IF EXISTS disposals_org_branch ON disposals;
DROP POLICY IF EXISTS disposals_select ON disposals;
CREATE POLICY disposals_select ON disposals
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND branch_id IN (SELECT get_user_branch_ids())
  );

REVOKE INSERT, UPDATE, DELETE ON disposals FROM public, anon, authenticated;
GRANT SELECT ON disposals TO authenticated;

REVOKE ALL ON FUNCTION create_disposal(uuid, text, uuid, uuid, integer, numeric, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION approve_disposal(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION dispose_stock(uuid, text) FROM public, anon;

GRANT EXECUTE ON FUNCTION create_disposal(uuid, text, uuid, uuid, integer, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_disposal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION dispose_stock(uuid, text) TO authenticated;

COMMENT ON FUNCTION create_disposal IS 'Create a PENDING disposal; validates batch, branch, quantity and stock.dispose permission';
COMMENT ON FUNCTION approve_disposal IS 'Approve a pending disposal with stock.dispose permission and status guards';
COMMENT ON FUNCTION dispose_stock IS 'Atomically reduce batch stock, write EXPIRED/DAMAGED movement + audit and mark DISPOSED (idempotent)';
