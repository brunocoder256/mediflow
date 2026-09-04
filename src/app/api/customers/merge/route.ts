import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
const Schema=z.object({ masterId: z.string().uuid(), duplicateId: z.string().uuid(), reason: z.string().max(500).optional().nullable() });
export async function POST(req: Request){
  try{
    const body=await req.json();
    const parsed=Schema.parse(body);
    const { mergeCustomers } = await import('@/lib/services/customers');
    const res=await mergeCustomers(parsed.masterId, parsed.duplicateId, parsed.reason ?? undefined);
    return NextResponse.json(res);
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}
