-- Migration: 00002_organizations.sql
-- Organizations table

CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    business_type text,
    registration_number text,
    phone text,
    email text,
    address text,
    logo_url text,
    currency text NOT NULL DEFAULT 'UGX',
    timezone text NOT NULL DEFAULT 'Africa/Kampala',
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
