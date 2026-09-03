import { NextResponse } from 'next/server';
import { getTransfers, createTransfer, requestTransfer, approveTransfer, shipTransfer, receiveTransfer } from '@/lib/services/transfers';
import { z } from 'zod/v4';

export async function GET(req: Request){
  try{
    const p=new URL(req.url).searchParams;
    const data=await getTransfers({ branch_id: p.get('branch_id') ?? undefined, status: p.get('status') ?? undefined });
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
const CreateSchema=z.object({
  source_branch_id: z.string().uuid(),
  destination_branch_id: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(z.object({ product_id: z.string().uuid(), batch_id: z.string().uuid().optional().nullable(), quantity: z.number().int().min(1), unit_cost: z.number().min(0) })).min(1)
});
export async function POST(req: Request){
  try{
    const body=await req.json();
    if(body.action==='approve') return NextResponse.json(await approveTransfer(body.id));
    if(body.action==='request') return NextResponse.json(await requestTransfer(body.id));
    if(body.action==='ship') return NextResponse.json(await shipTransfer(body.id));
    if(body.action==='receive') return NextResponse.json(await receiveTransfer(body.id));
    const parsed=CreateSchema.parse(body);
    const data=await createTransfer(parsed as any);
    return NextResponse.json(data,{status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}
