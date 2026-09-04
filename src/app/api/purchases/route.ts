import { NextResponse } from 'next/server';
import { getPurchases, getPurchaseById, createPurchase, receivePurchase, updatePurchaseStatus, cancelPurchase, getPurchaseKPIs } from '@/lib/services/purchases';
import { createPurchaseSchema, receivePurchaseSchema, purchaseStatusSchema } from '@/lib/validations/purchases';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branch_id = searchParams.get('branch_id') ?? undefined;
        const status = searchParams.get('status') ?? undefined;
        const supplier_id = searchParams.get('supplier_id') ?? undefined;
        const search = searchParams.get('search') ?? searchParams.get('q') ?? undefined;
        const date_from = searchParams.get('date_from') ?? undefined;
        const date_to = searchParams.get('date_to') ?? undefined;
        const product_id = searchParams.get('product_id') ?? undefined;
        const page = parseInt(searchParams.get('page') ?? '1');
        const perPage = parseInt(searchParams.get('perPage') ?? '20');
        const kpi = searchParams.get('kpi');
        const id = searchParams.get('id');
        if (kpi === '1' || kpi === 'true') {
            const data = await getPurchaseKPIs(branch_id);
            return NextResponse.json(data);
        }
        if(id){ const d=await getPurchaseById(id); return NextResponse.json(d); }
        const data = await getPurchases({ branch_id, status, supplier_id, search, date_from, date_to, product_id, page, perPage });
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
export async function POST(request: Request){
  try{
    const body = await request.json();
    if(body.action === 'receive'){
      const parsed = receivePurchaseSchema.parse({ purchase_order_id: body.purchase_order_id, received_items: body.received_items });
      const data = await receivePurchase(parsed as any);
      return NextResponse.json(data, {status:201});
    }
    if(body.action === 'status'){
      const parsed = purchaseStatusSchema.parse({ purchase_order_id: body.purchase_order_id, status: body.status });
      const data = await updatePurchaseStatus(parsed.purchase_order_id, parsed.status);
      return NextResponse.json(data);
    }
    if(body.action === 'cancel'){
      const data = await cancelPurchase(body.purchase_order_id);
      return NextResponse.json(data);
    }
    const parsed = createPurchaseSchema.parse(body);
    const normalized = { ...parsed, items: parsed.items.map(i=>({ ...i, discount: i.discount ?? 0, tax: i.tax ?? 0 })) };
    const data = await createPurchase(normalized as any);
    return NextResponse.json(data, {status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}
export async function PATCH(request: Request){
  try{
    const body = await request.json();
    if(body.action === 'cancel' || body.status === 'CANCELLED'){
      const data = await cancelPurchase(body.purchase_order_id ?? body.id);
      return NextResponse.json(data);
    }
    if(body.purchase_order_id && body.status){
      const parsed = purchaseStatusSchema.parse({ purchase_order_id: body.purchase_order_id, status: body.status });
      const data = await updatePurchaseStatus(parsed.purchase_order_id, parsed.status);
      return NextResponse.json(data);
    }
    return NextResponse.json({error:'Invalid PATCH payload'},{status:400});
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400}); }
}
