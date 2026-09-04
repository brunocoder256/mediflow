import { NextResponse } from 'next/server';
import { createPurchaseReturn, approvePurchaseReturn, completePurchaseReturn, getPurchaseReturns, getPurchaseReturnsKPIs } from '@/lib/services/purchase-returns';
import { purchaseReturnSchema } from '@/lib/validations/purchases';
import { getSB } from '@/lib/services/supabase';

export async function GET(request: Request){
  try{
    const { searchParams } = new URL(request.url);
    if(searchParams.get('kpi')==='1'){
      const branch_id = searchParams.get('branch_id') ?? undefined;
      const kpi = await getPurchaseReturnsKPIs(branch_id);
      return NextResponse.json(kpi);
    }
    const id = searchParams.get('id');
    if(id){
      const sb:any = await getSB();
      const { data, error } = await sb.from('purchase_returns').select('*, purchase_return_items(*, products(name,sku)), suppliers(name), purchase_orders(purchase_number, grn_number), branches(name)').eq('id', id).single();
      if(error) throw new Error(error.message);
      const [movs, audit] = await Promise.all([
        sb.from('stock_movements').select('*').eq('reference_id', id).eq('reference_type','PURCHASE_RETURN').then((r:any)=> r.data ?? []).catch(()=>[]),
        sb.from('audit_logs').select('*').eq('entity_id', id).order('created_at',{ascending:false}).limit(30).then((r:any)=> r.data ?? []).catch(()=>[]),
      ]);
      return NextResponse.json({ ...data, stock_movements: movs, audit_logs: audit });
    }
    const po = searchParams.get('purchase_order_id') ?? undefined;
    const sup = searchParams.get('supplier_id') ?? undefined;
    const branch_id = searchParams.get('branch_id') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
    const perPage = searchParams.get('perPage') ? parseInt(searchParams.get('perPage')!) : undefined;

    let data = await getPurchaseReturns(po, sup);
    // additional server filtering
    if(branch_id && branch_id!=='all') data = (data as any[]).filter((r:any)=> r.branch_id===branch_id);
    if(status && status!=='all') data = (data as any[]).filter((r:any)=> r.status===status);
    if(search){
      const s=search.toLowerCase();
      data = (data as any[]).filter((r:any)=> r.return_number?.toLowerCase().includes(s) || r.reason?.toLowerCase().includes(s) || r.suppliers?.name?.toLowerCase().includes(s) || (r.purchase_return_items??[]).some((it:any)=> it.batch_id?.toLowerCase().includes(s)));
    }
    if(page && perPage){
      const start=(page-1)*perPage;
      const sliced=(data as any[]).slice(start, start+perPage);
      return NextResponse.json({ data: sliced, count: (data as any[]).length });
    }
    return NextResponse.json({ data, count: (data as any[]).length });
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500});}
}
export async function POST(request: Request){
  try{
    const body = await request.json();
    if(body.action === 'approve'){
      const data = await approvePurchaseReturn(body.return_id ?? body.id);
      return NextResponse.json(data);
    }
    if(body.action === 'reject'){
      const sb:any = await getSB();
      const { data } = await sb.from('purchase_returns').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', body.return_id ?? body.id).select().single();
      return NextResponse.json(data);
    }
    if(body.action === 'complete'){
      const data = await completePurchaseReturn(body.return_id ?? body.id);
      return NextResponse.json(data);
    }
    if(body.action === 'cancel'){
      const sb:any = await getSB();
      const { data } = await sb.from('purchase_returns').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', body.return_id ?? body.id).select().single();
      return NextResponse.json(data);
    }
    // allow operation_id pass-through
    const payload = { ...body, operation_id: body.operation_id ?? body._operationId ?? undefined };
    // validate via schema but allow extra fields
    try{
      const parsed = purchaseReturnSchema.parse({ purchase_order_id: payload.purchase_order_id, supplier_id: payload.supplier_id, branch_id: payload.branch_id, reason: payload.reason, items: payload.items });
      const data = await createPurchaseReturn({ ...parsed as any, operation_id: payload.operation_id, reason_category: payload.reason_category, grn_id: payload.grn_id, resolution: payload.resolution } as any);
      return NextResponse.json(data,{status:201});
    }catch(parseErr:any){
      // fallback direct (e.g., offline payload with different shape)
      const data = await createPurchaseReturn(payload as any);
      return NextResponse.json(data,{status:201});
    }
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400});}
}
export async function PATCH(request: Request){
  try{
    const body = await request.json();
    if(body.action === 'approve') return NextResponse.json(await approvePurchaseReturn(body.return_id ?? body.id));
    if(body.action === 'complete') return NextResponse.json(await completePurchaseReturn(body.return_id ?? body.id));
    if(body.action === 'reject'){
      const sb:any = await getSB();
      const { data } = await sb.from('purchase_returns').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', body.return_id ?? body.id).select().single();
      return NextResponse.json(data);
    }
    if(body.action === 'cancel'){
      const sb:any = await getSB();
      const { data } = await sb.from('purchase_returns').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', body.return_id ?? body.id).select().single();
      return NextResponse.json(data);
    }
    return NextResponse.json({error:'Invalid action'},{status:400});
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400});}
}
