import { NextResponse } from 'next/server';
import { getGoodsReceipts } from '@/lib/services/purchases';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const po = searchParams.get('purchase_order_id');
    if (!po) return NextResponse.json({ error: 'purchase_order_id required' }, { status: 400 });
    const data = await getGoodsReceipts(po);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
