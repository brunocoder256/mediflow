-- Migration: 00031_transfers.sql
-- Inter-branch stock transfers

CREATE TABLE IF NOT EXISTS transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    transfer_number text NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_TRANSIT','RECEIVED','CANCELLED')),
    requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    received_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    received_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfer_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id uuid NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id uuid REFERENCES product_batches(id) ON DELETE SET NULL,
    quantity integer NOT NULL,
    unit_cost numeric(14,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation_transfers ON transfers
    FOR ALL USING (
        organization_id = get_user_org_id()
    );

CREATE POLICY org_isolation_transfer_items ON transfer_items
    FOR ALL USING (
        transfer_id IN (
            SELECT id FROM transfers
            WHERE organization_id = get_user_org_id()
        )
    );

CREATE INDEX idx_transfers_organization_id ON transfers(organization_id);
CREATE INDEX idx_transfers_source_branch_id ON transfers(source_branch_id);
CREATE INDEX idx_transfers_destination_branch_id ON transfers(destination_branch_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfer_items_transfer_id ON transfer_items(transfer_id);
CREATE INDEX idx_transfer_items_product_id ON transfer_items(product_id);