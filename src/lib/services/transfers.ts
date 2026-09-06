/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB, getProfileId, createAuditLog } from './supabase';
import { getUserBranches, hasPermission } from '@/lib/auth';

// Lifecycle: DRAFT -> REQUESTED -> APPROVED -> IN_TRANSIT -> RECEIVED -> CANCELLED
// Branch consistency: creates/updates are permission-gated (stock.transfer),
// source branch must be one of the actor's branches, and stock only ever leaves
// on SHIP (with a conditional decrement, never below zero) and arrives on RECEIVE
// (creating the destination batch when it does not exist yet).

const TRANSFER_PERMISSIONS = ['stock.transfer', 'inventory.transfer'];

async function getOrgId() {
  const sb: any = await getSB();
  const pid = await getProfileId();
  const { data } = await sb.from('profiles').select('organization_id').eq('id', pid).single();
  return data?.organization_id;
}

async function actor() {
  const sb: any = await getSB();
  const pid = await getProfileId();
  const orgId = await getOrgId();
  if (!pid || !orgId) throw new Error('Unauthenticated');
  return { sb, pid, orgId };
}

async function requireTransferPermission() {
  const { sb, pid, orgId } = await actor();
  for (const code of TRANSFER_PERMISSIONS) {
    if (await hasPermission(sb, pid, orgId, code)) return;
  }
  throw new Error('Forbidden: stock.transfer permission required');
}

async function assertBranchActive(branchId: string) {
  const { sb } = await actor();
  const { data } = await sb.from('branches').select('is_active').eq('id', branchId).single();
  if (!data?.is_active) throw new Error('Branch is inactive');
}

export async function createTransfer(input: {
  source_branch_id: string;
  destination_branch_id: string;
  notes?: string;
  items: { product_id: string; batch_id?: string; quantity: number; unit_cost: number }[];
}) {
  await requireTransferPermission();
  const { sb, pid, orgId } = await actor();
  if (input.source_branch_id === input.destination_branch_id)
    throw new Error('Source and destination must differ');
  if (!input.items.length) throw new Error('Transfer must have at least one item');
  for (const it of input.items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new Error('Item quantity must be a positive integer');
    if (it.unit_cost < 0) throw new Error('Item unit cost cannot be negative');
  }
  await assertBranchActive(input.source_branch_id);
  await assertBranchActive(input.destination_branch_id);
  // The source branch must be one the actor operates from.
  const myBranches = await getUserBranches(sb, pid);
  if (!myBranches.includes(input.source_branch_id))
    throw new Error('Source branch is not one of your branches');

  const { data, error } = await sb
    .from('transfers')
    .insert({
      organization_id: orgId,
      source_branch_id: input.source_branch_id,
      destination_branch_id: input.destination_branch_id,
      status: 'DRAFT',
      requested_by: pid,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const items = input.items.map((i) => ({
    transfer_id: data.id,
    product_id: i.product_id,
    batch_id: i.batch_id ?? null,
    quantity: i.quantity,
    unit_cost: i.unit_cost,
  }));
  const { error: itemsErr } = await sb.from('transfer_items').insert(items);
  if (itemsErr) throw new Error(itemsErr.message);
  await createAuditLog('TRANSFER_CREATED', 'transfers', data.id, null, data);
  return data;
}

export async function requestTransfer(id: string) {
  await requireTransferPermission();
  const sb: any = await getSB();
  const { data, error } = await sb
    .from('transfers')
    .update({ status: 'REQUESTED' })
    .eq('id', id)
    .eq('status', 'DRAFT')
    .select()
    .single();
  if (error) throw new Error(error.message);
  await createAuditLog('TRANSFER_REQUESTED', 'transfers', id, null, data);
  return data;
}

export async function approveTransfer(id: string) {
  await requireTransferPermission();
  const sb: any = await getSB();
  const pid = await getProfileId();
  const { data, error } = await sb
    .from('transfers')
    .update({ status: 'APPROVED', approved_by: pid, approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'REQUESTED')
    .select()
    .single();
  if (error) throw new Error(error.message);
  await createAuditLog('TRANSFER_APPROVED', 'transfers', id, null, data);
  return data;
}

export async function cancelTransfer(id: string) {
  await requireTransferPermission();
  const sb: any = await getSB();
  const { data, error } = await sb
    .from('transfers')
    .update({ status: 'CANCELLED' })
    .eq('id', id)
    .in('status', ['DRAFT', 'REQUESTED'])
    .select()
    .single();
  if (error) throw new Error(error.message);
  await createAuditLog('TRANSFER_CANCELLED', 'transfers', id, null, data);
  return data;
}

export async function shipTransfer(id: string) {
  await requireTransferPermission();
  const sb: any = await getSB();
  const pid = await getProfileId();
  const { data: tr, error: trErr } = await sb
    .from('transfers')
    .select('*, transfer_items(*)')
    .eq('id', id)
    .single();
  if (trErr || !tr) throw new Error('Transfer not found');
  if (tr.status !== 'APPROVED') throw new Error('Only approved transfers can be shipped');
  await assertBranchActive(tr.source_branch_id);
  // Ship only from a branch the actor actually operates.
  const myBranches = await getUserBranches(sb, pid!);
  if (!myBranches.includes(tr.source_branch_id)) throw new Error('You are not assigned to the source branch');

  // Decrement source batches conditionally (never below zero).
  for (const it of tr.transfer_items ?? []) {
    if (!it.batch_id) {
      const { data: pb } = await sb
        .from('product_batches')
        .select('id')
        .eq('product_id', it.product_id)
        .eq('branch_id', tr.source_branch_id)
        .eq('is_active', true)
        .gt('quantity_available', 0)
        .gt('expiry_date', new Date().toISOString().slice(0, 10))
        .order('expiry_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!pb) throw new Error(`No sellable batch for product ${it.product_id} at source branch`);
      it.batch_id = pb.id;
    }
    const { data: batch } = await sb
      .from('product_batches')
      .select('quantity_available')
      .eq('id', it.batch_id)
      .single();
    if (!batch || Number(batch.quantity_available) < it.quantity)
      throw new Error(`Insufficient stock for batch ${it.batch_id}: need ${it.quantity}, have ${batch?.quantity_available ?? 0}`);
    const { error: decErr } = await sb
      .from('product_batches')
      .update({ quantity_available: Number(batch.quantity_available) - it.quantity, updated_at: new Date().toISOString() })
      .eq('id', it.batch_id)
      .eq('quantity_available', batch.quantity_available);
    if (decErr) throw new Error(`Failed to decrement batch ${it.batch_id}: ${decErr.message}`);
    // Persist the auto-resolved batch back into the draft item so receive knows it.
    await sb.from('transfer_items').update({ batch_id: it.batch_id }).eq('id', it.id);
    await sb.from('stock_movements').insert({
      organization_id: tr.organization_id,
      branch_id: tr.source_branch_id,
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
  const { data, error } = await sb
    .from('transfers')
    .update({ status: 'IN_TRANSIT', shipped_by: pid, shipped_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await createAuditLog('TRANSFER_SHIPPED', 'transfers', id, null, data);
  return data;
}

export async function receiveTransfer(id: string) {
  await requireTransferPermission();
  const sb: any = await getSB();
  const pid = await getProfileId();
  const { data: tr, error: trErr } = await sb
    .from('transfers')
    .select('*, transfer_items(*)')
    .eq('id', id)
    .single();
  if (trErr || !tr) throw new Error('Transfer not found');
  if (tr.status !== 'IN_TRANSIT') throw new Error('Only in-transit transfers can be received');
  await assertBranchActive(tr.destination_branch_id);
  const myBranches = await getUserBranches(sb, pid!);
  if (!myBranches.includes(tr.destination_branch_id))
    throw new Error('You are not assigned to the destination branch');

  for (const it of tr.transfer_items ?? []) {
    // Identify the source batch to carry over its identity (batch number, expiry, prices).
    let sourceBatch: any = null;
    if (it.batch_id) {
      const { data: sbr } = await sb.from('product_batches').select('*').eq('id', it.batch_id).single();
      sourceBatch = sbr ?? null;
    }
    // Try to merge into an existing destination batch with the same number.
    let q = sb
      .from('product_batches')
      .select('*')
      .eq('product_id', it.product_id)
      .eq('branch_id', tr.destination_branch_id)
      .eq('is_active', true);
    if (sourceBatch?.batch_number) q = q.eq('batch_number', sourceBatch.batch_number);
    const { data: existing, error: exErr } = await q.limit(1);
    if (exErr) throw new Error(exErr.message);

    if ((existing ?? []).length) {
      const b = existing[0];
      const { error: upErr } = await sb
        .from('product_batches')
        .update({
          quantity_available: Number(b.quantity_available) + it.quantity,
          quantity_received: Number(b.quantity_received) + it.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', b.id);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { error: insErr } = await sb.from('product_batches').insert({
        organization_id: tr.organization_id,
        branch_id: tr.destination_branch_id,
        product_id: it.product_id,
        batch_number: sourceBatch?.batch_number ?? `TRF-${id.slice(0, 8)}`,
        expiry_date: sourceBatch?.expiry_date ?? new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        purchase_price: sourceBatch?.purchase_price ?? it.unit_cost,
        selling_price: sourceBatch?.selling_price ?? it.unit_cost,
        quantity_received: it.quantity,
        quantity_available: it.quantity,
        received_at: new Date().toISOString().slice(0, 10),
        is_active: true,
      });
      if (insErr) throw new Error(insErr.message);
    }
    await sb.from('stock_movements').insert({
      organization_id: tr.organization_id,
      branch_id: tr.destination_branch_id,
      product_id: it.product_id,
      batch_id: it.batch_id ?? null,
      movement_type: 'TRANSFER_IN',
      quantity: it.quantity,
      reference_type: 'TRANSFER',
      reference_id: id,
      unit_cost: it.unit_cost,
      created_by: pid,
    });
  }
  const { data, error } = await sb
    .from('transfers')
    .update({ status: 'RECEIVED', received_by: pid, received_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await createAuditLog('TRANSFER_RECEIVED', 'transfers', id, null, data);
  return data;
}

export async function getTransfers(params: { branch_id?: string; status?: string }) {
  const sb: any = await getSB();
  let q = sb
    .from('transfers')
    .select(
      '*, transfer_items(*), source_branch:branches!source_branch_id(id, name, code), destination_branch:branches!destination_branch_id(id, name, code)',
    )
    .order('created_at', { ascending: false });
  if (params.branch_id)
    q = q.or(`source_branch_id.eq.${params.branch_id},destination_branch_id.eq.${params.branch_id}`);
  if (params.status) q = q.eq('status', params.status);
  const { data } = await q;
  return (data ?? []).map((t: any) => ({
    ...t,
    item_count: (t.transfer_items ?? []).length,
    total_cost: (t.transfer_items ?? []).reduce(
      (s: number, i: any) => s + Number(i.quantity || 0) * Number(i.unit_cost || 0),
      0,
    ),
  }));
}

export async function getTransferCapabilities() {
  const { sb, pid, orgId } = await actor();
  const [stockPerm, inventoryPerm, branches] = await Promise.all([
    hasPermission(sb, pid, orgId, 'stock.transfer'),
    hasPermission(sb, pid, orgId, 'inventory.transfer'),
    getUserBranches(sb, pid),
  ]);
  return { canManage: stockPerm || inventoryPerm, branchIds: branches };
}