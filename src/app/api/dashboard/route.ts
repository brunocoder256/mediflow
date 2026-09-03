import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';
import { getInventoryValuation, getNetProfitReport } from '@/lib/services/financial';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branch_id = searchParams.get('branch_id') ?? undefined;
    const sb: any = await getSB();
    const today = new Date().toISOString().slice(0,10);
    const todayStart = `${today}T00:00:00`;
    // today's sales
    let salesQ = sb.from('sales').select('id, total, discount, tax').eq('status','COMPLETED').gte('sold_at', todayStart);
    if (branch_id) salesQ = salesQ.eq('branch_id', branch_id);
    const { data: todaySales } = await salesQ;
    const todayRevenue = (todaySales ?? []).reduce((s:any,r:any)=>s+Number(r.total),0);
    const todayCount = (todaySales ?? []).length;

    // inventory alerts
    let batchQ = sb.from('product_batches').select('quantity_available, expiry_date, product_id, products(reorder_level)').eq('is_active', true);
    if (branch_id) batchQ = batchQ.eq('branch_id', branch_id);
    const { data: batches } = await batchQ;
    const low = (batches ?? []).filter((b:any)=> b.quantity_available <= (b.products?.reorder_level ?? 10)).length;
    const now = new Date(); const soon = new Date(); soon.setDate(soon.getDate()+30);
    const expiring = (batches ?? []).filter((b:any)=>{ const d=new Date(b.expiry_date); return d>now && d<=soon; }).length;
    const expired = (batches ?? []).filter((b:any)=> new Date(b.expiry_date) <= now).length;

    // valuation & profit
    const [valuation, profit] = await Promise.all([
      getInventoryValuation({ branch_id }),
      getNetProfitReport({ branch_id, date_from: todayStart }),
    ]);

    // pending purchases
    let poQ = sb.from('purchase_orders').select('id').in('status',['DRAFT','ORDERED','PARTIALLY_RECEIVED']);
    if (branch_id) poQ = poQ.eq('branch_id', branch_id);
    const { data: pendingPO } = await poQ;

    // open cash session
    let sessQ = sb.from('cash_sessions').select('id, status').eq('status','OPEN');
    if (branch_id) sessQ = sessQ.eq('branch_id', branch_id);
    const { data: openSess } = await sessQ.limit(1).maybeSingle();

    // top products (by sale_items quantity today)
    const saleIds = (todaySales ?? []).map((s:any)=>s.id);
    let topProducts: any[] = [];
    if (saleIds.length) {
      const { data: items } = await sb.from('sale_items').select('product_id, quantity, products(name)').in('sale_id', saleIds);
      const map: Record<string, { name:string; qty:number }> = {};
      for (const it of (items ?? [])) {
        const pid=it.product_id; if(!map[pid]) map[pid]={ name: it.products?.name ?? pid, qty:0 }; map[pid].qty+=Number(it.quantity);
      }
      topProducts = Object.entries(map).sort((a,b)=>b[1].qty - a[1].qty).slice(0,5).map(([id,v])=>({ product_id:id, ...v }));
    }

    return NextResponse.json({
      todaySales: todayRevenue,
      todayCount,
      grossProfit: profit.grossProfit,
      expenses: profit.totalExpenses,
      netProfit: profit.netProfit,
      inventoryValue: valuation.valuation,
      lowStock: low,
      expiringSoon: expiring,
      expired,
      pendingPurchases: (pendingPO ?? []).length,
      openCashSession: openSess ?? null,
      topProducts,
      recentTxns: (todaySales ?? []).slice(0,5),
    });
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
