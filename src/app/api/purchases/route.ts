import { NextResponse } from 'next/server';
import { getPurchases, getPurchaseById, createPurchase, receivePurchase } from '@/lib/services/purchases';
import { z } from 'zod/v4';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branch_id = searchParams.get('branch_id') ?? undefined;
        const status = searchParams.get('status') ?? undefined;
        const page = parseInt(searchParams.get('page') ?? '1');
        const perPage = parseInt(searchParams.get('perPage') ?? '20');
        const id = searchParams.get('id');
        if(id){ const d=await getPurchaseById(id); return NextResponse.json(d); }
        const data = await getPurchases({ branch_id, status, page, perPage });
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
const CreateSchema = z.object({
  branch_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  items: z.array(z.object({ product_id: z.string().uuid(), quantity_ordered: z.number().int().min(1), unit_cost: z.number().min(0), discount: z.number().min(0).optional(), tax: z.number().min(0).optional() })).min(1)
});
export async function POST(request: Request){
  try{
    const body = await request.json();
    if(body.action === 'receive'){
      const data = await receivePurchase({ purchase_order_id: body.purchase_order_id, received_items: body.received_items });
      return NextResponse.json(data, {status:201});
    }
    const parsed = CreateSchema.parse(body);
    const normalized = { ...parsed, items: parsed.items.map(i=>({ ...i, discount: i.discount ?? 0, tax: i.tax ?? 0 })) };
    const data = await createPurchase(normalized as any);
    return NextResponse.json(data, {status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}