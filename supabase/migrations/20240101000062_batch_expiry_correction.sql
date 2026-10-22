-- Migration: secure batch expiry-date correction
--
-- Expiry dates are batch-level inventory data, not editable product master
-- fields. This migration adds a dedicated permission, an append-only correction
-- history, a guard that prevents direct expiry edits, and an atomic RPC that
-- performs authorization, validation, audit and update in one transaction.

-- 1) Dedicated permission -----------------------------------------------------------------
INSERT INTO permissions (code, name, description) VALUES
  ('inventory.batch_expiry.correct', 'Correct Batch Expiry Date', 'Correct a batch expiry date with a mandatory reason and audit trail')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description;

-- Grant to inventory/management roles only. Cashiers and sales-only users are
-- deliberately excluded. Follows the existing role-name seeding convention.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'inventory.batch_expiry.correct'
WHERE r.name IN ('Owner', 'Administrator', 'Manager', 'Branch Manager', 'Inventory Manager', 'Pharmacist', 'Stock Manager')
ON CONFLICT DO NOTHING;

-- Organization-scoped permission check. The existing has_permission() resolves
-- roles globally; scoping the role's organization prevents a role held in one
-- organization from authorizing an action in another.
CREATE OR REPLACE FUNCTION has_permission_in_org(p_code text, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM profiles pr
      WHERE pr.auth_user_id = auth.uid()
        AND pr.organization_id = p_org_id
        AND pr.is_active = true
        AND COALESCE(pr.status, 'active') NOT IN ('inactive', 'suspended', 'locked')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user_permission_overrides upo
      JOIN permissions p ON p.id = upo.permission_id
      JOIN profiles pr ON pr.id = upo.user_id
      WHERE pr.auth_user_id = auth.uid()
        AND pr.organization_id = p_org_id
        AND p.code = p_code
        AND upo.effect = 'deny'
    )
    AND (
      EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        JOIN profiles pr ON pr.id = ur.user_id
        WHERE pr.auth_user_id = auth.uid()
          AND pr.organization_id = p_org_id
          AND r.organization_id = p_org_id
          AND p.code = p_code
      )
      OR EXISTS (
        SELECT 1
        FROM user_permission_overrides upo
        JOIN permissions p ON p.id = upo.permission_id
        JOIN profiles pr ON pr.id = upo.user_id
        WHERE pr.auth_user_id = auth.uid()
          AND pr.organization_id = p_org_id
          AND p.code = p_code
          AND upo.effect = 'grant'
      )
    );
$$;

REVOKE ALL ON FUNCTION has_permission_in_org(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION has_permission_in_org(text, uuid) TO authenticated;

-- 2) Append-only correction history --------------------------------------------------------
CREATE TABLE IF NOT EXISTS batch_expiry_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES product_batches(id) ON DELETE SET NULL,
  product_id uuid,
  old_expiry_date date,
  new_expiry_date date,
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('APPLIED', 'REJECTED', 'FAILED')),
  error_code text,
  error_message text,
  high_impact boolean NOT NULL DEFAULT false,
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  applied_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  applied_at timestamptz,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: an operation can only produce one *applied* correction per
-- organization. Rejected attempts may share an operation id so a corrected
-- request can be retried. Scoping by organization prevents cross-tenant
-- operation-id collisions from blocking a legitimate correction.
DROP INDEX IF EXISTS uq_batch_expiry_corrections_applied_operation;
CREATE UNIQUE INDEX uq_batch_expiry_corrections_applied_operation
  ON batch_expiry_corrections(organization_id, operation_id)
  WHERE status = 'APPLIED';

CREATE INDEX IF NOT EXISTS idx_batch_expiry_corrections_org
  ON batch_expiry_corrections(organization_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_expiry_corrections_branch
  ON batch_expiry_corrections(branch_id);
CREATE INDEX IF NOT EXISTS idx_batch_expiry_corrections_batch
  ON batch_expiry_corrections(batch_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_expiry_corrections_product
  ON batch_expiry_corrections(product_id);

ALTER TABLE batch_expiry_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batch_expiry_corrections_select ON batch_expiry_corrections;
CREATE POLICY batch_expiry_corrections_select ON batch_expiry_corrections
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      branch_id IS NULL
      OR COALESCE(user_has_branch_access(branch_id), false)
    )
    AND (
      has_permission_in_org('inventory.batch_expiry.correct', organization_id)
      OR has_permission_in_org('audit.view', organization_id)
    )
  );

-- History is written only by the SECURITY DEFINER RPC. Ordinary application
-- roles cannot insert, edit or delete correction records.
REVOKE INSERT, UPDATE, DELETE ON batch_expiry_corrections FROM public, anon, authenticated;
GRANT SELECT ON batch_expiry_corrections TO authenticated;

-- 3) Guard: expiry can only change through the correction workflow ----------------
CREATE OR REPLACE FUNCTION guard_batch_expiry_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.expiry_date IS DISTINCT FROM OLD.expiry_date
     AND COALESCE(current_setting('mediflow.batch_expiry_correction', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Batch expiry dates can only be changed through the authorised correction workflow'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_batch_expiry_update ON product_batches;
CREATE TRIGGER trg_guard_batch_expiry_update
  BEFORE UPDATE OF expiry_date ON product_batches
  FOR EACH ROW EXECUTE FUNCTION guard_batch_expiry_update();

-- 4) Atomic correction RPC ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION correct_batch_expiry(
  p_batch_id uuid,
  p_expected_expiry_date date,
  p_new_expiry_date date,
  p_reason text,
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
  v_batch_id uuid;
  v_batch_org uuid;
  v_branch_id uuid;
  v_product_id uuid;
  v_old_expiry date;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_existing_id uuid;
  v_existing_old date;
  v_existing_new date;
  v_existing_branch uuid;
  v_existing_batch uuid;
  v_existing_product uuid;
  v_existing_high boolean;
  v_log_branch uuid;
  v_log_batch uuid;
  v_log_product uuid;
  v_log_old date;
  v_correction_id uuid;
  v_high_impact boolean := false;
  v_code text;
  v_message text;
BEGIN
  -- Resolve and validate the actor inside the authoritative function too; the
  -- RPC is directly callable by authenticated users, not only via the API route.
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
  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'batch_id is required';
  END IF;
  IF p_operation_id IS NULL OR btrim(p_operation_id) = '' THEN
    RAISE EXCEPTION 'operation_id is required';
  END IF;
  IF length(p_operation_id) > 100 THEN
    RAISE EXCEPTION 'operation_id is too long';
  END IF;
  IF p_expected_expiry_date IS NULL THEN
    RAISE EXCEPTION 'expected_expiry_date is required for optimistic concurrency';
  END IF;
  IF p_new_expiry_date IS NULL THEN
    RAISE EXCEPTION 'A valid expiry date is required';
  END IF;

  -- Lock the batch so concurrent corrections cannot silently overwrite.
  SELECT id, organization_id, branch_id, product_id, expiry_date
    INTO v_batch_id, v_batch_org, v_branch_id, v_product_id, v_old_expiry
  FROM product_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_batch_id IS NULL THEN
    INSERT INTO batch_expiry_corrections (
      operation_id, organization_id, branch_id, batch_id, product_id,
      old_expiry_date, new_expiry_date, reason, status, error_code, error_message,
      requested_by
    ) VALUES (
      p_operation_id, v_org_id, NULL, NULL, NULL,
      NULL, p_new_expiry_date, left(COALESCE(NULLIF(v_reason, ''), '(no reason provided)'), 500), 'REJECTED', 'BATCH_NOT_FOUND',
      'Batch not found', v_profile_id
    );
    RETURN jsonb_build_object(
      'success', false,
      'outcome', 'REJECTED',
      'error_code', 'BATCH_NOT_FOUND',
      'message', 'Batch not found'
    );
  END IF;

  -- Authorization: organization, branch access and dedicated permission.
  IF v_batch_org IS DISTINCT FROM v_org_id THEN
    v_code := 'UNAUTHORIZED_BATCH';
    v_message := 'Unauthorized batch access';
  ELSIF NOT COALESCE(user_has_branch_access(v_branch_id), false) THEN
    v_code := 'UNAUTHORIZED_BRANCH';
    v_message := 'Unauthorized branch access';
  ELSIF NOT has_permission_in_org('inventory.batch_expiry.correct', v_org_id) THEN
    v_code := 'PERMISSION_DENIED';
    v_message := 'You do not have permission to correct batch expiry dates';
  END IF;

  IF v_code IS NOT NULL THEN
    -- Never write another organization's identifiers or expiry into the
    -- caller's audit trail. Branch-denied attempts also must not reveal the
    -- expiry of a branch the caller cannot access.
    IF v_code = 'UNAUTHORIZED_BATCH' THEN
      v_log_branch := NULL;
      v_log_batch := NULL;
      v_log_product := NULL;
      v_log_old := NULL;
    ELSIF v_code = 'UNAUTHORIZED_BRANCH' THEN
      v_log_branch := v_branch_id;
      v_log_batch := v_batch_id;
      v_log_product := v_product_id;
      v_log_old := NULL;
    ELSE
      v_log_branch := v_branch_id;
      v_log_batch := v_batch_id;
      v_log_product := v_product_id;
      v_log_old := v_old_expiry;
    END IF;

    INSERT INTO batch_expiry_corrections (
      operation_id, organization_id, branch_id, batch_id, product_id,
      old_expiry_date, new_expiry_date, reason, status, error_code, error_message,
      requested_by
    ) VALUES (
      p_operation_id, v_org_id, v_log_branch, v_log_batch, v_log_product,
      v_log_old, p_new_expiry_date, left(COALESCE(NULLIF(v_reason, ''), '(no reason provided)'), 500), 'REJECTED', v_code, v_message,
      v_profile_id
    );
    RETURN jsonb_build_object(
      'success', false,
      'outcome', 'REJECTED',
      'error_code', v_code,
      'message', v_message,
      'batch_id', v_batch_id
    );
  END IF;

  -- Idempotency is checked only after authorization, so retries cannot use a
  -- known operation id to read another branch's batch metadata. An operation id
  -- belongs to one applied correction per organization.
  SELECT id, old_expiry_date, new_expiry_date, branch_id, batch_id, product_id, high_impact
    INTO v_existing_id, v_existing_old, v_existing_new, v_existing_branch, v_existing_batch, v_existing_product, v_existing_high
  FROM batch_expiry_corrections
  WHERE operation_id = p_operation_id
    AND status = 'APPLIED'
    AND organization_id = v_org_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_batch IS DISTINCT FROM p_batch_id THEN
    INSERT INTO batch_expiry_corrections (
      operation_id, organization_id, branch_id, batch_id, product_id,
      old_expiry_date, new_expiry_date, reason, status, error_code, error_message,
      requested_by
    ) VALUES (
      p_operation_id, v_org_id, v_branch_id, v_batch_id, v_product_id,
      v_old_expiry, p_new_expiry_date, left(COALESCE(NULLIF(v_reason, ''), '(no reason provided)'), 500),
      'REJECTED', 'OPERATION_ID_CONFLICT', 'This operation id was already used for a different batch', v_profile_id
    );
    RETURN jsonb_build_object(
      'success', false,
      'outcome', 'REJECTED',
      'error_code', 'OPERATION_ID_CONFLICT',
      'message', 'This operation id was already used for a different batch',
      'batch_id', v_batch_id
    );
  END IF;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'correction_id', v_existing_id,
      'batch_id', v_existing_batch,
      'branch_id', v_existing_branch,
      'product_id', v_existing_product,
      'old_expiry_date', v_existing_old,
      'new_expiry_date', v_existing_new,
      'high_impact', v_existing_high
    );
  END IF;

  -- Validation (logged as rejected attempts without touching the batch).
  IF length(v_reason) < 5 THEN
    v_code := 'REASON_REQUIRED';
    v_message := 'A correction reason of at least 5 characters is required';
  ELSIF length(v_reason) > 500 THEN
    v_code := 'REASON_TOO_LONG';
    v_message := 'Correction reason must be 500 characters or fewer';
  ELSIF p_new_expiry_date < DATE '1900-01-01' OR p_new_expiry_date > DATE '2200-12-31' THEN
    v_code := 'INVALID_DATE';
    v_message := 'Expiry date is outside the accepted range';
  ELSIF p_expected_expiry_date IS NOT NULL AND v_old_expiry IS DISTINCT FROM p_expected_expiry_date THEN
    v_code := 'STALE_BATCH';
    v_message := 'This batch was changed by another user. Reload the batch and review the current expiry date before retrying.';
  ELSIF p_new_expiry_date IS NOT DISTINCT FROM v_old_expiry THEN
    v_code := 'UNCHANGED';
    v_message := 'The proposed expiry date is identical to the current expiry date';
  END IF;

  IF v_code IS NOT NULL THEN
    INSERT INTO batch_expiry_corrections (
      operation_id, organization_id, branch_id, batch_id, product_id,
      old_expiry_date, new_expiry_date, reason, status, error_code, error_message,
      requested_by
    ) VALUES (
      p_operation_id, v_batch_org, v_branch_id, v_batch_id, v_product_id,
      v_old_expiry, p_new_expiry_date, left(COALESCE(NULLIF(v_reason, ''), '(no reason provided)'), 500), 'REJECTED', v_code, v_message,
      v_profile_id
    );
    RETURN jsonb_build_object(
      'success', false,
      'outcome', 'REJECTED',
      'error_code', v_code,
      'message', v_message,
      'batch_id', v_batch_id,
      'old_expiry_date', v_old_expiry
    );
  END IF;

  -- Expiry today already removes the batch from sale (POS requires
  -- expiry_date > CURRENT_DATE), so treat it as high impact too.
  v_high_impact := (p_new_expiry_date <= CURRENT_DATE)
    OR COALESCE(abs(p_new_expiry_date - v_old_expiry), 0) > 180;

  -- Audit + update happen in the same transaction. If either fails the whole
  -- correction is rolled back, so a batch can never change without its history.
  INSERT INTO batch_expiry_corrections (
    operation_id, organization_id, branch_id, batch_id, product_id,
    old_expiry_date, new_expiry_date, reason, status, high_impact,
    requested_by, applied_by, applied_at
  ) VALUES (
    p_operation_id, v_batch_org, v_branch_id, v_batch_id, v_product_id,
    v_old_expiry, p_new_expiry_date, v_reason, 'APPLIED', v_high_impact,
    v_profile_id, v_profile_id, now()
  ) RETURNING id INTO v_correction_id;

  -- Authorise the column change for this transaction only.
  PERFORM set_config('mediflow.batch_expiry_correction', 'on', true);

  UPDATE product_batches
     SET expiry_date = p_new_expiry_date,
         updated_at = now()
   WHERE id = v_batch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch disappeared during correction';
  END IF;

  -- Re-arm the guard immediately so no later statement in this transaction can
  -- change another batch expiry using the same transaction-local flag.
  PERFORM set_config('mediflow.batch_expiry_correction', 'off', true);

  INSERT INTO audit_logs (
    organization_id, branch_id, user_id, created_by,
    action, entity_type, entity_id, old_values, new_values
  ) VALUES (
    v_batch_org, v_branch_id, v_profile_id, v_profile_id,
    'BATCH_EXPIRY_CORRECTED', 'product_batches', v_batch_id,
    jsonb_build_object(
      'expiry_date', v_old_expiry
    ),
    jsonb_build_object(
      'expiry_date', p_new_expiry_date,
      'correction_id', v_correction_id,
      'operation_id', p_operation_id,
      'reason', v_reason,
      'high_impact', v_high_impact
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'correction_id', v_correction_id,
    'batch_id', v_batch_id,
    'branch_id', v_branch_id,
    'product_id', v_product_id,
    'old_expiry_date', v_old_expiry,
    'new_expiry_date', p_new_expiry_date,
    'high_impact', v_high_impact
  );
END;
$$;

REVOKE ALL ON FUNCTION correct_batch_expiry(uuid, date, date, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION correct_batch_expiry(uuid, date, date, text, text) TO authenticated;
