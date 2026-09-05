-- Migration: super_admin
-- Minimal Super Admin account management:
--   * platform_admins   – who can access /super-admin/accounts
--   * registrations     – pharmacy account applications awaiting approval
--   * register_account  – public RPC used by the Create Account page
--   * is_super_admin    – helper used by RLS + API routes
-- Accounts are created automatically by the Super Admin when approving.

CREATE TABLE IF NOT EXISTS platform_admins (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  business_type text,
  owner_full_name text NOT NULL,
  owner_email text NOT NULL,
  owner_phone text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','rejected')),
  rejection_reason text,
  info_request_message text,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(lower(owner_email));
CREATE INDEX IF NOT EXISTS idx_registrations_business ON registrations(business_name);
CREATE INDEX IF NOT EXISTS idx_registrations_created ON registrations(created_at);

-- A single open application per owner email (rejected ones may re-apply).
CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_email_open
  ON registrations (lower(owner_email)) WHERE status <> 'rejected';

-- Platform (MediFlow) organization that hosts the Super Admin + audit trail.
INSERT INTO organizations (id, name, business_type, registration_number, status)
VALUES ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', 'MediFlow Platform', 'platform', 'MF-PLATFORM', 'active')
ON CONFLICT (id) DO NOTHING;

-- Sequence for human-friendly account references: MF-00001, MF-00002 ...
CREATE SEQUENCE IF NOT EXISTS registration_ref_seq START 1;

-- Is the current caller a platform Super Admin?
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_admins pa
    JOIN profiles p ON p.id = pa.user_id
    WHERE p.auth_user_id = auth.uid()
      AND pa.is_active = true
  );
$$;

-- Public: create a pharmacy account application (Create Account page).
-- No organization/account is created until the Super Admin approves.
CREATE OR REPLACE FUNCTION register_account(
  p_business_name text,
  p_business_type text,
  p_owner_full_name text,
  p_owner_email text,
  p_owner_phone text,
  p_location text
)
RETURNS registrations
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_reg registrations%ROWTYPE;
  v_existing boolean;
BEGIN
  IF p_business_name IS NULL OR btrim(p_business_name) = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;
  IF p_owner_full_name IS NULL OR btrim(p_owner_full_name) = '' THEN
    RAISE EXCEPTION 'Owner full name is required';
  END IF;
  IF p_owner_email IS NULL OR p_owner_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid owner email is required';
  END IF;
  IF p_owner_phone IS NULL OR btrim(p_owner_phone) = '' THEN
    RAISE EXCEPTION 'Owner phone is required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM registrations r
    WHERE lower(r.owner_email) = lower(p_owner_email) AND r.status <> 'rejected'
  ) INTO v_existing;
  IF v_existing THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_REGISTERED';
  END IF;

  v_ref := 'MF-' || lpad(nextval('registration_ref_seq')::text, 5, '0');

  INSERT INTO registrations (
    reference, business_name, business_type, owner_full_name, owner_email, owner_phone, location, status
  ) VALUES (
    v_ref, btrim(p_business_name), NULLIF(btrim(p_business_type), ''), btrim(p_owner_full_name),
    lower(btrim(p_owner_email)), btrim(p_owner_phone), NULLIF(btrim(p_location), ''), 'pending'
  )
  RETURNING * INTO v_reg;

  -- Audit trail (platform org scope, SECURITY DEFINER so anon can record it)
  INSERT INTO audit_logs (
    organization_id, user_id, created_by, action, entity_type, entity_id,
    old_values, new_values, branch_id
  ) VALUES (
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', NULL, NULL, 'ACCOUNT_APPLIED', 'registrations', v_reg.id,
    NULL, jsonb_build_object(
      'reference', v_ref,
      'business_name', v_reg.business_name,
      'owner_email', v_reg.owner_email
    ),
    NULL
  );

  RETURN v_reg;
END;
$$;

-- Row Level Security: registrations and platform_admins are Super Admin-only.
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registrations_super_admin ON registrations;
CREATE POLICY registrations_super_admin ON registrations
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_admins_super_admin ON platform_admins;
CREATE POLICY platform_admins_super_admin ON platform_admins
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Direct table access by app roles is not needed; everything flows through RPCs.
REVOKE ALL ON registrations FROM authenticated;
REVOKE ALL ON registrations FROM anon;
REVOKE ALL ON platform_admins FROM authenticated;
REVOKE ALL ON platform_admins FROM anon;

GRANT EXECUTE ON FUNCTION register_account(text, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon, authenticated, service_role;