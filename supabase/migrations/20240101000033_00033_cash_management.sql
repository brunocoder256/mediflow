-- Migration 00033: Cash Management - registers, sessions, movements
-- Phase 4: Real-world cash handling

-- Cash registers per branch
create table if not exists cash_registers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, branch_id, code)
);

-- Cash sessions - cashier opening/closing
create table if not exists cash_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  register_id uuid not null references cash_registers(id) on delete restrict,
  cashier_id uuid not null references profiles(id) on delete restrict,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSING','CLOSED','APPROVAL_REQUIRED','APPROVED')),
  opening_float numeric(14,2) not null default 0 check (opening_float >= 0),
  expected_cash numeric(14,2) not null default 0,
  closing_cash numeric(14,2),
  cash_variance numeric(14,2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cash movements - every cash event auditable
create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  session_id uuid not null references cash_sessions(id) on delete cascade,
  type text not null check (type in ('OPENING_FLOAT','SALE','REFUND','CASH_IN','CASH_OUT','ADJUSTMENT','CLOSING_ADJUSTMENT')),
  amount numeric(14,2) not null check (amount <> 0),
  direction text not null check (direction in ('IN','OUT')),
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_registers_org_branch on cash_registers(organization_id, branch_id);
create index if not exists idx_cash_sessions_org_branch on cash_sessions(organization_id, branch_id);
create index if not exists idx_cash_sessions_register on cash_sessions(register_id);
create index if not exists idx_cash_sessions_cashier on cash_sessions(cashier_id);
create index if not exists idx_cash_sessions_status on cash_sessions(status);
create index if not exists idx_cash_movements_session on cash_movements(session_id);
create index if not exists idx_cash_movements_type on cash_movements(type);
create index if not exists idx_cash_movements_created_at on cash_movements(created_at);

-- Only one OPEN session per register
create unique index if not exists uq_cash_sessions_one_open_per_register on cash_sessions(register_id) where status = 'OPEN';

-- Triggers for updated_at
create or replace function handle_cash_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_cash_registers_updated_at on cash_registers;
create trigger trg_cash_registers_updated_at before update on cash_registers for each row execute function handle_cash_updated_at();
drop trigger if exists trg_cash_sessions_updated_at on cash_sessions;
create trigger trg_cash_sessions_updated_at before update on cash_sessions for each row execute function handle_cash_updated_at();

-- RLS
alter table cash_registers enable row level security;
alter table cash_sessions enable row level security;
alter table cash_movements enable row level security;

drop policy if exists cash_registers_org_branch on cash_registers;
create policy cash_registers_org_branch on cash_registers for all using (
  organization_id = get_user_org_id() and branch_id in (select get_user_branch_ids())
);
drop policy if exists cash_sessions_org_branch on cash_sessions;
create policy cash_sessions_org_branch on cash_sessions for all using (
  organization_id = get_user_org_id() and branch_id in (select get_user_branch_ids())
);
drop policy if exists cash_movements_org_branch on cash_movements;
create policy cash_movements_org_branch on cash_movements for all using (
  organization_id = get_user_org_id() and branch_id in (select get_user_branch_ids())
);

comment on table cash_registers is 'Physical cash registers per branch';
comment on table cash_sessions is 'Cashier opening/closing sessions with reconciliation';
comment on table cash_movements is 'Auditable cash movements: floats, sales, refunds, in/out';
