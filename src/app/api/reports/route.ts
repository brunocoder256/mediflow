import { NextResponse } from 'next/server';
import { getSalesReport, getSalesAggregates, getInventoryReports, getPurchasingReport, getStaffReport, getCashReport } from '@/lib/services/reports';
import { getCOGSReport, getNetProfitReport, getInventoryValuation, getExpenseSummary } from '@/lib/services/financial';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? 'sales';
    const branch_id = searchParams.get('branch_id') ?? undefined;
    const date_from = searchParams.get('date_from') ?? undefined;
    const date_to = searchParams.get('date_to') ?? undefined;
    const cashier_id = searchParams.get('cashier_id') ?? undefined;
    const payment_method = searchParams.get('payment_method') ?? undefined;

    if (type === 'sales') {
      const [sales, agg] = await Promise.all([getSalesReport({ branch_id, cashier_id, payment_method, date_from, date_to }), getSalesAggregates({ branch_id, date_from, date_to })]);
      return NextResponse.json({ sales, aggregates: agg });
    }
    if (type === 'financial') {
      const [cogs, net, exp] = await Promise.all([getCOGSReport({ branch_id, date_from, date_to }), getNetProfitReport({ branch_id, date_from, date_to }), getExpenseSummary({ branch_id, date_from, date_to })]);
      return NextResponse.json({ cogs, netProfit: net, expenses: exp });
    }
    if (type === 'inventory') {
      const inv = await getInventoryReports({ branch_id });
      const val = await getInventoryValuation({ branch_id });
      return NextResponse.json({ ...inv, valuation: val });
    }
    if (type === 'purchasing') {
      const data = await getPurchasingReport({ branch_id, date_from, date_to });
      return NextResponse.json(data);
    }
    if (type === 'staff') {
      const data = await getStaffReport({ branch_id, date_from, date_to });
      return NextResponse.json(data);
    }
    if (type === 'cash') {
      const data = await getCashReport({ branch_id, date_from, date_to });
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
