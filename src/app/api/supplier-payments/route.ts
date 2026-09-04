import { NextResponse } from 'next/server';
import { recordSupplierPayment, getSupplierPayments } from '@/lib/services/supplier-payments';
import { supplierPaymentSchema } from '@/lib/validations/purchases';
import { getSB } from '@/lib/services/supabase';

export async function GET(request: Request){
  try{
    const { searchParams } = new URL(request.url);
    const supplier_id = searchParams.get('supplier_id') ?? undefined;
    const branch_id = searchParams.get('branch_id') ?? undefined;
    const purchase_order_id = searchParams.get('purchase_order_id') ?? undefined;
    if(purchase_order_id){
      const sb:any = await getSB();
      const { data } = await sb.from('supplier_payments').select('*, suppliers(name)').eq('purchase_order_id', purchase_order_id).order('payment_date', {ascending:false});
      return NextResponse.json(data ?? []);
    }
    const data = await getSupplierPayments(supplier_id, branch_id);
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500});}
}
export async function POST(request: Request){
  try{
    const body = await request.json();
    const parsed = supplierPaymentSchema.parse(body);
    const data = await recordSupplierPayment(parsed as any);
    return NextResponse.json(data,{status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400});}
}
