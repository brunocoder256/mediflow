-- Migration: 00057_platform_expiry_notifications.sql
-- Notify Super Admins whenever any client organization's trial or paid cycle
-- expires (status -> trial_expired).
--
-- Implemented as an AFTER UPDATE trigger on organizations so it fires for every
-- expiry path: the lazy gate flip in get_my_access_status(), the pg_cron daily
-- sweep, or an explicit admin action. A notification row is inserted for every
-- active platform admin (deduplicated against existing unread notifications).

-- 1) Helper: notify active platform admins that an org's access/trial ended.
CREATE OR REPLACE FUNCTION notify_platform_admins_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name text;
  v_type text;
  v_title text;
  v_message text;
  v_admin record;
BEGIN
  -- Only act on the transition INTO trial_expired (fire once, not on every touch).
  IF NEW.status = 'trial_expired' AND OLD.status IS DISTINCT FROM 'trial_expired' THEN
    v_org_name := COALESCE(NEW.name, 'An organization');

    -- Distinguish a trial expiry from a paid-cycle expiry for a clearer message.
    IF NEW.plan = 'trial' THEN
      v_type := 'trial_expired';
      v_title := 'Trial expired: ' || v_org_name;
      v_message := v_org_name || '''s free trial has ended. Review the account and reach out to the owner about completing payment / extending the trial.';
    ELSE
      v_type := 'cycle_expired';
      v_title := 'Paid cycle expired: ' || v_org_name;
      v_message := v_org_name || '''s paid access has ended (no remaining cycles). Contact the owner about renewing their subscription.';
    END IF;

    FOR v_admin IN
      SELECT pa.user_id
        FROM platform_admins pa
        JOIN profiles p ON p.id = pa.user_id
       WHERE pa.is_active = true
         AND p.is_active = true
    LOOP
      -- Deduplicate: skip if an unread notification with the same type+title exists.
      IF NOT EXISTS (
        SELECT 1 FROM notifications n
         WHERE n.user_id = v_admin.user_id
           AND n.type = v_type
           AND n.title = v_title
           AND n.is_read = false
      ) THEN
        INSERT INTO notifications (organization_id, user_id, type, title, message)
        VALUES ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', v_admin.user_id, v_type, v_title, v_message);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Trigger on organizations: fire whenever status flips to trial_expired.
DROP TRIGGER IF EXISTS trg_organizations_notify_expiry ON organizations;
CREATE TRIGGER trg_organizations_notify_expiry
  AFTER UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION notify_platform_admins_expiry();

-- 3) Also fire on insert in the (rare) case an org is created already expired.
DROP TRIGGER IF EXISTS trg_organizations_notify_expiry_insert ON organizations;
CREATE TRIGGER trg_organizations_notify_expiry_insert
  AFTER INSERT ON organizations
  FOR EACH ROW
  WHEN (NEW.status = 'trial_expired')
  EXECUTE FUNCTION notify_platform_admins_expiry();

REVOKE ALL ON FUNCTION notify_platform_admins_expiry() FROM public;
