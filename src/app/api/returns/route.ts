import { NextResponse } from 'next/server';
import { getReturns, getReturnsKPIs, getReturnById, createReturn, updateReturnStatus, createRefund, getRefunds, completeRefund } from '@/lib/services/returns';
import { getSB } from '@/lib/services/supabase';
import { z } from 'zod/v4';

const ReturnSchema = z.object({
  sale_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  operation_id: z.string().optional(),
  reason: z.string().optional(),
  reason_category: z.string().optional(),
  resolution: z.string().optional(),
  refund_method: z.string().optional(),
  items: z.array(z.object({
    sale_item_id: z.string().uuid(),
    product_id: z.string().uuid(),
    batch_id: z.string().uuid(),
    quantity: z.number().int().min(1),
    reason: z.string().optional(),
    reason_category: z.string().optional(),
    return_condition: z.string().optional(),
    condition: z.string().optional(),
    inventory_destination: z.string().optional()
  })).min(1),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if(searchParams.get('kpi')==='1'){
      const branch_id = searchParams.get('branch_id') ?? undefined;
      const kpi = await getReturnsKPIs(branch_id);
      // also purchase KPIs for dashboard unified
      try{
        const { getPurchaseReturnsKPIs } = await import('@/lib/services/purchase-returns');
        const pkpi = await getPurchaseReturnsKPIs(branch_id);
        return NextResponse.json({ sales: kpi, purchase: pkpi });
      }catch{ return NextResponse.json({ sales: kpi }); }
    }
    if(id){
      const detail = await getReturnById(id);
      return NextResponse.json(detail);
    }
    const branch_id = searchParams.get('branch_id') ?? undefined;
    const page = parseInt(searchParams.get('page') ?? '1');
    const perPage = parseInt(searchParams.get('perPage') ?? '20');
    const search = searchParams.get('search') ?? searchParams.get('q') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const reason = searchParams.get('reason') ?? undefined;
    const refund_status = searchParams.get('refund_status') ?? undefined;
    const date_from = searchParams.get('date_from') ?? undefined;
    const date_to = searchParams.get('date_to') ?? undefined;
    const product_id = searchParams.get('product_id') ?? undefined;
    const batch_id = searchParams.get('batch_id') ?? undefined;

    // unified? if type=purchase we delegate
    const type = searchParams.get('type');
    if(type==='purchase'){
      const { getPurchaseReturns } = await import('@/lib/services/purchase-returns');
      const data = await getPurchaseReturns(undefined, undefined);
      // simple filter already done client, but we can pass through
      return NextResponse.json({ data, count: data.length });
    }

    const data = await getReturns({ branch_id, page, perPage, search, status, reason, refund_status, date_from, date_to, product_id, batch_id });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request){
  try{
    const body = await req.json();
    // status transitions
    if(body.action === 'status'){
      const data = await updateReturnStatus(body.id ?? body.return_id, body.status, { rejection_reason: body.rejection_reason });
      return NextResponse.json(data);
    }
    if(body.action === 'approve'){
      const data = await updateReturnStatus(body.id ?? body.return_id, 'approved');
      return NextResponse.json(data);
    }
    if(body.action === 'reject'){
      const data = await updateReturnStatus(body.id ?? body.return_id, 'rejected', { rejection_reason: body.reason });
      return NextResponse.json(data);
    }
    if(body.action === 'complete'){
      const data = await updateReturnStatus(body.id ?? body.return_id, 'completed');
      return NextResponse.json(data);
    }
    if(body.action === 'cancel'){
      const data = await updateReturnStatus(body.id ?? body.return_id, 'cancelled');
      return NextResponse.json(data);
    }
    if(body.action === 'refund'){
      const data = await createRefund({ return_id: body.return_id, sale_id: body.sale_id, branch_id: body.branch_id, amount: body.amount, payment_method: body.payment_method, reference: body.reference, reason: body.reason, operation_id: body.operation_id });
      return NextResponse.json(data,{status:201});
    }
    if(body.action === 'complete_refund'){
      const data = await completeRefund(body.refund_id);
      return NextResponse.json(data);
    }
    // normal create
    const parsed = ReturnSchema.parse(body);
    const data = await createReturn({ sale_id: parsed.sale_id, branch_id: parsed.branch_id, operation_id: (body as any).operation_id, reason: parsed.reason, reason_category: parsed.reason_category, resolution: parsed.resolution, refund_method: parsed.refund_method, items: parsed.items as any });
    return NextResponse.json(data, {status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}

export async function PATCH(req: Request){
  try{
    const body = await req.json();
    if(body.action){
      // reuse POST actions
      const fakeReq = { json: async()=> body } as any;
      // delegate to POST logic via direct call
      if(['status','approve','reject','complete','cancel','refund','complete_refund'].includes(body.action)){
        const r = await POST(new Request('http://x', { method:'POST', body: JSON.stringify(body), headers:{'Content-Type':'application/json'} }));
        const j = await r.json();
        return NextResponse.json(j, { status: r.status });
      }
    }
    return NextResponse.json({error:'Invalid action'},{status:400});
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400});}
}
