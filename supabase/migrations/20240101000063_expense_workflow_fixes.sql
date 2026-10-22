-- Migration 00063: Expense workflow fixes
-- Expand approval/action checks to support REVERSED, CREATED, REOPENED flows
-- Tighten uniqueness and ensure idempotency/org-scoped safety

-- 1) expenses.approval_status: allow REVERSED
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.expenses'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%approval_status%';

  if cname is not null then
    execute format('alter table public.expenses drop constraint %I', cname);
  end if;
end $$;

alter table public.expenses
  add constraint expenses_approval_status_check
  check (approval_status in ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED','REVERSED'));

-- 2) expense_approvals.action: allow CREATED, REOPENED, etc
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.expense_approvals'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%action%';

  if cname is not null then
    execute format('alter table public.expense_approvals drop constraint %I', cname);
  end if;
end $$;

alter table public.expense_approvals
  add constraint expense_approvals_action_check
  check (action in ('CREATED','SUBMITTED','APPROVED','REJECTED','CANCELLED','REVERSED','PAID','POSTED','REOPENED'));

-- 3) Ensure idempotency org uniqueness exists (defensive)
create unique index if not exists uq_expenses_idempotency_org
  on public.expenses(organization_id, idempotency_key)
  where idempotency_key is not null;

-- 4) Ensure expense_number per org unique
create unique index if not exists uq_expenses_expense_number_org
  on public.expenses(organization_id, expense_number)
  where expense_number is not null;

-- 5) Backfill status consistency for safety
update public.expenses
set status = coalesce(status, approval_status)
where status is null and approval_status is not null;

update public.expenses
set posting_status = case
  when approval_status = 'REVERSED' then 'REVERSED'
  when approval_status = 'APPROVED' and posting_status = 'UNPOSTED' then 'POSTED'
  else posting_status
end
where posting_status is not null;
