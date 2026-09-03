/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB, getProfileId, createAuditLog } from './supabase';

export async function createDisposal(input: { branch_id: string; type:'EXPIRED'|'DAMAGED'|'OTHER'; product_id: string; batch_id?: string; quantity: number; unit_cost: number; reason?: string; condition?: string }) {
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  const { data, error } = await sb.from('disposals').insert({
    organization_id: orgId,
    branch_id: input.branch_id,
    type: input.type,
    product_id: input.product_id,
    batch_id: input.batch_id ?? null,
    quantity: input.quantity,
    unit_cost: input.unit_cost,
    reason: input.reason ?? null,
    condition: input.condition ?? null,
    reported_by: pid,
    status: 'PENDING',
  }).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog('DISPOSAL_CREATED', 'disposals', data.id, null, data);
  return data;
}
export async function approveDisposal(id: string) {
  const sb:any = await getSB();
  const pid = await getProfileId();
  const { data, error } = await sb.from('disposals').update({ status:'APPROVED', approved_by: pid, approved_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog('DISPOSAL_APPROVED', 'disposals', id, null, data);
  return data;
}
export async function disposeStock(id: string, method?: string) {
  const sb:any = await getSB();
  const { data: disp } = await sb.from('disposals').select('*').eq('id', id).single();
  if (!disp) throw new Error('Disposal not found');
  if (disp.status !== 'APPROVED') throw new Error('Must be approved before disposal');
  // decrement batch if linked
  if (disp.batch_id) {
    const { data: batch } = await sb.from('product_batches').select('quantity_available').eq('id', disp.batch_id).single();
    if (batch) await sb.from('product_batches').update({ quantity_available: Math.max(0, batch.quantity_available - disp.quantity) }).eq('id', disp.batch_id);
    // movement
    const pid = await getProfileId();
    await sb.from('stock_movements').insert({
      organization_id: disp.organization_id,
      branch_id: disp.branch_id,
      product_id: disp.product_id,
      batch_id: disp.batch_id,
      movement_type: disp.type === 'EXPIRED' ? 'EXPIRED' : 'DAMAGED',
      quantity: -disp.quantity,
      reference_type: 'DISPOSAL',
      reference_id: id,
      unit_cost: disp.unit_cost,
      notes: `Disposal ${disp.type} ${method ?? ''}`,
      created_by: pid,
    });
  }
  const { data, error } = await sb.from('disposals').update({ status:'DISPOSED', disposed_at: new Date().toISOString(), disposal_method: method ?? null }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog('DISPOSAL_COMPLETED', 'disposals', id, disp, data);
  return data;
}
export async function getDisposals(params:{ branch_id?: string; status?: string; type?: string }) {
  const sb:any = await getSB();
  let q = sb.from('disposals').select('*, products(name), product_batches(batch_number, expiry_date)').order('created_at',{ascending:false});
  if (params.branch_id) q=q.eq('branch_id', params.branch_id);
  if (params.status) q=q.eq('status', params.status);
  if (params.type) q=q.eq('type', params.type);
  const { data } = await q;
  return data ?? [];
}
async function getOrgId(){ const sb:any=await getSB(); const pid=await getProfileId(); const {data}=await sb.from('profiles').select('organization_id').eq('id', pid).single(); return data?.organization_id; }
