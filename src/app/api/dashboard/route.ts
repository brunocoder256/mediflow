import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';
import { getInventoryValuation, getNetProfitReport } from '@/lib/services/financial';

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branch_id = searchParams.get('branch_id') ?? undefined;
    const sb: any = await getSB();

    const now = new Date();
    const dateStr = (d: Date) => d.toISOString().slice(0, 10);
    const todayStart = `${dateStr(now)}T00:00:00`;
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const yesterdayStart = `${dateStr(yest)}T00:00:00`;
    const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 6); sevenAgo.setHours(0, 0, 0, 0);

    // Today's sales
    let salesQ = sb.from('sales').select('id, total, discount, tax, sale_number, sold_at, status').eq('status', 'COMPLETED').gte('sold_at', todayStart);
    if (branch_id) salesQ = salesQ.eq('branch_id', branch_id);
    const { data: todaySales } = await salesQ;

    // Yesterday's sales (for trends)
    let yQ = sb.from('sales').select('id, total, discount').eq('status', 'COMPLETED').gte('sold_at', yesterdayStart).lt('sold_at', todayStart);
    if (branch_id) yQ = yQ.eq('branch_id', branch_id);
    const { data: yesterdaySales } = await yQ;

    const netOf = (rows: any[]) => rows.reduce((s: number, r: any) => s + (Number(r.total) - Number(r.discount ?? 0)), 0);
    const todayRevenue = round2(netOf(todaySales ?? []));
    const todayCount = (todaySales ?? []).length;
    const yesterdayRevenue = round2(netOf(yesterdaySales ?? []));
    const yesterdayCount = (yesterdaySales ?? []).length;

    // Last 7 days series (daily net revenue + count)
    let weekQ = sb.from('sales').select('total, discount, sold_at').eq('status', 'COMPLETED').gte('sold_at', sevenAgo.toISOString());
    if (branch_id) weekQ = weekQ.eq('branch_id', branch_id);
    const { data: weekSales } = await weekQ;
    const series: Record<string, { label: string; revenue: number; count: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = dateStr(d);
      series[key] = { label: key.slice(5), revenue: 0, count: 0 };
    }
    for (const r of (weekSales ?? []) as any[]) {
      const key = dateStr(new Date(r.sold_at));
      if (series[key]) {
        series[key].revenue = round2(series[key].revenue + (Number(r.total) - Number(r.discount ?? 0)));
        series[key].count += 1;
      }
    }
    const salesSeries = Object.values(series);

    // Inventory alerts
    let batchQ = sb.from('product_batches').select('quantity_available, expiry_date, product_id, products(reorder_level)').eq('is_active', true);
    if (branch_id) batchQ = batchQ.eq('branch_id', branch_id);
    const { data: batches } = await batchQ;
    const low = (batches ?? []).filter((b: any) => b.quantity_available <= (b.products?.reorder_level ?? 10)).length;
    const nowDate = new Date(); const soon = new Date(); soon.setDate(soon.getDate() + 30);
    const expiring = (batches ?? []).filter((b: any) => { const d = new Date(b.expiry_date); return d > nowDate && d <= soon; }).length;
    const expired = (batches ?? []).filter((b: any) => new Date(b.expiry_date) <= nowDate).length;

    // Valuation & profit (today + prior comparison for profit/expenses)
    const [valuation, profit, yesterdayProfit] = await Promise.all([
      getInventoryValuation({ branch_id }),
      getNetProfitReport({ branch_id, date_from: todayStart }),
      getNetProfitReport({ branch_id, date_from: yesterdayStart, date_to: todayStart }),
    ]);

    // Pending purchases
    let poQ = sb.from('purchase_orders').select('id').in('status', ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED']);
    if (branch_id) poQ = poQ.eq('branch_id', branch_id);
    const { data: pendingPO } = await poQ;

    // Open cash session
    let sessQ = sb.from('cash_sessions').select('id, status').eq('status', 'OPEN');
    if (branch_id) sessQ = sessQ.eq('branch_id', branch_id);
    const { data: openSess } = await sessQ.limit(1).maybeSingle();

    // Top products by revenue today (with qty)
    const saleIds = (todaySales ?? []).map((s: any) => s.id);
    let topProducts: any[] = [];
    if (saleIds.length) {
      const { data: items } = await sb.from('sale_items').select('product_id, quantity, unit_price, discount, products(name)').in('sale_id', saleIds);
      const map: Record<string, { name: string; qty: number; revenue: number }> = {};
      for (const it of (items ?? []) as any[]) {
        const pid = it.product_id;
        if (!map[pid]) map[pid] = { name: it.products?.name ?? pid, qty: 0, revenue: 0 };
        map[pid].qty += Number(it.quantity);
        map[pid].revenue = round2(map[pid].revenue + (Number(it.unit_price) * Number(it.quantity) - Number(it.discount ?? 0)));
      }
      topProducts = Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5).map(([id, v]) => ({ product_id: id, ...v }));
    }

    return NextResponse.json({
      todaySales: todayRevenue,
      todaySalesGross: round2((todaySales ?? []).reduce((s: number, r: any) => s + Number(r.total), 0)),
      todayCount,
      todaySalesLast: yesterdayRevenue,
      todayCountLast: yesterdayCount,
      grossProfit: round2(profit.grossProfit),
      grossProfitLast: round2(yesterdayProfit.grossProfit),
      expenses: round2(profit.totalExpenses),
      expensesLast: round2(yesterdayProfit.totalExpenses),
      netProfit: round2(profit.netProfit),
      inventoryValue: valuation.valuation,
      lowStock: low,
      expiringSoon: expiring,
      expired,
      pendingPurchases: (pendingPO ?? []).length,
      openCashSession: openSess ?? null,
      topProducts,
      recentTxns: (todaySales ?? []).slice(0, 5),
      salesSeries,
    });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}