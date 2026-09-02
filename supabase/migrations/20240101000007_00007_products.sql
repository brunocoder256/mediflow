-- Migration: 00007_products.sql
-- Products table

CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
    unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
    name text NOT NULL,
    generic_name text,
    brand_name text,
    sku text,
    barcode text,
    description text,
    reorder_level integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
