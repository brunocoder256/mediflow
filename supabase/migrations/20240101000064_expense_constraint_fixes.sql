-- Migration 00064: Expense constraint fixes
-- The legacy expenses.status check only allowed PENDING/APPROVED/REJECTED/CANCELLED,
-- but the expense workflow writes DRAFT and REVERSED too. The payment_method check
-- also omitted PETTY_CASH, which the UI offers. Both caused inserts/updates to fail.

-- 1) Drop any legacy check constraint that targets the standalone status column
--    (but not approval_status / payment_status / posting_status).
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~ '\mstatus\M'
      and pg_get_constraintdef(oid) !~ '(approval|payment|posting)_status'
  loop
    execute format('alter table public.expenses drop constraint %I', c.conname);
  end loop;
end $$;

-- 2) Normalize any rows whose legacy status is null or outside the workflow values.
update public.expenses
set status = case
  when approval_status = 'PENDING_APPROVAL' then 'PENDING'
  when approval_status in ('DRAFT','APPROVED','REJECTED','CANCELLED','REVERSED') then approval_status
  else coalesce(status, 'DRAFT')
end
where status is null
   or status not in ('DRAFT','PENDING','PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED','REVERSED');

-- 3) Allow every status the expense workflow can produce.
alter table public.expenses drop constraint if exists expenses_status_check;
alter table public.expenses
  add constraint expenses_status_check
  check (status in ('DRAFT','PENDING','PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED','REVERSED'));

-- 4) Allow PETTY_CASH, which the expense UI and service already support.
alter table public.expenses drop constraint if exists expenses_payment_method_check;
alter table public.expenses
  add constraint expenses_payment_method_check
  check (payment_method in ('CASH','MOBILE_MONEY','CARD','BANK','PETTY_CASH','OTHER'));
