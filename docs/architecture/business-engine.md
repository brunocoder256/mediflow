# MediFlow Business Engine Architecture

## 1. Overview
MediFlow transforms from secured UI foundation to functional Drug Shop Management System.
Core engine covers Products, Batches, Inventory, Stock Movements, Stock Counts, Purchasing, POS, Sales, Payments, Returns, Expenses, Customers, Suppliers, Reports, Audit.

Pattern for every transaction:
```
UI -> Form Validation (Zod) -> Server Action / Route -> Authorization (RLS) -> Business Service -> DB Transaction -> Audit -> Result
```
Browser never authoritative for price/cost/stock/totals/discount/tax/permissions/org/branch/profit/payment status.

## 2. Stock Model
- `products` catalog with generic_name, brand_name, SKU, barcode, category, unit, reorder_level.
- `product_batches` per (product, branch) with batch_number, expiry_date, purchase_price, selling_price, quantity_received, quantity_available, supplier_id.
- `stock_movements` immutable ledger: PURCHASE, SALE, SALE_RETURN, PURCHASE_RETURN, ADJUSTMENT_IN/OUT, TRANSFER_IN/OUT, OPENING_BALANCE, EXPIRED, DAMAGED. Every quantity change has a movement.
- Current stock = sum(quantity_available) across eligible batches + ledger for audit. Movement explains why.

## 3. Transaction Model
- Sale atomically creates: sales, sale_items (with batch_id), payments, stock_movements, batch quantity changes, audit log. If any fails -> ROLLBACK.
- Purchase: purchase_orders (DRAFT->ORDERED->PARTIALLY_RECEIVED->RECEIVED) -> receiving creates batches + movements. Creating PO does NOT increase stock.
- Return: references original sale, validates quantity <= sold - already_returned, distinguishes SELLABLE vs DAMAGED.
- Void: controlled reversal, never delete completed sale.

## 4. Batch Model & FEFO
- Multiple batches per product, each with own cost/price/expiry.
- Expiry classification: NORMAL / EXPIRING_SOON (configurable days) / EXPIRED. Server rejects expired.
- FEFO: sale selects earliest valid expiry first (branch_id, product_id, expiry_date index).

## 5. COGS & Valuation
- COGS = sum(batch quantity * batch purchase_price) per sale_items, retained historically.
- Inventory Value = sum(batch quantity_available * purchase_price) (never selling_price).
- Gross Profit = Net Sales - COGS; Net Profit = Gross Profit - Expenses.

## 6. Stock Counts
Lifecycle: DRAFT -> IN_PROGRESS -> COUNTED -> REVIEW -> APPROVED -> POSTED -> CANCELLED. Item captures system_quantity, counted_quantity, variance = counted - system. Approval requires permission, records who/when/reason, becomes immutable after POSTED.

## 7. Financial Calculations
Centralized in `src/lib/calculations.ts`: calcLineSubtotal, calcSaleTotal, calcCOGS, calcGrossProfit, calcNetProfit, calcInventoryValue, roundToCents. Server recalculates all totals; UI may estimate for responsiveness.

## 8. Authorization
RLS on all tables (org_isolation_*, branch_isolation_*). Permissions: dashboard.view, pos.use, products.*, sales.*, purchases.*, inventory.*, reports.view, etc. Server-side checks mandatory.

## 9. Audit
Append-only audit_logs for every business action (PRODUCT_CREATED, BATCH_RECEIVED, SALE_COMPLETED, SALE_VOIDED, etc.). Immutable history; corrections via reversals/adjustments.

## 10. Transaction Boundaries & Idempotency
Use PostgreSQL functions/RPC or single server transaction (BEGIN...COMMIT). Operation `operation_id` on sync_queue for idempotent POS/offline sync. Duplicate sale rejected if operation_id exists.

## 11. Concurrency
Atomic batch decrement: `UPDATE product_batches SET quantity_available = quantity_available - qty WHERE id=... AND quantity_available >= qty`. Second concurrent sale fails. Never client-read-modify-write.

## 12. Extensions Deferred
- cash_registers/cash_sessions (foundation in suppliers/branches)
- price_history (added as new table)
- Full EFRIS (architecture prepared, not claimed)
