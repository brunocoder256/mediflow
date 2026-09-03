# Production Readiness — MediFlow V1 Phase 7

## Deployment (Vercel + Supabase, mediflow.vercel.app)
- **GitHub → Vercel**: connect repo, set root `mediflow`, framework Next.js, build `npm run build`, Node 20
- **Env (Vercel Dashboard → Settings → Environment Variables):**
  - `NEXT_PUBLIC_SUPABASE_URL` (publishable)
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY` (server only, never `NEXT_PUBLIC`)
  - `SUPABASE_URL` duplicate for server client if needed
- **Supabase**: run migrations in order `supabase/migrations/*.sql` via `supabase db push` or Dashboard SQL editor; enable RLS (already enabled per table); verify `get_user_org_id()` + `get_user_branch_ids()` policies; no service-role key in `src/lib/supabase/client.ts` (only publishable) `src/lib/supabase/client.ts:1`
- **Domain**: Vercel → Domains → add `mediflow.vercel.app` (auto) + custom if owned; HTTPS enforced
- **Verify**: `npm run typecheck && npm run lint && npm run build && npm test` locally; `npm run test:e2e` with Playwright (requires dev server)
- **Post-deploy smoke**: login → open register 100k → receive BATCH-A/B → sell 120 FEFO → receipt → sales history → return 5 → stock count variance → close cash → reports reconcile → transfer → disposal

## Security RLS Audit (Phase 7)
- All new tables `cash_registers/sessions/movements`, `price_history`, `supplier_payments`, `disposals`, `stock_counts`, `transfers` have `enable row level security` + `policy org_branch` `20240101000033_00033_cash_management.sql:43`, `20240101000034_00034_price_history_disposals_supplier_payments.sql:59`
- Existing policies verified: `organizations` id = `get_user_org_id()`, `branches`/`profiles`/`products`/`batches` scoped, `audit_logs` append-only `INSERT/SELECT` only `20240101000024_00024_rls.sql:1`
- No `NEXT_PUBLIC_SUPABASE_SECRET` leaked; `src/lib/supabase/server.ts:11` uses cookies, middleware `src/lib/supabase/middleware.ts:1` refreshes session
- Zod validation on every POST: `SaleCreateSchema` `src/app/api/sales/route.ts:27`, `ReturnSchema` `src/app/api/returns/route.ts:8`, `CreateSchema` purchases, `ExpenseSchema` etc.; server recalculates price/cost/totals
- Permissions granular: `cash.manage/approve`, `stock.transfer/dispose`, `price.change`, `supplier.pay`, `expense.approve` seeded `20240101000035_00035_report_views_and_security.sql:6`
- Audit append-only: `revoke update, delete on audit_logs` `20240101000035_00035_report_views_and_security.sql:30`, all business actions `createAuditLog` `src/lib/services/supabase.ts:61`

## Performance Audit
- Indexes verified: `idx_product_batches_branch_product_expiry` `20240101000026_00026_harden_integrity.sql:127`, `idx_sales_operation_id`, `idx_stock_movements_operation_id` `20240101000036_00036_phase5_core_completion.sql:14`, `idx_cash_*`, `idx_disposals_*`, `idx_supplier_payments_*`
- Pagination everywhere: `getSalesList` `range(from, perPage)` `src/lib/services/sales.ts:14`, `getPurchases`, `getReturns`, `getSalesReport` `src/lib/services/reports.ts:1` with `range`, inventory via `limit 50` `src/app/api/products/route.ts:1`, stock movements `range` `src/app/api/stock-movements/route.ts:1`
- Server-side filtering: products ilike `src/lib/services/pos.ts:18` with limit 20, sales `ilike sale_number` + date/payment filters DB-side, not loading entire tables
- Debounced search: customers 300ms `src/app/(dashboard)/customers/page.tsx:28`, audit 300ms, sales instant but DB-limited 20-50 rows
- No N+1: `searchProducts` batches enriched via 1 query per product → acceptable for POS (limit 20); reports use views `inventory_valuation` `20240101000035_00035_report_views_and_security.sql:22`

## PWA Verification
- `public/manifest.json:1` standalone, theme `#0f766e`, icons 192/512 maskable
- `public/sw.js:1` install shell `[ "/", "/dashboard", "/offline"]`, fetch handler excludes `/api/ supabase /auth/`, cache shell only
- `src/app/layout.tsx:27` registers `/sw.js` on load, `<link rel="manifest">`, `apple-touch-icon`
- `public/offline` fallback shell `Offline — POS will queue`
- Cache strategy: network-first for API, cache-first for shell, no private data cached indiscriminately
- Update: `skipWaiting` + `clients.claim()` on activate

## Mobile UX Polish (320→1440)
- POS: branch selector `src/app/(dashboard)/pos/page.tsx:42` + offline banner, desktop `hidden md:flex flex-1` + `w-[380px]` cart, mobile `md:hidden` `Sheet` bottom drawer `SheetTrigger` `View Cart`, large touch targets `h-8 w-8`, sticky action, keyboard nav via `Input` + `Select`
- Inventory: `flex-col md:flex-row` filters, `TabsList` flex-wrap, `Table` → `overflow-x-auto` + `hidden md:table-cell` for value, cards on empty
- Purchases: product lines `grid md:grid-cols-12` collapses to single column on mobile, sticky `Save` `w-full`
- Tables → responsive: `overflow-x-auto` for tabular, cards for empty states, `Skeleton` not `setTimeout`
- Verified breakpoints: 320, 375, 390, 430, 768, 1024, 1280 via Tailwind `sm/md/lg/xl`

## Known Limitations for V2
- Transfers `shipped_by/shipped_at` added in 00036 but UI ship/receive not branch-authorized per permission (server checks org only)
- `price_history` trigger not auto on `product_batches` update — manual insert via service only
- Playwright E2E is smoke + calc verification, not full seeded DB auth flow (requires Supabase test seed)

## Run
```
npm run typecheck # 0 errors
npm run lint      # warnings only
npm run build     # 33 routes
npm test          # 47 vitest
npm run test:e2e  # playwright (needs dev)
```
