-- Migration: 00058_subscription_plans.sql
-- Three subscription tiers: Starter (20,000), Pro Pharmacy (50,000),
-- Enterprise (100,000 UGX per month).
--
-- The billing *stage* stays on organizations.plan ('trial' | 'full'). The
-- selected subscription *tier* is tracked separately as plan_tier so we can
-- layer plan-specific features on top later without touching the billing gate.
--
--   plan_tier = 'starter' | 'pro' | 'enterprise'
--
-- All three tiers currently unlock the same full system.

-- ---------------------------------------------------------------
-- 1) organizations: subscription tier
-- ---------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'starter';

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_tier_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_tier_check
  CHECK (plan_tier IN ('starter', 'pro', 'enterprise'));

UPDATE organizations SET plan_tier = 'starter' WHERE plan_tier IS NULL;

-- ---------------------------------------------------------------
-- 2) registrations: remember the tier chosen at signup
-- ---------------------------------------------------------------
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'starter';

ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_plan_tier_check;
ALTER TABLE registrations ADD CONSTRAINT registrations_plan_tier_check
  CHECK (plan_tier IN ('starter', 'pro', 'enterprise'));

UPDATE registrations SET plan_tier = 'starter' WHERE plan_tier IS NULL;

-- ---------------------------------------------------------------
-- 3) get_my_access_status(): include the subscription tier
-- ---------------------------------------------------------------
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
    'plan_tier', COALESCE(v_org.plan_tier, 'starter'),
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

-- ---------------------------------------------------------------
-- 4) get_my_trial_status(): include the subscription tier
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_trial_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_ps  platform_settings%ROWTYPE;
BEGIN
  SELECT o.* INTO v_org
    FROM profiles p
    JOIN organizations o ON o.id = p.organization_id
   WHERE p.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_org.id IS NULL THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;

  SELECT * INTO v_ps FROM platform_settings WHERE id = 1;

  -- Lazy trial expiry: an active trial past its deadline is flipped here.
  IF v_org.status = 'active' AND v_org.plan = 'trial'
     AND v_org.trial_ends_at IS NOT NULL AND v_org.trial_ends_at < now() THEN
    UPDATE organizations SET status = 'trial_expired', updated_at = now() WHERE id = v_org.id;
    v_org.status := 'trial_expired';
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'status', v_org.status,
    'plan', v_org.plan,
    'plan_tier', COALESCE(v_org.plan_tier, 'starter'),
    'trial_ends_at', v_org.trial_ends_at,
    'trial_days', COALESCE(v_ps.trial_days, 3),
    'contact_phone_1', COALESCE(v_ps.contact_phone_1, '0759327843'),
    'contact_phone_2', COALESCE(v_ps.contact_phone_2, '0768082948')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_trial_status() TO authenticated, service_role;

-- ---------------------------------------------------------------
-- 5) credit_paid_cycles(): optionally set the subscription tier on approval.
--    Adding the argument changes the signature, so drop the old function first.
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS credit_paid_cycles(uuid, integer);

CREATE OR REPLACE FUNCTION credit_paid_cycles(
  p_organization_id uuid,
  p_months integer,
  p_plan_tier text DEFAULT NULL
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
  v_tier text;
BEGIN
  IF p_months IS NULL OR p_months < 1 THEN
    RAISE EXCEPTION 'months must be >= 1';
  END IF;

  IF p_plan_tier IS NOT NULL AND p_plan_tier NOT IN ('starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'invalid plan tier: %', p_plan_tier;
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_organization_id FOR UPDATE;
  IF v_org.id IS NULL THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  v_tier := COALESCE(p_plan_tier, v_org.plan_tier, 'starter');

  -- Extend from the later of now() or the current access end (so stacking
  -- payments adds on top without double-counting months still on the clock).
  v_base := GREATEST(now(), COALESCE(v_org.access_ends_at, now()));
  v_new_end := v_base + (p_months || ' months')::interval;

  UPDATE organizations
     SET paid_cycles = COALESCE(v_org.paid_cycles, 0) + p_months,
         access_ends_at = v_new_end,
         plan = 'full',
         plan_tier = v_tier,
         status = 'active',
         trial_ends_at = NULL,
         updated_at = now()
   WHERE id = p_organization_id;

  RETURN jsonb_build_object(
    'paid_cycles', COALESCE(v_org.paid_cycles, 0) + p_months,
    'access_ends_at', v_new_end,
    'plan_tier', v_tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION credit_paid_cycles(uuid, integer, text) TO service_role;
