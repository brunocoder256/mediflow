import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';

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
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
