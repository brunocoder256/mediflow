/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getSB, getProfileId, getOrgId, createAuditLog, getOne } from './supabase';

export async function createPurchaseReturn(input: {
  purchase_order_id: string;
  supplier_id: string;
  branch_id: string;
  reason: string;
  operation_id?: string;
  reason_category?: string;
  resolution?: string;
  grn_id?: string;
  items: Array<{ purchase_item_id: string; product_id: string; batch_id?: string | null; quantity: number; unit_cost: number; reason?: string; reason_category?: string; expiry_date?: string }>;
}) {
  const sb: any = await getSB();
  const profileId = await getProfileId();
  const orgId = await getOrgId();
  if (!orgId || !profileId) throw new Error('Unauthorized');
  if(input.operation_id){ const { data: dup } = await sb.from('purchase_returns').select('id').eq('operation_id', input.operation_id).maybeSingle(); if(dup) return dup; }
  const po: any = await getOne('purchase_orders', input.purchase_order_id);
  if (!po) throw new Error('Purchase not found');
  if (po.status === 'CANCELLED') throw new Error('Cannot return cancelled purchase');
  // validate batches have enough quantity + remaining returnable per purchase_item (spec 16/29/30)
  // fetch already returned per purchase_item (not cancelled/rejected)
  const itemIds = input.items.map(i=>i.purchase_item_id);
  const alreadyByItem:Record<string,number>={};
  try{ const { data: prev } = await sb.from('purchase_return_items').select('purchase_item_id, quantity, purchase_returns!inner(status)').in('purchase_item_id', itemIds); for(const r of (prev??[]) as any[]){ const st=(r.purchase_returns as any)?.status ?? r.status; if(['rejected','cancelled'].includes(st)) continue; alreadyByItem[r.purchase_item_id]=(alreadyByItem[r.purchase_item_id]??0)+Number(r.quantity); } }catch{}
  // also validate against purchase_items.quantity_received where available
  const { data: piRows } = await sb.from('purchase_items').select('id, quantity_ordered, quantity_received').in('id', itemIds);
  const piMap=new Map((piRows??[]).map((p:any)=>[p.id,p]));
  for (const it of input.items) {
    if (it.batch_id) {
      const { data: batch } = await sb.from('product_batches').select('quantity_available, product_id').eq('id', it.batch_id).single();
      if (!batch) throw new Error(`Batch not found ${it.batch_id}`);
      if (batch.product_id !== it.product_id) throw new Error('Batch product mismatch');
      if (Number(batch.quantity_available) < Number(it.quantity)) throw new Error(`Insufficient stock in batch for return qty ${it.quantity}`);
    }
    if (it.quantity <= 0) throw new Error('Quantity must be >0');
    const pi:any = piMap.get(it.purchase_item_id);
    const already = alreadyByItem[it.purchase_item_id] ?? 0;
    const maxByBatch = it.batch_id ? Number((await sb.from('product_batches').select('quantity_available').eq('id', it.batch_id).maybeSingle().then((r:any)=>r.data?.quantity_available ?? 999999)) ) : 999999;
    // remaining returnable is min(batch available, received - already)
    const received = pi ? Number(pi.quantity_received ?? pi.quantity_ordered) : Number(it.quantity)+already;
    const remaining = received - already;
    if(it.quantity > remaining) throw new Error(`Exceeds returnable for item ${it.purchase_item_id.slice(0,8)}: received ${received}, already returned ${already}, max ${remaining}`);
    if(it.quantity > maxByBatch) throw new Error(`Batch stock ${maxByBatch} insufficient for ${it.quantity}`);
  }
  const total = input.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_cost), 0);
  // GRN snapshot where applicable
  let grnNumber:string|null=null; if(input.grn_id){ try{ const { data: grn } = await sb.from('goods_receipts').select('grn_number').eq('id', input.grn_id).maybeSingle(); grnNumber=grn?.grn_number ?? null; }catch{} }
  const { data: ret, error } = await sb.from('purchase_returns').insert({
    organization_id: orgId,
    branch_id: input.branch_id,
    purchase_order_id: input.purchase_order_id,
    supplier_id: input.supplier_id,
    grn_id: input.grn_id ?? null,
    grn_number: grnNumber,
    return_number: `PR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    reason: input.reason,
    reason_category: input.reason_category ?? input.reason ?? null,
    resolution: input.resolution ?? null,
    total,
    status: 'pending',
    operation_id: input.operation_id ?? null,
    created_by: profileId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single();
  if (error) throw new Error(error.message);
  const rows = input.items.map((it) => ({
    purchase_return_id: ret.id,
    purchase_item_id: it.purchase_item_id,
    product_id: it.product_id,
    batch_id: it.batch_id ?? null,
    quantity: it.quantity,
    unit_cost: it.unit_cost,
    amount: Number(it.quantity) * Number(it.unit_cost),
    reason: it.reason ?? null,
  }));
  const { error: e2 } = await sb.from('purchase_return_items').insert(rows);
  if (e2) {
    await sb.from('purchase_returns').delete().eq('id', ret.id);
    throw new Error(e2.message);
  }
  await createAuditLog('PURCHASE_RETURN_CREATED', 'purchase_returns', ret.id, null, ret);
  return ret;
}

export async function approvePurchaseReturn(returnId: string) {
  const sb: any = await getSB();
  const profileId = await getProfileId();
  const { data: ret } = await sb.from('purchase_returns').select('*').eq('id', returnId).single();
  if (!ret) throw new Error('Return not found');
  if (ret.status !== 'pending') throw new Error(`Cannot approve from ${ret.status}`);
  const { data, error } = await sb.from('purchase_returns').update({ status: 'approved', approved_by: profileId, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', returnId).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog('PURCHASE_RETURN_APPROVED', 'purchase_returns', returnId, ret, data);
  return data;
}

export async function completePurchaseReturn(returnId: string) {
  const sb: any = await getSB();
  const profileId = await getProfileId();
  const { data: ret } = await sb.from('purchase_returns').select('*, purchase_return_items(*)').eq('id', returnId).single();
  if (!ret) throw new Error('Return not found');
  if (ret.status !== 'approved') throw new Error('Must be approved before completing');
  // create stock movements and reduce batch quantities
  for (const it of (ret.purchase_return_items ?? [])) {
    if (it.batch_id) {
      const { data: batch } = await sb.from('product_batches').select('quantity_available').eq('id', it.batch_id).single();
      if (!batch || Number(batch.quantity_available) < Number(it.quantity)) throw new Error('Insufficient batch quantity for return');
      await sb.from('product_batches').update({ quantity_available: Number(batch.quantity_available) - Number(it.quantity), updated_at: new Date().toISOString() }).eq('id', it.batch_id);
      await sb.from('stock_movements').insert({
        organization_id: ret.organization_id,
        branch_id: ret.branch_id,
        product_id: it.product_id,
        batch_id: it.batch_id,
        movement_type: 'PURCHASE_RETURN',
        quantity: -Number(it.quantity),
        reference_type: 'PURCHASE_RETURN',
        reference_id: returnId,
        unit_cost: it.unit_cost,
        notes: `Return to supplier ${ret.return_number}`,
        created_by: profileId,
      });
    } else {
      // no batch: just movement without batch (less ideal)
      await sb.from('stock_movements').insert({
        organization_id: ret.organization_id,
        branch_id: ret.branch_id,
        product_id: it.product_id,
        batch_id: null,
        movement_type: 'PURCHASE_RETURN',
        quantity: -Number(it.quantity),
        reference_type: 'PURCHASE_RETURN',
        reference_id: returnId,
        unit_cost: it.unit_cost,
        notes: `Return to supplier ${ret.return_number}`,
        created_by: profileId,
      });
    }
  }
  const { data, error } = await sb.from('purchase_returns').update({ status: 'completed', processed_by: profileId, updated_at: new Date().toISOString() }).eq('id', returnId).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog('PURCHASE_RETURN_COMPLETED', 'purchase_returns', returnId, ret, data);
  return data;
}

export async function getPurchaseReturnsKPIs(branch_id?: string){
  const sb:any = await getSB(); const orgId = await getOrgId(); let q=sb.from('purchase_returns').select('id, status, total, reason_category, credit_status, created_at, supplier_id').eq('organization_id', orgId); if(branch_id && branch_id!=='all') q=q.eq('branch_id', branch_id); const { data }=await q; const list=(data??[]) as any[]; const pendingApproval=list.filter(r=>['pending','submitted','pending_approval'].includes(r.status)).length; const pendingCredit=list.filter(r=> r.credit_status==='PENDING').length; const totalValue=list.reduce((a:any,r:any)=>a+Number(r.total),0); return { total:list.length, pendingApproval, pendingCredit, totalValue, byStatus: { pending:list.filter(r=>r.status==='pending').length, approved:list.filter(r=>r.status==='approved').length, completed:list.filter(r=>r.status==='completed').length } };
}

export async function getPurchaseReturns(purchaseOrderId?: string, supplierId?: string) {
  const sb: any = await getSB();
  let q = sb.from('purchase_returns').select('*, purchase_return_items(*), suppliers(name)').order('created_at', { ascending: false });
  if (purchaseOrderId) q = q.eq('purchase_order_id', purchaseOrderId);
  if (supplierId) q = q.eq('supplier_id', supplierId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
