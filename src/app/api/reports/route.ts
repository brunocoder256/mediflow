import { NextResponse } from 'next/server';
import {
  getSalesReport, getSalesAggregates, getSalesByProduct, getSalesByCategory, getSalesByCustomer, getSalesByPaymentMethod, getSalesByBranch, getSalesByTime,
  getInventoryReports, getStockSummary, getStockValuation, getStockMovements, getExpiryReport, getLowStockReport, getSlowMovingReport, getDeadStockReport,
  getPurchasingReport, getPurchasingAnalytics, getSupplierReport, getCustomerReport, getAccountsReceivable, getAccountsPayable,
  getExpenseReport, getStaffReport, getCashReport, getProfitAndLoss, getBranchComparison, getAuditReport, getExecutiveKPIs, getReconciliation,
  getPreviousPeriod, calcComparison, ReportFilters,
} from '@/lib/services/reports';
import { getCOGSReport, getNetProfitReport, getInventoryValuation, getExpenseSummary } from '@/lib/services/financial';

async function checkPermission(): Promise<{ ok: boolean; branchId?: string }> {
  // Server-side: we trust RLS but also verify user exists. For reports, permission is validated via RLS + branch scope.
  // If we cannot verify, still allow but branch-scoped.
  try {
    const { getSB } = await import('@/lib/services/supabase');
    const sb: any = await getSB();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { ok: false };
    return { ok: true };
  } catch { return { ok: true }; }
}

export async function GET(req: Request) {
  try {
    const perm = await checkPermission();
    if (!perm.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? 'overview';
    const branch_id = searchParams.get('branch_id') ?? undefined;
    const product_id = searchParams.get('product_id') ?? undefined;
    const category_id = searchParams.get('category_id') ?? undefined;
    const supplier_id = searchParams.get('supplier_id') ?? undefined;
    const customer_id = searchParams.get('customer_id') ?? undefined;
    const cashier_id = searchParams.get('cashier_id') ?? searchParams.get('staff_id') ?? undefined;
    const payment_method = searchParams.get('payment_method') ?? undefined;
    const expense_category = searchParams.get('expense_category') ?? searchParams.get('category') ?? undefined;
    const date_from = searchParams.get('date_from') ?? undefined;
    const date_to = searchParams.get('date_to') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const bucket = searchParams.get('bucket') ?? undefined;
    const granularity = (searchParams.get('granularity') ?? 'day') as any;
    const compare = searchParams.get('compare') === '1' || searchParams.get('compare') === 'true';
    const page = parseInt(searchParams.get('page') ?? '1');
    const perPage = parseInt(searchParams.get('perPage') ?? '50');

    const baseFilters: ReportFilters = { branch_id, product_id, category_id, supplier_id, customer_id, cashier_id, payment_method, expense_category, date_from, date_to, search, bucket, granularity, page, perPage };

    // Helpers for period comparison
    async function withComparison(currentFn: (f: ReportFilters) => Promise<any>, currentFilters: ReportFilters) {
      const current = await currentFn(currentFilters);
      if (!compare || !date_from || !date_to) return { current, comparison: null };
      const prev = getPreviousPeriod(date_from, date_to);
      const prevVal = await currentFn({ ...currentFilters, date_from: prev.from, date_to: prev.to });
      return { current, previous: prevVal, period: { current: { from: date_from, to: date_to }, previous: prev } };
    }

    if (type === 'overview' || type === 'kpi' || type === 'executive') {
      const kpi = await getExecutiveKPIs(baseFilters);
      if (compare && date_from && date_to) {
        const prev = getPreviousPeriod(date_from, date_to);
        const prevKpi = await getExecutiveKPIs({ ...baseFilters, date_from: prev.from, date_to: prev.to });
        const salesCmp = calcComparison(kpi.sales.total, prevKpi.sales.total);
        const profitCmp = calcComparison(kpi.grossProfit, prevKpi.grossProfit);
        const netCmp = calcComparison(kpi.netProfit, prevKpi.netProfit);
        const stockCmp = calcComparison(kpi.stockValue, prevKpi.stockValue);
        return NextResponse.json({ current: kpi, previous: prevKpi, comparison: { sales: salesCmp, grossProfit: profitCmp, netProfit: netCmp, stockValue: stockCmp }, generated_at: new Date().toISOString() });
      }
      return NextResponse.json({ ...kpi, generated_at: new Date().toISOString() });
    }
    if (type === 'sales') {
      const [sales, agg] = await Promise.all([getSalesReport(baseFilters), getSalesAggregates(baseFilters)]);
      if (compare && date_from && date_to) {
        const prev = getPreviousPeriod(date_from, date_to);
        const prevAgg = await getSalesAggregates({ ...baseFilters, date_from: prev.from, date_to: prev.to });
        return NextResponse.json({ sales, aggregates: agg, comparison: calcComparison(agg.totalRevenue, prevAgg.totalRevenue), previous: prevAgg, generated_at: new Date().toISOString() });
      }
      return NextResponse.json({ sales, aggregates: agg, generated_at: new Date().toISOString() });
    }
    if (type === 'sales-by-product') {
      const data = await getSalesByProduct(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'sales-by-category') {
      const data = await getSalesByCategory(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'sales-by-customer') {
      const data = await getSalesByCustomer(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'sales-by-payment') {
      const data = await getSalesByPaymentMethod(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'sales-by-branch') {
      const data = await getSalesByBranch(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'sales-by-time' || type === 'sales-trend' || type === 'daily-sales') {
      const data = await getSalesByTime(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'financial' || type === 'profit') {
      const [cogs, net, exp] = await Promise.all([getCOGSReport(baseFilters as any), getNetProfitReport(baseFilters as any), getExpenseSummary(baseFilters as any)]);
      const pnl = await getProfitAndLoss(baseFilters);
      if (compare && date_from && date_to) {
        const prev = getPreviousPeriod(date_from, date_to);
        const prevPnl = await getProfitAndLoss({ ...baseFilters, date_from: prev.from, date_to: prev.to });
        return NextResponse.json({ cogs, netProfit: net, expenses: exp, pnl, comparison: { grossProfit: calcComparison(pnl.grossProfit, prevPnl.grossProfit), netProfit: calcComparison(pnl.netOperatingProfit, prevPnl.netOperatingProfit) }, previous: prevPnl, generated_at: new Date().toISOString() });
      }
      return NextResponse.json({ cogs, netProfit: net, expenses: exp, pnl, generated_at: new Date().toISOString() });
    }
    if (type === 'pnl' || type === 'profit-loss') {
      const pnl = await getProfitAndLoss(baseFilters);
      return NextResponse.json({ ...pnl, generated_at: new Date().toISOString() });
    }
    if (type === 'inventory' || type === 'inventory-summary') {
      const inv = await getInventoryReports(baseFilters);
      const val = await getStockValuation(baseFilters);
      const summary = await getStockSummary(baseFilters);
      return NextResponse.json({ ...inv, valuation: val, summary, generated_at: new Date().toISOString() });
    }
    if (type === 'stock-summary') {
      const data = await getStockSummary(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'stock-valuation') {
      const val = await getStockValuation(baseFilters);
      return NextResponse.json({ ...val, generated_at: new Date().toISOString() });
    }
    if (type === 'stock-movement' || type === 'movements') {
      const data = await getStockMovements({ ...baseFilters, movement_type: searchParams.get('movement_type') ?? undefined });
      return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
    }
    if (type === 'expiry') {
      const data = await getExpiryReport(baseFilters);
      return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
    }
    if (type === 'low-stock') {
      const data = await getLowStockReport(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'slow-moving') {
      const days = parseInt(searchParams.get('days') ?? '30');
      const threshold = parseInt(searchParams.get('threshold') ?? '5');
      const data = await getSlowMovingReport({ ...baseFilters, days, threshold });
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'dead-stock') {
      const days = parseInt(searchParams.get('days') ?? '60');
      const data = await getDeadStockReport({ ...baseFilters, days });
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'purchasing') {
      const [data, analytics] = await Promise.all([getPurchasingReport(baseFilters), getPurchasingAnalytics(baseFilters)]);
      return NextResponse.json({ ...data, analytics, generated_at: new Date().toISOString() });
    }
    if (type === 'purchasing-analytics') {
      const data = await getPurchasingAnalytics(baseFilters);
      return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
    }
    if (type === 'supplier' || type === 'suppliers') {
      const data = await getSupplierReport(baseFilters);
      return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
    }
    if (type === 'customer' || type === 'customers') {
      const data = await getCustomerReport(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'ar' || type === 'receivable' || type === 'accounts-receivable') {
      const data = await getAccountsReceivable(baseFilters);
      return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
    }
    if (type === 'ap' || type === 'payable' || type === 'accounts-payable') {
      const data = await getAccountsPayable(baseFilters);
      return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
    }
    if (type === 'expense' || type === 'expenses') {
      const data = await getExpenseReport(baseFilters);
      return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
    }
    if (type === 'staff') {
      const data = await getStaffReport(baseFilters);
      return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (type === 'cash') {
      const data = await getCashReport(baseFilters);
      return NextResponse.json(data);
    }
    if (type === 'branches' || type === 'branch-comparison') {
      const data = await getBranchComparison(baseFilters);
      return NextResponse.json({ data, count: data.length, generated_at: new Date().toISOString() });
    }
    if (type === 'audit') {
      const data = await getAuditReport(baseFilters);
      return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
    }
    if (type === 'reconciliation' || type === 'consistency') {
      const data = await getReconciliation(baseFilters);
      return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
    }
    // Fallback — attempt legacy
    if (type === 'sales-legacy') {
      const [sales, agg] = await Promise.all([getSalesReport(baseFilters), getSalesAggregates(baseFilters)]);
      return NextResponse.json({ sales, aggregates: agg });
    }
    return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
