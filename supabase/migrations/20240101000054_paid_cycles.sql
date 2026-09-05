-- Migration: 00054_paid_cycles.sql
-- Monthly auto-cycle after a super admin approves a lapsed account.
-- 1) organizations: paid_until (next renewal boundary for full-plan orgs)
-- 2) platform_settings: cycle_days (default 30) — length of each paid cycle
-- 3) get_my_trial_status(): lazily lapse an active full-plan org whose
--    paid_until has passed (reuses the existing trial_expired status so all
--    gating surfaces keep working unchanged), and report why the account
--    lapsed (expired_reason = 'trial' | 'paid')
-- 4) pg_cron daily sweep extended to cover paid cycles

-- ---------------------------------------------------------------
-- 1) organizations
-- ---------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS paid_until timestamptz;

-- ---------------------------------------------------------------
-- 2) platform_settings: paid cycle length (days)
-- ---------------------------------------------------------------
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS cycle_days integer NOT NULL DEFAULT 30 CHECK (cycle_days > 0);

UPDATE platform_settings SET cycle_days = 30 WHERE id = 1 AND cycle_days IS NULL;

-- ---------------------------------------------------------------
-- 3) get_my_trial_status(): lazy trial/paid-cycle expiry flip + reason
--    SECURITY DEFINER so the app role can read platform_settings + flip.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_trial_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org         organizations%ROWTYPE;
  v_ps          platform_settings%ROWTYPE;
  v_reason      text;
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

  -- Lazy expiry: active orgs past their deadline are flipped here.
  -- Trials lapse on trial_ends_at; paid (full) cycles lapse on paid_until.
  IF v_org.status = 'active' THEN
    IF v_org.plan = 'trial'
       AND v_org.trial_ends_at IS NOT NULL AND v_org.trial_ends_at < now() THEN
      UPDATE organizations SET status = 'trial_expired', updated_at = now() WHERE id = v_org.id;
      v_org.status := 'trial_expired';
      v_reason := 'trial';
    ELSIF v_org.plan = 'full'
          AND v_org.paid_until IS NOT NULL AND v_org.paid_until < now() THEN
      UPDATE organizations SET status = 'trial_expired', updated_at = now() WHERE id = v_org.id;
      v_org.status := 'trial_expired';
      v_reason := 'paid';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'status', v_org.status,
    'expired_reason', v_reason,
    'plan', v_org.plan,
    'trial_ends_at', v_org.trial_ends_at,
    'paid_until', v_org.paid_until,
    'trial_days', COALESCE(v_ps.trial_days, 3),
    'cycle_days', COALESCE(v_ps.cycle_days, 30),
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
            AND ( (plan = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at < now())
               OR (plan = 'full'  AND paid_until   IS NOT NULL AND paid_until   < now()) ); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron unavailable: the lazy flip in get_my_trial_status() still enforces.
  NULL;
END;
$$;