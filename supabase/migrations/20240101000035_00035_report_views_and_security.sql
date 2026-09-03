-- Migration 00035: Reporting helpers and security hardening
-- Phase 4: Views/functions for real reports, plus missing constraints

-- Seed additional permissions for Phase4
insert into permissions (id, code, name, description) values
  ('f0eebc99-9001-4000-8000-000000000040', 'cash.manage', 'Manage Cash', 'Open/close cash sessions, cash in/out'),
  ('f0eebc99-9001-4000-8000-000000000041', 'cash.approve', 'Approve Cash Variance', 'Approve cash variance requiring manager'),
  ('f0eebc99-9001-4000-8000-000000000042', 'reports.cash', 'View Cash Reports', 'Access cash reconciliation reports'),
  ('f0eebc99-9001-4000-8000-000000000043', 'stock.transfer', 'Manage Transfers', 'Create/approve branch transfers'),
  ('f0eebc99-9001-4000-8000-000000000044', 'stock.dispose', 'Dispose Stock', 'Approve disposal of expired/damaged stock'),
  ('f0eebc99-9001-4000-8000-000000000045', 'price.change', 'Change Prices', 'Change product selling/purchase prices'),
  ('f0eebc99-9001-4000-8000-000000000046', 'supplier.pay', 'Pay Supplier', 'Record supplier payments'),
  ('f0eebc99-9001-4000-8000-000000000047', 'expense.approve', 'Approve Expenses', 'Approve pending expenses')
on conflict (code) do nothing;

-- Owner gets all new perms
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'Owner' and p.code in ('cash.manage','cash.approve','reports.cash','stock.transfer','stock.dispose','price.change','supplier.pay','expense.approve')
on conflict do nothing;

-- Manager gets operational perms
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'Manager' and p.code in ('cash.manage','cash.approve','reports.cash','stock.transfer','stock.dispose','price.change','supplier.pay','expense.approve')
on conflict do nothing;

-- Stock Manager gets transfer/dispose
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'Stock Manager' and p.code in ('stock.transfer','stock.dispose','price.change')
on conflict do nothing;

-- Add missing check: cash_sessions closing_cash required when closed
-- (application-level enforcement, not DB constraint to allow OPEN)

-- Create view for sales with payments aggregation (for reports)
create or replace view sales_payment_summary as
select
  s.id,
  s.organization_id,
  s.branch_id,
  s.sale_number,
  s.status,
  s.subtotal,
  s.discount,
  s.tax,
  s.total,
  s.cashier_id,
  s.sold_at,
  coalesce(sum(p.amount) filter (where p.status='completed'),0) as paid_amount,
  count(p.id) as payment_count
from sales s left join payments p on p.sale_id = s.id
group by s.id;

-- Create view for inventory valuation per product/branch
create or replace view inventory_valuation as
select
  b.organization_id,
  b.branch_id,
  b.product_id,
  p.name as product_name,
  sum(b.quantity_available * b.purchase_price) as valuation,
  sum(b.quantity_available) as total_qty
from product_batches b join products p on p.id = b.product_id
where b.is_active = true and b.quantity_available > 0
group by b.organization_id, b.branch_id, b.product_id, p.name;

comment on view sales_payment_summary is 'Sales with aggregated payment totals for reconciliation';
comment on view inventory_valuation is 'Current inventory valuation per product/branch';

-- Ensure audit_logs remains append-only (re-assert)
revoke update, delete on audit_logs from public, anon, authenticated;

-- Helper function: calculate supplier balance
create or replace function get_supplier_balance(p_supplier_id uuid, p_org_id uuid)
returns table(purchased numeric, paid numeric, returned numeric, balance numeric)
language sql stable as $$
  with purchased as (
    select coalesce(sum(po.total),0) as v from purchase_orders po
    where po.supplier_id = p_supplier_id and po.organization_id = p_org_id and po.status in ('ORDERED','PARTIALLY_RECEIVED','RECEIVED')
  ),
  paid as (
    select coalesce(sum(sp.amount),0) as v from supplier_payments sp
    where sp.supplier_id = p_supplier_id and sp.organization_id = p_org_id
  ),
  returned as (
    select coalesce(sum(pr.total),0) as v from purchase_returns pr
    where pr.supplier_id = p_supplier_id and pr.organization_id = p_org_id and pr.status in ('approved','completed')
  )
  select (select v from purchased), (select v from paid), (select v from returned), (select v from purchased) - (select v from paid) - (select v from returned);
$$;

comment on function get_supplier_balance is 'Derived supplier balance: purchases - payments - returns';
