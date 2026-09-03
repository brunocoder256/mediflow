/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB } from './supabase';
import { calcCOGS, calcGrossProfit, calcNetProfit, calcInventoryValue, roundToCents } from '../calculations';

export async function getInventoryValuation(params: { branch_id?: string; category_id?: string } = {}) {
  const sb: any = await getSB();
  let q = sb.from('product_batches').select('quantity_available, purchase_price, product_id, branch_id, products!inner(category_id)').eq('is_active', true).gt('quantity_available', 0);
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  // filter by category if needed
  let filtered = data as any[];
  if (params.category_id) filtered = filtered.filter((r:any)=>r.products?.category_id === params.category_id);
  const valuation = calcInventoryValue(filtered.map((r:any)=>({ quantity_available: r.quantity_available, purchase_price: r.purchase_price })));
  // by branch / product / category breakdown
  const byProductMap = new Map<string, number>();
  const byBranchMap = new Map<string, number>();
  for (const r of filtered) {
    byProductMap.set(r.product_id, (byProductMap.get(r.product_id)??0) + r.quantity_available * Number(r.purchase_price));
    byBranchMap.set(r.branch_id, (byBranchMap.get(r.branch_id)??0) + r.quantity_available * Number(r.purchase_price));
  }
  return { valuation, totalQty: filtered.reduce((s:any,r:any)=>s+r.quantity_available,0), byProduct: Object.fromEntries(byProductMap), byBranch: Object.fromEntries(byBranchMap), raw: filtered };
}

export async function getCOGSReport(params: { branch_id?: string; date_from?: string; date_to?: string } = {}) {
  const sb: any = await getSB();
  // Fetch sales + sale_items + batches cost
  let salesQ = sb.from('sales').select('id, sold_at, branch_id').eq('status','COMPLETED');
  if (params.branch_id) salesQ = salesQ.eq('branch_id', params.branch_id);
  if (params.date_from) salesQ = salesQ.gte('sold_at', params.date_from);
  if (params.date_to) salesQ = salesQ.lte('sold_at', params.date_to);
  const { data: sales } = await salesQ;
  const saleIds = (sales ?? []).map((s:any)=>s.id);
  if (saleIds.length===0) return { cogs:0, grossSales:0, netSales:0, grossProfit:0, margin:0, salesCount:0 };
  const itemsQ = sb.from('sale_items').select('quantity, unit_price, discount, tax, subtotal, product_id, batch_id, sale_id, product_batches(purchase_price)').in('sale_id', saleIds);
  const { data: items } = await itemsQ;
  // calculate
  const cogs = (items ?? []).reduce((s:any,it:any)=> s + Number(it.quantity) * Number(it.product_batches?.purchase_price ?? 0), 0);
  const grossSales = (items ?? []).reduce((s:any,it:any)=> s + Number(it.quantity)*Number(it.unit_price),0);
  const totalDiscount = (items ?? []).reduce((s:any,it:any)=> s+Number(it.discount),0);
  // refunds
  const refundQ = sb.from('returns').select('total').in('sale_id', saleIds).eq('status','completed');
  const { data: refunds } = await refundQ;
  const refundTotal = (refunds ?? []).reduce((s:any,r:any)=>s+Number(r.total),0);
  const netSales = roundToCents(grossSales - totalDiscount - refundTotal);
  const grossProfit = calcGrossProfit(netSales, cogs);
  const margin = netSales>0 ? roundToCents(grossProfit/netSales*100) : 0;
  return { cogs: roundToCents(cogs), grossSales: roundToCents(grossSales), totalDiscount: roundToCents(totalDiscount), refundTotal: roundToCents(refundTotal), netSales, grossProfit, margin, salesCount: saleIds.length, rawItems: items };
}

export async function getNetProfitReport(params: { branch_id?: string; date_from?: string; date_to?: string } = {}) {
  const cogsReport = await getCOGSReport(params);
  const sb: any = await getSB();
  let expQ = sb.from('expenses').select('amount').eq('status','APPROVED');
  if (params.branch_id) expQ = expQ.eq('branch_id', params.branch_id);
  if (params.date_from) expQ = expQ.gte('expense_date', params.date_from);
  if (params.date_to) expQ = expQ.lte('expense_date', params.date_to);
  const { data: exps } = await expQ;
  const totalExpenses = (exps ?? []).reduce((s:any,e:any)=>s+Number(e.amount),0);
  const netProfit = calcNetProfit(cogsReport.grossProfit, totalExpenses);
  return { ...cogsReport, totalExpenses: roundToCents(totalExpenses), netProfit };
}

export async function getSupplierBalance(supplierId: string) {
  const sb: any = await getSB();
  const { data, error } = await sb.rpc('get_supplier_balance', { p_supplier_id: supplierId, p_org_id: (await getOrgId()) });
  if (error) throw new Error(error.message);
  return data?.[0] ?? { purchased:0, paid:0, returned:0, balance:0 };
}
async function getOrgId() {
  const sb:any = await getSB();
  const { data:{user}} = await sb.auth.getUser();
  const { data } = await sb.from('profiles').select('organization_id').eq('auth_user_id', user.id).single();
  return data?.organization_id;
}
export async function getSupplierHistory(supplierId: string, params: { branch_id?: string; date_from?: string; date_to?: string } = {}) {
  const sb:any = await getSB();
  const poQ0 = sb.from('purchase_orders').select('id, purchase_number, status, total, ordered_at, branch_id').eq('supplier_id', supplierId).order('ordered_at', {ascending:false});
  const poQ = params.branch_id ? poQ0.eq('branch_id', params.branch_id) : poQ0;
  const payQ = sb.from('supplier_payments').select('amount, payment_date, payment_method, reference').eq('supplier_id', supplierId).order('payment_date', {ascending:false});
  const retQ = sb.from('purchase_returns').select('total, created_at').eq('supplier_id', supplierId).order('created_at', {ascending:false});
  const [pos, pays, rets] = await Promise.all([poQ, payQ, retQ]);
  return { purchases: pos.data ?? [], payments: pays.data ?? [], returns: rets.data ?? [] };
}

export async function getExpenseSummary(params: { branch_id?: string; date_from?: string; date_to?: string; groupBy?: 'category'|'branch' } = {}) {
  const sb:any = await getSB();
  let q = sb.from('expenses').select('amount, category, branch_id, expense_date');
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.date_from) q = q.gte('expense_date', params.date_from);
  if (params.date_to) q = q.lte('expense_date', params.date_to);
  const { data } = await q;
  const total = (data??[]).reduce((s:any,e:any)=>s+Number(e.amount),0);
  const byCategory: Record<string,number> = {};
  for (const e of (data??[])) byCategory[e.category] = (byCategory[e.category]??0)+Number(e.amount);
  return { total: roundToCents(total), count: (data??[]).length, byCategory };
}
