-- Migration 00043: Remaining Work — approvals, catalogue availability, price alerts
-- Price alert threshold stored in organization_settings or branch_settings JSON; add approvals table

-- Supplier credit approvals (approval workflow per spec 59)
create table if not exists supplier_credit_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  requested_by uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  previous_limit numeric(14,2) not null,
  requested_limit numeric(14,2) not null,
  reason text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table supplier_credit_approvals enable row level security;
drop policy if exists org_isolation_supplier_credit_approvals on supplier_credit_approvals;
create policy org_isolation_supplier_credit_approvals on supplier_credit_approvals for all using (organization_id = get_user_org_id());
create index if not exists idx_credit_approvals_supplier on supplier_credit_approvals(supplier_id);
create index if not exists idx_credit_approvals_status on supplier_credit_approvals(status);

-- Supplier catalogue flag: extend product_suppliers with availability + effective_date (for catalogue import)
alter table product_suppliers add column if not exists availability text default 'Available' check (availability in ('Available','Limited','Out of Stock','Discontinued'));
alter table product_suppliers add column if not exists effective_date date default current_date;
alter table product_suppliers add column if not exists catalogue_notes text;

-- Price alert threshold: stored in organization_settings as JSON key supplier_price_alert_pct (default 10)
-- Ensure settings table exists; insert default if missing
do $$
begin
  if not exists (select 1 from information_schema.tables where table_name='organization_settings') then
    create table organization_settings (id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, key text not null, value jsonb, created_at timestamptz not null default now(), unique(organization_id,key));
  end if;
end $$;

insert into organization_settings (organization_id, key, value)
select id, 'supplier_price_alert_pct', to_jsonb(10)
from organizations
on conflict (organization_id, key) do nothing;

insert into organization_settings (organization_id, key, value)
select id, 'supplier_catalogue_import_enabled', to_jsonb(true)
from organizations
on conflict (organization_id, key) do nothing;

-- Helper view for price alerts (price change > threshold)
create or replace view supplier_price_alerts as
select
  sph.supplier_id,
  sph.product_id,
  sph.price as new_price,
  lag(sph.price) over (partition by sph.supplier_id, sph.product_id order by sph.effective_date, sph.created_at) as prev_price,
  sph.effective_date,
  sph.created_at,
  case when lag(sph.price) over (partition by sph.supplier_id, sph.product_id order by sph.effective_date) is not null
       then abs(sph.price - lag(sph.price) over (partition by sph.supplier_id, sph.product_id order by sph.effective_date)) / nullif(lag(sph.price) over (partition by sph.supplier_id, sph.product_id order by sph.effective_date),0) * 100
       else 0 end as pct_change
from supplier_price_history sph;

comment on table supplier_credit_approvals is 'Approval for high-value supplier credit changes (requested→approved/rejected)';
comment on view supplier_price_alerts is 'Detects supplier price change pct for alerting; threshold configurable in organization_settings supplier_price_alert_pct';
