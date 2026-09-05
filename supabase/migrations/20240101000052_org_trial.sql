-- Migration: 00052_org_trial.sql
-- 3-day free trial for newly approved organizations.
-- 1) organizations: plan + trial_ends_at + new status trial_expired
-- 2) platform_settings: single-row trial configuration (days + contact phones)
-- 3) get_my_trial_status(): lazy trial-expiry flip + owner-facing trial info
-- 4) pg_cron daily sweep (optional; lazy flip covers enforcement)

-- ---------------------------------------------------------------
-- 1) organizations
-- ---------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'full' CHECK (plan IN ('trial', 'full')),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'trial_expired'));

-- Existing orgs stay full access (no trial).
UPDATE organizations SET plan = 'full', trial_ends_at = NULL WHERE plan IS NULL;

-- ---------------------------------------------------------------
-- 2) platform_settings (single mutable row, id = 1)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  trial_days integer NOT NULL DEFAULT 3 CHECK (trial_days > 0),
  contact_phone_1 text NOT NULL DEFAULT '0759327843',
  contact_phone_2 text NOT NULL DEFAULT '0768082948',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (id, trial_days)
VALUES (1, 3)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON platform_settings TO service_role;
GRANT UPDATE ON platform_settings TO service_role;
GRANT INSERT ON platform_settings TO service_role;

-- ---------------------------------------------------------------
-- 3) get_my_trial_status(): SECURITY DEFINER so the app role can read
--    platform_settings + lazily expire trials (atomic single-call flip).
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
    'trial_ends_at', v_org.trial_ends_at,
    'trial_days', COALESCE(v_ps.trial_days, 3),
    'contact_phone_1', COALESCE(v_ps.contact_phone_1, '0759327843'),
    'contact_phone_2', COALESCE(v_ps.contact_phone_2, '0768082948')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_trial_status() TO authenticated, service_role;

-- ---------------------------------------------------------------
-- 4) pg_cron daily sweep (belt-and-braces on top of the lazy gate)
-- ---------------------------------------------------------------
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    PERFORM cron.unschedule('mediflow_trial_expiry')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mediflow_trial_expiry');
    PERFORM cron.schedule(
      'mediflow_trial_expiry',
      '0 0 * * *',
      $cron$ UPDATE public.organizations
            SET status = 'trial_expired', updated_at = now()
          WHERE status = 'active'
            AND plan = 'trial'
            AND trial_ends_at IS NOT NULL
            AND trial_ends_at < now(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron unavailable: the lazy flip in get_my_trial_status() still enforces.
  NULL;
END;
$$;