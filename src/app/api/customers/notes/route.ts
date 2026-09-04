import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
export async function GET(req: Request){
  try{
    const { searchParams } = new URL(req.url);
    const customer_id=searchParams.get('customer_id');
    if(!customer_id) return NextResponse.json({error:'customer_id required'},{status:400});
    const { getCustomerNotes } = await import('@/lib/services/customers');
    const data=await getCustomerNotes(customer_id);
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
const Schema=z.object({ customer_id: z.string().uuid(), content: z.string().min(1).max(2000), visibility: z.enum(['INTERNAL','SHARED']).optional() });
export async function POST(req: Request){
  try{
    const body=await req.json();
    const parsed=Schema.parse(body);
    const { addCustomerNote } = await import('@/lib/services/customers');
    const data=await addCustomerNote(parsed.customer_id, parsed.content, parsed.visibility ?? 'INTERNAL');
    return NextResponse.json(data,{status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}
