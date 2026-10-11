import { NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/security';
import { getSB, getOrgId } from '@/lib/services/supabase';

// Replay an offline inventory adjustment queued as table_name:"stock_movements".
// Idempotent via operation_id (stored as reference_id) so a retry can't apply
// the same adjustment twice.
export async function POST(req: Request){
  try{
    const body = await req.json();
    const batch_id = body.batch_id as string;
    const quantity = Number(body.quantity ?? 0);
    const reason = (body.reason as string) || null;
    const operation_id = (body.operation_id ?? body._operationId) as string | undefined;
    if(!batch_id || !quantity) return NextResponse.json({ error: 'batch_id and quantity required' },{status:400});
    const sb:any = await getSB();
    const orgId = await getOrgId();
    if(operation_id){
      const { data: existing } = await sb.from('stock_movements').select('id').eq('reference_type','ADJUSTMENT').eq('reference_id', operation_id).eq('organization_id', orgId).maybeSingle();
      if(existing) return NextResponse.json({ ok:true, id: existing.id, deduped:true });
    }
    const { data: batch, error: bErr } = await sb.from('product_batches').select('*').eq('id', batch_id).eq('organization_id', orgId).single();
    if(bErr || !batch) return NextResponse.json({ error: 'Batch not found' },{status:404});
    const newQty = Number(batch.quantity_available ?? 0) + quantity;
    if(newQty < 0) return NextResponse.json({ error: 'Result would be negative stock' },{status:400});
    const { error: uErr } = await sb.from('product_batches').update({ quantity_available: newQty, updated_at: new Date().toISOString() }).eq('id', batch_id);
    if(uErr) throw new Error(uErr.message);
    const { data: mov, error: mErr } = await sb.from('stock_movements').insert({
      organization_id: orgId,
      branch_id: batch.branch_id,
      product_id: batch.product_id,
      batch_id: batch.id,
      movement_type: quantity > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      quantity,
      reference_type: 'ADJUSTMENT',
      reference_id: operation_id ?? null,
      unit_cost: batch.purchase_price ?? batch.cost_price ?? null,
      notes: reason,
    }).select('id').single();
    if(mErr) throw new Error(mErr.message);
    return NextResponse.json({ ok:true, id: mov?.id, quantity_available: newQty },{status:201});
  }catch(e:any){ return NextResponse.json({ error: sanitizeError(e?.message ?? '') },{status:400}); }
}

export async function GET(req: Request){
  try{
    const sb:any = await getSB();
    const p=new URL(req.url).searchParams;
    const branch_id=p.get('branch_id') ?? undefined;
    const product_id=p.get('product_id') ?? undefined;
    const movement_type=p.get('movement_type') ?? undefined;
    const date_from=p.get('date_from') ?? undefined;
    const date_to=p.get('date_to') ?? undefined;
    const page=Number(p.get('page') ?? 1);
    const perPage=Number(p.get('perPage') ?? 20);
    let q=sb.from('stock_movements').select('id, product_id, batch_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_at, branch_id, created_by, products(name), product_batches(batch_number)', {count:'exact'}).order('created_at',{ascending:false});
    if(branch_id) q=q.eq('branch_id', branch_id);
    if(product_id) q=q.eq('product_id', product_id);
    if(movement_type) q=q.eq('movement_type', movement_type);
    if(date_from) q=q.gte('created_at', date_from);
    if(date_to) q=q.lte('created_at', date_to);
    const from=(page-1)*perPage;
    const {data, count, error}=await q.range(from, from+perPage-1);
    if(error) throw new Error(error.message);
    return NextResponse.json({data: data ?? [], count});
  }catch(e:any){ return NextResponse.json({ error: sanitizeError(e?.message ?? '') },{status:500}); }
}
