-- Migration: login_security
-- Tracks failed login attempts and enforces account lockout per docs/users.md §9/§27/§31
-- Additive; does not replace Supabase Auth. RPCs are invoked from the login page.

-- Record a failed login: increment counter and lock after threshold.
CREATE OR REPLACE FUNCTION record_failed_login(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_org uuid;
  v_default_branch uuid;
  v_threshold int := 5;
  v_window_min int := 15;
  v_attempts int;
  v_locked_until timestamptz;
BEGIN
  SELECT p.id, p.organization_id, p.default_branch_id
    INTO v_id, v_org, v_default_branch
  FROM profiles p
  JOIN auth.users u ON u.id = p.auth_user_id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN; -- unknown email: nothing to track (do not reveal account existence)
  END IF;

  SELECT failed_login_attempts, locked_until
    INTO v_attempts, v_locked_until
  FROM profiles WHERE id = v_id;

  v_attempts := coalesce(v_attempts, 0) + 1;

  -- If a previous lock has expired, reset the counter before applying the new attempt
  IF v_locked_until IS NOT NULL AND v_locked_until < now() THEN
    v_attempts := 1;
    v_locked_until := NULL;
  END IF;

  IF v_attempts >= v_threshold THEN
    v_locked_until := now() + (v_window_min || ' minutes')::interval;
    v_attempts := 0;
  END IF;

  UPDATE profiles
  SET failed_login_attempts = v_attempts,
      locked_until = v_locked_until,
      status = CASE WHEN v_locked_until IS NOT NULL THEN 'locked' ELSE status END,
      updated_at = now()
  WHERE id = v_id;

  IF v_locked_until IS NOT NULL THEN
    INSERT INTO audit_logs (organization_id, user_id, created_by, action, entity_type, entity_id, old_values, new_values, branch_id)
    VALUES (v_org, v_id, v_id, 'ACCOUNT_LOCKED', 'profiles', v_id, NULL,
            jsonb_build_object('locked_until', v_locked_until::text, 'failed_login_attempts', v_attempts), v_default_branch);
  END IF;
END;
$$;

-- Clear failed attempts (on successful login or manual unlock)
CREATE OR REPLACE FUNCTION clear_failed_login(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_was_locked boolean;
BEGIN
  SELECT p.id, (p.status = 'locked' OR p.locked_until IS NOT NULL) INTO v_id, v_was_locked
  FROM profiles p
  JOIN auth.users u ON u.id = p.auth_user_id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_id IS NULL THEN RETURN; END IF;

  UPDATE profiles
  SET failed_login_attempts = 0,
      locked_until = NULL,
      status = CASE WHEN v_was_locked THEN 'active' ELSE status END,
      updated_at = now()
  WHERE id = v_id;
END;
$$;

-- Query helper: is the account currently locked?
CREATE OR REPLACE FUNCTION is_account_locked(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN auth.users u ON u.id = p.auth_user_id
    WHERE lower(u.email) = lower(p_email)
      AND (p.status = 'locked' OR (p.locked_until IS NOT NULL AND p.locked_until > now()))
  );
$$;

GRANT EXECUTE ON FUNCTION record_failed_login(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION clear_failed_login(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_account_locked(text) TO authenticated, anon;
