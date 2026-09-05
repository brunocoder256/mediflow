-- Migration 00044: Returns Master Upgrade — full pharmacy returns per docs/returns.md
-- Safe idempotent, preserves existing data

-- 1) Returns (sales returns) — expand to full lifecycle per spec 40/41
alter table returns add column if not exists organization_id uuid references organizations(id) on delete cascade;
-- backfill organization_id from sales if missing
update returns r set organization_id = s.organization_id from sales s where r.sale_id = s.id and r.organization_id is null;

alter table returns add column if not exists return_type text default 'SALES' check (return_type in ('SALES','PURCHASE'));
alter table returns add column if not exists reason_category text;
-- reason values per spec 18
alter table returns add column if not exists condition text;
alter table returns add column if not exists inventory_destination text check (inventory_destination is null or inventory_destination in ('SALEABLE','QUARANTINE','DAMAGED','EXPIRED','RECALL','DISPOSAL'));
alter table returns add column if not exists resolution text check (resolution is null or resolution in ('REFUND','EXCHANGE','STORE_CREDIT','PARTIAL_REFUND','REJECTED','SUPPLIER_CREDIT','REPLACEMENT','WRITE_OFF'));
alter table returns add column if not exists refund_status text default 'NOT_APPLICABLE' check (refund_status in ('NOT_APPLICABLE','PENDING','PARTIAL','COMPLETED','REJECTED','FAILED'));
alter table returns add column if not exists refund_method text check (refund_method is null or refund_method in ('CASH','MOBILE_MONEY','CARD','BANK','ORIGINAL','STORE_CREDIT','OTHER'));
alter table returns add column if not exists operation_id text unique;
alter table returns add column if not exists customer_id uuid references customers(id) on delete set null;
alter table returns add column if not exists approved_by uuid references profiles(id) on delete set null;
alter table returns add column if not exists approved_at timestamptz;
alter table returns add column if not exists rejected_at timestamptz;
alter table returns add column if not exists rejection_reason text;
alter table returns add column if not exists submitted_at timestamptz;
alter table returns add column if not exists completed_at timestamptz;
alter table returns add column if not exists created_by uuid references profiles(id) on delete set null;
alter table returns add column if not exists updated_at timestamptz not null default now();
alter table returns add column if not exists sale_number text; -- snapshot

-- Normalize status values to spec lifecycle (existing pending/approved/completed + draft/submitted/rejected/cancelled/processing)
alter table returns drop constraint if exists returns_status_check;
alter table returns add constraint returns_status_check check (status in ('draft','pending','submitted','pending_approval','approved','processing','completed','rejected','cancelled'));

update returns set return_type='SALES' where return_type is null;
update returns set refund_status='NOT_APPLICABLE' where refund_status is null;
update returns set updated_at=now() where updated_at is null;
update returns set sale_number = s.sale_number from sales s where returns.sale_id = s.id and returns.sale_number is null;

-- return_items: add condition + destination + original price snapshot
alter table return_items add column if not exists condition text check (condition is null or condition in ('SEALED','OPENED','DAMAGED','CONTAMINATED','EXPIRED','NEAR_EXPIRY','QUALITY_ISSUE','OTHER'));
alter table return_items add column if not exists inventory_destination text check (inventory_destination is null or inventory_destination in ('SALEABLE','QUARANTINE','DAMAGED','EXPIRED','RECALL','DISPOSAL'));
alter table return_items add column if not exists reason_category text;
alter table return_items add column if not exists unit_price numeric(14,2);
alter table return_items add column if not exists original_discount numeric(14,2);
alter table return_items add column if not exists original_tax numeric(14,2);
alter table return_items add column if not exists batch_number text;

-- 2) Purchase returns — add GRN link + destination + credit tracking per spec 42/43
alter table purchase_returns add column if not exists grn_id uuid references goods_receipts(id) on delete set null;
alter table purchase_returns add column if not exists inventory_destination text check (inventory_destination is null or inventory_destination in ('SUPPLIER','QUARANTINE','DISPOSAL'));
alter table purchase_returns add column if not exists resolution text check (resolution is null or resolution in ('SUPPLIER_CREDIT','CASH_REFUND','REPLACEMENT','PARTIAL_CREDIT','REJECTED','WRITE_OFF'));
alter table purchase_returns add column if not exists credit_status text default 'PENDING' check (credit_status in ('NOT_APPLICABLE','PENDING','PARTIAL','COMPLETED','REJECTED'));
alter table purchase_returns add column if not exists refund_status text default 'NOT_APPLICABLE' check (refund_status in ('NOT_APPLICABLE','PENDING','PARTIAL','COMPLETED','REJECTED'));
alter table purchase_returns add column if not exists operation_id text unique;
alter table purchase_returns add column if not exists submitted_at timestamptz;
alter table purchase_returns add column if not exists completed_at timestamptz;
alter table purchase_returns add column if not exists dispatched_at timestamptz;
alter table purchase_returns add column if not exists supplier_received_at timestamptz;
alter table purchase_returns add column if not exists reason_category text;
alter table purchase_returns add column if not exists grn_number text;
-- expand status to include draft/submitted/pending_approval/processing per spec 40
alter table purchase_returns drop constraint if exists purchase_returns_status_check;
alter table purchase_returns add constraint purchase_returns_status_check check (status in ('draft','pending','submitted','pending_approval','approved','processing','completed','rejected','cancelled'));

-- purchase_return_items: add expiry + condition tracking
alter table purchase_return_items add column if not exists expiry_date date;
alter table purchase_return_items add column if not exists batch_number text;
alter table purchase_return_items add column if not exists condition text;

-- 3) Refunds — link to returns already, ensure branch scoping + operation_id
alter table refunds add column if not exists operation_id text unique;
alter table refunds add column if not exists return_number text;
update refunds r set return_number = ret.return_number from returns ret where r.return_id = ret.id and r.return_number is null;

-- 4) Indexes for fast search (spec 6) — return_number/sale/grn/supplier/product/batch
create index if not exists idx_returns_return_number on returns(return_number);
create index if not exists idx_returns_sale_id on returns(sale_id);
create index if not exists idx_returns_status on returns(status);
create index if not exists idx_returns_refund_status on returns(refund_status);
create index if not exists idx_returns_branch on returns(branch_id);
create index if not exists idx_returns_created_at on returns(created_at desc);
create index if not exists idx_returns_operation_id on returns(operation_id) where operation_id is not null;
create index if not exists idx_return_items_batch on return_items(batch_id);
create index if not exists idx_return_items_product on return_items(product_id);
create index if not exists idx_purchase_returns_operation on purchase_returns(operation_id) where operation_id is not null;
create index if not exists idx_purchase_returns_grn on purchase_returns(grn_id) where grn_id is not null;
create index if not exists idx_refunds_operation on refunds(operation_id) where operation_id is not null;

-- 5) Updated_at triggers
drop trigger if exists trg_returns_updated_at on returns;
create trigger trg_returns_updated_at before update on returns for each row execute function handle_updated_at();
drop trigger if exists trg_purchase_returns_updated_at on purchase_returns;
create trigger trg_purchase_returns_updated_at before update on purchase_returns for each row execute function handle_updated_at();

-- 6) RLS — ensure returns org/branch isolation (if not already)
alter table returns enable row level security;
drop policy if exists org_branch_isolation_returns on returns;
create policy org_branch_isolation_returns on returns for all using (organization_id = get_user_org_id() and branch_id in (select get_user_branch_ids()));
drop policy if exists org_isolation_return_items on return_items;
create policy org_isolation_return_items on return_items for all using (return_id in (select id from returns where organization_id = get_user_org_id()));

-- 7) Helper function generate_return_number daily sequence (server-authoritative per spec 8)
create or replace function generate_return_number() returns trigger as $$
declare v_date text; v_seq int; v_last text;
begin
  if new.return_number is not null and length(trim(new.return_number))>0 then return new; end if;
  v_date := to_char(coalesce(new.created_at, now()), 'YYYYMMDD');
  select return_number into v_last from returns where return_number like 'RET-'||v_date||'-%' order by return_number desc limit 1;
  if v_last is null then v_seq:=1; else v_seq:= substring(v_last from 14 for 6)::int + 1; end if;
  new.return_number := 'RET-'||v_date||'-'||lpad(v_seq::text,6,'0');
  return new;
end; $$ language plpgsql;
drop trigger if exists trg_return_number on returns;
create trigger trg_return_number before insert on returns for each row execute function generate_return_number();

-- Purchase return number already PR-xxx via app; add trigger for consistency
create or replace function generate_purchase_return_number() returns trigger as $$
declare v_date text; v_seq int; v_last text;
begin
  if new.return_number is not null and length(trim(new.return_number))>0 then return new; end if;
  v_date := to_char(coalesce(new.created_at, now()), 'YYYYMMDD');
  select return_number into v_last from purchase_returns where return_number like 'PR-'||v_date||'-%' order by return_number desc limit 1;
  if v_last is null then v_seq:=1; else v_seq:= substring(v_last from 13 for 6)::int + 1; end if;
  new.return_number := 'PR-'||v_date||'-'||lpad(v_seq::text,6,'0');
  return new;
end; $$ language plpgsql;
drop trigger if exists trg_pr_number on purchase_returns;
create trigger trg_pr_number before insert on purchase_returns for each row execute function generate_purchase_return_number();

-- 8) Permissions per spec 64
insert into permissions (code, name, description) values ('returns.view','View Returns','Can view returns') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.create','Create Returns','Can create returns') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.submit','Submit Returns','Can submit returns for approval') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.approve','Approve Returns','Can approve returns') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.reject','Reject Returns','Can reject returns') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.post','Post Returns','Can post/complete returns') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.cancel','Cancel Returns','Can cancel returns') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.refund','Process Refunds','Can process refunds') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.supplier_credit','Process Supplier Credit','Can process supplier credits') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.export','Export Returns','Can export returns') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.view_financials','View Return Financials','Can view refund/credit amounts') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('returns.view_all_branches','View All Branch Returns','Can view returns across branches') on conflict (code) do nothing;
