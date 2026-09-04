-- Migration 00042: Suppliers Master Upgrade — pharmacy production-grade supplier management
-- Audits existing suppliers table and extends to full business entity per docs/supplier.md
-- Safe/idempotent: IF NOT EXISTS checks everywhere, preserves data

-- 1) Extend suppliers with all missing master fields
alter table suppliers add column if not exists supplier_code text;
alter table suppliers add column if not exists trading_name text;
alter table suppliers add column if not exists supplier_type text default 'Pharmaceutical distributor' check (supplier_type in ('Pharmaceutical distributor','Wholesaler','Manufacturer','Medical equipment supplier','Laboratory supplier','General supplier','Other'));
alter table suppliers add column if not exists supplier_category text;
alter table suppliers add column if not exists description text;
-- Contact extended
alter table suppliers add column if not exists contact_role text;
alter table suppliers add column if not exists phone_alt text;
alter table suppliers add column if not exists email_alt text;
alter table suppliers add column if not exists physical_address text;
alter table suppliers add column if not exists postal_address text;
alter table suppliers add column if not exists city text;
alter table suppliers add column if not exists region text;
alter table suppliers add column if not exists country text default 'Uganda';
alter table suppliers add column if not exists website text;
-- Business / regulatory
alter table suppliers add column if not exists business_registration_number text;
alter table suppliers add column if not exists tin text;
alter table suppliers add column if not exists licence_number text;
alter table suppliers add column if not exists licence_expiry_date date;
alter table suppliers add column if not exists verification_status text default 'Unverified' check (verification_status in ('Unverified','Pending','Verified','Rejected'));
alter table suppliers add column if not exists verification_date date;
alter table suppliers add column if not exists regulatory_notes text;
-- Commercial terms
alter table suppliers add column if not exists payment_terms text default '30 Days';
alter table suppliers add column if not exists credit_terms text;
alter table suppliers add column if not exists credit_limit numeric(14,2) default 0;
alter table suppliers add column if not exists currency text default 'UGX' check (currency in ('UGX','USD','KES','TZS','RWF','EUR','GBP'));
alter table suppliers add column if not exists default_discount numeric(5,2) default 0;
alter table suppliers add column if not exists tax_treatment text;
alter table suppliers add column if not exists minimum_order_value numeric(14,2) default 0;
alter table suppliers add column if not exists minimum_order_quantity integer default 0;
alter table suppliers add column if not exists lead_time_days integer;
alter table suppliers add column if not exists delivery_terms text;
alter table suppliers add column if not exists preferred_payment_method text check (preferred_payment_method is null or preferred_payment_method in ('CASH','MOBILE_MONEY','BANK','CARD','OTHER'));
alter table suppliers add column if not exists account_reference text;
alter table suppliers add column if not exists commercial_notes text;
-- Status extended (active + suspended/under_review)
alter table suppliers add column if not exists status text default 'Active' check (status in ('Active','Inactive','Suspended','Under Review'));
-- branch availability handled via supplier_branches junction below, keep is_active for backward compat and sync with status
alter table suppliers add column if not exists created_by uuid references profiles(id) on delete set null;
alter table suppliers add column if not exists updated_by uuid references profiles(id) on delete set null;

-- Ensure existing rows have status synced from is_active
update suppliers set status = case when is_active = false then 'Inactive' else coalesce(status,'Active') end where status is null or status not in ('Active','Inactive','Suspended','Under Review');
update suppliers set supplier_type = coalesce(supplier_type,'Pharmaceutical distributor');
update suppliers set country = coalesce(country,'Uganda');
update suppliers set currency = coalesce(currency,'UGX');

-- Supplier code generation trigger (SUP-YYYYMMDD-XXXX daily)
create or replace function generate_supplier_code() returns trigger as $$
declare v_date text; v_seq int; v_last text;
begin
  if new.supplier_code is not null and length(trim(new.supplier_code))>0 then return new; end if;
  v_date := to_char(coalesce(new.created_at, now()), 'YYYYMMDD');
  select supplier_code into v_last from suppliers where supplier_code like 'SUP-'||v_date||'-%' order by supplier_code desc limit 1;
  if v_last is null then v_seq := 1; else v_seq := substring(v_last from 13 for 4)::int + 1; end if;
  new.supplier_code := 'SUP-'||v_date||'-'||lpad(v_seq::text,4,'0');
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_supplier_code on suppliers;
create trigger trg_supplier_code before insert on suppliers for each row execute function generate_supplier_code();

create index if not exists idx_suppliers_org on suppliers(organization_id);
create index if not exists idx_suppliers_code on suppliers(supplier_code) where supplier_code is not null;
create index if not exists idx_suppliers_name on suppliers(name);
create index if not exists idx_suppliers_status on suppliers(status);
create index if not exists idx_suppliers_type on suppliers(supplier_type);
create index if not exists idx_suppliers_city on suppliers(city) where city is not null;
create index if not exists idx_suppliers_phone on suppliers(phone) where phone is not null;
create unique index if not exists uq_suppliers_org_code on suppliers(organization_id, supplier_code) where supplier_code is not null and supplier_code <> '';

-- updated_at trigger
drop trigger if exists trg_suppliers_updated_at on suppliers;
create trigger trg_suppliers_updated_at before update on suppliers for each row execute function handle_updated_at();

-- 2) Supplier branches junction (multi-branch support)
create table if not exists supplier_branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  is_active boolean not null default true,
  is_default_receiving boolean not null default false,
  created_at timestamptz not null default now(),
  unique(supplier_id, branch_id)
);
alter table supplier_branches enable row level security;
drop policy if exists org_isolation_supplier_branches on supplier_branches;
create policy org_isolation_supplier_branches on supplier_branches for all using (organization_id = get_user_org_id() and branch_id in (select get_user_branch_ids()));
create index if not exists idx_supplier_branches_supplier on supplier_branches(supplier_id);
create index if not exists idx_supplier_branches_branch on supplier_branches(branch_id);

-- 3) Extend product_suppliers to full supplier catalogue / pricing (per spec sections 12-15)
alter table product_suppliers add column if not exists supplier_price numeric(14,2);
alter table product_suppliers add column if not exists current_price numeric(14,2);
alter table product_suppliers add column if not exists average_price numeric(14,2);
alter table product_suppliers add column if not exists pack_size integer;
alter table product_suppliers add column if not exists supplier_sku text;
alter table product_suppliers add column if not exists is_active boolean default true;
alter table product_suppliers add column if not exists last_purchased_at timestamptz;
alter table product_suppliers add column if not exists purchase_frequency integer default 0;

-- 4) Supplier price history (per supplier-product, preserves historical cost per spec 14)
create table if not exists supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  price numeric(14,2) not null,
  effective_date date not null default current_date,
  purchase_order_id uuid references purchase_orders(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table supplier_price_history enable row level security;
drop policy if exists org_isolation_supplier_price_history on supplier_price_history;
create policy org_isolation_supplier_price_history on supplier_price_history for all using (organization_id = get_user_org_id());
create index if not exists idx_supplier_price_history_supplier_product on supplier_price_history(supplier_id, product_id);
create index if not exists idx_supplier_price_history_date on supplier_price_history(effective_date desc);

-- 5) Supplier documents (reuse purchase_attachments if exists but keep separate for agreements/licences per spec 28)
create table if not exists supplier_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size integer,
  mime_type text,
  document_type text not null check (document_type in ('AGREEMENT','LICENCE','CERTIFICATE','PRICE_LIST','CONTRACT','STATEMENT','INVOICE','DELIVERY_NOTE','OTHER')),
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table supplier_documents enable row level security;
drop policy if exists org_isolation_supplier_documents on supplier_documents;
create policy org_isolation_supplier_documents on supplier_documents for all using (organization_id = get_user_org_id());
create index if not exists idx_supplier_documents_supplier on supplier_documents(supplier_id);

-- 6) Supplier notes / communication history (per spec 29)
create table if not exists supplier_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  note text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table supplier_notes enable row level security;
drop policy if exists org_isolation_supplier_notes on supplier_notes;
create policy org_isolation_supplier_notes on supplier_notes for all using (organization_id = get_user_org_id());
create index if not exists idx_supplier_notes_supplier on supplier_notes(supplier_id);

-- 7) Supplier activity timeline materialized via audit_logs already; add helper view for supplier KPI aggregation
-- Supplier balance helper: get_supplier_balance already referenced in suppliers API — ensure it exists (transaction-derived)
drop function if exists get_supplier_balance(uuid, uuid) cascade;
create or replace function get_supplier_balance(p_supplier_id uuid, p_org_id uuid)
returns table(balance numeric) language sql stable security definer as $$
  select coalesce(
    (select coalesce(sum(total),0) from purchase_orders where supplier_id = p_supplier_id and organization_id = p_org_id and status not in ('CANCELLED','DRAFT'))
    - coalesce((select sum(amount) from supplier_payments where supplier_id = p_supplier_id and organization_id = p_org_id),0)
    - coalesce((select sum(total) from purchase_returns where supplier_id = p_supplier_id and organization_id = p_org_id and status in ('approved','completed')),0)
  ,0)::numeric as balance;
$$;

-- 8) Helper for supplier performance (delivery / fulfillment) — simple view via purchase_orders + goods_receipts
-- No extra table; performance computed on read from purchase_orders status + expected vs received dates

-- Permissions for supplier management (RBAC per spec 35)
insert into permissions (code, name, description) values ('suppliers.view','View Suppliers','Can view suppliers') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.create','Create Suppliers','Can create suppliers') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.edit','Edit Suppliers','Can edit suppliers') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.deactivate','Deactivate Suppliers','Can deactivate suppliers') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.delete','Delete Suppliers','Can delete suppliers without history') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.view_financials','View Supplier Financials','Can view supplier balances and statements') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.view_prices','View Supplier Prices','Can view supplier pricing') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.create_purchase_order','Create PO from Supplier','Can create purchase order from supplier') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.create_return','Create Supplier Return','Can create supplier return') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.record_payment','Record Supplier Payment','Can record supplier payment') on conflict (code) do nothing;
insert into permissions (code, name, description) values ('suppliers.export','Export Suppliers','Can export supplier data') on conflict (code) do nothing;

comment on table supplier_branches is 'Branch availability per supplier (multi-branch support per spec 34)';
comment on table supplier_price_history is 'Historical supplier price per product, never overwrites PO/GRN historical cost';
comment on table supplier_documents is 'Supplier agreements/licences/price lists — reuses storage bucket, metadata table';
comment on table supplier_notes is 'Internal notes per supplier with audit user';
comment on function get_supplier_balance is 'Transaction-derived balance = purchases - payments - returns (spec 23)';

-- Seed example supplier types already defaulted
do $$ begin
  perform 1;
end $$;
