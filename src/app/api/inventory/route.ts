import { NextResponse } from 'next/server';
import { getStockOverview, getLowStockItems, getExpiringItems, getExpiredItems, getInventoryValue } from '@/lib/services/batches';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branch_id = searchParams.get('branch_id');
        const daysParam = searchParams.get('days');
        const days = daysParam ? Number(daysParam) : 30;
        const thresholdDays = isNaN(days) ? 30 : days;

        const [stock, lowStock, expiring, expired, value, exp7, exp30, exp60, exp90] = await Promise.all([
            getStockOverview(),
            getLowStockItems(),
            getExpiringItems(thresholdDays),
            getExpiredItems(),
            getInventoryValue(),
            getExpiringItems(7),
            getExpiringItems(30),
            getExpiringItems(60),
            getExpiringItems(90),
        ]);

        // Branch filtering (single source of truth remains product_batches)
        const filterByBranch = (rows: any[]) => branch_id ? rows.filter((r: any) => r.branch_id === branch_id) : rows;

        // Also fetch transfers pending for KPI
        let pendingTransfers = 0;
        let pendingReceipts = 0;
        try {
            const { getSB } = await import('@/lib/services/supabase');
            const sb: any = await getSB();
            const { data: transfers } = await sb.from('transfers').select('id').in('status', ['DRAFT','REQUESTED','APPROVED','IN_TRANSIT']).limit(100);
            pendingTransfers = (transfers ?? []).length;
            const { data: purchases } = await sb.from('purchase_orders').select('id').in('status', ['ORDERED','PARTIALLY_RECEIVED']).limit(100);
            pendingReceipts = (purchases ?? []).length;
        } catch {}

        return NextResponse.json({
            stock: filterByBranch(stock as any),
            lowStock: filterByBranch(lowStock as any),
            expiring: filterByBranch(expiring as any),
            expired: filterByBranch(expired as any),
            inventoryValue: value,
            buckets: {
                exp7: filterByBranch(exp7 as any),
                exp30: filterByBranch(exp30 as any),
                exp60: filterByBranch(exp60 as any),
                exp90: filterByBranch(exp90 as any),
            },
            kpi: {
                pendingTransfers,
                pendingReceipts,
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
