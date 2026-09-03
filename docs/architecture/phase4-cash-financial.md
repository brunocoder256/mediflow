# Phase 4: Cash, Financial & Operational Architecture

## Cash Management
- **cash_registers** (org, branch, code unique per branch, active)
- **cash_sessions** (OPEN, CLOSING, CLOSED, APPROVAL_REQUIRED, APPROVED) one OPEN per register enforced by partial unique index
- **cash_movements** (OPENING_FLOAT, SALE, REFUND, CASH_IN, CASH_OUT, ADJUSTMENT, CLOSING_ADJUSTMENT) with direction IN/OUT, auditable
- `expected = opening + cashSales + cashIn - cashOut - refunds; variance = actual - expected; threshold UGX 5k requires manager approval`

## Payment Reconciliation
- `payments.provider`, `payments.reconciliation_status` (UNRECONCILED/MATCHED/RECONCILED/DISPUTED/CANCELLED), `payments.session_id`, `payer_reference`
- Mobile money extensible: provider + reference, no fake integration
- Reports use `sales_payment_summary` view

## Price History
- `price_history` preserves old/new, field_name purchase_price/selling_price, changed_by, reason, effective_date; sales history immutable

## Disposals
- `disposals` (EXPIRED/DAMAGED/OTHER) PENDING->APPROVED->DISPOSED, creates EXPIRED/DAMAGED stock_movements, batch decrement only after approval

## Supplier Payables
- `supplier_payments` + `get_supplier_balance(p_supplier_id, p_org_id)` = purchases - payments - returns (transaction-derived, never manual)

## Transfers
- Lifecycle DRAFT->REQUESTED->APPROVED->IN_TRANSIT->RECEIVED; stock leaves on ship (TRANSFER_OUT), arrives on receive (TRANSFER_IN), explicit transactional

## Financial Reporting
- `inventory_valuation` view, `getInventoryValuation`, `getCOGSReport` (historical batch.purchase_price), `getNetProfitReport` (grossProfit - expenses), `getExpenseSummary`, `getSalesReport`, `getStaffReport`
- Formulas centralized in `src/lib/calculations.ts` and `src/lib/services/financial.ts`

## Security
- RLS on all new tables via `get_user_org_id()` + `get_user_branch_ids()`
- Permissions: cash.manage, cash.approve, stock.transfer/dispose, price.change, supplier.pay, expense.approve (seeded in migration 00035)
- Append-only audit via `createAuditLog`, no UPDATE/DELETE on audit_logs

## Offline & Idempotency
- `sync_queue.operation_id` unique; clients generate UUID, retry safe
- `checkDuplicateOperation` guards pendingSales; cash/sale/transfer reject duplicate operation_id

## Receipts
- `src/components/receipt.tsx` 58mm/80mm thermal + browser print, organization/branch/contact/receipt_number/date/cashier/items/discount/tax/total/payment/footer + EFRIS placeholder
