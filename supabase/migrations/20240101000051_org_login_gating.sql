-- Migration: org login gating
-- Lets the login page and server helpers know whether the caller's
-- organization account is active (client accounts are gated by org status).

CREATE OR REPLACE FUNCTION get_my_org_status()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT o.status
       FROM profiles p
       JOIN organizations o ON o.id = p.organization_id
      WHERE p.auth_user_id = auth.uid()
      LIMIT 1),
    'none'
  );
$$;

GRANT EXECUTE ON FUNCTION get_my_org_status() TO authenticated, service_role;