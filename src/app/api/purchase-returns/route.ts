import { NextResponse } from 'next/server';
import { createPurchaseReturn, approvePurchaseReturn, completePurchaseReturn, getPurchaseReturns } from '@/lib/services/purchase-returns';
import { purchaseReturnSchema } from '@/lib/validations/purchases';

export async function GET(request: Request){
  try{
    const { searchParams } = new URL(request.url);
    const po = searchParams.get('purchase_order_id') ?? undefined;
    const sup = searchParams.get('supplier_id') ?? undefined;
    const data = await getPurchaseReturns(po, sup);
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500});}
}
export async function POST(request: Request){
  try{
    const body = await request.json();
    if(body.action === 'approve'){
      const data = await approvePurchaseReturn(body.return_id);
      return NextResponse.json(data);
    }
    if(body.action === 'complete'){
      const data = await completePurchaseReturn(body.return_id);
      return NextResponse.json(data);
    }
    const parsed = purchaseReturnSchema.parse(body);
    const data = await createPurchaseReturn(parsed as any);
    return NextResponse.json(data,{status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400});}
}
export async function PATCH(request: Request){
  try{
    const body = await request.json();
    if(body.action === 'approve') return NextResponse.json(await approvePurchaseReturn(body.return_id));
    if(body.action === 'complete') return NextResponse.json(await completePurchaseReturn(body.return_id));
    return NextResponse.json({error:'Invalid action'},{status:400});
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400});}
}
