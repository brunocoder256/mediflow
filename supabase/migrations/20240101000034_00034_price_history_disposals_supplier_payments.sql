-- Migration 00034: Price History, Disposals, Supplier Payments, Payment Reconciliation
-- Phase 4: Operational workflows

-- Price history - preserve old/new price per change
create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  batch_id uuid references product_batches(id) on delete set null,
  field_name text not null check (field_name in ('purchase_price','selling_price')),
  old_value numeric(14,2),
  new_value numeric(14,2) not null,
  changed_by uuid references profiles(id) on delete set null,
  reason text,
  effective_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_price_history_product on price_history(product_id);
create index if not exists idx_price_history_batch on price_history(batch_id);
create index if not exists idx_price_history_created_at on price_history(created_at);

-- Supplier payments - payables foundation
create table if not exists supplier_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  purchase_order_id uuid references purchase_orders(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('CASH','MOBILE_MONEY','CARD','BANK','OTHER')),
  reference text,
  payment_date date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_supplier_payments_supplier on supplier_payments(supplier_id);
create index if not exists idx_supplier_payments_purchase on supplier_payments(purchase_order_id);
create index if not exists idx_supplier_payments_date on supplier_payments(payment_date);

-- Disposals - expired/damaged stock workflow
create table if not exists disposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  type text not null check (type in ('EXPIRED','DAMAGED','OTHER')),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','DISPOSED','CANCELLED')),
  product_id uuid not null references products(id) on delete restrict,
  batch_id uuid references product_batches(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14,2) not null,
  reason text,
  condition text,
  reported_by uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  disposed_at timestamptz,
  disposal_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_disposals_org_branch on disposals(organization_id, branch_id);
create index if not exists idx_disposals_status on disposals(status);
create index if not exists idx_disposals_type on disposals(type);
create index if not exists idx_disposals_product on disposals(product_id);
create index if not exists idx_disposals_batch on disposals(batch_id);

-- Enhance payments with reconciliation fields (if not exists)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='payments' and column_name='provider') then
    alter table payments add column provider text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='payments' and column_name='reconciliation_status') then
    alter table payments add column reconciliation_status text not null default 'UNRECONCILED' check (reconciliation_status in ('UNRECONCILED','MATCHED','RECONCILED','DISPUTED','CANCELLED'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='payments' and column_name='session_id') then
    alter table payments add column session_id uuid references cash_sessions(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='payments' and column_name='payer_reference') then
    alter table payments add column payer_reference text;
  end if;
end $$;

create index if not exists idx_payments_reconciliation on payments(reconciliation_status);
create index if not exists idx_payments_session on payments(session_id);

-- Enhance expenses with approval/status
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='expenses' and column_name='status') then
    alter table expenses add column status text not null default 'APPROVED' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expenses' and column_name='approved_by') then
    alter table expenses add column approved_by uuid references profiles(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expenses' and column_name='receipt_reference') then
    alter table expenses add column receipt_reference text;
  end if;
end $$;

-- RLS for new tables
alter table price_history enable row level security;
alter table supplier_payments enable row level security;
alter table disposals enable row level security;

drop policy if exists price_history_org on price_history;
create policy price_history_org on price_history for all using (organization_id = get_user_org_id());
drop policy if exists supplier_payments_org_branch on supplier_payments;
create policy supplier_payments_org_branch on supplier_payments for all using (
  organization_id = get_user_org_id() and branch_id in (select get_user_branch_ids())
);
drop policy if exists disposals_org_branch on disposals;
create policy disposals_org_branch on disposals for all using (
  organization_id = get_user_org_id() and branch_id in (select get_user_branch_ids())
);

-- Updated_at triggers
drop trigger if exists trg_disposals_updated_at on disposals;
create trigger trg_disposals_updated_at before update on disposals for each row execute function handle_cash_updated_at();

comment on table price_history is 'Historical price changes, never mutates sale history';
comment on table supplier_payments is 'Payables: derived balance = purchases - payments - returns';
comment on table disposals is 'Controlled disposal for expired/damaged stock with approval';
