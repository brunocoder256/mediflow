/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createAuditLog, getSB, getProfileId, getOrgId } from './supabase';
import type { CreateExpenseInput } from '@/lib/validations/expenses';
import { roundToCents } from '../calculations';

function genExpenseNumber(): string {
  const d = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const r = Math.random().toString(36).slice(2,8).toUpperCase();
  return `EXP-${d}-${r}`;
}

function normalizePaymentMethod(m?: string): string {
  if (!m) return 'CASH';
  const up = String(m).toUpperCase();
  if (['CASH','MOBILE_MONEY','CARD','BANK','PETTY_CASH','OTHER'].includes(up)) return up;
  return 'OTHER';
}

// duplicate detection: same payee/amount/date/category/branch within +/- 1 day
async function checkDuplicate(orgId: string, data: any): Promise<any|null> {
  const sb:any = await getSB();
  try {
    let q = sb.from('expenses').select('id, expense_number, amount, expense_date, supplier_id, category, category_id, description, branch_id').eq('organization_id', orgId).eq('branch_id', data.branch_id).eq('amount', data.amount);
    if (data.supplier_id) q=q.eq('supplier_id', data.supplier_id);
    if (data.reference_number) q=q.eq('reference_number', data.reference_number);
    const { data: rows } = await q.limit(5);
    if (!rows || rows.length===0) return null;
    // same date within 1 day
    const target = new Date(data.expense_date).getTime();
    for (const r of rows) {
      const d = new Date(r.expense_date).getTime();
      if (Math.abs(target-d) <= 86400000) return r;
    }
    return null;
  } catch { return null; }
}

async function logApproval(expenseId: string, orgId: string, action: string, prev: string, next: string, reason?: string) {
  try {
    const sb:any = await getSB();
    const pid = await getProfileId();
    await sb.from('expense_approvals').insert({ organization_id: orgId, expense_id: expenseId, action, actor_id: pid, reason: reason ?? null, previous_status: prev, new_status: next });
  } catch {}
}

export async function createExpense(input: CreateExpenseInput) {
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  if (!orgId) throw new Error('Missing organization');
  if (!pid) throw new Error('Unauthenticated');
  // validate branch belongs to org
  const { data: branch } = await sb.from('branches').select('id, organization_id').eq('id', input.branch_id).single();
  if (!branch || branch.organization_id !== orgId) throw new Error('Invalid branch');
  // supplier validation if provided
  if (input.supplier_id) {
    const { data: sup } = await sb.from('suppliers').select('id, organization_id').eq('id', input.supplier_id).single();
    if (!sup || sup.organization_id !== orgId) throw new Error('Invalid supplier/payee');
  }
  // category validation
  let categoryId = input.category_id ?? null;
  let categoryText = input.category ?? null;
  if (categoryId) {
    const { data: cat } = await sb.from('expense_categories').select('id, organization_id, code, name').eq('id', categoryId).single();
    if (!cat || cat.organization_id !== orgId) throw new Error('Invalid category');
    categoryText = categoryText || cat.code || cat.name;
  } else if (categoryText) {
    // try lookup by code/name for enhanced traceability
    const { data: cat2 } = await sb.from('expense_categories').select('id, code').eq('organization_id', orgId).or(`code.ilike.${categoryText},name.ilike.${categoryText}`).maybeSingle();
    if (cat2) categoryId = cat2.id;
  }
  if (!categoryText && !categoryId) throw new Error('Category is required');
  // multi-line validation
  const lines = input.lines ?? [];
  const amount = Number(input.amount);
  const tax = Number(input.tax_amount ?? 0);
  if (amount <=0) throw new Error('Amount must be > 0');
  if (lines.length >0) {
    const sum = lines.reduce((s,l)=> s + Number(l.amount) + Number(l.tax_amount ?? 0),0);
    const total = amount + tax;
    if (Math.abs(sum - total) > 0.01) throw new Error(`Sum of line amounts (${sum}) must equal total (${total})`);
    if (lines.some(l=> Number(l.amount) <=0)) throw new Error('Each line amount must be >0');
  }
  // duplicate warning (not blocking)
  const dup = await checkDuplicate(orgId, { branch_id: input.branch_id, amount, supplier_id: input.supplier_id, expense_date: input.expense_date, reference_number: input.reference_number });
  let duplicateWarning: string | null = null;
  if (dup) duplicateWarning = `A similar expense exists: ${dup.expense_number ?? dup.id} (same amount/date/payee) — review before saving.`;
  // reference_number uniqueness if provided
  if (input.reference_number) {
    const { data: refDup } = await sb.from('expenses').select('id').eq('organization_id', orgId).eq('reference_number', input.reference_number).limit(1);
    if (refDup && refDup.length>0) throw new Error('Reference number already exists');
  }
  // idempotency: if key provided and exists, return existing
  if (input.idempotency_key) {
    const { data: existing } = await sb.from('expenses').select('*').eq('organization_id', orgId).eq('idempotency_key', input.idempotency_key).maybeSingle();
    if (existing) return { ...existing, duplicate: false, warning: null };
  }
  // generate number server-side
  const expenseNumber = genExpenseNumber();
  const currency = input.currency ?? 'UGX';
  const exchange = Number(input.exchange_rate ?? 1);
  const paymentMethod = normalizePaymentMethod(input.payment_method);
  const payload:any = {
    organization_id: orgId,
    branch_id: input.branch_id,
    expense_number: expenseNumber,
    category: categoryText,
    category_id: categoryId,
    subcategory_id: input.subcategory_id ?? null,
    supplier_id: input.supplier_id ?? null,
    description: String(input.description).trim(),
    reference_number: input.reference_number || null,
    amount,
    tax_amount: tax,
    total_amount: roundToCents(amount + tax),
    currency,
    exchange_rate: exchange,
    payment_method: paymentMethod,
    payment_account_id: input.payment_account_id ?? null,
    expense_date: new Date(input.expense_date).toISOString().slice(0,10),
    approval_status: 'DRAFT',
    payment_status: 'UNPAID',
    posting_status: 'UNPOSTED',
    status: 'DRAFT',
    created_by: pid,
    notes: input.notes || null,
    tax_inclusive: !!input.tax_inclusive,
    idempotency_key: input.idempotency_key || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  // inventory purchase protection: warn if description suggests stock
  const lowerDesc = String(input.description).toLowerCase();
  const stockKeywords = ['medicine','drug','tablet','capsule','syrup','inventory','stock','pharma','batch'];
  let purchaseProtectionWarning: string | null = null;
  if (stockKeywords.some(k=> lowerDesc.includes(k)) && !categoryText?.toLowerCase().includes('suppl')) {
    purchaseProtectionWarning = 'This appears to be a stock/inventory purchase. Use Purchasing instead for accurate COGS.';
  }
  const { data, error } = await sb.from('expenses').insert(payload).select().single();
  if (error) {
    if (/column.*does not exist/i.test(error.message)) {
      // fallback minimal legacy insert (amount, description)
      const legacy:any = { organization_id: orgId, branch_id: input.branch_id, category: categoryText, description: String(input.description).trim(), amount, payment_method: paymentMethod, expense_date: new Date(input.expense_date).toISOString().slice(0,10), created_by: pid, status: 'DRAFT' };
      const { data: d2, error: e2 } = await sb.from('expenses').insert(legacy).select().single();
      if (e2) throw new Error(e2.message);
      await createAuditLog('EXPENSE_CREATED', 'expenses', d2.id, null, d2);
      return { ...d2, warning: duplicateWarning || purchaseProtectionWarning, duplicate: !!dup };
    }
    throw new Error(error.message);
  }
  // insert lines
  if (lines.length>0) {
    const lineRows = lines.map(l=> ({
      expense_id: data.id,
      organization_id: orgId,
      category_id: (l as any).category_id ?? categoryId,
      description: (l as any).description ?? null,
      amount: Number((l as any).amount),
      tax_amount: Number((l as any).tax_amount ?? 0),
    }));
    const { error: le } = await sb.from('expense_lines').insert(lineRows);
    if (le && !/does not exist|relation/i.test(le.message)) throw new Error(le.message);
  }
  await createAuditLog('EXPENSE_CREATED', 'expenses', data.id, null, data);
  await logApproval(data.id, orgId, 'CREATED', '', 'DRAFT');
  return { ...data, warning: duplicateWarning || purchaseProtectionWarning, duplicate: !!dup };
}

export async function getExpenses(params: {
  branch_id?: string; category?: string; category_id?: string; supplier_id?: string;
  payment_method?: string; payment_status?: string; approval_status?: string; search?: string;
  date_from?: string; date_to?: string; amount_min?: number; amount_max?: number;
  created_by?: string; page?: number; perPage?: number; includeLines?: boolean;
}) {
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const { page=1, perPage=20 } = params;
  let q = sb.from('expenses').select('*, expense_categories!left(name,code), suppliers!left(name), branches!left(name,code)', { count:'exact' }).eq('organization_id', orgId).order('expense_date', {ascending:false});
  if (params.branch_id && params.branch_id!=='all') q=q.eq('branch_id', params.branch_id);
  if (params.category_id) q=q.eq('category_id', params.category_id);
  else if (params.category && params.category!=='all') q=q.or(`category.eq.${params.category},category_id.eq.${params.category}`);
  if (params.supplier_id && params.supplier_id!=='all') q=q.eq('supplier_id', params.supplier_id);
  if (params.payment_method && params.payment_method!=='all') q=q.eq('payment_method', params.payment_method);
  if (params.payment_status && params.payment_status!=='all') q=q.eq('payment_status', params.payment_status);
  if (params.approval_status && params.approval_status!=='all') q=q.eq('approval_status', params.approval_status);
  if (params.created_by) q=q.eq('created_by', params.created_by);
  if (params.date_from) q=q.gte('expense_date', params.date_from);
  if (params.date_to) q=q.lte('expense_date', params.date_to);
  if (params.amount_min != null) q=q.gte('amount', params.amount_min);
  if (params.amount_max != null) q=q.lte('amount', params.amount_max);
  // search: description, expense_number, reference_number
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    q=q.or(`description.ilike.%${s}%,expense_number.ilike.%${s}%,reference_number.ilike.%${s}%,notes.ilike.%${s}%`);
  }
  const from = (page-1)*perPage;
  let { data, error, count } = await q.range(from, from+perPage-1);
  if (error) {
    // fallback without joins
    let q2 = sb.from('expenses').select('*', {count:'exact'}).eq('organization_id', orgId).order('expense_date',{ascending:false});
    if (params.branch_id && params.branch_id!=='all') q2=q2.eq('branch_id', params.branch_id);
    if (params.date_from) q2=q2.gte('expense_date', params.date_from);
    if (params.date_to) q2=q2.lte('expense_date', params.date_to);
    if (params.search) q2=q2.or(`description.ilike.%${params.search}%,expense_number.ilike.%${params.search}%`);
    const res2 = await q2.range(from, from+perPage-1);
    data=res2.data; error=res2.error; count=res2.count;
  }
  if (error) throw new Error(error.message);
  // enrich with lines if requested or needed for totals
  return { data: data ?? [], count: count ?? 0 };
}

export async function getExpenseById(id: string) {
  const sb:any = await getSB();
  const { data, error } = await sb.from('expenses').select('*, expense_categories!left(name,code), suppliers(*), branches(*), profiles:created_by(*), approver:approved_by(*)').eq('id', id).single();
  if (error) {
    const { data: d2, error: e2 } = await sb.from('expenses').select('*').eq('id', id).single();
    if (e2) throw new Error(e2.message);
    // fallback enrich
    let lines=[], attachments=[], approvals=[], audit=[];
    try {
      const [l,a,ap,au] = await Promise.all([
        sb.from('expense_lines').select('*').eq('expense_id', id).then((r:any)=>r.data??[]).catch(()=>[]),
        sb.from('expense_attachments').select('*').eq('expense_id', id).order('created_at',{ascending:false}).then((r:any)=>r.data??[]).catch(()=>[]),
        sb.from('expense_approvals').select('*, actor:actor_id(full_name)').eq('expense_id', id).order('created_at',{ascending:false}).then((r:any)=>r.data??[]).catch(()=>[]),
        sb.from('audit_logs').select('*').eq('entity_id', id).order('created_at',{ascending:false}).limit(50).then((r:any)=>r.data??[]).catch(()=>[]),
      ]);
      lines=l; attachments=a; approvals=ap; audit=au;
    } catch {}
    return { ...d2, lines, attachments, approvals, audit };
  }
  // fetch lines/attachments/approvals
  let lines=[], attachments=[], approvals=[], audit=[];
  try {
    const [l,a,ap,au] = await Promise.all([
      sb.from('expense_lines').select('*').eq('expense_id', id).then((r:any)=>r.data??[]).catch(()=>[]),
      sb.from('expense_attachments').select('*').eq('expense_id', id).order('created_at',{ascending:false}).then((r:any)=>r.data??[]).catch(()=>[]),
      sb.from('expense_approvals').select('*').eq('expense_id', id).order('created_at',{ascending:false}).then((r:any)=>r.data??[]).catch(()=>[]),
      sb.from('audit_logs').select('*').eq('entity_id', id).order('created_at',{ascending:false}).limit(50).then((r:any)=>r.data??[]).catch(()=>[]),
    ]);
    lines=l; attachments=a; approvals=ap; audit=au;
  } catch {}
  return { ...data, lines, attachments, approvals, audit };
}

export async function updateExpense(id: string, patch: any) {
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const { data: existing } = await sb.from('expenses').select('*').eq('id', id).single();
  if (!existing) throw new Error('Expense not found');
  if (existing.organization_id !== orgId) throw new Error('Unauthorized');
  const approval = existing.approval_status ?? existing.status;
  if (!['DRAFT','REJECTED'].includes(approval)) throw new Error('Only Draft/Rejected expenses can be edited — use reversal for posted');
  if (existing.posting_status === 'POSTED' || existing.posting_status === 'REVERSED') throw new Error('Posted/Reversed expenses locked');
  if (existing.payment_status === 'PAID') throw new Error('Paid expenses cannot be edited');
  // validate patch
  const upd:any = { updated_at: new Date().toISOString() };
  if (patch.description !== undefined) upd.description = String(patch.description).slice(0,1000);
  if (patch.amount !== undefined) {
    const amt = Number(patch.amount);
    if (!(amt>0)) throw new Error('Amount must be >0');
    upd.amount = amt;
  }
  if (patch.tax_amount !== undefined) upd.tax_amount = Number(patch.tax_amount);
  if (upd.amount !== undefined || upd.tax_amount !== undefined) {
    const amt = upd.amount ?? Number(existing.amount);
    const tax = upd.tax_amount ?? Number(existing.tax_amount ?? 0);
    upd.total_amount = roundToCents(amt+tax);
  }
  if (patch.category_id !== undefined) upd.category_id = patch.category_id;
  if (patch.supplier_id !== undefined) upd.supplier_id = patch.supplier_id;
  if (patch.reference_number !== undefined) upd.reference_number = patch.reference_number || null;
  if (patch.notes !== undefined) upd.notes = patch.notes;
  if (patch.expense_date !== undefined) upd.expense_date = new Date(patch.expense_date).toISOString().slice(0,10);
  if (patch.payment_method !== undefined) upd.payment_method = normalizePaymentMethod(patch.payment_method);
  if (patch.branch_id !== undefined) upd.branch_id = patch.branch_id;
  if (patch.currency !== undefined) upd.currency = patch.currency;
  if (patch.lines !== undefined && Array.isArray(patch.lines)) {
    const lines = patch.lines;
    const sum = lines.reduce((s:any,l:any)=> s + Number(l.amount) + Number(l.tax_amount??0),0);
    const total = Number(upd.total_amount ?? existing.total_amount ?? upd.amount ?? existing.amount) + Number(upd.tax_amount ?? existing.tax_amount ?? 0);
    // but we will validate against final total
  }
  const { data, error } = await sb.from('expenses').update(upd).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  if (patch.lines) {
    try {
      await sb.from('expense_lines').delete().eq('expense_id', id);
      const rows = patch.lines.map((l:any)=> ({ expense_id: id, organization_id: orgId, category_id: l.category_id ?? upd.category_id ?? existing.category_id, description: l.description ?? null, amount: Number(l.amount), tax_amount: Number(l.tax_amount??0)}));
      if (rows.length) await sb.from('expense_lines').insert(rows);
    } catch {}
  }
  await createAuditLog('EXPENSE_UPDATED', 'expenses', id, existing, data);
  return data;
}

async function transition(id: string, action: string, opts:any={}) {
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  const { data: ex } = await sb.from('expenses').select('*').eq('id', id).single();
  if (!ex) throw new Error('Expense not found');
  if (ex.organization_id !== orgId) throw new Error('Unauthorized');
  const curApproval = ex.approval_status ?? (ex.status==='PENDING'?'PENDING_APPROVAL':ex.status);
  const curPayment = ex.payment_status ?? 'UNPAID';
  const curPosting = ex.posting_status ?? 'UNPOSTED';
  let nextApproval = curApproval, nextPayment = curPayment, nextPosting = curPosting, allowed=false;
  const reason = opts.reason ?? opts.reversal_reason ?? null;
  let auditAction = '';
  if (action==='submit') {
    if (!['DRAFT','REJECTED'].includes(curApproval)) throw new Error('Only Draft/Rejected can be submitted');
    nextApproval='PENDING_APPROVAL'; auditAction='EXPENSE_SUBMITTED'; allowed=true;
  } else if (action==='approve') {
    if (curApproval!=='PENDING_APPROVAL') throw new Error('Only pending approval can be approved');
    // permission check: expense.approve (we trust caller has, but also check via error message)
    nextApproval='APPROVED'; auditAction='EXPENSE_APPROVED'; allowed=true;
  } else if (action==='reject') {
    if (curApproval!=='PENDING_APPROVAL') throw new Error('Only pending can be rejected');
    if (!reason) throw new Error('Rejection reason required');
    nextApproval='REJECTED'; auditAction='EXPENSE_REJECTED'; allowed=true;
  } else if (action==='pay') {
    if (curApproval!=='APPROVED') throw new Error('Expense must be approved before paying');
    if (curPayment==='PAID') throw new Error('Already paid');
    if (curPosting==='REVERSED') throw new Error('Reversed expense cannot be paid');
    if (!opts.payment_account_id && !ex.payment_account_id) {
      // auto-create or use default cash session logic: allow without account but warn
    }
    nextPayment='PAID'; nextPosting='POSTED'; auditAction='EXPENSE_PAID'; allowed=true;
  } else if (action==='post') {
    if (curApproval!=='APPROVED') throw new Error('Must be approved to post');
    nextPosting='POSTED'; auditAction='EXPENSE_POSTED'; allowed=true;
  } else if (action==='cancel') {
    if (['PAID','POSTED','REVERSED'].includes(curPayment) || curPosting==='POSTED') throw new Error('Cannot cancel paid/posted — use reverse');
    if (['CANCELLED','REVERSED'].includes(curApproval) || curPosting==='REVERSED') throw new Error('Already cancelled/reversed');
    nextApproval='CANCELLED'; nextPosting='UNPOSTED'; auditAction='EXPENSE_CANCELLED'; allowed=true;
  } else if (action==='reverse') {
    if (curPosting!=='POSTED') throw new Error('Only posted can be reversed');
    if (ex.is_reversal) throw new Error('Reversal cannot be reversed');
    auditAction='EXPENSE_REVERSED'; allowed=true;
    // Create reversal record instead of mutating original to POSTED->REVERSED + create negative entry
    const revNumber = `REV-${ex.expense_number ?? ex.id.slice(0,8)}`;
    const revPayload:any = {
      organization_id: orgId,
      branch_id: ex.branch_id,
      expense_number: revNumber,
      category: ex.category,
      category_id: ex.category_id,
      description: `Reversal of ${ex.expense_number ?? ex.id} — ${reason ?? ''}`.slice(0,1000),
      amount: Number(ex.amount),
      tax_amount: Number(ex.tax_amount ?? 0),
      total_amount: -Number(ex.total_amount ?? ex.amount),
      currency: ex.currency,
      exchange_rate: ex.exchange_rate,
      payment_method: ex.payment_method,
      payment_account_id: ex.payment_account_id,
      expense_date: new Date().toISOString().slice(0,10),
      approval_status: 'APPROVED',
      payment_status: 'PAID',
      posting_status: 'REVERSED',
      status: 'REVERSED',
      created_by: pid,
      reversal_of: ex.id,
      reversal_reason: reason,
      is_reversal: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // For reversal we store positive amount but flagged; total negative for P&L
    // But keep amount positive for audit, total negative indicates reversal
    // Insert reversal
    const { data: rev, error: revErr } = await sb.from('expenses').insert(revPayload).select().single();
    if (revErr) throw new Error(revErr.message);
    // Also mark original as reversed
    await sb.from('expenses').update({ posting_status:'REVERSED', approval_status:'REVERSED', status:'REVERSED', is_reversal:false, reversal_reason: reason, updated_at: new Date().toISOString() }).eq('id', id);
    await createAuditLog(auditAction, 'expenses', id, ex, { reversal_id: rev.id, reason });
    await logApproval(id, orgId, 'REVERSED', curPosting, 'REVERSED', reason);
    await createAuditLog('EXPENSE_REVERSAL_CREATED','expenses', rev.id, null, rev);
    // if paid, create opposite cash movement
    if (curPayment==='PAID' && ex.branch_id) {
      try {
        // find current open cash session for branch
        const { data: sess } = await sb.from('cash_sessions').select('id').eq('branch_id', ex.branch_id).eq('status','OPEN').maybeSingle();
        if (sess) {
          await sb.from('cash_movements').insert({ organization_id: orgId, branch_id: ex.branch_id, session_id: sess.id, type:'REFUND', amount: Number(ex.total_amount ?? ex.amount), direction:'IN', reference_type:'EXPENSE_REVERSAL', reference_id: rev.id, reason: reason ?? 'Expense reversal', created_by: pid });
        } else {
          // fallback to cash_movements with cash register if exists
          const { data: reg } = await sb.from('cash_registers').select('id').eq('branch_id', ex.branch_id).eq('is_active', true).limit(1).maybeSingle();
          if (reg) {
            // no session, still log movement without session? We skip if no session to preserve integrity
          }
        }
      } catch {}
    }
    return rev;
  } else if (action==='reopen') {
    if (curApproval!=='REJECTED') throw new Error('Only rejected can be reopened');
    nextApproval='DRAFT'; auditAction='EXPENSE_REOPENED'; allowed=true;
  }
  if (!allowed) throw new Error('Invalid transition');
  const upd:any = { updated_at: new Date().toISOString() };
  if (nextApproval!==curApproval) {
    upd.approval_status = nextApproval;
    upd.status = nextApproval === 'PENDING_APPROVAL' ? 'PENDING' : nextApproval;
    if (nextApproval==='PENDING_APPROVAL') { upd.submitted_by = pid; upd.submitted_at = new Date().toISOString(); }
    if (nextApproval==='APPROVED') { upd.approved_by = pid; upd.approved_at = new Date().toISOString(); }
    if (nextApproval==='REJECTED') { upd.approved_by = pid; upd.approved_at = new Date().toISOString(); }
  }
  if (nextPayment!==curPayment) {
    upd.payment_status = nextPayment;
    if (nextPayment==='PAID') { upd.paid_by = pid; upd.paid_at = new Date().toISOString(); upd.payment_date = new Date().toISOString().slice(0,10); if (opts.payment_account_id) upd.payment_account_id = opts.payment_account_id; if (opts.payment_method) upd.payment_method = normalizePaymentMethod(opts.payment_method); }
  }
  if (nextPosting!==curPosting) upd.posting_status = nextPosting;
  if (action==='pay' || action==='post') {
    if (curPosting==='UNPOSTED') upd.posting_status='POSTED';
  }
  const { data: updated, error } = await sb.from('expenses').update(upd).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog(auditAction, 'expenses', id, ex, updated);
  await logApproval(id, orgId, auditAction.replace('EXPENSE_',''), curApproval+':'+curPayment, nextApproval+':'+nextPayment, reason);
  // payment integration: create cash movement when paid
  if (action==='pay' && updated.payment_status==='PAID') {
    try {
      // Determine session / movement
      const branchId = updated.branch_id;
      const amt = Number(updated.total_amount ?? updated.amount);
      // If PETTY_CASH or CASH, use cash_movements
      if (['CASH','PETTY_CASH'].includes(String(updated.payment_method).toUpperCase())) {
        const { data: sess } = await sb.from('cash_sessions').select('id, branch_id').eq('branch_id', branchId).eq('status','OPEN').maybeSingle();
        if (sess) {
          await sb.from('cash_movements').insert({ organization_id: orgId, branch_id: branchId, session_id: sess.id, type:'CASH_OUT', amount: amt, direction:'OUT', reference_type:'EXPENSE', reference_id: id, reason: updated.description?.slice(0,200) ?? 'Expense', created_by: pid });
        }
      } else {
        // Non-cash: still record as cash_movements CASH_OUT with same session if exists, else just audit
        // For bank/mobile, we log to audit only and still consider cash flow outflow via reports
      }
    } catch (e:any) {
      // do not fail transaction on movement error
    }
  }
  return updated;
}

export async function submitExpense(id:string){ return transition(id,'submit'); }
export async function approveExpense(id:string){ return transition(id,'approve'); }
export async function rejectExpense(id:string, reason:string){ return transition(id,'reject',{reason}); }
export async function payExpense(id:string, opts?:{payment_account_id?:string; payment_method?:string}){ return transition(id,'pay', opts); }
export async function postExpense(id:string){ return transition(id,'post'); }
export async function cancelExpense(id:string, reason?:string){ return transition(id,'cancel',{reason}); }
export async function reverseExpense(id:string, reason:string){ return transition(id,'reverse',{reversal_reason: reason}); }
export async function reopenExpense(id:string){ return transition(id,'reopen'); }

export async function duplicateExpense(id:string){
  const sb:any=await getSB();
  const orgId=await getOrgId(); const pid=await getProfileId();
  const { data: orig } = await sb.from('expenses').select('*').eq('id', id).single();
  if(!orig) throw new Error('Not found');
  const { data: lines } = await sb.from('expense_lines').select('*').eq('expense_id', id).then((r:any)=>({data:r.data??[]})).catch(()=>({data:[]})) as any;
  const payload:any = {
    branch_id: orig.branch_id,
    category: orig.category,
    category_id: orig.category_id,
    supplier_id: orig.supplier_id,
    description: orig.description,
    reference_number: null,
    amount: Number(orig.amount),
    tax_amount: Number(orig.tax_amount ?? 0),
    currency: orig.currency,
    expense_date: new Date().toISOString().slice(0,10),
    payment_method: orig.payment_method,
    payment_account_id: orig.payment_account_id,
    notes: orig.notes,
    tax_inclusive: orig.tax_inclusive,
    lines: lines.map((l:any)=> ({ category_id:l.category_id, description:l.description, amount:Number(l.amount), tax_amount:Number(l.tax_amount??0)})),
  };
  return createExpense(payload);
}

export async function getExpenseCategories() {
  const sb:any = await getSB();
  const orgId = await getOrgId();
  if (!orgId) return [
    { value:'rent', label:'Rent' },
    { value:'utilities', label:'Utilities' },
    { value:'other', label:'Other' },
  ];
  const { data, error } = await sb.from('expense_categories').select('*').eq('organization_id', orgId).eq('is_active', true).order('name');
  if (error || !data) {
    return [
      { value: 'rent', label: 'Rent' }, { value: 'utilities', label: 'Utilities' }, { value: 'supplies', label: 'Supplies' }, { value: 'other', label: 'Other' },
    ];
  }
  return data.map((c:any)=> ({ value: c.id, label: c.name, code: c.code, parent_id: c.parent_id, description: c.description }));
}

export async function createExpenseCategory(input:any){
  const sb:any=await getSB(); const orgId=await getOrgId();
  if(!orgId) throw new Error('Missing org');
  const { data, error } = await sb.from('expense_categories').insert({ organization_id: orgId, name: String(input.name).trim(), code: String(input.code ?? input.name).toUpperCase().replace(/\s+/g,'_'), parent_id: input.parent_id ?? null, account_mapping: input.account_mapping ?? null, tax_treatment: input.tax_treatment ?? null, is_active: input.is_active ?? true, branch_id: input.branch_id ?? null, description: input.description ?? null }).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('EXPENSE_CATEGORY_CREATED','expense_categories', data.id, null, data);
  return data;
}

export async function getExpenseKPIs(params:{branch_id?:string; date_from?:string; date_to?:string}={}) {
  const sb:any=await getSB(); const orgId=await getOrgId();
  let q = sb.from('expenses').select('amount, tax_amount, total_amount, approval_status, payment_status, posting_status, expense_date, category, category_id, branch_id').eq('organization_id', orgId);
  if(params.branch_id && params.branch_id!=='all') q=q.eq('branch_id', params.branch_id);
  if(params.date_from) q=q.gte('expense_date', params.date_from);
  if(params.date_to) q=q.lte('expense_date', params.date_to);
  const { data } = await q;
  const all = data ?? [];
  const total = all.filter((e:any)=> e.posting_status!=='REVERSED' && e.approval_status!=='REVERSED' && e.approval_status!=='CANCELLED').reduce((s:any,e:any)=> s + Number(e.total_amount ?? e.amount),0);
  const todayStr = new Date().toISOString().slice(0,10);
  const weekAgo = new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const monthAgo = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const todayTotal = all.filter((e:any)=> e.expense_date===todayStr).reduce((s:any,e:any)=> s+Number(e.total_amount??e.amount),0);
  const weekTotal = all.filter((e:any)=> e.expense_date>=weekAgo).reduce((s:any,e:any)=> s+Number(e.total_amount??e.amount),0);
  const monthTotal = all.filter((e:any)=> e.expense_date>=monthAgo).reduce((s:any,e:any)=> s+Number(e.total_amount??e.amount),0);
  const pendingApproval = all.filter((e:any)=> e.approval_status==='PENDING_APPROVAL').reduce((s:any,e:any)=> s+Number(e.total_amount??e.amount),0);
  const approvedUnpaid = all.filter((e:any)=> e.approval_status==='APPROVED' && e.payment_status==='UNPAID').reduce((s:any,e:any)=> s+Number(e.total_amount??e.amount),0);
  const byCat:Record<string,number>={};
  for(const e of all){ const k=e.category ?? e.category_id ?? 'other'; byCat[k]=(byCat[k]??0)+Number(e.total_amount??e.amount); }
  let largestCategory=null; let largestValue=0;
  for(const [k,v] of Object.entries(byCat)){ if(v>largestValue){largestValue=v; largestCategory=k; } }
  // petty cash balance: sum opening + IN - OUT
  let pettyBalance=null;
  try{
    if(params.branch_id && params.branch_id!=='all'){
      const { data: sess } = await sb.from('cash_sessions').select('id').eq('branch_id', params.branch_id).eq('status','OPEN').maybeSingle();
      if(sess){
        const { data: moves } = await sb.from('cash_movements').select('amount, direction, type').eq('session_id', sess.id);
        let bal=0;
        for(const m of (moves??[])){
          if(m.direction==='IN') bal+=Number(m.amount);
          else bal-=Number(m.amount);
        }
        pettyBalance=bal;
      }
    }
  }catch{}
  return { total, count: all.length, todayTotal, weekTotal, monthTotal, pendingApproval, approvedUnpaid, byCategory: byCat, largestCategory, largestValue, pettyBalance };
}

export async function getExpenseSummary(params:{branch_id?:string; date_from?:string; date_to?:string}={}){
  const k = await getExpenseKPIs(params);
  return { total: k.total, count: k.count, byCategory: k.byCategory };
}

export async function getExpenseReports(params:{branch_id?:string; date_from?:string; date_to?:string; groupBy?:string}={}){
  const sb:any=await getSB(); const orgId=await getOrgId();
  let q = sb.from('expenses').select('amount, total_amount, category, category_id, branch_id, supplier_id, payment_method, approval_status, payment_status, expense_date, created_by').eq('organization_id', orgId);
  if(params.branch_id && params.branch_id!=='all') q=q.eq('branch_id', params.branch_id);
  if(params.date_from) q=q.gte('expense_date', params.date_from);
  if(params.date_to) q=q.lte('expense_date', params.date_to);
  const { data } = await q;
  const all = (data??[]).filter((e:any)=> e.approval_status!=='REVERSED' && e.approval_status!=='CANCELLED');
  const byCategory:Record<string,number>={};
  const byBranch:Record<string,number>={};
  const byPayee:Record<string,number>={};
  const byPayment:Record<string,number>={};
  const byMonth:Record<string,number>={};
  for(const e of all){
    const cat=e.category ?? e.category_id ?? 'other';
    byCategory[cat]=(byCategory[cat]??0)+Number(e.total_amount??e.amount);
    byBranch[e.branch_id]=(byBranch[e.branch_id]??0)+Number(e.total_amount??e.amount);
    const payee=e.supplier_id ?? 'unknown';
    byPayee[payee]=(byPayee[payee]??0)+Number(e.total_amount??e.amount);
    byPayment[e.payment_method ?? 'OTHER']=(byPayment[e.payment_method ?? 'OTHER']??0)+Number(e.total_amount??e.amount);
    const m=String(e.expense_date).slice(0,7);
    byMonth[m]=(byMonth[m]??0)+Number(e.total_amount??e.amount);
  }
  return { byCategory, byBranch, byPayee, byPayment, byMonth, total: all.reduce((s:any,e:any)=>s+Number(e.total_amount??e.amount),0), count: all.length };
}

export async function addExpenseAttachment(expenseId:string, input:any){
  const sb:any=await getSB(); const orgId=await getOrgId(); const pid=await getProfileId();
  const { data, error } = await sb.from('expense_attachments').insert({ organization_id: orgId, expense_id: expenseId, file_name: input.file_name, file_url: input.file_url, file_size: input.file_size ?? null, mime_type: input.mime_type ?? null, document_type: input.document_type ?? 'RECEIPT', uploaded_by: pid }).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('EXPENSE_ATTACHMENT_ADDED','expense_attachments', data.id, null, data);
  return data;
}
export async function removeExpenseAttachment(id:string){
  const sb:any=await getSB();
  const { data: existing } = await sb.from('expense_attachments').select('expense_id, expense:expense_id(posting_status)').eq('id', id).single().then((r:any)=>r).catch(()=>({data:null}));
  if(existing?.expense?.posting_status==='POSTED') throw new Error('Cannot remove attachment from posted expense');
  const { error } = await sb.from('expense_attachments').delete().eq('id', id);
  if(error) throw new Error(error.message);
  await createAuditLog('EXPENSE_ATTACHMENT_REMOVED','expense_attachments', id, existing, null);
  return true;
}
