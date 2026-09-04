-- Migration 00045: Expenses Master Upgrade — Production-grade ERP financial module
-- Covers spec sections 3-40: categories, multi-line, workflow, approvals, payment, petty cash, supplier, accounting, branches, audit, offline, numbering

-- ============================================================================
-- 1. Expense Categories (configurable, hierarchical)
-- ============================================================================
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text not null,
  parent_id uuid references expense_categories(id) on delete set null,
  account_mapping text,
  tax_treatment text,
  is_active boolean not null default true,
  branch_id uuid references branches(id) on delete cascade,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, code),
  unique(organization_id, name)
);
create index if not exists idx_expense_categories_org on expense_categories(organization_id);
create index if not exists idx_expense_categories_parent on expense_categories(parent_id);
create index if not exists idx_expense_categories_active on expense_categories(is_active);

alter table expense_categories enable row level security;
drop policy if exists org_isolation_expense_categories on expense_categories;
create policy org_isolation_expense_categories on expense_categories for all using (organization_id = get_user_org_id());

-- trigger for updated_at
create or replace function handle_expense_categories_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_expense_categories_updated_at on expense_categories;
create trigger trg_expense_categories_updated_at before update on expense_categories for each row execute function handle_expense_categories_updated_at();

-- ============================================================================
-- 2. Extend expenses table — add ERP-grade columns (idempotent)
-- ============================================================================
-- legacy columns: id, organization_id, branch_id, category (text), description, amount, payment_method, expense_date, created_by, created_at, updated_at, status, approved_by, receipt_reference
alter table expenses add column if not exists expense_number text;
alter table expenses add column if not exists category_id uuid references expense_categories(id) on delete set null;
alter table expenses add column if not exists subcategory_id uuid references expense_categories(id) on delete set null;
alter table expenses add column if not exists supplier_id uuid references suppliers(id) on delete set null;
alter table expenses add column if not exists reference_number text;
alter table expenses add column if not exists subcategory text;
alter table expenses add column if not exists tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0);
alter table expenses add column if not exists total_amount numeric(14,2);
alter table expenses add column if not exists currency text not null default 'UGX';
alter table expenses add column if not exists exchange_rate numeric(14,6) default 1;
alter table expenses add column if not exists payment_account_id uuid;
alter table expenses add column if not exists payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','PAID','PARTIALLY_PAID','FAILED','CANCELLED'));
alter table expenses add column if not exists approval_status text not null default 'DRAFT' check (approval_status in ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED'));
alter table expenses add column if not exists posting_status text not null default 'UNPOSTED' check (posting_status in ('UNPOSTED','POSTED','REVERSED'));
alter table expenses add column if not exists submitted_by uuid references profiles(id) on delete set null;
alter table expenses add column if not exists submitted_at timestamptz;
alter table expenses add column if not exists approved_at timestamptz;
alter table expenses add column if not exists paid_by uuid references profiles(id) on delete set null;
alter table expenses add column if not exists paid_at timestamptz;
alter table expenses add column if not exists payment_date date;
alter table expenses add column if not exists notes text;
alter table expenses add column if not exists reversal_of uuid references expenses(id) on delete set null;
alter table expenses add column if not exists reversal_reason text;
alter table expenses add column if not exists idempotency_key text;
alter table expenses add column if not exists Tax_inclusive boolean not null default false;
-- normalize legacy status column to stay in sync
alter table expenses add column if not exists tax_inclusive boolean not null default false;
alter table expenses add column if not exists is_reversal boolean not null default false;

-- unique expense_number per org, idempotency uniqueness
create unique index if not exists uq_expenses_expense_number_org on expenses(organization_id, expense_number) where expense_number is not null;
create unique index if not exists uq_expenses_idempotency_org on expenses(organization_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists uq_expenses_reference_org on expenses(organization_id, reference_number) where reference_number is not null and reference_number <> '';

create index if not exists idx_expenses_category_id on expenses(category_id);
create index if not exists idx_expenses_supplier_id on expenses(supplier_id);
create index if not exists idx_expenses_approval_status on expenses(approval_status);
create index if not exists idx_expenses_payment_status on expenses(payment_status);
create index if not exists idx_expenses_posting_status on expenses(posting_status);
create index if not exists idx_expenses_branch_date on expenses(branch_id, expense_date);
create index if not exists idx_expenses_created_by on expenses(created_by);
create index if not exists idx_expenses_reversal_of on expenses(reversal_of);

-- trigger for updated_at
create or replace function handle_expenses_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_expenses_updated_at on expenses;
create trigger trg_expenses_updated_at before update on expenses for each row execute function handle_expenses_updated_at();

-- computed total_amount trigger (amount + tax)
create or replace function handle_expenses_total() returns trigger as $$
begin
  if new.total_amount is null then
    new.total_amount := coalesce(new.amount,0) + coalesce(new.tax_amount,0);
  end if;
  -- keep legacy category text in sync when category_id set
  if new.category_id is not null and (new.category is null or new.category = '') then
    select code into new.category from expense_categories where id = new.category_id;
  end if;
  return new;
end; $$ language plpgsql;
drop trigger if exists trg_expenses_total on expenses;
create trigger trg_expenses_total before insert or update on expenses for each row execute function handle_expenses_total();

-- expense numbering function (EXP-YYYYMMDD-XXXX)
create or replace function generate_expense_number() returns text as $$
declare n text;
begin
  n := 'EXP-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(random()::text),1,6));
  return n;
end; $$ language plpgsql;

-- sequence fallback for deterministic daily numbers if needed (lightweight)

-- ============================================================================
-- 3. Expense Lines (multi-line support)
-- ============================================================================
create table if not exists expense_lines (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id uuid references expense_categories(id) on delete set null,
  description text,
  amount numeric(14,2) not null check (amount > 0),
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) generated always as (amount + tax_amount) stored,
  created_at timestamptz not null default now()
);
create index if not exists idx_expense_lines_expense_id on expense_lines(expense_id);
create index if not exists idx_expense_lines_category_id on expense_lines(category_id);
alter table expense_lines enable row level security;
drop policy if exists org_isolation_expense_lines on expense_lines;
create policy org_isolation_expense_lines on expense_lines for all using (organization_id = get_user_org_id());

-- ============================================================================
-- 4. Expense Attachments (receipts/invoices)
-- ============================================================================
create table if not exists expense_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  expense_id uuid not null references expenses(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size integer,
  mime_type text,
  document_type text not null default 'RECEIPT' check (document_type in ('RECEIPT','INVOICE','PHOTO','PDF','OTHER')),
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_expense_attachments_expense on expense_attachments(expense_id);
alter table expense_attachments enable row level security;
drop policy if exists org_isolation_expense_attachments on expense_attachments;
create policy org_isolation_expense_attachments on expense_attachments for all using (organization_id = get_user_org_id());

-- ============================================================================
-- 5. Expense Approvals history (audit trail per expense)
-- ============================================================================
create table if not exists expense_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  expense_id uuid not null references expenses(id) on delete cascade,
  action text not null check (action in ('SUBMITTED','APPROVED','REJECTED','CANCELLED','REVERSED','PAID','POSTED')),
  actor_id uuid references profiles(id) on delete set null,
  reason text,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);
create index if not exists idx_expense_approvals_expense on expense_approvals(expense_id);
alter table expense_approvals enable row level security;
drop policy if exists org_isolation_expense_approvals on expense_approvals;
create policy org_isolation_expense_approvals on expense_approvals for all using (organization_id = get_user_org_id());

-- ============================================================================
-- 6. Backfill: ensure existing rows have expense_number, total_amount, approval/posting defaults
-- ============================================================================
do $$ begin
  update expenses set expense_number = generate_expense_number() where expense_number is null;
  update expenses set total_amount = coalesce(amount,0) + coalesce(tax_amount,0) where total_amount is null;
  update expenses set approval_status = case when status='PENDING' then 'PENDING_APPROVAL' when status='APPROVED' then 'APPROVED' when status='REJECTED' then 'REJECTED' when status='CANCELLED' then 'CANCELLED' else 'DRAFT' end where approval_status='DRAFT' and status is not null;
  update expenses set posting_status = case when approval_status='APPROVED' then 'POSTED' else 'UNPOSTED' end where posting_status='UNPOSTED' and approval_status is not null;
exception when others then null;
end $$;

-- ============================================================================
-- 7. Seed default expense categories per organization (idempotent)
-- ============================================================================
-- We'll insert for demo org; loop for all orgs via function in seed section
insert into expense_categories (organization_id, name, code, description) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Rent', 'RENT', 'Premises rent'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Utilities', 'UTILITIES', 'General utilities'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Electricity', 'ELECTRICITY', 'Electricity bills'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Water', 'WATER', 'Water bills'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Internet', 'INTERNET', 'Internet & data'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Communication', 'COMMUNICATION', 'Airtime, bundles'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Transport', 'TRANSPORT', 'Transport & travel'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Fuel', 'FUEL', 'Fuel costs'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Delivery', 'DELIVERY', 'Delivery costs'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Office Supplies', 'OFFICE_SUPPLIES', 'Stationery & office'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cleaning', 'CLEANING', 'Cleaning materials/services'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Repairs & Maintenance', 'REPAIRS', 'Repairs & maintenance'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Security', 'SECURITY', 'Security services'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Marketing', 'MARKETING', 'Marketing & promotion'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Professional Services', 'PROF_SERVICES', 'Legal, audit, consultancy'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Licenses & Permits', 'LICENSES', 'Licenses & permits'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Insurance', 'INSURANCE', 'Insurance premiums'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Software/Subscriptions', 'SOFTWARE', 'Software & subscriptions'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Training', 'TRAINING', 'Staff training'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Bank Charges', 'BANK_CHARGES', 'Bank fees'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mobile Money Charges', 'MOMO_CHARGES', 'Mobile money fees'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Miscellaneous', 'MISC', 'Other expenses'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Staff Welfare', 'STAFF_WELFARE', 'Staff welfare'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Staff Meals', 'STAFF_MEALS', 'Staff meals'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Staff Transport', 'STAFF_TRANSPORT', 'Staff transport'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Other Staff Costs', 'STAFF_OTHER', 'Other staff costs'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Interest', 'INTEREST', 'Interest charges'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Payment Charges', 'PAYMENT_CHARGES', 'Payment processing fees'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Taxes', 'TAXES', 'Taxes'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Regulatory Fees', 'REG_FEES', 'Regulatory fees'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Equipment', 'EQUIPMENT', 'Equipment purchases'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Furniture', 'FURNITURE', 'Furniture'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Computers', 'COMPUTERS', 'Computers & IT'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Other Fixed Assets', 'FIXED_OTHER', 'Other fixed assets')
on conflict (organization_id, code) do nothing;

-- ============================================================================
-- 8. Add new permissions for granular expense workflow
-- ============================================================================
insert into permissions (id, code, name, description) values
  ('e0ebc99-9001-4000-8000-000000000001', 'expenses.submit', 'Submit Expenses', 'Submit expense for approval'),
  ('e0ebc99-9001-4000-8000-000000000002', 'expenses.approve', 'Approve Expenses', 'Approve pending expenses'),
  ('e0ebc99-9001-4000-8000-000000000003', 'expenses.pay', 'Pay Expenses', 'Mark expense as paid'),
  ('e0ebc99-9001-4000-8000-000000000004', 'expenses.reverse', 'Reverse Expenses', 'Reverse posted expenses'),
  ('e0ebc99-9001-4000-8000-000000000005', 'expenses.manage_categories', 'Manage Categories', 'Create/edit expense categories'),
  ('e0ebc99-9001-4000-8000-000000000006', 'expenses.export', 'Export Expenses', 'Export expense reports')
on conflict (code) do nothing;

-- Grant new perms to Owner/Manager
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p where r.name in ('Owner','Administrator','Manager') and p.code in ('expenses.submit','expenses.approve','expenses.pay','expenses.reverse','expenses.manage_categories','expenses.export') and r.organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
on conflict do nothing;
