import { NextResponse } from 'next/server';
import { getExpenses, getExpenseById, createExpense, updateExpense, submitExpense, approveExpense, rejectExpense, payExpense, cancelExpense, reverseExpense, duplicateExpense, getExpenseCategories, createExpenseCategory, addExpenseAttachment, removeExpenseAttachment, getExpenseKPIs, getExpenseReports } from '@/lib/services/expenses';
import { createExpenseSchema, expenseActionSchema, expenseCategorySchema, expenseAttachmentSchema } from '@/lib/validations/expenses';
import { getSB, getProfileId, getOrgId } from '@/lib/services/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const categories = searchParams.get('categories');
    const kpi = searchParams.get('kpi');
    const reports = searchParams.get('reports');
    if (categories === '1' || categories === 'true') {
      const cats = await getExpenseCategories();
      return NextResponse.json(cats);
    }
    if (kpi === '1' || kpi === 'true') {
      const branch_id = searchParams.get('branch_id') ?? undefined;
      const date_from = searchParams.get('date_from') ?? undefined;
      const date_to = searchParams.get('date_to') ?? undefined;
      const data = await getExpenseKPIs({ branch_id, date_from, date_to });
      return NextResponse.json(data);
    }
    if (reports === '1' || reports === 'true') {
      const branch_id = searchParams.get('branch_id') ?? undefined;
      const date_from = searchParams.get('date_from') ?? undefined;
      const date_to = searchParams.get('date_to') ?? undefined;
      const data = await getExpenseReports({ branch_id, date_from, date_to });
      return NextResponse.json(data);
    }
    if (id) {
      const data = await getExpenseById(id);
      return NextResponse.json(data);
    }
    const branch_id = searchParams.get('branch_id') ?? undefined;
    const category = searchParams.get('category') ?? undefined;
    const category_id = searchParams.get('category_id') ?? undefined;
    const supplier_id = searchParams.get('supplier_id') ?? undefined;
    const payment_method = searchParams.get('payment_method') ?? undefined;
    const payment_status = searchParams.get('payment_status') ?? undefined;
    const approval_status = searchParams.get('approval_status') ?? searchParams.get('status') ?? undefined;
    const search = searchParams.get('search') ?? searchParams.get('q') ?? undefined;
    const date_from = searchParams.get('date_from') ?? undefined;
    const date_to = searchParams.get('date_to') ?? undefined;
    const amount_min = searchParams.get('amount_min') ? Number(searchParams.get('amount_min')) : undefined;
    const amount_max = searchParams.get('amount_max') ? Number(searchParams.get('amount_max')) : undefined;
    const created_by = searchParams.get('created_by') ?? undefined;
    const page = parseInt(searchParams.get('page') ?? '1');
    const perPage = parseInt(searchParams.get('perPage') ?? '20');
    const result = await getExpenses({ branch_id, category, category_id, supplier_id, payment_method, payment_status, approval_status, search, date_from, date_to, amount_min, amount_max, created_by, page, perPage });
    // also return summary for backward compat
    const { total, count, byCategory } = await import('@/lib/services/expenses').then(m=>m.getExpenseSummary({ branch_id, date_from, date_to }));
    return NextResponse.json({ ...result, summary: { total, count, byCategory } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request){
  try{
    const body=await req.json();
    // sub-actions
    if (body.action) {
      const parsed = expenseActionSchema.parse(body);
      let data;
      if (parsed.action==='submit') data = await submitExpense(parsed.id);
      else if (parsed.action==='approve') data = await approveExpense(parsed.id);
      else if (parsed.action==='reject') data = await rejectExpense(parsed.id, parsed.reason ?? 'Rejected');
      else if (parsed.action==='pay') data = await payExpense(parsed.id, { payment_account_id: parsed.payment_account_id ?? undefined, payment_method: parsed.payment_method });
      else if (parsed.action==='post') { const { postExpense } = await import('@/lib/services/expenses'); data = await postExpense(parsed.id); }
      else if (parsed.action==='cancel') data = await cancelExpense(parsed.id, parsed.reason);
      else if (parsed.action==='reverse') {
        if (!parsed.reversal_reason && !parsed.reason) return NextResponse.json({error:'Reversal reason required'}, {status:400});
        data = await reverseExpense(parsed.id, parsed.reversal_reason ?? parsed.reason!);
      } else if (parsed.action==='reopen') { const { reopenExpense } = await import('@/lib/services/expenses'); data = await reopenExpense(parsed.id); }
      else return NextResponse.json({error:'Unknown action'}, {status:400});
      return NextResponse.json(data);
    }
    if (body.category_action === 'create' || body.code || body.name && !body.branch_id && !body.amount) {
      // category creation detection fallback
      if (body.name && body.code) {
        const parsed = expenseCategorySchema.parse(body);
        const data = await createExpenseCategory(parsed);
        return NextResponse.json(data,{status:201});
      }
    }
    if (body.document_type && body.file_name) {
      const parsed = expenseAttachmentSchema.parse(body);
      const data = await addExpenseAttachment(parsed.expense_id, parsed);
      return NextResponse.json(data,{status:201});
    }
    if (body.duplicate_id) {
      const data = await duplicateExpense(body.duplicate_id);
      return NextResponse.json(data,{status:201});
    }
    if (body.category_create) {
      const parsed = expenseCategorySchema.parse(body.category_create);
      const data = await createExpenseCategory(parsed);
      return NextResponse.json(data,{status:201});
    }
    // normal expense creation
    const parsed = createExpenseSchema.parse(body);
    const data = await createExpense(parsed as any);
    return NextResponse.json(data,{status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues ?? e.errors},{status:400}); }
}

export async function PATCH(req: Request){
  try{
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const body = await req.json();
    const id = idParam ?? body.id;
    if (!id) return NextResponse.json({error:'Missing id'},{status:400});
    if (body.action) {
      const parsed = expenseActionSchema.parse({ id, action: body.action, reason: body.reason, reversal_reason: body.reversal_reason, payment_account_id: body.payment_account_id, payment_method: body.payment_method });
      let data;
      if (parsed.action==='submit') data = await submitExpense(parsed.id);
      else if (parsed.action==='approve') data = await approveExpense(parsed.id);
      else if (parsed.action==='reject') data = await rejectExpense(parsed.id, parsed.reason ?? 'Rejected');
      else if (parsed.action==='pay') data = await payExpense(parsed.id, { payment_account_id: parsed.payment_account_id ?? undefined, payment_method: parsed.payment_method });
      else if (parsed.action==='cancel') data = await cancelExpense(parsed.id, parsed.reason);
      else if (parsed.action==='reverse') data = await reverseExpense(parsed.id, parsed.reversal_reason ?? parsed.reason!);
      else return NextResponse.json({error:'Unknown action'},{status:400});
      return NextResponse.json(data);
    }
    if (body.file_name && body.file_url) {
      // attachment removal? not here
      return NextResponse.json({error:'Use POST for attachments'},{status:400});
    }
    // generic update (draft edit)
    const data = await updateExpense(id, body);
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400}); }
}

export async function PUT(req: Request){
  // alias for PATCH (edit)
  return PATCH(req);
}

export async function DELETE(req: Request){
  try{
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body = await req.json().catch(()=> ({}));
    const attachmentId = searchParams.get('attachment_id') ?? body.attachment_id;
    if (attachmentId) {
      const data = await removeExpenseAttachment(attachmentId);
      return NextResponse.json({ok:data});
    }
    if (!id) return NextResponse.json({error:'Missing id'},{status:400});
    // Expenses must not be hard deleted if posted; use cancel/reverse. Allow delete only for DRAFT without audit implications.
    const sb:any = await getSB();
    const orgId = await getOrgId();
    const { data: ex } = await sb.from('expenses').select('approval_status, posting_status, payment_status, organization_id').eq('id', id).single();
    if (!ex) return NextResponse.json({error:'Not found'},{status:404});
    if (ex.organization_id !== orgId) return NextResponse.json({error:'Unauthorized'},{status:403});
    if (ex.posting_status==='POSTED' || ex.payment_status==='PAID') return NextResponse.json({error:'Cannot delete posted/paid expense — use reversal'}, {status:400});
    if (ex.approval_status==='APPROVED') return NextResponse.json({error:'Cannot delete approved expense — cancel or reverse'}, {status:400});
    const { error } = await sb.from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ok:true});
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400}); }
}
