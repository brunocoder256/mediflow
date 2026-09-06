-- Migration: 00054_billing_cycles.sql
-- Upfront multi-month ("cycle") payments for MediFlow.
--
-- A customer can pay for several months at once (e.g. 3 months upfront).
-- Instead of blocking them after one month, we track how many paid cycles are
-- left and when their current paid access actually ends. When that deadline
-- passes (without re-authorization), the account is blocked again and the
-- owner is asked to complete the monthly payment.
--
-- Key model:
--   plan          = 'trial' | 'full'   (unchanged: trial vs. paid)
--   paid_cycles   = number of paid months currently remaining (billing credits)
--   access_ends_at= when the current paid access expires (nullable)
--
-- A NEW trial account starts with plan='trial', paid_cycles=0, access_ends_at=NULL.
-- Approval / payment confirmation ADDS paid_cycles and extends access_ends_at.
-- The gate enforces: paid access is valid while access_ends_at >= now().

-- 1) organizations: billing cycle columns
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS paid_cycles integer NOT NULL DEFAULT 0 CHECK (paid_cycles >= 0),
  ADD COLUMN IF NOT EXISTS access_ends_at timestamptz;

-- 2) get_my_access_status(): single source of truth for the client gate.
--    Lazily blocks paid accounts whose access_ends_at has passed, and trial
--    accounts past trial_ends_at. Returns everything the UI needs (including
--    remaining paid cycles and whether the owner is "waiting for approval").
CREATE OR REPLACE FUNCTION get_my_access_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_ps  platform_settings%ROWTYPE;
  v_blocked boolean := false;
  v_reason text := NULL;
BEGIN
  SELECT o.* INTO v_org
    FROM profiles p
    JOIN organizations o ON o.id = p.organization_id
   WHERE p.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_org.id IS NULL THEN
    RETURN jsonb_build_object('status', 'none', 'blocked', false);
  END IF;

  SELECT * INTO v_ps FROM platform_settings WHERE id = 1;

  -- Lazy trial expiry: an active trial past its deadline is flipped here.
  IF v_org.status = 'active' AND v_org.plan = 'trial'
     AND v_org.trial_ends_at IS NOT NULL AND v_org.trial_ends_at < now() THEN
    UPDATE organizations SET status = 'trial_expired', updated_at = now() WHERE id = v_org.id;
    v_org.status := 'trial_expired';
  END IF;

  -- Paid access expiry: a full (paid) account whose paid window has passed is
  -- blocked (not fully deactivated) and put back into the "complete your
  -- payment" state without signing the user out.
  IF v_org.plan = 'full' AND v_org.status = 'active'
     AND v_org.access_ends_at IS NOT NULL AND v_org.access_ends_at < now() THEN
    UPDATE organizations SET status = 'trial_expired', updated_at = now() WHERE id = v_org.id;
    v_org.status := 'trial_expired';
  END IF;

  -- Determine blocked / reason for the UI gate.
  IF v_org.status = 'trial_expired' THEN
    v_blocked := true;
    v_reason := 'subscription_over';
  ELSIF v_org.status IN ('suspended', 'inactive') THEN
    v_blocked := true;
    v_reason := 'suspended';
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'status', v_org.status,
    'plan', v_org.plan,
    'blocked', v_blocked,
    'reason', v_reason,
    'trial_ends_at', v_org.trial_ends_at,
    'paid_cycles', COALESCE(v_org.paid_cycles, 0),
    'access_ends_at', v_org.access_ends_at,
    'trial_days', COALESCE(v_ps.trial_days, 3),
    'contact_phone_1', COALESCE(v_ps.contact_phone_1, '0759327843'),
    'contact_phone_2', COALESCE(v_ps.contact_phone_2, '0768082948')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_access_status() TO authenticated, service_role;

-- 3) Helper for the Super Admin to credit paid cycles (used by API routes).
CREATE OR REPLACE FUNCTION credit_paid_cycles(
  p_organization_id uuid,
  p_months integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_base timestamptz;
  v_new_end timestamptz;
BEGIN
  IF p_months IS NULL OR p_months < 1 THEN
    RAISE EXCEPTION 'months must be >= 1';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_organization_id FOR UPDATE;
  IF v_org.id IS NULL THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  -- Extend from the later of now() or the current access end (so stacking
  -- payments adds on top without double-counting months still on the clock).
  v_base := GREATEST(now(), COALESCE(v_org.access_ends_at, now()));
  v_new_end := v_base + (p_months || ' months')::interval;

  UPDATE organizations
     SET paid_cycles = COALESCE(v_org.paid_cycles, 0) + p_months,
         access_ends_at = v_new_end,
         plan = 'full',
         status = 'active',
         trial_ends_at = NULL,
         updated_at = now()
   WHERE id = p_organization_id;

  RETURN jsonb_build_object(
    'paid_cycles', COALESCE(v_org.paid_cycles, 0) + p_months,
    'access_ends_at', v_new_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION credit_paid_cycles(uuid, integer) TO service_role;

-- 4) pg_cron daily sweep: lazily block paid accounts whose paid window ended
--    (belt-and-braces; the lazy gate in get_my_access_status also enforces).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    PERFORM cron.unschedule('mediflow_billing_expiry')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mediflow_billing_expiry');
    PERFORM cron.schedule(
      'mediflow_billing_expiry',
      '0 0 * * *',
      $cron$ UPDATE public.organizations
            SET status = 'trial_expired', updated_at = now()
          WHERE status = 'active'
            AND plan = 'full'
            AND access_ends_at IS NOT NULL
            AND access_ends_at < now(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
