import { NextResponse } from 'next/server';
import { getStockOverview, getLowStockItems, getExpiringItems, getExpiredItems, getInventoryValue } from '@/lib/services/batches';

export async function GET() {
    try {
        const [stock, lowStock, expiring, expired, value] = await Promise.all([
            getStockOverview(),
            getLowStockItems(),
            getExpiringItems(30),
            getExpiredItems(),
            getInventoryValue(),
        ]);
        return NextResponse.json({ stock, lowStock, expiring, expired, inventoryValue: value });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}