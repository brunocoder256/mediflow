/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB, getProfileId, createAuditLog } from './supabase';

export async function recordSupplierPayment(input:{ supplier_id:string; branch_id:string; purchase_order_id?:string; amount:number; payment_method:string; reference?:string; payment_date?:string }){
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  const { data, error } = await sb.from('supplier_payments').insert({
    organization_id: orgId,
    branch_id: input.branch_id,
    supplier_id: input.supplier_id,
    purchase_order_id: input.purchase_order_id ?? null,
    amount: input.amount,
    payment_method: input.payment_method,
    reference: input.reference ?? null,
    payment_date: input.payment_date ?? new Date().toISOString().slice(0,10),
    created_by: pid,
  }).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('SUPPLIER_PAYMENT', 'supplier_payments', data.id, null, data);
  return data;
}
export async function getSupplierPayments(supplierId?: string, branchId?: string){
  const sb:any = await getSB();
  let q = sb.from('supplier_payments').select('*, suppliers(name)').order('payment_date',{ascending:false});
  if(supplierId) q=q.eq('supplier_id', supplierId);
  if(branchId) q=q.eq('branch_id', branchId);
  const { data } = await q;
  return data ?? [];
}
async function getOrgId(){ const sb:any=await getSB(); const pid=await getProfileId(); const {data}=await sb.from('profiles').select('organization_id').eq('id', pid).single(); return data?.organization_id; }
