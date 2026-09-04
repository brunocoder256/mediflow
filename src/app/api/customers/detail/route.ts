import { NextResponse } from 'next/server';
import { getCustomerById, getCustomerSales, getCustomerPayments, getCustomerReturns, getCustomerNotes, getCustomerAudit, getCustomerLoyalty, getCustomerStatement } from '@/lib/services/customers';
export async function GET(req: Request){
  try{
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const tab = searchParams.get('tab') ?? 'overview';
    if(!id) return NextResponse.json({error:'id required'},{status:400});
    if(tab==='overview'){
      const customer = await getCustomerById(id);
      const [sales, payments, ret, notes, audit, loyalty, statement] = await Promise.all([
        getCustomerSales(id,1,5).catch(()=>({data:[],count:0})),
        getCustomerPayments(id,1,5).catch(()=>({data:[],count:0})),
        getCustomerReturns(id,1,5).catch(()=>({data:[],count:0})),
        getCustomerNotes(id).catch(()=>[]),
        getCustomerAudit(id).catch(()=>({logs:[], merges:[]})),
        getCustomerLoyalty(id).catch(()=>({ledger:[],total:0})),
        getCustomerStatement(id).catch(()=>({opening:0,closing:0,totalSales:0,totalPaid:0,totalReturns:0,entries:[]})),
      ]);
      return NextResponse.json({ customer, sales, payments, returns: ret, notes, audit, loyalty, statement });
    }
    if(tab==='sales'){
      const page=parseInt(searchParams.get('page')??'1');
      const perPage=parseInt(searchParams.get('perPage')??'20');
      const data=await getCustomerSales(id, page, perPage);
      return NextResponse.json(data);
    }
    if(tab==='payments'){
      const page=parseInt(searchParams.get('page')??'1');
      const perPage=parseInt(searchParams.get('perPage')??'20');
      const data=await getCustomerPayments(id, page, perPage);
      return NextResponse.json(data);
    }
    if(tab==='returns'){
      const page=parseInt(searchParams.get('page')??'1');
      const perPage=parseInt(searchParams.get('perPage')??'20');
      const data=await getCustomerReturns(id, page, perPage);
      return NextResponse.json(data);
    }
    if(tab==='notes'){
      const data=await getCustomerNotes(id);
      return NextResponse.json(data);
    }
    if(tab==='audit'){
      const data=await getCustomerAudit(id);
      return NextResponse.json(data);
    }
    if(tab==='loyalty'){
      const data=await getCustomerLoyalty(id);
      return NextResponse.json(data);
    }
    if(tab==='statement'){
      const from=searchParams.get('from') ?? undefined;
      const to=searchParams.get('to') ?? undefined;
      const data=await getCustomerStatement(id, from, to);
      return NextResponse.json(data);
    }
    const customer = await getCustomerById(id);
    return NextResponse.json(customer);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
