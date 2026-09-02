-- Migration: 00022_settings.sql
-- Organization and branch settings

CREATE TABLE IF NOT EXISTS organization_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    receipt_header text,
    receipt_footer text,
    default_tax_rate numeric(5,2) NOT NULL DEFAULT 0,
    default_currency text NOT NULL DEFAULT 'UGX',
    low_stock_threshold integer NOT NULL DEFAULT 10,
    expiry_warning_days integer NOT NULL DEFAULT 90,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branch_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid UNIQUE NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    receipt_prefix text NOT NULL DEFAULT 'RCP',
    invoice_prefix text NOT NULL DEFAULT 'INV',
    default_payment_method text NOT NULL DEFAULT 'CASH',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
