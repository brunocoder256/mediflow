import { NextResponse } from 'next/server';
export async function GET(req: Request){
  try{
    const { searchParams } = new URL(req.url);
    const customer_id=searchParams.get('customer_id');
    if(!customer_id) return NextResponse.json({error:'customer_id required'},{status:400});
    const from=searchParams.get('from') ?? undefined;
    const to=searchParams.get('to') ?? undefined;
    const { getCustomerStatement } = await import('@/lib/services/customers');
    const data=await getCustomerStatement(customer_id, from, to);
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
