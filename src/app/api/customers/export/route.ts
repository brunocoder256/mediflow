import { NextResponse } from 'next/server';
import { listCustomers } from '@/lib/services/customers';
export async function GET(req: Request){
  try{
    const { searchParams } = new URL(req.url);
    const search=searchParams.get('search')??undefined;
    const customer_type=searchParams.get('customer_type')??undefined;
    const status=searchParams.get('status')??undefined;
    const branch_id=searchParams.get('branch_id')??undefined;
    // fetch up to 5000 for export respecting filters
    const { data } = await listCustomers({ search, customer_type, status, branch_id, page:1, perPage:5000 });
    return NextResponse.json({ data, count: data.length });
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
