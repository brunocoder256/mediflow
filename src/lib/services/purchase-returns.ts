/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getSB, getProfileId, getOrgId, createAuditLog, getOne } from './supabase';

export async function createPurchaseReturn(input: {
  purchase_order_id: string;
  supplier_id: string;
  branch_id: string;
  reason: string;
  items: Array<{ purchase_item_id: string; product_id: string; batch_id?: string | null; quantity: number; unit_cost: number; reason?: string }>;
}) {
  const sb: any = await getSB();
  const profileId = await getProfileId();
  const orgId = await getOrgId();
  if (!orgId || !profileId) throw new Error('Unauthorized');
  const po: any = await getOne('purchase_orders', input.purchase_order_id);
  if (!po) throw new Error('Purchase not found');
  if (po.status === 'CANCELLED') throw new Error('Cannot return cancelled purchase');
  // validate batches have enough quantity
  for (const it of input.items) {
    if (it.batch_id) {
      const { data: batch } = await sb.from('product_batches').select('quantity_available, product_id').eq('id', it.batch_id).single();
      if (!batch) throw new Error(`Batch not found ${it.batch_id}`);
      if (batch.product_id !== it.product_id) throw new Error('Batch product mismatch');
      if (Number(batch.quantity_available) < Number(it.quantity)) throw new Error(`Insufficient stock in batch for return qty ${it.quantity}`);
    }
    if (it.quantity <= 0) throw new Error('Quantity must be >0');
  }
  const total = input.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_cost), 0);
  const { data: ret, error } = await sb.from('purchase_returns').insert({
    organization_id: orgId,
    branch_id: input.branch_id,
    purchase_order_id: input.purchase_order_id,
    supplier_id: input.supplier_id,
    return_number: `PR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    reason: input.reason,
    total,
    status: 'pending',
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

export async function getPurchaseReturns(purchaseOrderId?: string, supplierId?: string) {
  const sb: any = await getSB();
  let q = sb.from('purchase_returns').select('*, purchase_return_items(*), suppliers(name)').order('created_at', { ascending: false });
  if (purchaseOrderId) q = q.eq('purchase_order_id', purchaseOrderId);
  if (supplierId) q = q.eq('supplier_id', supplierId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
