-- Migration: 00018_expenses.sql
-- Business expenses

CREATE TABLE IF NOT EXISTS expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    category text NOT NULL,
    description text,
    amount numeric(14,2) NOT NULL,
    payment_method text NOT NULL,
    expense_date date NOT NULL,
    created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
