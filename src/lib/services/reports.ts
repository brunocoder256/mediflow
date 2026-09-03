/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB } from './supabase';

export async function getSalesReport(params: { branch_id?: string; cashier_id?: string; payment_method?: string; product_id?: string; category_id?: string; date_from?: string; date_to?: string; page?: number; perPage?: number }) {
  const sb:any = await getSB();
  const { page=1, perPage=50, ...f } = params;
  let q = sb.from('sales').select('id, sale_number, branch_id, cashier_id, total, subtotal, discount, tax, status, sold_at, customer_id', { count:'exact' }).eq('status','COMPLETED').order('sold_at', {ascending:false});
  if (f.branch_id) q=q.eq('branch_id', f.branch_id);
  if (f.cashier_id) q=q.eq('cashier_id', f.cashier_id);
  if (f.date_from) q=q.gte('sold_at', f.date_from);
  if (f.date_to) q=q.lte('sold_at', f.date_to);
  const from=(page-1)*perPage;
  const { data, count, error } = await q.range(from, from+perPage-1);
  if(error) throw new Error(error.message);
  // payment method filter requires join
  let filtered = data ?? [];
  if (f.payment_method) {
    const { data: pays } = await sb.from('payments').select('sale_id').eq('payment_method', f.payment_method);
    const ids = new Set((pays??[]).map((p:any)=>p.sale_id));
    filtered = filtered.filter((s:any)=>ids.has(s.id));
  }
  // product/category filter
  if (f.product_id || f.category_id) {
    const prodQ = f.product_id ? sb.from('sale_items').select('sale_id').eq('product_id', f.product_id) : sb.from('sale_items').select('sale_id, products!inner(category_id)').eq('products.category_id', f.category_id);
    const { data: sitems } = await prodQ;
    const ids2 = new Set((sitems??[]).map((si:any)=>si.sale_id));
    filtered = filtered.filter((s:any)=>ids2.has(s.id));
  }
  return { data: filtered, count };
}
export async function getSalesAggregates(params: { branch_id?: string; date_from?: string; date_to?: string }) {
  const { data } = await getSalesReport({ ...params, page:1, perPage:1000 });
  const totalRevenue = (data??[]).reduce((s:any,r:any)=>s+Number(r.total),0);
  const totalDiscount = (data??[]).reduce((s:any,r:any)=>s+Number(r.discount),0);
  const totalTax = (data??[]).reduce((s:any,r:any)=>s+Number(r.tax),0);
  const count = (data??[]).length;
  const avgOrder = count? totalRevenue/count:0;
  return { totalRevenue, totalDiscount, totalTax, count, avgOrder };
}
export async function getInventoryReports(params: { branch_id?: string }) {
  const sb:any = await getSB();
  let batchesQ = sb.from('product_batches').select('id, product_id, branch_id, batch_number, expiry_date, quantity_available, purchase_price, selling_price, is_active, products(name, reorder_level, category_id)').eq('is_active', true);
  if (params.branch_id) batchesQ=batchesQ.eq('branch_id', params.branch_id);
  const { data: batches } = await batchesQ;
  const now = new Date();
  const soon = new Date(); soon.setDate(soon.getDate()+30);
  const current = batches ?? [];
  const low = current.filter((b:any)=> b.quantity_available <= (b.products?.reorder_level ?? 10));
  const expired = current.filter((b:any)=> new Date(b.expiry_date) <= now);
  const expiring = current.filter((b:any)=> { const d=new Date(b.expiry_date); return d>now && d<=soon; });
  return { current, low, expired, expiring };
}
export async function getPurchasingReport(params: { branch_id?: string; supplier_id?: string; date_from?: string; date_to?: string }) {
  const sb:any = await getSB();
  let q = sb.from('purchase_orders').select('id, purchase_number, supplier_id, branch_id, status, total, ordered_at, received_at', {count:'exact'}).order('ordered_at', {ascending:false});
  if (params.branch_id) q=q.eq('branch_id', params.branch_id);
  if (params.supplier_id) q=q.eq('supplier_id', params.supplier_id);
  if (params.date_from) q=q.gte('ordered_at', params.date_from);
  if (params.date_to) q=q.lte('ordered_at', params.date_to);
  const { data, count } = await q;
  // outstanding per supplier via rpc
  return { data: data??[], count: count??0 };
}
export async function getStaffReport(params: { branch_id?: string; date_from?: string; date_to?: string }) {
  const sb:any = await getSB();
  let salesQ = sb.from('sales').select('cashier_id, total, discount, status, sold_at').eq('status','COMPLETED');
  if (params.branch_id) salesQ=salesQ.eq('branch_id', params.branch_id);
  if (params.date_from) salesQ=salesQ.gte('sold_at', params.date_from);
  if (params.date_to) salesQ=salesQ.lte('sold_at', params.date_to);
  const { data: sales } = await salesQ;
  // void/returns counts
  let voidQ = sb.from('sales').select('cashier_id').eq('status','VOIDED');
  if (params.branch_id) voidQ=voidQ.eq('branch_id', params.branch_id);
  const { data: voids } = await voidQ;
  const byCashier: Record<string, any> = {};
  for (const s of (sales??[])) {
    const id=s.cashier_id;
    if(!byCashier[id]) byCashier[id]={ salesCount:0, revenue:0, discounts:0, voids:0 };
    byCashier[id].salesCount+=1;
    byCashier[id].revenue+=Number(s.total);
    byCashier[id].discounts+=Number(s.discount);
  }
  for (const v of (voids??[])) {
    if(!byCashier[v.cashier_id]) byCashier[v.cashier_id]={ salesCount:0, revenue:0, discounts:0, voids:0 };
    byCashier[v.cashier_id].voids+=1;
  }
  // enrich with profile names
  const ids = Object.keys(byCashier);
  const names: Record<string,string> = {};
  if (ids.length) {
    const { data: profs } = await sb.from('profiles').select('id, full_name').in('id', ids);
    for (const p of (profs??[])) names[p.id]=p.full_name;
  }
  return Object.entries(byCashier).map(([id, v]:any)=>({ cashier_id:id, cashier_name: names[id]??id, ...v }));
}
export async function getCashReport(params: { branch_id?: string; date_from?: string; date_to?: string }) {
  const sb:any = await getSB();
  let q = sb.from('cash_sessions').select('id, register_id, branch_id, cashier_id, status, opening_float, expected_cash, closing_cash, cash_variance, opened_at, closed_at').order('opened_at',{ascending:false});
  if (params.branch_id) q=q.eq('branch_id', params.branch_id);
  if (params.date_from) q=q.gte('opened_at', params.date_from);
  if (params.date_to) q=q.lte('opened_at', params.date_to);
  const { data } = await q;
  return data ?? [];
}
