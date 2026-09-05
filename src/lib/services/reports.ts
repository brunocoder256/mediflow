/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB } from './supabase';
import { calcGrossProfit, calcNetProfit, calcInventoryValue, roundToCents } from '../calculations';

// ============================================================
// Helpers — date presets & period comparison
// ============================================================
export type ReportFilters = {
  branch_id?: string;
  product_id?: string;
  category_id?: string;
  supplier_id?: string;
  customer_id?: string;
  staff_id?: string;
  cashier_id?: string;
  payment_method?: string;
  sale_status?: string;
  payment_status?: string;
  purchase_status?: string;
  return_status?: string;
  expense_category?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  bucket?: string;
  groupBy?: string;
};

export function getDatePreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const startOfWeek = (d: Date) => { const c = new Date(d); const day = c.getDay(); c.setDate(c.getDate() - day); c.setHours(0, 0, 0, 0); return c; };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const startOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
  switch (preset) {
    case 'today': return { from: iso(now), to: iso(now) };
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: iso(y), to: iso(y) }; }
    case 'last7': { const s = new Date(now); s.setDate(s.getDate() - 6); return { from: iso(s), to: iso(now) }; }
    case 'last30': { const s = new Date(now); s.setDate(s.getDate() - 29); return { from: iso(s), to: iso(now) }; }
    case 'thisWeek': { const s = startOfWeek(now); return { from: iso(s), to: iso(now) }; }
    case 'lastWeek': { const s = startOfWeek(now); s.setDate(s.getDate() - 7); const e = new Date(s); e.setDate(e.getDate() + 6); return { from: iso(s), to: iso(e) }; }
    case 'thisMonth': { const s = startOfMonth(now); return { from: iso(s), to: iso(now) }; }
    case 'lastMonth': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { from: iso(s), to: iso(e) }; }
    case 'thisQuarter': { const s = startOfQuarter(now); return { from: iso(s), to: iso(now) }; }
    case 'thisYear': { const s = startOfYear(now); return { from: iso(s), to: iso(now) }; }
    case 'lastYear': { const s = new Date(now.getFullYear() - 1, 0, 1); const e = new Date(now.getFullYear() - 1, 11, 31); return { from: iso(s), to: iso(e) }; }
    default: return { from: iso(now), to: iso(now) };
  }
}

export function getPreviousPeriod(date_from?: string, date_to?: string): { from?: string; to?: string } {
  if (!date_from || !date_to) return {};
  const from = new Date(date_from);
  const to = new Date(date_to);
  const diff = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - diff + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(prevFrom), to: iso(prevTo) };
}

export function calcComparison(current: number, previous: number) {
  const diff = roundToCents(current - previous);
  let pct: number | null = null;
  if (previous === 0) pct = current === 0 ? 0 : null;
  else pct = roundToCents((diff / Math.abs(previous)) * 100);
  return { current, previous, diff, pct };
}

// ============================================================
// CORE — existing but enhanced
// ============================================================
export async function getSalesReport(params: ReportFilters) {
  const sb: any = await getSB();
  const { page = 1, perPage = 50, ...f } = params;
  let q = sb.from('sales').select('id, sale_number, branch_id, cashier_id, total, subtotal, discount, tax, status, sold_at, customer_id', { count: 'exact' }).eq('status', f.sale_status ?? 'COMPLETED').order('sold_at', { ascending: false });
  if (f.branch_id) q = q.eq('branch_id', f.branch_id);
  if (f.cashier_id || f.staff_id) q = q.eq('cashier_id', f.cashier_id ?? f.staff_id);
  if (f.customer_id) q = q.eq('customer_id', f.customer_id);
  if (f.date_from) q = q.gte('sold_at', f.date_from);
  if (f.date_to) q = q.lte('sold_at', f.date_to + 'T23:59:59');
  const from = (page - 1) * perPage;
  const { data, count, error } = await q.range(from, from + perPage - 1);
  if (error) throw new Error(error.message);
  let filtered = data ?? [];
  if (f.payment_method) {
    const { data: pays } = await sb.from('payments').select('sale_id').eq('payment_method', f.payment_method);
    const ids = new Set((pays ?? []).map((p: any) => p.sale_id));
    filtered = filtered.filter((s: any) => ids.has(s.id));
  }
  if (f.product_id || f.category_id) {
    const prodQ = f.product_id ? sb.from('sale_items').select('sale_id').eq('product_id', f.product_id) : sb.from('sale_items').select('sale_id, products!inner(category_id)').eq('products.category_id', f.category_id);
    const { data: sitems } = await prodQ;
    const ids2 = new Set((sitems ?? []).map((si: any) => si.sale_id));
    filtered = filtered.filter((s: any) => ids2.has(s.id));
  }
  if (f.search) {
    const s = f.search.toLowerCase();
    filtered = filtered.filter((r: any) => r.sale_number?.toLowerCase().includes(s) || r.id?.toLowerCase().includes(s));
  }
  return { data: filtered, count: count ?? filtered.length };
}

export async function getSalesAggregates(params: ReportFilters) {
  const { data } = await getSalesReport({ ...params, page: 1, perPage: 1000 });
  const totalRevenue = (data ?? []).reduce((s: any, r: any) => s + Number(r.total), 0);
  const totalDiscount = (data ?? []).reduce((s: any, r: any) => s + Number(r.discount), 0);
  const totalTax = (data ?? []).reduce((s: any, r: any) => s + Number(r.tax), 0);
  const count = (data ?? []).length;
  const avgOrder = count ? totalRevenue / count : 0;
  // returns
  const sb: any = await getSB();
  let retTotal = 0;
  try {
    const rq = sb.from('returns').select('total, sale_id').in('sale_id', (data ?? []).map((d: any) => d.id)).eq('status', 'completed');
    const { data: rets } = await rq;
    retTotal = (rets ?? []).reduce((s: any, r: any) => s + Number(r.total), 0);
  } catch {}
  // Net = gross revenue − discounts − refunds/returns (consistent with P&L)
  const netSales = roundToCents(totalRevenue - totalDiscount - retTotal);
  return { totalRevenue: roundToCents(totalRevenue), totalDiscount: roundToCents(totalDiscount), totalTax: roundToCents(totalTax), count, avgOrder: roundToCents(avgOrder), retTotal: roundToCents(retTotal), netSales };
}

// ============================================================
// SALES BREAKDOWNS
// ============================================================
export async function getSalesByProduct(params: ReportFilters) {
  const sb: any = await getSB();
  let salesQ = sb.from('sales').select('id, sold_at, branch_id').eq('status', 'COMPLETED');
  if (params.branch_id) salesQ = salesQ.eq('branch_id', params.branch_id);
  if (params.date_from) salesQ = salesQ.gte('sold_at', params.date_from);
  if (params.date_to) salesQ = salesQ.lte('sold_at', params.date_to + 'T23:59:59');
  if (params.customer_id) salesQ = salesQ.eq('customer_id', params.customer_id);
  const { data: sales } = await salesQ;
  const ids = (sales ?? []).map((s: any) => s.id);
  if (!ids.length) return [];
  const { data: items } = await sb.from('sale_items').select('product_id, quantity, unit_price, discount, subtotal, products(name, category_id, categories:category_id(name))').in('sale_id', ids);
  // need batch cost for COGS per product
  const { data: batchItems } = await sb.from('sale_items').select('product_id, quantity, batch_id, product_batches(purchase_price)').in('sale_id', ids);
  const costMap: Record<string, number> = {};
  for (const it of (batchItems ?? []) as any[]) costMap[it.product_id] = (costMap[it.product_id] ?? 0) + Number(it.quantity) * Number(it.product_batches?.purchase_price ?? 0);
  const agg: Record<string, any> = {};
  for (const it of (items ?? []) as any[]) {
    const pid = it.product_id;
    if (!agg[pid]) agg[pid] = { product_id: pid, product_name: it.products?.name ?? pid, quantity: 0, revenue: 0, discount: 0, cogs: 0 };
    agg[pid].quantity += Number(it.quantity);
    agg[pid].revenue += Number(it.subtotal ?? it.quantity * it.unit_price - (it.discount ?? 0));
    agg[pid].discount += Number(it.discount ?? 0);
  }
  for (const pid of Object.keys(agg)) {
    agg[pid].cogs = roundToCents(costMap[pid] ?? 0);
    agg[pid].grossProfit = roundToCents(agg[pid].revenue - agg[pid].cogs);
    agg[pid].margin = agg[pid].revenue ? roundToCents((agg[pid].grossProfit / agg[pid].revenue) * 100) : 0;
    agg[pid].revenue = roundToCents(agg[pid].revenue);
  }
  let list = Object.values(agg).sort((a: any, b: any) => b.revenue - a.revenue);
  if (params.product_id) list = list.filter((r: any) => r.product_id === params.product_id);
  if (params.category_id) {
    // filter by category via products table
    const { data: prods } = await sb.from('products').select('id, category_id').in('id', list.map((r: any) => r.product_id));
    const catSet = new Set((prods ?? []).filter((p: any) => p.category_id === params.category_id).map((p: any) => p.id));
    list = list.filter((r: any) => catSet.has(r.product_id));
  }
  return list;
}

export async function getSalesByCategory(params: ReportFilters) {
  const byProduct = await getSalesByProduct(params);
  const sb: any = await getSB();
  const pids = byProduct.map((r: any) => r.product_id);
  if (!pids.length) return [];
  const { data: prods } = await sb.from('products').select('id, category_id, categories:category_id(name)').in('id', pids);
  const catMap: Record<string, any> = {};
  const prodCat: Record<string, string> = {};
  for (const p of (prods ?? []) as any[]) {
    prodCat[p.id] = p.category_id ?? 'uncategorized';
    const cname = (p as any).categories?.name ?? p.category_id ?? 'Uncategorized';
    if (!catMap[prodCat[p.id]]) catMap[prodCat[p.id]] = { category_id: prodCat[p.id], category_name: cname, quantity: 0, revenue: 0, cogs: 0 };
  }
  for (const r of byProduct as any[]) {
    const cid = prodCat[r.product_id] ?? 'uncategorized';
    if (!catMap[cid]) catMap[cid] = { category_id: cid, category_name: cid, quantity: 0, revenue: 0, cogs: 0 };
    catMap[cid].quantity += r.quantity;
    catMap[cid].revenue += r.revenue;
    catMap[cid].cogs += r.cogs;
  }
  return Object.values(catMap).map((c: any) => ({ ...c, revenue: roundToCents(c.revenue), cogs: roundToCents(c.cogs), grossProfit: roundToCents(c.revenue - c.cogs), margin: c.revenue ? roundToCents((c.revenue - c.cogs) / c.revenue * 100) : 0 })).sort((a: any, b: any) => b.revenue - a.revenue);
}

export async function getSalesByCustomer(params: ReportFilters) {
  const sb: any = await getSB();
  let q = sb.from('sales').select('customer_id, total, discount, status, sold_at').eq('status', 'COMPLETED');
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.date_from) q = q.gte('sold_at', params.date_from);
  if (params.date_to) q = q.lte('sold_at', params.date_to + 'T23:59:59');
  const { data: sales } = await q;
  const agg: Record<string, any> = {};
  for (const s of (sales ?? []) as any[]) {
    const cid = s.customer_id ?? 'walk-in';
    if (!agg[cid]) agg[cid] = { customer_id: cid, transactions: 0, revenue: 0, discount: 0 };
    agg[cid].transactions += 1;
    agg[cid].revenue += Number(s.total);
    agg[cid].discount += Number(s.discount ?? 0);
  }
  // returns per customer
  try {
    const { data: rets } = await sb.from('returns').select('customer_id, total, sale_id').eq('status', 'completed');
    for (const r of (rets ?? []) as any[]) {
      const cid = (r as any).customer_id ?? 'walk-in';
      if (agg[cid]) agg[cid].returns = (agg[cid].returns ?? 0) + Number(r.total);
    }
  } catch {}
  for (const k of Object.keys(agg)) {
    agg[k].revenue = roundToCents(agg[k].revenue);
    agg[k].netSales = roundToCents(agg[k].revenue - (agg[k].returns ?? 0));
  }
  // enrich names
  const ids = Object.keys(agg).filter((id) => id !== 'walk-in');
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: custs } = await sb.from('customers').select('id, name, display_name').in('id', ids);
    for (const c of (custs ?? []) as any[]) names[c.id] = c.display_name ?? c.name;
  }
  let list = Object.entries(agg).map(([id, v]: any) => ({ customer_id: id, customer_name: names[id] ?? (id === 'walk-in' ? 'Walk-in' : id.slice(0, 8)), ...v })).sort((a: any, b: any) => b.revenue - a.revenue);
  if (params.customer_id) list = list.filter((r: any) => r.customer_id === params.customer_id);
  if (params.search) list = list.filter((r: any) => r.customer_name.toLowerCase().includes(params.search!.toLowerCase()));
  return list;
}

export async function getSalesByPaymentMethod(params: ReportFilters) {
  const sb: any = await getSB();
  let salesQ = sb.from('sales').select('id, branch_id, sold_at').eq('status', 'COMPLETED');
  if (params.branch_id) salesQ = salesQ.eq('branch_id', params.branch_id);
  if (params.date_from) salesQ = salesQ.gte('sold_at', params.date_from);
  if (params.date_to) salesQ = salesQ.lte('sold_at', params.date_to + 'T23:59:59');
  const { data: sales } = await salesQ;
  const ids = (sales ?? []).map((s: any) => s.id);
  if (!ids.length) return [];
  const { data: pays } = await sb.from('payments').select('payment_method, amount, sale_id').in('sale_id', ids);
  const agg: Record<string, any> = {};
  for (const p of (pays ?? []) as any[]) {
    const m = p.payment_method ?? 'OTHER';
    if (!agg[m]) agg[m] = { payment_method: m, total: 0, count: 0 };
    agg[m].total += Number(p.amount);
    agg[m].count += 1;
  }
  return Object.values(agg).map((r: any) => ({ ...r, total: roundToCents(r.total) })).sort((a: any, b: any) => b.total - a.total);
}

export async function getSalesByBranch(params: ReportFilters) {
  const sb: any = await getSB();
  let q = sb.from('sales').select('branch_id, total, discount, tax, status, sold_at').eq('status', 'COMPLETED');
  if (params.date_from) q = q.gte('sold_at', params.date_from);
  if (params.date_to) q = q.lte('sold_at', params.date_to + 'T23:59:59');
  const { data: sales } = await q;
  const agg: Record<string, any> = {};
  for (const s of (sales ?? []) as any[]) {
    const bid = s.branch_id;
    if (!agg[bid]) agg[bid] = { branch_id: bid, revenue: 0, transactions: 0, discount: 0, tax: 0 };
    agg[bid].revenue += Number(s.total);
    agg[bid].transactions += 1;
    agg[bid].discount += Number(s.discount ?? 0);
    agg[bid].tax += Number(s.tax ?? 0);
  }
  const branchIds = Object.keys(agg);
  const names: Record<string, string> = {};
  if (branchIds.length) {
    const { data: branches } = await sb.from('branches').select('id, name, code').in('id', branchIds);
    for (const b of (branches ?? []) as any[]) names[b.id] = `${b.name} (${b.code})`;
  }
  return Object.entries(agg).map(([id, v]: any) => ({ branch_id: id, branch_name: names[id] ?? id.slice(0, 8), ...v, revenue: roundToCents(v.revenue) })).sort((a: any, b: any) => b.revenue - a.revenue);
}

export async function getSalesByTime(params: ReportFilters) {
  const granularity = params.granularity ?? 'day';
  const sb: any = await getSB();
  let q = sb.from('sales').select('total, sold_at').eq('status', 'COMPLETED');
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.date_from) q = q.gte('sold_at', params.date_from);
  if (params.date_to) q = q.lte('sold_at', params.date_to + 'T23:59:59');
  const { data: sales } = await q;
  const buckets: Record<string, any> = {};
  for (const s of (sales ?? []) as any[]) {
    const d = new Date(s.sold_at);
    let key = '';
    if (granularity === 'hour') key = `${d.toISOString().slice(0, 13)}:00`;
    else if (granularity === 'day') key = d.toISOString().slice(0, 10);
    else if (granularity === 'week') { const jan1 = new Date(d.getFullYear(), 0, 1); const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7); key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`; }
    else if (granularity === 'month') key = d.toISOString().slice(0, 7);
    if (!buckets[key]) buckets[key] = { period: key, revenue: 0, count: 0 };
    buckets[key].revenue += Number(s.total);
    buckets[key].count += 1;
  }
  return Object.values(buckets).map((b: any) => ({ ...b, revenue: roundToCents(b.revenue), avg: b.count ? roundToCents(b.revenue / b.count) : 0 })).sort((a: any, b: any) => a.period.localeCompare(b.period));
}

export async function getDailySales(params: ReportFilters) {
  return getSalesByTime({ ...params, granularity: 'day' });
}

// ============================================================
// INVENTORY
// ============================================================
export async function getInventoryReports(params: ReportFilters) {
  const sb: any = await getSB();
  let batchesQ = sb.from('product_batches').select('id, product_id, branch_id, batch_number, expiry_date, quantity_available, quantity_received, purchase_price, selling_price, is_active, products(name, reorder_level, category_id, preferred_supplier_id)').eq('is_active', true);
  if (params.branch_id) batchesQ = batchesQ.eq('branch_id', params.branch_id);
  if (params.product_id) batchesQ = batchesQ.eq('product_id', params.product_id);
  const { data: batches } = await batchesQ;
  const now = new Date();
  const soon = new Date(); soon.setDate(soon.getDate() + 30);
  const current = batches ?? [];
  const low = current.filter((b: any) => b.quantity_available <= (b.products?.reorder_level ?? 10));
  const expired = current.filter((b: any) => new Date(b.expiry_date) <= now);
  const expiring = current.filter((b: any) => { const d = new Date(b.expiry_date); return d > now && d <= soon; });
  return { current, low, expired, expiring };
}

export async function getStockSummary(params: ReportFilters) {
  const inv = await getInventoryReports(params);
  const byProduct: Record<string, any> = {};
  for (const b of inv.current as any[]) {
    const pid = b.product_id;
    if (!byProduct[pid]) byProduct[pid] = { product_id: pid, product_name: b.products?.name ?? pid, quantity_available: 0, quantity_received: 0, stock_value_cost: 0, stock_value_sell: 0, batches: 0, reorder_level: b.products?.reorder_level ?? 10 };
    byProduct[pid].quantity_available += Number(b.quantity_available);
    byProduct[pid].quantity_received += Number(b.quantity_received ?? b.quantity_available);
    byProduct[pid].stock_value_cost += Number(b.quantity_available) * Number(b.purchase_price);
    byProduct[pid].stock_value_sell += Number(b.quantity_available) * Number(b.selling_price);
    byProduct[pid].batches += 1;
  }
  return Object.values(byProduct).map((r: any) => ({ ...r, stock_value_cost: roundToCents(r.stock_value_cost), stock_value_sell: roundToCents(r.stock_value_sell), potential_margin: roundToCents(r.stock_value_sell - r.stock_value_cost) })).sort((a: any, b: any) => b.stock_value_cost - a.stock_value_cost);
}

export async function getStockValuation(params: ReportFilters) {
  const sb: any = await getSB();
  let q = sb.from('product_batches').select('quantity_available, purchase_price, selling_price, product_id, branch_id, products!inner(category_id)').eq('is_active', true).gt('quantity_available', 0);
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  const { data } = await q;
  let filtered = data as any[];
  if (params.category_id) filtered = filtered.filter((r: any) => r.products?.category_id === params.category_id);
  const valuation = calcInventoryValue(filtered.map((r: any) => ({ quantity_available: r.quantity_available, purchase_price: r.purchase_price })));
  const valuationSell = roundToCents(filtered.reduce((s: number, r: any) => s + r.quantity_available * Number(r.selling_price), 0));
  const byProductMap = new Map<string, number>();
  const byBranchMap = new Map<string, number>();
  for (const r of filtered) {
    byProductMap.set(r.product_id, (byProductMap.get(r.product_id) ?? 0) + r.quantity_available * Number(r.purchase_price));
    byBranchMap.set(r.branch_id, (byBranchMap.get(r.branch_id) ?? 0) + r.quantity_available * Number(r.purchase_price));
  }
  return { valuation, valuationSell, potentialMargin: roundToCents(valuationSell - valuation), totalQty: filtered.reduce((s: any, r: any) => s + r.quantity_available, 0), byProduct: Object.fromEntries(byProductMap), byBranch: Object.fromEntries(byBranchMap), raw: filtered };
}

export async function getStockMovements(params: ReportFilters & { movement_type?: string }) {
  const sb: any = await getSB();
  const page = params.page ?? 1; const perPage = params.perPage ?? 50;
  let q = sb.from('stock_movements').select('id, product_id, batch_id, branch_id, movement_type, quantity, reference_type, reference_id, unit_cost, notes, created_by, created_at, products(name), product_batches(batch_number)', { count: 'exact' }).order('created_at', { ascending: false });
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.product_id) q = q.eq('product_id', params.product_id);
  if ((params as any).movement_type) q = q.eq('movement_type', (params as any).movement_type);
  if (params.date_from) q = q.gte('created_at', params.date_from);
  if (params.date_to) q = q.lte('created_at', params.date_to + 'T23:59:59');
  const from = (page - 1) * perPage;
  const { data, count, error } = await q.range(from, from + perPage - 1);
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0 };
}

export async function getExpiryReport(params: ReportFilters) {
  const sb: any = await getSB();
  let q = sb.from('product_batches').select('id, product_id, branch_id, batch_number, expiry_date, quantity_available, purchase_price, supplier_id, products(name), suppliers:supplier_id(name)').eq('is_active', true).gt('quantity_available', 0);
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.product_id) q = q.eq('product_id', params.product_id);
  if (params.supplier_id) q = q.eq('supplier_id', params.supplier_id);
  const { data } = await q;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const buckets: Record<string, any[]> = { expired: [], '0-30': [], '31-60': [], '61-90': [], '90+': [] };
  let totalAtRisk = 0;
  for (const b of (data ?? []) as any[]) {
    const expiry = new Date(b.expiry_date); const diff = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
    const value = Number(b.quantity_available) * Number(b.purchase_price);
    const row = { ...b, days_to_expiry: diff, value_at_risk: roundToCents(value) };
    totalAtRisk += value;
    if (diff <= 0) buckets.expired.push(row);
    else if (diff <= 30) buckets['0-30'].push(row);
    else if (diff <= 60) buckets['31-60'].push(row);
    else if (diff <= 90) buckets['61-90'].push(row);
    else buckets['90+'].push(row);
  }
  const requested = params.bucket;
  const filtered = requested && buckets[requested] ? buckets[requested] : Object.values(buckets).flat();
  return { buckets, totalAtRisk: roundToCents(totalAtRisk), counts: { expired: buckets.expired.length, '0-30': buckets['0-30'].length, '31-60': buckets['31-60'].length, '61-90': buckets['61-90'].length, '90+': buckets['90+'].length }, data: filtered.sort((a: any, b: any) => a.days_to_expiry - b.days_to_expiry) };
}

export async function getLowStockReport(params: ReportFilters) {
  const sb: any = await getSB();
  let q = sb.from('product_batches').select('id, product_id, branch_id, batch_number, quantity_available, purchase_price, products(name, reorder_level, reorder_quantity, preferred_supplier_id, category_id)').eq('is_active', true);
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  const { data } = await q;
  // aggregate by product
  const byProd: Record<string, any> = {};
  for (const b of (data ?? []) as any[]) {
    const pid = b.product_id;
    if (!byProd[pid]) byProd[pid] = { product_id: pid, product_name: b.products?.name ?? pid, quantity_available: 0, reorder_level: b.products?.reorder_level ?? 10, reorder_quantity: b.products?.reorder_quantity ?? 20, preferred_supplier_id: b.products?.preferred_supplier_id ?? null, category_id: b.products?.category_id ?? null, batches: [] };
    byProd[pid].quantity_available += Number(b.quantity_available);
    byProd[pid].batches.push(b);
  }
  let low = Object.values(byProd).filter((p: any) => p.quantity_available <= p.reorder_level);
  if (params.category_id) low = low.filter((p: any) => p.category_id === params.category_id);
  // enrich supplier names
  const supIds = [...new Set(low.map((p: any) => p.preferred_supplier_id).filter(Boolean))];
  const supMap: Record<string, string> = {};
  if (supIds.length) {
    const { data: sups } = await sb.from('suppliers').select('id, name').in('id', supIds);
    for (const s of (sups ?? []) as any[]) supMap[s.id] = s.name;
  }
  return low.map((p: any) => ({
    ...p,
    preferred_supplier_name: p.preferred_supplier_id ? (supMap[p.preferred_supplier_id] ?? p.preferred_supplier_id.slice(0, 8)) : null,
    suggested_reorder: Math.max(p.reorder_quantity, p.reorder_level - p.quantity_available + p.reorder_quantity),
    deficit: p.reorder_level - p.quantity_available,
  })).sort((a: any, b: any) => a.quantity_available - b.quantity_available);
}

export async function getSlowMovingReport(params: ReportFilters & { days?: number; threshold?: number }) {
  const days = params.days ?? 30; const threshold = params.threshold ?? 5;
  const sb: any = await getSB();
  const since = new Date(); since.setDate(since.getDate() - days);
  let salesQ = sb.from('sales').select('id, sold_at, branch_id').eq('status', 'COMPLETED').gte('sold_at', since.toISOString());
  if (params.branch_id) salesQ = salesQ.eq('branch_id', params.branch_id);
  const { data: sales } = await salesQ;
  const ids = (sales ?? []).map((s: any) => s.id);
  const velocity: Record<string, number> = {};
  if (ids.length) {
    const { data: items } = await sb.from('sale_items').select('product_id, quantity').in('sale_id', ids);
    for (const it of (items ?? []) as any[]) velocity[it.product_id] = (velocity[it.product_id] ?? 0) + Number(it.quantity);
  }
  // all products with stock
  let batchQ = sb.from('product_batches').select('product_id, quantity_available, purchase_price, products(name, category_id, preferred_supplier_id)').eq('is_active', true).gt('quantity_available', 0);
  if (params.branch_id) batchQ = batchQ.eq('branch_id', params.branch_id);
  const { data: batches } = await batchQ;
  const stockMap: Record<string, any> = {};
  for (const b of (batches ?? []) as any[]) {
    if (!stockMap[b.product_id]) stockMap[b.product_id] = { product_id: b.product_id, product_name: b.products?.name ?? b.product_id, quantity: 0, value: 0, preferred_supplier_id: b.products?.preferred_supplier_id ?? null, velocity: velocity[b.product_id] ?? 0 };
    stockMap[b.product_id].quantity += Number(b.quantity_available);
    stockMap[b.product_id].value += Number(b.quantity_available) * Number(b.purchase_price);
  }
  let slow = Object.values(stockMap).filter((p: any) => p.velocity > 0 && p.velocity <= threshold);
  // need last sale date
  if (ids.length) {
    const { data: itemsWithSale } = await sb.from('sale_items').select('product_id, sale_id, sales!inner(sold_at)').in('sale_id', ids);
    const lastMap: Record<string, string> = {};
    for (const it of (itemsWithSale ?? []) as any[]) {
      const d = (it as any).sales?.sold_at;
      if (!lastMap[it.product_id] || d > lastMap[it.product_id]) lastMap[it.product_id] = d;
    }
    slow = slow.map((p: any) => ({ ...p, last_sale_date: lastMap[p.product_id] ?? null, days_since_sale: lastMap[p.product_id] ? Math.ceil((Date.now() - new Date(lastMap[p.product_id]).getTime()) / 86400000) : null }));
  }
  return slow.map((p: any) => ({ ...p, value: roundToCents(p.value) })).sort((a: any, b: any) => a.velocity - b.velocity);
}

export async function getDeadStockReport(params: ReportFilters & { days?: number }) {
  const days = params.days ?? 60;
  const sb: any = await getSB();
  const since = new Date(); since.setDate(since.getDate() - days);
  let salesQ = sb.from('sales').select('id, branch_id').eq('status', 'COMPLETED').gte('sold_at', since.toISOString());
  if (params.branch_id) salesQ = salesQ.eq('branch_id', params.branch_id);
  const { data: sales } = await salesQ;
  const ids = (sales ?? []).map((s: any) => s.id);
  const soldSet = new Set<string>();
  if (ids.length) {
    const { data: items } = await sb.from('sale_items').select('product_id').in('sale_id', ids);
    for (const it of (items ?? []) as any[]) soldSet.add(it.product_id);
  }
  let batchQ = sb.from('product_batches').select('product_id, quantity_available, purchase_price, products(name, category_id, preferred_supplier_id)').eq('is_active', true).gt('quantity_available', 0);
  if (params.branch_id) batchQ = batchQ.eq('branch_id', params.branch_id);
  const { data: batches } = await batchQ;
  const stockMap: Record<string, any> = {};
  for (const b of (batches ?? []) as any[]) {
    if (!stockMap[b.product_id]) stockMap[b.product_id] = { product_id: b.product_id, product_name: b.products?.name ?? b.product_id, quantity: 0, value: 0, preferred_supplier_id: b.products?.preferred_supplier_id ?? null };
    stockMap[b.product_id].quantity += Number(b.quantity_available);
    stockMap[b.product_id].value += Number(b.quantity_available) * Number(b.purchase_price);
  }
  const dead = Object.values(stockMap).filter((p: any) => !soldSet.has(p.product_id));
  // try to get last ever sale date for these products
  const deadIds = dead.map((d: any) => d.product_id);
  const lastMap: Record<string, string> = {};
  if (deadIds.length) {
    const { data: allItems } = await sb.from('sale_items').select('product_id, sales!inner(sold_at)').in('product_id', deadIds);
    for (const it of (allItems ?? []) as any[]) {
      const d = (it as any).sales?.sold_at;
      if (!lastMap[it.product_id] || d > lastMap[it.product_id]) lastMap[it.product_id] = d;
    }
  }
  return dead.map((p: any) => ({
    ...p,
    value: roundToCents(p.value),
    last_sale_date: lastMap[p.product_id] ?? null,
    days_since_sale: lastMap[p.product_id] ? Math.ceil((Date.now() - new Date(lastMap[p.product_id]).getTime()) / 86400000) : null,
  })).sort((a: any, b: any) => b.value - a.value);
}

// ============================================================
// PURCHASING
// ============================================================
export async function getPurchasingReport(params: ReportFilters) {
  const sb: any = await getSB();
  let q = sb.from('purchase_orders').select('id, purchase_number, supplier_id, branch_id, status, total, ordered_at, received_at, suppliers(name)', { count: 'exact' }).order('ordered_at', { ascending: false });
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.supplier_id) q = q.eq('supplier_id', params.supplier_id);
  if (params.purchase_status) q = q.eq('status', params.purchase_status);
  if (params.date_from) q = q.gte('ordered_at', params.date_from);
  if (params.date_to) q = q.lte('ordered_at', params.date_to);
  if (params.search) q = q.ilike('purchase_number', `%${params.search}%`);
  const page = params.page ?? 1; const perPage = params.perPage ?? 50;
  const from = (page - 1) * perPage;
  const { data, count } = await q.range(from, from + perPage - 1);
  return { data: data ?? [], count: count ?? 0 };
}

export async function getPurchasingAnalytics(params: ReportFilters) {
  const sb: any = await getSB();
  let q = sb.from('purchase_orders').select('total, status, ordered_at, supplier_id, branch_id');
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.supplier_id) q = q.eq('supplier_id', params.supplier_id);
  if (params.date_from) q = q.gte('ordered_at', params.date_from);
  if (params.date_to) q = q.lte('ordered_at', params.date_to);
  const { data } = await q;
  const list = data ?? [];
  const bySupplier: Record<string, number> = {};
  const byBranch: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const trend: Record<string, number> = {};
  let total = 0;
  for (const po of list as any[]) {
    total += Number(po.total);
    bySupplier[po.supplier_id] = (bySupplier[po.supplier_id] ?? 0) + Number(po.total);
    byBranch[po.branch_id] = (byBranch[po.branch_id] ?? 0) + Number(po.total);
    byStatus[po.status] = (byStatus[po.status] ?? 0) + 1;
    const m = String(po.ordered_at).slice(0, 7);
    trend[m] = (trend[m] ?? 0) + Number(po.total);
  }
  // outstanding/partially etc via status
  const outstanding = (byStatus['ORDERED'] ?? 0) + (byStatus['PARTIALLY_RECEIVED'] ?? 0);
  const partially = byStatus['PARTIALLY_RECEIVED'] ?? 0;
  return { total: roundToCents(total), count: list.length, bySupplier, byBranch, byStatus, trend, outstanding, partially };
}

// ============================================================
// SUPPLIER REPORTS
// ============================================================
export async function getSupplierReport(params: ReportFilters) {
  const sb: any = await getSB();
  // purchases by supplier already covered but aggregate
  const analytics = await getPurchasingAnalytics(params);
  // supplier balances via rpc/fallback
  const balances: any[] = [];
  try {
    // try to list suppliers
    const sq = sb.from('suppliers').select('id, name');
    const { data: sups } = await sq.limit(100);
    for (const s of (sups ?? []) as any[]) {
      try {
        const { data: rb } = await sb.rpc('get_supplier_balance', { p_supplier_id: s.id, p_org_id: (await getOrgId()) });
        const bal = rb?.[0] ?? rb;
        balances.push({ supplier_id: s.id, supplier_name: s.name, purchased: Number(bal?.purchased ?? 0), paid: Number(bal?.paid ?? 0), returned: Number(bal?.returned ?? 0), balance: Number(bal?.balance ?? 0) });
      } catch {
        const v = (analytics.bySupplier as any)[s.id] ?? 0;
        balances.push({ supplier_id: s.id, supplier_name: s.name, purchased: v, paid: 0, returned: 0, balance: v });
      }
    }
  } catch {}
  return { analytics, balances: balances.sort((a: any, b: any) => b.balance - a.balance) };
}

async function getOrgId() {
  const sb: any = await getSB();
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.from('profiles').select('organization_id').eq('auth_user_id', user.id).single();
    return data?.organization_id ?? null;
  } catch { return null; }
}

// ============================================================
// CUSTOMER REPORTS & AR
// ============================================================
export async function getCustomerReport(params: ReportFilters) {
  const list = await getSalesByCustomer(params);
  // enrich outstanding via customer statement logic simplified
  return list.slice(0, params.perPage ?? 100);
}

export async function getAccountsReceivable(params: ReportFilters) {
  const sb: any = await getSB();
  let salesQ = sb.from('sales').select('customer_id, total, sold_at, status, branch_id').eq('status', 'COMPLETED');
  if (params.branch_id) salesQ = salesQ.eq('branch_id', params.branch_id);
  if (params.date_from) salesQ = salesQ.gte('sold_at', params.date_from);
  if (params.date_to) salesQ = salesQ.lte('sold_at', params.date_to + 'T23:59:59');
  const { data: sales } = await salesQ;
  const custSales: Record<string, any[]> = {};
  for (const s of (sales ?? []) as any[]) {
    const cid = s.customer_id ?? 'walk-in';
    if (cid === 'walk-in') continue;
    if (!custSales[cid]) custSales[cid] = [];
    custSales[cid].push(s);
  }
  const customers = Object.keys(custSales);
  const result: any[] = [];
  for (const cid of customers) {
    const cSales = custSales[cid];
    const total = cSales.reduce((a: number, s: any) => a + Number(s.total), 0);
    const saleIds = cSales.map((s: any) => (s as any).id);
    let paid = 0;
    if (saleIds.length) {
      try {
        const { data: pays } = await sb.from('payments').select('amount, sale_id').in('sale_id', saleIds);
        paid = (pays ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
      } catch {}
    }
    let ret = 0;
    try {
      const { data: rets } = await sb.from('returns').select('total, sale_id').eq('customer_id', cid).eq('status', 'completed');
      ret = (rets ?? []).reduce((a: number, r: any) => a + Number(r.total), 0);
    } catch {}
    const outstanding = roundToCents(total - paid - ret);
    if (outstanding <= 0) continue;
    // aging based on oldest unpaid sale
    const oldest = cSales.sort((a: any, b: any) => new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime())[0];
    const days = Math.ceil((Date.now() - new Date(oldest.sold_at).getTime()) / 86400000);
    let bucket = 'Current';
    if (days > 90) bucket = '90+ days';
    else if (days > 60) bucket = '61-90 days';
    else if (days > 30) bucket = '31-60 days';
    else if (days > 0) bucket = '1-30 days';
    result.push({ customer_id: cid, outstanding, days_overdue: days, bucket, total, paid, returned: ret, oldest_date: oldest.sold_at });
  }
  // names
  if (result.length) {
    const { data: custs } = await sb.from('customers').select('id, name, display_name').in('id', result.map((r) => r.customer_id));
    const m: Record<string, string> = {};
    for (const c of (custs ?? []) as any[]) m[c.id] = (c as any).display_name ?? c.name;
    for (const r of result) r.customer_name = m[r.customer_id] ?? r.customer_id.slice(0, 8);
  }
  const buckets: Record<string, number> = { Current: 0, '1-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0 };
  for (const r of result) buckets[r.bucket] = (buckets[r.bucket] ?? 0) + r.outstanding;
  return { data: result.sort((a: any, b: any) => b.outstanding - a.outstanding), buckets, totalOutstanding: roundToCents(result.reduce((a: number, r: any) => a + r.outstanding, 0)) };
}

export async function getAccountsPayable(params: ReportFilters) {
  const sb: any = await getSB();
  let poQ = sb.from('purchase_orders').select('supplier_id, total, status, ordered_at, branch_id').in('status', ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED']);
  if (params.branch_id) poQ = poQ.eq('branch_id', params.branch_id);
  if (params.supplier_id) poQ = poQ.eq('supplier_id', params.supplier_id);
  if (params.date_from) poQ = poQ.gte('ordered_at', params.date_from);
  if (params.date_to) poQ = poQ.lte('ordered_at', params.date_to);
  const { data: pos } = await poQ;
  const supMap: Record<string, any[]> = {};
  for (const po of (pos ?? []) as any[]) {
    if (!supMap[po.supplier_id]) supMap[po.supplier_id] = [];
    supMap[po.supplier_id].push(po);
  }
  const result: any[] = [];
  for (const sid of Object.keys(supMap)) {
    const list = supMap[sid];
    const purchased = list.reduce((a: number, p: any) => a + Number(p.total), 0);
    let paid = 0; let returned = 0;
    try {
      const { data: pays } = await sb.from('supplier_payments').select('amount').eq('supplier_id', sid);
      paid = (pays ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
    } catch {}
    try {
      const { data: rets } = await sb.from('purchase_returns').select('total').eq('supplier_id', sid).in('status', ['approved', 'completed']);
      returned = (rets ?? []).reduce((a: number, r: any) => a + Number(r.total), 0);
    } catch {}
    const outstanding = roundToCents(purchased - paid - returned);
    if (outstanding <= 0) continue;
    const oldest = list.sort((a: any, b: any) => new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime())[0];
    const days = Math.ceil((Date.now() - new Date(oldest.ordered_at).getTime()) / 86400000);
    let bucket = 'Current';
    if (days > 90) bucket = '90+ days';
    else if (days > 60) bucket = '61-90 days';
    else if (days > 30) bucket = '31-60 days';
    else if (days > 0) bucket = '1-30 days';
    result.push({ supplier_id: sid, outstanding, days_overdue: days, bucket, purchased, paid, returned, oldest_date: oldest.ordered_at });
  }
  if (result.length) {
    const { data: sups } = await sb.from('suppliers').select('id, name').in('id', result.map((r) => r.supplier_id));
    const m: Record<string, string> = {};
    for (const s of (sups ?? []) as any[]) m[s.id] = s.name;
    for (const r of result) r.supplier_name = m[r.supplier_id] ?? r.supplier_id.slice(0, 8);
  }
  const buckets: Record<string, number> = { Current: 0, '1-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0 };
  for (const r of result) buckets[r.bucket] = (buckets[r.bucket] ?? 0) + r.outstanding;
  return { data: result.sort((a: any, b: any) => b.outstanding - a.outstanding), buckets, totalOutstanding: roundToCents(result.reduce((a: number, r: any) => a + r.outstanding, 0)) };
}

// ============================================================
// EXPENSE REPORTS
// ============================================================
export async function getExpenseReport(params: ReportFilters) {
  const sb: any = await getSB();
  let q = sb.from('expenses').select('id, category, category_id, branch_id, total_amount, amount, payment_method, approval_status, payment_status, posting_status, expense_date, description, supplier_id').order('expense_date', { ascending: false });
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.expense_category) q = q.eq('category', params.expense_category);
  if (params.supplier_id) q = q.eq('supplier_id', params.supplier_id);
  if (params.payment_method) q = q.eq('payment_method', params.payment_method);
  if (params.date_from) q = q.gte('expense_date', params.date_from);
  if (params.date_to) q = q.lte('expense_date', params.date_to);
  const { data } = await q;
  const filtered = (data ?? []).filter((e: any) => !e.is_reversal && e.posting_status !== 'REVERSED');
  const byCategory: Record<string, number> = {};
  const byBranch: Record<string, number> = {};
  const byPayment: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  let total = 0;
  for (const e of filtered as any[]) {
    const amt = Number(e.total_amount ?? e.amount);
    total += amt;
    byCategory[e.category ?? e.category_id ?? 'Other'] = (byCategory[e.category ?? e.category_id ?? 'Other'] ?? 0) + amt;
    byBranch[e.branch_id] = (byBranch[e.branch_id] ?? 0) + amt;
    byPayment[e.payment_method ?? 'OTHER'] = (byPayment[e.payment_method ?? 'OTHER'] ?? 0) + amt;
    const m = String(e.expense_date).slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + amt;
  }
  const page = params.page ?? 1; const perPage = params.perPage ?? 50;
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  return { data: paged, count: filtered.length, total: roundToCents(total), byCategory, byBranch, byPayment, byMonth, rawAll: filtered };
}

// ============================================================
// STAFF / CASH
// ============================================================
export async function getStaffReport(params: ReportFilters) {
  const sb: any = await getSB();
  let salesQ = sb.from('sales').select('cashier_id, total, discount, status, sold_at').eq('status', 'COMPLETED');
  if (params.branch_id) salesQ = salesQ.eq('branch_id', params.branch_id);
  if (params.date_from) salesQ = salesQ.gte('sold_at', params.date_from);
  if (params.date_to) salesQ = salesQ.lte('sold_at', params.date_to + 'T23:59:59');
  const { data: sales } = await salesQ;
  let voidQ = sb.from('sales').select('cashier_id').eq('status', 'VOIDED');
  if (params.branch_id) voidQ = voidQ.eq('branch_id', params.branch_id);
  const { data: voids } = await voidQ;
  const byCashier: Record<string, any> = {};
  for (const s of (sales ?? [])) {
    const id = (s as any).cashier_id;
    if (!byCashier[id]) byCashier[id] = { salesCount: 0, revenue: 0, discounts: 0, voids: 0 };
    byCashier[id].salesCount += 1;
    byCashier[id].revenue += Number((s as any).total);
    byCashier[id].discounts += Number((s as any).discount);
  }
  for (const v of (voids ?? [])) {
    if (!byCashier[(v as any).cashier_id]) byCashier[(v as any).cashier_id] = { salesCount: 0, revenue: 0, discounts: 0, voids: 0 };
    byCashier[(v as any).cashier_id].voids += 1;
  }
  const ids = Object.keys(byCashier);
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await sb.from('profiles').select('id, full_name').in('id', ids);
    for (const p of (profs ?? []) as any[]) names[p.id] = p.full_name;
  }
  return Object.entries(byCashier).map(([id, v]: any) => ({ cashier_id: id, cashier_name: names[id] ?? id.slice(0, 8), ...v, revenue: roundToCents(v.revenue), discounts: roundToCents(v.discounts), avgSale: v.salesCount ? roundToCents(v.revenue / v.salesCount) : 0 }));
}

export async function getCashReport(params: ReportFilters) {
  const sb: any = await getSB();
  let q = sb.from('cash_sessions').select('id, register_id, branch_id, cashier_id, status, opening_float, expected_cash, closing_cash, cash_variance, opened_at, closed_at').order('opened_at', { ascending: false });
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.date_from) q = q.gte('opened_at', params.date_from);
  if (params.date_to) q = q.lte('opened_at', params.date_to + 'T23:59:59');
  if (params.staff_id) q = q.eq('cashier_id', params.staff_id);
  const { data } = await q;
  return data ?? [];
}

// ============================================================
// FINANCIAL / P&L
// ============================================================
export async function getInventoryValuationWrapped(params: ReportFilters) {
  return getStockValuation(params);
}

export async function getProfitAndLoss(params: ReportFilters) {
  const sb: any = await getSB();
  // Revenue
  const agg = await getSalesAggregates(params);
  // COGS via sale_items batch cost
  let salesQ = sb.from('sales').select('id').eq('status', 'COMPLETED');
  if (params.branch_id) salesQ = salesQ.eq('branch_id', params.branch_id);
  if (params.date_from) salesQ = salesQ.gte('sold_at', params.date_from);
  if (params.date_to) salesQ = salesQ.lte('sold_at', params.date_to + 'T23:59:59');
  const { data: sales } = await salesQ;
  const saleIds = (sales ?? []).map((s: any) => s.id);
  let cogs = 0;
  if (saleIds.length) {
    const { data: items } = await sb.from('sale_items').select('quantity, product_batches(purchase_price), batch_id').in('sale_id', saleIds);
    cogs = (items ?? []).reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.product_batches?.purchase_price ?? 0), 0);
  }
  const grossSales = agg.totalRevenue;
  const totalDiscount = agg.totalDiscount;
  const refundTotal = agg.retTotal;
  const netRevenue = roundToCents(grossSales - totalDiscount - refundTotal);
  const grossProfit = calcGrossProfit(netRevenue, roundToCents(cogs));
  const margin = netRevenue ? roundToCents((grossProfit / netRevenue) * 100) : 0;
  // Operating expenses
  const expReport = await getExpenseReport({ branch_id: params.branch_id, date_from: params.date_from, date_to: params.date_to, page: 1, perPage: 10000 });
  const operatingExpenses = expReport.total;
  const netProfit = calcNetProfit(grossProfit, operatingExpenses);
  return {
    revenue: { grossSales: roundToCents(grossSales), discount: roundToCents(totalDiscount), returns: roundToCents(refundTotal), netRevenue },
    cogs: roundToCents(cogs),
    grossProfit,
    margin,
    operatingExpenses,
    netOperatingProfit: netProfit,
    salesCount: agg.count,
    expenseCount: expReport.count,
    byExpenseCategory: expReport.byCategory,
  };
}

// ============================================================
// BRANCH COMPARISON
// ============================================================
export async function getBranchComparison(params: ReportFilters) {
  const branches = await getSalesByBranch(params);
  const invVal = await getStockValuation({});
  // enhance with profit per branch
  const result: any[] = [];
  for (const b of branches) {
    const pnl = await getProfitAndLoss({ branch_id: b.branch_id, date_from: params.date_from, date_to: params.date_to });
    result.push({ ...b, grossProfit: pnl.grossProfit, netProfit: pnl.netOperatingProfit, expenses: pnl.operatingExpenses, stockValue: invVal.byBranch[b.branch_id] ?? 0 });
  }
  return result;
}

// ============================================================
// AUDIT
// ============================================================
export async function getAuditReport(params: ReportFilters) {
  const sb: any = await getSB();
  const page = params.page ?? 1; const perPage = params.perPage ?? 50;
  let q = sb.from('audit_logs').select('id, action, entity_type, entity_id, created_at, user_id', { count: 'exact' }).order('created_at', { ascending: false });
  if (params.date_from) q = q.gte('created_at', params.date_from);
  if (params.date_to) q = q.lte('created_at', params.date_to + 'T23:59:59');
  if (params.search) q = q.ilike('action', `%${params.search}%`);
  const from = (page - 1) * perPage;
  const { data, count } = await q.range(from, from + perPage - 1);
  // enrich voided sales, adjustments etc
  const voided = (data ?? []).filter((r: any) => r.action.includes('VOID') || r.action.includes('VOIDED'));
  return { data: data ?? [], count: count ?? 0, voidedCount: voided.length };
}

// ============================================================
// EXECUTIVE KPIs — for landing page
// ============================================================
export async function getExecutiveKPIs(params: ReportFilters) {
  const [salesAgg, pnl, invVal, expReport, ar, ap, expiry] = await Promise.all([
    getSalesAggregates(params),
    getProfitAndLoss(params),
    getStockValuation(params),
    getExpenseReport({ ...params, page: 1, perPage: 1 }),
    getAccountsReceivable(params),
    getAccountsPayable(params),
    getExpiryReport(params),
  ]);
  // returns count/value
  const sb: any = await getSB();
  let retQ = sb.from('returns').select('total').eq('status', 'completed');
  if (params.branch_id) retQ = retQ.eq('branch_id', params.branch_id);
  if (params.date_from) retQ = retQ.gte('created_at', params.date_from);
  if (params.date_to) retQ = retQ.lte('created_at', params.date_to);
  const { data: rets } = await retQ;
  const returnsCount = (rets ?? []).length;
  const returnsValue = (rets ?? []).reduce((a: number, r: any) => a + Number(r.total), 0);
  return {
    sales: { total: salesAgg.totalRevenue, net: salesAgg.netSales, count: salesAgg.count, avg: salesAgg.avgOrder },
    grossProfit: pnl.grossProfit,
    margin: pnl.margin,
    netProfit: pnl.netOperatingProfit,
    expenses: { total: pnl.operatingExpenses, count: expReport.count, byCategory: expReport.byCategory },
    stockValue: invVal.valuation,
    stockQty: invVal.totalQty,
    ar: { total: ar.totalOutstanding, count: ar.data.length, buckets: ar.buckets },
    ap: { total: ap.totalOutstanding, count: ap.data.length, buckets: ap.buckets },
    transactions: salesAgg.count,
    returns: { count: returnsCount, value: roundToCents(returnsValue) },
    expiringValue: expiry.totalAtRisk,
    expiringCounts: expiry.counts,
    cogs: pnl.cogs,
  };
}

// ============================================================
// RECONCILIATION CHECKS
// ============================================================
export async function getReconciliation(params: ReportFilters) {
  const sb: any = await getSB();
  const agg = await getSalesAggregates(params);
  // sales total vs payments
  let salesQ = sb.from('sales').select('id, total').eq('status', 'COMPLETED');
  if (params.branch_id) salesQ = salesQ.eq('branch_id', params.branch_id);
  if (params.date_from) salesQ = salesQ.gte('sold_at', params.date_from);
  if (params.date_to) salesQ = salesQ.lte('sold_at', params.date_to + 'T23:59:59');
  const { data: sales } = await salesQ;
  const saleIds = (sales ?? []).map((s: any) => s.id);
  let paidTotal = 0;
  if (saleIds.length) {
    const { data: pays } = await sb.from('payments').select('amount').in('sale_id', saleIds);
    paidTotal = (pays ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
  }
  const salesTotal = (sales ?? []).reduce((a: number, s: any) => a + Number(s.total), 0);
  const salesDiff = roundToCents(salesTotal - paidTotal);
  const invVal = await getStockValuation(params);
  return {
    salesTotal: roundToCents(salesTotal),
    paidTotal: roundToCents(paidTotal),
    salesDiff,
    salesReconciled: Math.abs(salesDiff) < 0.01,
    inventoryValuation: invVal.valuation,
    agg,
  };
}
