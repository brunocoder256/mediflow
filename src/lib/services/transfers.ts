/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB, getProfileId, createAuditLog } from './supabase';

// Lifecycle: DRAFT -> REQUESTED -> APPROVED -> IN_TRANSIT -> RECEIVED -> CANCELLED (maps to existing DRAFT/IN_TRANSIT/RECEIVED/CANCELLED)
export async function createTransfer(input:{ source_branch_id:string; destination_branch_id:string; notes?:string; items:{ product_id:string; batch_id?:string; quantity:number; unit_cost:number }[] }){
  const sb:any = await getSB();
  const orgId=await getOrgId();
  const pid=await getProfileId();
  if(input.source_branch_id===input.destination_branch_id) throw new Error('Source and destination must differ');
  const { data, error } = await sb.from('transfers').insert({
    organization_id: orgId,
    source_branch_id: input.source_branch_id,
    destination_branch_id: input.destination_branch_id,
    transfer_number: `TRF-${Date.now().toString(36).toUpperCase()}`,
    status: 'DRAFT',
    requested_by: pid,
    notes: input.notes ?? null,
  }).select().single();
  if(error) throw new Error(error.message);
  const items = input.items.map(i=>({ transfer_id: data.id, product_id: i.product_id, batch_id: i.batch_id ?? null, quantity: i.quantity, unit_cost: i.unit_cost }));
  await sb.from('transfer_items').insert(items);
  await createAuditLog('TRANSFER_CREATED','transfers',data.id,null,data);
  return data;
}
export async function requestTransfer(id:string){
  const sb:any = await getSB();
  const { data, error } = await sb.from('transfers').update({ status:'REQUESTED' }).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('TRANSFER_REQUESTED','transfers',id,null,data);
  return data;
}
export async function approveTransfer(id:string){
  const sb:any = await getSB();
  const pid=await getProfileId();
  const { data, error } = await sb.from('transfers').update({ status:'APPROVED', approved_by: pid }).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('TRANSFER_APPROVED','transfers',id,null,data);
  return data;
}
export async function shipTransfer(id:string){
  const sb:any = await getSB();
  const pid=await getProfileId();
  const tr = await sb.from('transfers').select('*, transfer_items(*)').eq('id', id).single();
  if(!tr.data) throw new Error('Not found');
  // decrement source
  for(const it of (tr.data.transfer_items ?? [])){
    const { data: batch } = await sb.from('product_batches').select('quantity_available').eq('id', it.batch_id).single();
    if(batch) await sb.from('product_batches').update({ quantity_available: batch.quantity_available - it.quantity }).eq('id', it.batch_id);
    await sb.from('stock_movements').insert({
      organization_id: tr.data.organization_id,
      branch_id: tr.data.source_branch_id,
      product_id: it.product_id,
      batch_id: it.batch_id,
      movement_type: 'TRANSFER_OUT',
      quantity: -it.quantity,
      reference_type: 'TRANSFER',
      reference_id: id,
      unit_cost: it.unit_cost,
      created_by: pid,
    });
  }
  const { data, error } = await sb.from('transfers').update({ status:'IN_TRANSIT', shipped_by: pid, shipped_at: new Date().toISOString() }).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('TRANSFER_SHIPPED','transfers',id,null,data);
  return data;
}
export async function receiveTransfer(id:string){
  const sb:any = await getSB();
  const pid=await getProfileId();
  const tr = await sb.from('transfers').select('*, transfer_items(*)').eq('id', id).single();
  if(!tr.data) throw new Error('Not found');
  for(const it of (tr.data.transfer_items ?? [])){
    await sb.from('stock_movements').insert({
      organization_id: tr.data.organization_id,
      branch_id: tr.data.destination_branch_id,
      product_id: it.product_id,
      batch_id: it.batch_id,
      movement_type: 'TRANSFER_IN',
      quantity: it.quantity,
      reference_type: 'TRANSFER',
      reference_id: id,
      unit_cost: it.unit_cost,
      created_by: pid,
    });
    // optionally create/update batch in destination - simplified: increase if same batch exists else create
    const { data: existing } = await sb.from('product_batches').select('id, quantity_available').eq('product_id', it.product_id).eq('branch_id', tr.data.destination_branch_id).eq('batch_number', it.batch_id ? (await sb.from('product_batches').select('batch_number').eq('id', it.batch_id).single()).data?.batch_number : '').maybeSingle();
    if(existing) await sb.from('product_batches').update({ quantity_available: existing.quantity_available + it.quantity }).eq('id', existing.id);
  }
  const { data, error } = await sb.from('transfers').update({ status:'RECEIVED', received_by: pid, received_at: new Date().toISOString() }).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('TRANSFER_RECEIVED','transfers',id,null,data);
  return data;
}
export async function getTransfers(params:{ branch_id?: string; status?: string }){
  const sb:any = await getSB();
  let q = sb.from('transfers').select('*, transfer_items(*), suppliers(name)').order('created_at',{ascending:false});
  if(params.branch_id) q=q.or(`source_branch_id.eq.${params.branch_id},destination_branch_id.eq.${params.branch_id}`);
  if(params.status) q=q.eq('status', params.status);
  const { data } = await q;
  return data ?? [];
}
async function getOrgId(){ const sb:any=await getSB(); const pid=await getProfileId(); const {data}=await sb.from('profiles').select('organization_id').eq('id', pid).single(); return data?.organization_id; }
