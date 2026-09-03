import { NextResponse } from 'next/server';
import { createStockCount, getStockCounts, getStockCountById, approveStockCount, postStockCount } from '@/lib/services/stock-counts';
import { z } from 'zod/v4';

export async function GET(req: Request){
  try{
    const p=new URL(req.url).searchParams;
    const id=p.get('id');
    if(id){ const d=await getStockCountById(id); return NextResponse.json(d); }
    const data=await getStockCounts({ branch_id: p.get('branch_id') ?? undefined, status: p.get('status') ?? undefined, page: Number(p.get('page') ?? 1), perPage: Number(p.get('perPage') ?? 20) });
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
const CreateSchema=z.object({ branch_id: z.string().uuid(), name: z.string().min(1), scope_type: z.enum(['PRODUCT','CATEGORY','ALL']).optional(), scope_id: z.string().uuid().optional().nullable() });
export async function POST(req: Request){
  try{
    const body=await req.json();
    if(body.action==='approve') return NextResponse.json(await approveStockCount(body.id, body.reason ?? 'Approved'));
    if(body.action==='post') return NextResponse.json(await postStockCount(body.id));
    const parsed=CreateSchema.parse(body);
    const data=await createStockCount({ branch_id: parsed.branch_id, name: parsed.name, scope_type: parsed.scope_type ?? 'ALL', scope_id: parsed.scope_id ?? undefined } as any);
    return NextResponse.json(data,{status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}
