-- Phase 5 Core Completion: missing columns for transfers, stock counts, sales idempotency
-- Add shipped_by/shipped_at to transfers (service uses them but schema lacked)
alter table transfers add column if not exists shipped_by uuid references profiles(id) on delete set null;
alter table transfers add column if not exists shipped_at timestamptz;
alter table transfers add column if not exists approved_by uuid references profiles(id) on delete set null;
alter table transfers add column if not exists approved_at timestamptz;

-- Expand transfer status check to include REQUESTED/APPROVED
-- Existing check only DRAFT/IN_TRANSIT/RECEIVED/CANCELLED; add new values
alter table transfers drop constraint if exists transfers_status_check;
alter table transfers add constraint transfers_status_check check (status in ('DRAFT','REQUESTED','APPROVED','IN_TRANSIT','RECEIVED','CANCELLED'));

-- Stock counts: add reviewed_by/reviewed_at
alter table stock_counts add column if not exists reviewed_by uuid references profiles(id) on delete set null;
alter table stock_counts add column if not exists reviewed_at timestamptz;

-- Sales: operation_id for idempotency (offline/retry safe)
alter table sales add column if not exists operation_id text unique;
create index if not exists idx_sales_operation_id on sales(operation_id) where operation_id is not null;

-- Payments: ensure operation_id for idempotency as well
alter table payments add column if not exists operation_id text;
create unique index if not exists uq_payments_operation_id on payments(operation_id) where operation_id is not null;

-- Stock movements: ensure operation_id for dedup
alter table stock_movements add column if not exists operation_id text;
create index if not exists idx_stock_movements_operation_id on stock_movements(operation_id);

-- Ensure product_batches has unique per branch+product+batch for FEFO correctness
create unique index if not exists uq_product_batches_branch_product_batch on product_batches(branch_id, product_id, batch_number) where batch_number is not null;

comment on column transfers.shipped_by is 'Phase5: who shipped IN_TRANSIT';
comment on column sales.operation_id is 'Phase5: idempotency key for offline/retry';
