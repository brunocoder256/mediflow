/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB, getProfileId, createAuditLog } from './supabase';

// Registers
export async function getCashRegisters(branchId?: string) {
  const sb: any = await getSB();
  let q = sb.from('cash_registers').select('*').eq('is_active', true).order('name');
  if (branchId) q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}
export async function createCashRegister(input: { branch_id: string; name: string; code: string }) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  const { data, error } = await sb.from('cash_registers').insert({ ...input, organization_id: orgId }).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog('CASH_REGISTER_CREATED', 'cash_registers', data.id, null, data);
  return data;
}
async function getOrgId() {
  const sb: any = await getSB();
  const pid = await getProfileId();
  const { data } = await sb.from('profiles').select('organization_id').eq('id', pid).single();
  return data?.organization_id;
}

// Sessions
export async function getOpenSession(registerId: string) {
  const sb: any = await getSB();
  const { data } = await sb.from('cash_sessions').select('*').eq('register_id', registerId).eq('status', 'OPEN').maybeSingle();
  return data;
}
export async function getCurrentSession(branchId?: string) {
  const sb: any = await getSB();
  let q = sb.from('cash_sessions').select('*, cash_registers(name,code)').eq('status', 'OPEN').order('opened_at', { ascending: false }).limit(1);
  if (branchId) q = q.eq('branch_id', branchId);
  const { data } = await q.maybeSingle();
  return data;
}
export async function openCashSession(input: { register_id: string; branch_id: string; opening_float: number; notes?: string }) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  // check one open per register already enforced by DB unique index
  const { data, error } = await sb.from('cash_sessions').insert({
    organization_id: orgId,
    branch_id: input.branch_id,
    register_id: input.register_id,
    cashier_id: pid,
    opening_float: input.opening_float,
    status: 'OPEN',
    notes: input.notes ?? null,
  }).select().single();
  if (error) throw new Error(error.message);
  // opening float movement
  await sb.from('cash_movements').insert({
    organization_id: orgId,
    branch_id: input.branch_id,
    session_id: data.id,
    type: 'OPENING_FLOAT',
    amount: input.opening_float,
    direction: 'IN',
    reference_type: 'CASH_SESSION',
    reference_id: data.id,
    reason: 'Opening float',
    created_by: pid,
  });
  await createAuditLog('CASH_SESSION_OPENED', 'cash_sessions', data.id, null, data);
  return data;
}
export async function addCashMovement(input: { session_id: string; type: string; amount: number; direction: 'IN'|'OUT'; reason?: string; reference_type?: string; reference_id?: string }) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  const sess = await sb.from('cash_sessions').select('branch_id').eq('id', input.session_id).single();
  const { data, error } = await sb.from('cash_movements').insert({
    organization_id: orgId,
    branch_id: sess.data.branch_id,
    session_id: input.session_id,
    type: input.type,
    amount: input.amount,
    direction: input.direction,
    reason: input.reason ?? null,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    created_by: pid,
  }).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog('CASH_MOVEMENT', 'cash_movements', data.id, null, data);
  return data;
}
export async function getSessionSummary(sessionId: string) {
  const sb: any = await getSB();
  const { data: sess } = await sb.from('cash_sessions').select('*').eq('id', sessionId).single();
  const { data: moves } = await sb.from('cash_movements').select('*').eq('session_id', sessionId);
  const { data: cashPayments } = await sb.from('payments').select('amount').eq('session_id', sessionId).eq('payment_method', 'CASH').eq('status', 'completed');
  // also fallback: payments without session but same branch/day? For now only session-linked
  let opening = 0, cashSales = 0, cashIn = 0, cashOut = 0, refunds = 0;
  for (const m of (moves ?? [])) {
    if (m.type === 'OPENING_FLOAT') opening += Number(m.amount);
    else if (m.type === 'CASH_IN') cashIn += Number(m.amount);
    else if (m.type === 'CASH_OUT') cashOut += Number(m.amount);
    else if (m.type === 'REFUND') refunds += Number(m.amount);
  }
  // cashSales from cash_movements type SALE + payments
  const saleMoves = (moves ?? []).filter((m:any)=>m.type==='SALE').reduce((s:any,m:any)=>s+Number(m.amount),0);
  cashSales = saleMoves + (cashPayments ?? []).reduce((s:any,p:any)=>s+Number(p.amount),0);
  // if duplicate, prefer payments; if moves has SALE, use it
  if (saleMoves>0 && (cashPayments?.length ?? 0)>0) cashSales = Math.max(saleMoves, (cashPayments??[]).reduce((s:any,p:any)=>s+Number(p.amount),0));
  const expected = opening + cashSales + cashIn - cashOut - refunds;
  return { session: sess, moves, opening, cashSales, cashIn, cashOut, refunds, expected, cashPayments };
}
export async function closeCashSession(input: { session_id: string; closing_cash: number; notes?: string }) {
  const sb: any = await getSB();
  const pid = await getProfileId();
  const summary = await getSessionSummary(input.session_id);
  const expected = summary.expected;
  const variance = Number(input.closing_cash) - expected;
  const threshold = 5000; // UGX threshold requiring approval
  const needsApproval = Math.abs(variance) > threshold;
  const status = needsApproval ? 'APPROVAL_REQUIRED' : 'CLOSED';
  const { data, error } = await sb.from('cash_sessions').update({
    closing_cash: input.closing_cash,
    expected_cash: expected,
    cash_variance: variance,
    status,
    closed_at: new Date().toISOString(),
    closed_by: pid,
    notes: input.notes ?? null,
  }).eq('id', input.session_id).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog('CASH_SESSION_CLOSED', 'cash_sessions', input.session_id, summary.session, { ...data, variance });
  return { ...data, variance, needsApproval };
}
export async function approveCashSession(sessionId: string, notes?: string) {
  const sb: any = await getSB();
  const pid = await getProfileId();
  const { data, error } = await sb.from('cash_sessions').update({
    status: 'APPROVED',
    approved_by: pid,
    approved_at: new Date().toISOString(),
    notes,
  }).eq('id', sessionId).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog('CASH_SESSION_APPROVED', 'cash_sessions', sessionId, null, data);
  return data;
}
export async function getSessions(params: { branch_id?: string; status?: string; page?: number; perPage?: number }) {
  const sb: any = await getSB();
  let q = sb.from('cash_sessions').select('*', { count: 'exact' }).order('opened_at', { ascending: false });
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.status) q = q.eq('status', params.status);
  const from = ((params.page ?? 1)-1)*(params.perPage ?? 20);
  const { data, error, count } = await q.range(from, from+(params.perPage??20)-1);
  if (error) throw new Error(error.message);
  return { data, count };
}
