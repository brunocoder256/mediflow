import { NextResponse } from 'next/server';
import { getExpenses, getExpenseSummary } from '@/lib/services/expenses';
import { getSB, getProfileId } from '@/lib/services/supabase';
import { z } from 'zod/v4';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branch_id = searchParams.get('branch_id') ?? undefined;
        const date_from = searchParams.get('date_from') ?? undefined;
        const date_to = searchParams.get('date_to') ?? undefined;
        const page = parseInt(searchParams.get('page') ?? '1');
        const perPage = parseInt(searchParams.get('perPage') ?? '20');

        const [data, summary] = await Promise.all([
            getExpenses({ branch_id, page, perPage, date_from, date_to }),
            getExpenseSummary({ branch_id, date_from, date_to }),
        ]);
        return NextResponse.json({ ...data, summary });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
const ExpenseSchema=z.object({ branch_id: z.string().uuid(), category: z.string().min(1), description: z.string().min(1), amount: z.number().positive(), payment_method: z.enum(['CASH','MOBILE_MONEY','CARD','BANK','OTHER']).optional(), expense_date: z.string(), receipt_reference: z.string().optional() });
export async function POST(req: Request){
  try{
    const body=await req.json();
    const parsed=ExpenseSchema.parse(body);
    const sb:any = await getSB(); const pid=await getProfileId();
    const {data: prof}=await sb.from('profiles').select('organization_id').eq('id', pid).single();
    const {data, error}=await sb.from('expenses').insert({ organization_id: prof.organization_id, branch_id: parsed.branch_id, category: parsed.category, description: parsed.description, amount: parsed.amount, payment_method: parsed.payment_method ?? 'CASH', expense_date: parsed.expense_date, receipt_reference: parsed.receipt_reference ?? null, status:'PENDING', created_by: pid }).select().single();
    if(error) throw new Error(error.message);
    return NextResponse.json(data,{status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}
export async function PATCH(req: Request){
  try{
    const {id, action}=await req.json();
    const sb:any = await getSB(); const pid=await getProfileId();
    if(action==='approve'){
      const {data, error}=await sb.from('expenses').update({ status:'APPROVED', approved_by: pid }).eq('id', id).select().single();
      if(error) throw new Error(error.message);
      return NextResponse.json(data);
    }
    if(action==='reject'){
      const {data, error}=await sb.from('expenses').update({ status:'REJECTED' }).eq('id', id).select().single();
      if(error) throw new Error(error.message);
      return NextResponse.json(data);
    }
    return NextResponse.json({error:'Unknown action'},{status:400});
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400}); }
}