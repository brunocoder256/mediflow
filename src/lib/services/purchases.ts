/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getOne, createAuditLog, getSB, getProfileId, getOrgId } from './supabase';
import type { CreatePurchaseInput } from '@/lib/validations/purchases';

function generatePurchaseNumber(): string {
  // Keep PO- prefix for pharmacy familiarity; let DB trigger fallback if unique collision
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PO-${d}-${rand}`;
}

export async function createPurchase(input: CreatePurchaseInput & { expected_delivery_date?: string; currency?: string; payment_terms?: string; notes?: string }) {
  const sb: any = await getSB();
  const profileId = await getProfileId();
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Missing organization');
  if (!profileId) throw new Error('Unauthenticated');

  const purchaseNumber = generatePurchaseNumber();

  const subtotal = input.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);
  const discount = input.items.reduce((s, i) => s + (i.discount ?? 0), 0);
  const tax = input.items.reduce((s, i) => s + (i.tax ?? 0), 0);
  const total = subtotal - discount + tax;

  // Validate supplier & branch belong to org
  const { data: supplier } = await sb.from('suppliers').select('id, organization_id').eq('id', input.supplier_id).single();
  if (!supplier || supplier.organization_id !== orgId) throw new Error('Invalid supplier');
  const { data: branch } = await sb.from('branches').select('id, organization_id').eq('id', input.branch_id).single();
  if (!branch || branch.organization_id !== orgId) throw new Error('Invalid branch');
  // Validate products
  for (const it of input.items) {
    const { data: prod } = await sb.from('products').select('id, organization_id, is_active').eq('id', it.product_id).single();
    if (!prod || prod.organization_id !== orgId) throw new Error(`Invalid product ${it.product_id}`);
    if (!prod.is_active) throw new Error(`Product is inactive ${it.product_id}`);
  }

  const insertPayload: any = {
    organization_id: orgId,
    branch_id: input.branch_id,
    supplier_id: input.supplier_id,
    purchase_number: purchaseNumber,
    status: 'DRAFT',
    subtotal,
    discount,
    tax,
    total,
    ordered_at: new Date().toISOString(),
    created_by: profileId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  // optional fields if migration applied (ignore if column missing -> will error, so we try and fallback)
  if (input.expected_delivery_date) insertPayload.expected_delivery_date = input.expected_delivery_date;
  if (input.currency) insertPayload.currency = input.currency;
  if (input.payment_terms) insertPayload.payment_terms = input.payment_terms;
  if (input.notes) insertPayload.notes = input.notes;

  let po: any = null;
  // Try with optional fields, fallback without if column missing
  const { data: d1, error: e1 } = await sb.from('purchase_orders').insert(insertPayload).select().single();
  if (e1) {
    const msg = e1.message || '';
    if (/column.*does not exist|expected_delivery|currency|payment_terms|notes/i.test(msg)) {
      delete insertPayload.expected_delivery_date;
      delete insertPayload.currency;
      delete insertPayload.payment_terms;
      delete insertPayload.notes;
      const { data: d2, error: e2 } = await sb.from('purchase_orders').insert(insertPayload).select().single();
      if (e2) throw new Error(`Failed to create purchase: ${e2.message}`);
      po = d2;
    } else {
      throw new Error(`Failed to create purchase: ${e1.message}`);
    }
  } else {
    po = d1;
  }

  const purchaseItems = input.items.map((item) => ({
    purchase_order_id: po.id,
    product_id: item.product_id,
    quantity_ordered: item.quantity_ordered,
    quantity_received: 0,
    unit_cost: item.unit_cost,
    discount: item.discount ?? 0,
    tax: item.tax ?? 0,
    subtotal: item.quantity_ordered * item.unit_cost - (item.discount ?? 0) + (item.tax ?? 0),
  }));

  const { error: itemsErr } = await sb.from('purchase_items').insert(purchaseItems);
  if (itemsErr) {
    // cleanup header to avoid orphan
    await sb.from('purchase_orders').delete().eq('id', po.id);
    throw new Error(`Failed to create purchase items: ${itemsErr.message}`);
  }

  await createAuditLog('PURCHASE_CREATED', 'purchase_orders', po.id, null, po);
  return po;
}

export async function updatePurchaseStatus(purchaseId: string, newStatus: string, opts?: { approved_by?: string }) {
  const sb: any = await getSB();
  const po = await getOne('purchase_orders', purchaseId);
  if (!po) throw new Error('Purchase order not found');
  const valid = ['DRAFT','PENDING_APPROVAL','APPROVED','SENT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CLOSED','CANCELLED'] as const;
  if (!valid.includes(newStatus as any)) throw new Error(`Invalid status ${newStatus}`);
  // State machine: Draft → Pending Approval → Approved → Sent/Ordered → Partially/Received → Closed
  const allowed: Record<string, string[]> = {
    DRAFT: ['PENDING_APPROVAL','APPROVED','ORDERED','CANCELLED'],
    PENDING_APPROVAL: ['APPROVED','DRAFT','CANCELLED'],
    APPROVED: ['SENT','ORDERED','CANCELLED'],
    SENT: ['ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'],
    ORDERED: ['PARTIALLY_RECEIVED','RECEIVED','CANCELLED'],
    PARTIALLY_RECEIVED: ['RECEIVED','CANCELLED'],
    RECEIVED: ['CLOSED'],
    CLOSED: [],
    CANCELLED: [],
  };
  const cur = (po as any).status;
  if (!allowed[cur]?.includes(newStatus) && cur !== newStatus) {
    throw new Error(`Cannot transition from ${cur} to ${newStatus}`);
  }
  const profileId = await getProfileId();
  // Prevent cancelling after any receipt
  if (newStatus === 'CANCELLED') {
    const { data: items } = await sb.from('purchase_items').select('quantity_received').eq('purchase_order_id', purchaseId);
    const hasReceived = (items ?? []).some((it: any) => Number(it.quantity_received) > 0);
    if (hasReceived) throw new Error('Cannot cancel purchase with received quantities — use return');
  }
  const update: any = { status: newStatus, updated_at: new Date().toISOString() };
  if (newStatus === 'RECEIVED') update.received_at = new Date().toISOString();
  if (newStatus === 'ORDERED' || newStatus === 'SENT') update.ordered_at = new Date().toISOString();
  if (newStatus === 'APPROVED' || newStatus === 'PENDING_APPROVAL') {
    update.approved_by = opts?.approved_by ?? profileId ?? (po as any).approved_by ?? null;
    if (newStatus === 'APPROVED') update.approved_at = new Date().toISOString();
  }
  if (newStatus === 'SENT') update.sent_at = new Date().toISOString();
  if (newStatus === 'CLOSED') update.closed_at = new Date().toISOString();
  // Graceful fallback if new columns not yet migrated
  let data: any = null;
  let error: any = null;
  const res = await sb.from('purchase_orders').update(update).eq('id', purchaseId).select().single();
  data = res.data; error = res.error;
  if (error && /column.*does not exist|approved_by|approved_at|sent_at|closed_at/i.test(error.message)) {
    delete update.approved_by; delete update.approved_at; delete update.sent_at; delete update.closed_at;
    const res2 = await sb.from('purchase_orders').update(update).eq('id', purchaseId).select().single();
    data = res2.data; error = res2.error;
  }
  if (error) throw new Error(error.message);
  await createAuditLog('PURCHASE_STATUS_CHANGED', 'purchase_orders', purchaseId, po, { from: cur, to: newStatus });
  return data;
}

export async function cancelPurchase(purchaseId: string) {
  return updatePurchaseStatus(purchaseId, 'CANCELLED');
}

export async function receivePurchase(input: {
  purchase_order_id: string;
  received_items: Array<{
    purchase_item_id: string;
    product_id: string;
    quantity_received: number;
    unit_cost: number;
    batch_number: string;
    expiry_date: string;
    supplier_id: string;
    selling_price?: number;
    manufacturing_date?: string;
  }>;
}) {
  const sb: any = await getSB();
  const profileId = await getProfileId();
  const { purchase_order_id, received_items } = input;

  if (!received_items || received_items.length === 0) throw new Error('No items to receive');
  const po: any = await getOne('purchase_orders', purchase_order_id);
  if (!po) throw new Error('Purchase order not found');
  if (po.status === 'CANCELLED') throw new Error('Cannot receive cancelled purchase');
  if (po.status === 'RECEIVED') throw new Error('Purchase already fully received');

  // Fetch all purchase_items for this PO
  const { data: allItems, error: itemsErr } = await sb.from('purchase_items').select('*').eq('purchase_order_id', purchase_order_id);
  if (itemsErr) throw new Error(itemsErr.message);
  const itemMap = new Map((allItems ?? []).map((it: any) => [it.id, it]));
  // Validate each received entry
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const variances: any[] = [];
  for (const ri of received_items) {
    if (!ri.purchase_item_id || !itemMap.has(ri.purchase_item_id)) throw new Error(`Invalid purchase_item_id ${ri.purchase_item_id}`);
    const pi: any = itemMap.get(ri.purchase_item_id);
    if (pi.product_id !== ri.product_id) throw new Error(`Product mismatch for item ${ri.purchase_item_id}`);
    if (!Number.isInteger(ri.quantity_received) || ri.quantity_received <= 0) throw new Error(`Invalid quantity for ${ri.batch_number}`);
    if (!ri.batch_number || String(ri.batch_number).trim().length === 0) throw new Error('Batch number required');
    if (String(ri.batch_number).length > 50) throw new Error('Batch number too long');
    if (!ri.expiry_date) throw new Error(`Expiry required for batch ${ri.batch_number}`);
    const exp = new Date(ri.expiry_date);
    if (isNaN(exp.getTime())) throw new Error(`Invalid expiry date for batch ${ri.batch_number}`);
    exp.setHours(0, 0, 0, 0);
    if (exp <= today) throw new Error(`Batch ${ri.batch_number} is already expired (${ri.expiry_date})`);
    // short-dated flag (<90 days)
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 30) {
      variances.push({ batch: ri.batch_number, warning: `Short-dated: expires in ${diffDays} days`, expiry_date: ri.expiry_date });
    }
    if (ri.unit_cost < 0) throw new Error(`Invalid unit_cost for ${ri.batch_number}`);
    // Over-receiving check per item cumulative
    const already = Number(pi.quantity_received ?? 0);
    const pendingSameItem = received_items.filter((x) => x.purchase_item_id === ri.purchase_item_id).reduce((s, x) => s + Number(x.quantity_received), 0);
    // Avoid double counting in loop — we check total after grouping
  }
  // Group by purchase_item_id for cumulative check
  const grouped: Record<string, number> = {};
  for (const ri of received_items) grouped[ri.purchase_item_id] = (grouped[ri.purchase_item_id] ?? 0) + Number(ri.quantity_received);
  for (const [pid, qty] of Object.entries(grouped)) {
    const pi: any = itemMap.get(pid);
    const newTotal = Number(pi.quantity_received ?? 0) + Number(qty);
    if (newTotal > Number(pi.quantity_ordered)) {
      const over = newTotal - Number(pi.quantity_ordered);
      variances.push({ purchase_item_id: pid, over_received: over, ordered: pi.quantity_ordered, will_receive_total: newTotal, warning: `Over-receiving by ${over}` });
      // Allow but log; if over > 20% of ordered, require attention — we still allow but flag
    }
    if (newTotal < 0) throw new Error('Negative quantity not allowed');
  }

  // Idempotency: check duplicate batch numbers for same PO/product to avoid double apply
  // We will create batches one by one; if any batch_number already exists for same product/branch, Supabase will allow duplicate but we warn
  const createdBatches: any[] = [];
  const stockMovements: any[] = [];

  for (const ri of received_items) {
    const pi: any = itemMap.get(ri.purchase_item_id);
    const selling = ri.selling_price != null ? Number(ri.selling_price) : Math.round(Number(ri.unit_cost) * 1.5 * 100) / 100;
    const batchPayload: any = {
      organization_id: po.organization_id,
      branch_id: po.branch_id,
      product_id: ri.product_id,
      batch_number: String(ri.batch_number).trim(),
      expiry_date: new Date(ri.expiry_date).toISOString().slice(0, 10),
      purchase_price: Number(ri.unit_cost),
      selling_price: selling,
      quantity_received: Number(ri.quantity_received),
      quantity_available: Number(ri.quantity_received),
      received_at: new Date().toISOString().slice(0, 10),
      supplier_id: ri.supplier_id || po.supplier_id,
      purchase_item_id: ri.purchase_item_id,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (ri.manufacturing_date) {
      const m = new Date(ri.manufacturing_date);
      if (!isNaN(m.getTime()) && m < new Date(ri.expiry_date)) {
        // store if column exists — try, will fallback silently if missing
        batchPayload.manufacturing_date = m.toISOString().slice(0, 10);
      }
    }
    let batch: any = null;
    const { data: b1, error: be1 } = await sb.from('product_batches').insert(batchPayload).select().single();
    if (be1) {
      const msg = be1.message || '';
      if (/column.*manufacturing_date/i.test(msg)) {
        delete batchPayload.manufacturing_date;
        const { data: b2, error: be2 } = await sb.from('product_batches').insert(batchPayload).select().single();
        if (be2) throw new Error(`Failed to create batch ${ri.batch_number}: ${be2.message}`);
        batch = b2;
      } else if (/duplicate|unique/i.test(msg)) {
        throw new Error(`Duplicate batch ${ri.batch_number} for product`);
      } else {
        throw new Error(`Failed to create batch ${ri.batch_number}: ${be1.message}`);
      }
    } else {
      batch = b1;
    }
    createdBatches.push(batch);

    // stock movement per batch
    const { error: movErr } = await sb.from('stock_movements').insert({
      organization_id: po.organization_id,
      branch_id: po.branch_id,
      product_id: ri.product_id,
      batch_id: batch.id,
      movement_type: 'PURCHASE',
      quantity: Number(ri.quantity_received),
      reference_type: 'PURCHASE_ORDER',
      reference_id: purchase_order_id,
      unit_cost: Number(ri.unit_cost),
      notes: `GRN PO ${po.purchase_number} batch ${ri.batch_number}`,
      created_by: profileId,
    });
    if (movErr) throw new Error(`Failed to create movement for ${ri.batch_number}: ${movErr.message}`);
    stockMovements.push({ batch_id: batch.id, quantity: ri.quantity_received });

    // price history & supplier pricing
    try {
      // Update product default costs if this is latest? Do not overwrite historical but update current default for future reference
      // Also record price_history if cost changed
      const { data: prod } = await sb.from('products').select('default_purchase_cost, default_selling_price').eq('id', ri.product_id).single();
      if (prod) {
        if (Number(prod.default_purchase_cost) !== Number(ri.unit_cost)) {
          await sb.from('price_history').insert({
            organization_id: po.organization_id,
            product_id: ri.product_id,
            batch_id: batch.id,
            field_name: 'purchase_price',
            old_value: prod.default_purchase_cost != null ? String(prod.default_purchase_cost) : null,
            new_value: String(ri.unit_cost),
            changed_by: profileId,
            reason: `Purchase ${po.purchase_number}`,
            effective_date: new Date().toISOString().slice(0, 10),
            created_at: new Date().toISOString(),
          });
          // Optionally update product default (preserve history, but update current)
          await sb.from('products').update({ default_purchase_cost: ri.unit_cost, default_selling_price: selling, updated_at: new Date().toISOString() }).eq('id', ri.product_id);
        }
      }
      // Upsert product_suppliers junction
      const { data: ps } = await sb.from('product_suppliers').select('id').eq('product_id', ri.product_id).eq('supplier_id', ri.supplier_id || po.supplier_id).maybeSingle();
      if (ps) {
        await sb.from('product_suppliers').update({ last_purchase_price: ri.unit_cost, updated_at: new Date().toISOString() }).eq('id', ps.id);
      } else {
        // insert if table exists
        await sb.from('product_suppliers').insert({
          product_id: ri.product_id,
          supplier_id: ri.supplier_id || po.supplier_id,
          last_purchase_price: ri.unit_cost,
          is_preferred: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      // non-critical, ignore supplier price history failures (table may not exist)
    }
  }

  // Update purchase_items quantity_received incrementally
  for (const [pid, qty] of Object.entries(grouped)) {
    const pi: any = itemMap.get(pid);
    const newQty = Number(pi.quantity_received ?? 0) + Number(qty);
    const { error: updErr } = await sb.from('purchase_items').update({ quantity_received: newQty }).eq('id', pid);
    if (updErr) throw new Error(`Failed to update item ${pid}: ${updErr.message}`);
  }

  // Create Goods Received Note (GRN) — authoritative document linking receipt to batches
  let createdGRN: any = null;
  try {
    const totalQty = received_items.reduce((s, r) => s + Number(r.quantity_received), 0);
    const totalVal = received_items.reduce((s, r) => s + Number(r.quantity_received) * Number(r.unit_cost), 0);
    const grnPayload: any = {
      organization_id: po.organization_id,
      branch_id: po.branch_id,
      purchase_order_id,
      grn_number: `GRN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
      status: 'RECEIVED',
      received_by: profileId,
      received_at: new Date().toISOString(),
      notes: `GRN for PO ${po.purchase_number}`,
      total_quantity: totalQty,
      total_value: totalVal,
    };
    // Try insert; trigger will overwrite grn_number with server sequence if column respects trigger
    const { data: grn, error: grnErr } = await sb.from('goods_receipts').insert(grnPayload).select().single();
    if (!grnErr && grn) {
      createdGRN = grn;
      const grnItems = received_items.map((ri, idx) => ({
        goods_receipt_id: grn.id,
        purchase_item_id: ri.purchase_item_id,
        product_id: ri.product_id,
        batch_id: createdBatches[idx]?.id ?? null,
        quantity_received: Number(ri.quantity_received),
        unit_cost: Number(ri.unit_cost),
        batch_number: ri.batch_number,
        expiry_date: new Date(ri.expiry_date).toISOString().slice(0,10),
        amount: Number(ri.quantity_received) * Number(ri.unit_cost),
      }));
      await sb.from('goods_receipt_items').insert(grnItems);
      // Also link stock_movements to GRN where possible (keep PO ref for traceability, add GRN ref in notes)
    } else if (grnErr && !/does not exist|relation.*goods_receipts/i.test(grnErr.message)) {
      // If table missing, silently skip (pre-migration env)
      if (!/does not exist|relation/i.test(grnErr.message)) throw new Error(`GRN create failed: ${grnErr.message}`);
    }
  } catch (e) {
    // Non-blocking — batches/movements already created; GRN is supplementary document
    if ((e as any)?.message && !/does not exist|relation/i.test((e as any).message)) throw e as any;
  }

  // Re-fetch items to compute status
  const { data: updatedItems } = await sb.from('purchase_items').select('quantity_ordered, quantity_received').eq('purchase_order_id', purchase_order_id);
  let allReceived = true;
  let anyReceived = false;
  for (const it of (updatedItems ?? [])) {
    if (Number(it.quantity_received) > 0) anyReceived = true;
    if (Number(it.quantity_received) < Number(it.quantity_ordered)) allReceived = false;
  }
  let newStatus = po.status;
  if (allReceived && anyReceived) newStatus = 'RECEIVED';
  else if (anyReceived) newStatus = 'PARTIALLY_RECEIVED';
  else newStatus = 'ORDERED';

  const updatePO: any = { status: newStatus, updated_at: new Date().toISOString() };
  if (anyReceived && !po.received_at) updatePO.received_at = new Date().toISOString();
  // Do NOT overwrite total blindly; keep ordered total, but store received value in audit
  const { data: updatedPO, error: poUpdErr } = await sb.from('purchase_orders').update(updatePO).eq('id', purchase_order_id).select().single();
  if (poUpdErr) throw new Error(poUpdErr.message);

  await createAuditLog('PURCHASE_RECEIVED', 'purchase_orders', purchase_order_id, po, { status: newStatus, variances, grn: createdGRN?.grn_number ?? null, batches: createdBatches.map((b) => b.batch_number), movements: stockMovements.length });

  return { purchase: updatedPO, batches: createdBatches, variances, grn: createdGRN };
}

export async function getPurchases(params: { branch_id?: string; page?: number; perPage?: number; status?: string; supplier_id?: string; search?: string; date_from?: string; date_to?: string; product_id?: string }) {
  const sb: any = await getSB();
  const { branch_id, page = 1, perPage = 20, status, supplier_id, search, date_from, date_to, product_id } = params;
  // Server-side: purchase_number ilike via PostgREST .ilike; supplier/product/batch handled via post-filter fallback
  let query = sb.from('purchase_orders').select('*, suppliers(name), purchase_items(product_id), product_batches:product_batches!inner(batch_number)', { count: 'exact' });
  // Try server-side ilike for purchase_number; if fails due to join, fallback to client
  try {
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.ilike('purchase_number', term);
    }
  } catch {}
  if (branch_id) query = query.eq('branch_id', branch_id);
  if (status) query = query.eq('status', status);
  if (supplier_id) query = query.eq('supplier_id', supplier_id);
  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to);
  query = query.order('created_at', { ascending: false });
  const from = (page - 1) * perPage;
  let data: any[] = []; let count: number | null = 0; let error: any = null;
  try {
    const res = await query.range(from, from + perPage - 1);
    data = (res.data ?? []) as any[]; count = res.count; error = res.error;
    if (error && /product_batches|inner/i.test(error.message)) throw error;
  } catch (e:any) {
    // Fallback without product_batches join (e.g., no batches yet or postgREST join error)
    let q2 = sb.from('purchase_orders').select('*, suppliers(name), purchase_items(product_id)', { count: 'exact' });
    if (search && search.trim()) q2 = q2.ilike('purchase_number', `%${search.trim()}%`);
    if (branch_id) q2 = q2.eq('branch_id', branch_id);
    if (status) q2 = q2.eq('status', status);
    if (supplier_id) q2 = q2.eq('supplier_id', supplier_id);
    if (date_from) q2 = q2.gte('created_at', date_from);
    if (date_to) q2 = q2.lte('created_at', date_to);
    q2 = q2.order('created_at', { ascending: false });
    const res2 = await q2.range(from, from + perPage - 1);
    data = (res2.data ?? []) as any[]; count = res2.count; error = res2.error;
  }
  if (error) throw new Error(`Failed to fetch purchases: ${error.message}`);
  let filtered = data as any[];
  if (product_id) {
    filtered = filtered.filter((po: any) => (po.purchase_items ?? []).some((pi: any) => pi.product_id === product_id));
  }
  // If ilike missed supplier/batch/SKU matches, augment with client-side search on fetched page
  if (search) {
    const s = search.toLowerCase();
    // If server ilike returned 0 but client terms match supplier/batch, fall back to broader fetch then client filter
    const hasServerHits = filtered.length > 0;
    if (!hasServerHits) {
      // Fetch without ilike for this page and apply client filter (supplier/batch/SKU)
      let q3 = sb.from('purchase_orders').select('*, suppliers(name), purchase_items(product_id, products(sku, barcode)), product_batches(batch_number)', { count: 'exact' });
      if (branch_id) q3 = q3.eq('branch_id', branch_id);
      if (status) q3 = q3.eq('status', status);
      if (supplier_id) q3 = q3.eq('supplier_id', supplier_id);
      if (date_from) q3 = q3.gte('created_at', date_from);
      if (date_to) q3 = q3.lte('created_at', date_to);
      q3 = q3.order('created_at', { ascending: false }).range(from, from + perPage - 1);
      const res3 = await q3;
      if (!res3.error && res3.data) {
        const alt = (res3.data as any[]).filter((po: any) =>
          po.purchase_number?.toLowerCase().includes(s) ||
          po.suppliers?.name?.toLowerCase().includes(s) ||
          po.id?.toLowerCase().includes(s) ||
          (po.purchase_items ?? []).some((pi:any)=> pi.products?.sku?.toLowerCase().includes(s) || pi.products?.barcode?.toLowerCase().includes(s)) ||
          (po.product_batches ?? []).some((b:any)=> b.batch_number?.toLowerCase().includes(s))
        );
        if (alt.length > 0) { filtered = alt; count = alt.length; }
      }
    } else {
      // Enrich server hits with client-side supplier/batch/SKU if term not in purchase_number
      const extra = filtered.filter((po: any) =>
        po.purchase_number?.toLowerCase().includes(s) ||
        po.suppliers?.name?.toLowerCase().includes(s) ||
        po.id?.toLowerCase().includes(s)
      );
      if (extra.length === 0) {
        // keep original server hits
      } else filtered = filtered.filter((po: any) =>
        po.purchase_number?.toLowerCase().includes(s) ||
        po.suppliers?.name?.toLowerCase().includes(s) ||
        po.id?.toLowerCase().includes(s)
      );
    }
  }
  return { data: filtered, count: count ?? filtered.length };
}

export async function getPurchaseById(id: string) {
  const sb: any = await getSB();
  const { data, error } = await sb
    .from('purchase_orders')
    .select(`*, suppliers(*), branches(*), purchase_items(*, products(*)), audit_logs: audit_logs(*)` )
    .eq('id', id)
    .single();
  if (error) {
    // fallback without audit_logs join if relation missing
    const { data: d2, error: e2 } = await sb.from('purchase_orders').select(`*, suppliers(*), branches(*), purchase_items(*, products(*))`).eq('id', id).single();
    if (e2) throw new Error(`Failed to fetch purchase: ${e2.message}`);
    // also fetch batches & movements
    const { data: batches } = await sb.from('product_batches').select('*').eq('purchase_item_id', id).limit(1);
    // Actually fetch by purchase_order via stock_movements
    const { data: movements } = await sb.from('stock_movements').select('*, product_batches(*)').eq('reference_id', id).eq('reference_type', 'PURCHASE_ORDER');
    const { data: batches2 } = await sb.from('product_batches').select('*').in('id', (movements ?? []).map((m: any) => m.batch_id).filter(Boolean));
    const { data: payments } = await sb.from('supplier_payments').select('*').eq('purchase_order_id', id);
    const { data: returns } = await sb.from('purchase_returns').select('*, purchase_return_items(*)').eq('purchase_order_id', id);
    const { data: grnBatches } = await sb.from('product_batches').select('*').eq('organization_id', d2.organization_id).eq('branch_id', d2.branch_id);
    // filter grnBatches to those linked to this PO's items
    const itemIds = (d2.purchase_items ?? []).map((pi: any) => pi.id);
    const relevantBatches = (grnBatches ?? []).filter((b: any) => itemIds.includes(b.purchase_item_id));
    return { ...d2, batches: relevantBatches, stock_movements: movements ?? [], supplier_payments: payments ?? [], purchase_returns: returns ?? [] };
  }
  // enrich with batches/movements/payments
  const itemIds = (data.purchase_items ?? []).map((pi: any) => pi.id);
  let batches: any[] = [];
  let movements: any[] = [];
  let payments: any[] = [];
  let returns: any[] = [];
  let grns: any[] = [];
  let grnItems: any[] = [];
  let attachments: any[] = [];
  try {
    const [bRes, mRes, pRes, rRes, grnRes, attRes] = await Promise.all([
      sb.from('product_batches').select('*').in('purchase_item_id', itemIds.length ? itemIds : ['00000000-0000-0000-0000-000000000000']),
      sb.from('stock_movements').select('*').eq('reference_id', id).eq('reference_type', 'PURCHASE_ORDER'),
      sb.from('supplier_payments').select('*').eq('purchase_order_id', id),
      sb.from('purchase_returns').select('*, purchase_return_items(*)').eq('purchase_order_id', id),
      sb.from('goods_receipts').select('*, goods_receipt_items(*)').eq('purchase_order_id', id).order('received_at', { ascending: false }).limit(20).then((r:any)=>r).catch(()=>({data:[]})) as any,
      sb.from('purchase_attachments').select('*').eq('purchase_order_id', id).order('created_at', { ascending: false }).then((r:any)=>r).catch(()=>({data:[]})) as any,
    ]);
    batches = bRes.data ?? [];
    movements = mRes.data ?? [];
    payments = pRes.data ?? [];
    returns = rRes.data ?? [];
    grns = (grnRes as any)?.data ?? [];
    attachments = (attRes as any)?.data ?? [];
    if (grns.length) grnItems = grns.flatMap((g:any)=> g.goods_receipt_items ?? []);
  } catch {}
  return { ...data, batches, stock_movements: movements, supplier_payments: payments, purchase_returns: returns, goods_receipts: grns, goods_receipt_items: grnItems, purchase_attachments: attachments };
}

export async function getPurchaseKPIs(branch_id?: string) {
  const sb: any = await getSB();
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let base = sb.from('purchase_orders').select('id, status, total, created_at, supplier_id');
  if (branch_id) base = base.eq('branch_id', branch_id);
  const { data: all } = await base;
  const list = (all ?? []) as any[];
  const totalThisPeriod = list.filter((p) => p.created_at >= startMonth).reduce((s: number, p: any) => s + Number(p.total), 0);
  const pendingPOs = list.filter((p) => ['DRAFT', 'ORDERED'].includes(p.status)).length;
  const pendingReceipts = list.filter((p) => ['ORDERED', 'PARTIALLY_RECEIVED'].includes(p.status)).length;
  const partially = list.filter((p) => p.status === 'PARTIALLY_RECEIVED').length;
  const totalCount = list.length;
  // Payables: sum purchased - paid - returned via rpc per supplier? Approximate via view: use get_supplier_balance aggregated
  let unpaidTotal = 0;
  const overdue = 0;
  try {
    const { data: pos } = await sb.from('purchase_orders').select('id, total, status, created_at').in('status', ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED']);
    const poIds = (pos ?? []).map((p: any) => p.id);
    let paidSum = 0;
    if (poIds.length) {
      const { data: pays } = await sb.from('supplier_payments').select('amount, purchase_order_id');
      paidSum = (pays ?? []).reduce((s: number, pay: any) => s + Number(pay.amount), 0);
      const orderedSum = (pos ?? []).reduce((s: number, p: any) => s + Number(p.total), 0);
      unpaidTotal = Math.max(0, orderedSum - paidSum);
    }
  } catch {}
  // Returns recent
  let returnsCount = 0;
  try {
    const { data: rets } = await sb.from('purchase_returns').select('id').gte('created_at', startMonth);
    returnsCount = (rets ?? []).length;
  } catch {}
  return { totalThisPeriod, pendingPOs, pendingReceipts, partially, totalCount, unpaidTotal, overdue, returnsCount };
}

export async function getSupplierPurchaseHistory(supplierId: string, productId?: string) {
  const sb: any = await getSB();
  let q = sb.from('purchase_items').select('unit_cost, quantity_ordered, purchase_order_id, product_id, purchase_orders!inner(supplier_id, created_at, purchase_number)').eq('purchase_orders.supplier_id', supplierId).order('created_at', { ascending: false }).limit(20);
  if (productId) q = q.eq('product_id', productId);
  const { data } = await q;
  return data ?? [];
}

export async function getGoodsReceipts(purchaseOrderId: string) {
  const sb: any = await getSB();
  const { data, error } = await sb.from('goods_receipts').select('*, goods_receipt_items(*, products(name), batches:product_batches(batch_number))').eq('purchase_order_id', purchaseOrderId).order('received_at', { ascending: false });
  if (error) {
    if (/does not exist|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function addPurchaseAttachment(input: { purchase_order_id: string; goods_receipt_id?: string | null; file_name: string; file_url: string; file_size?: number; mime_type?: string; document_type: 'SUPPLIER_INVOICE'|'DELIVERY_NOTE'|'PURCHASE_ORDER'|'CREDIT_NOTE'|'OTHER' }) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  const prof = await getProfileId();
  const { data, error } = await sb.from('purchase_attachments').insert({
    organization_id: orgId,
    purchase_order_id: input.purchase_order_id,
    goods_receipt_id: input.goods_receipt_id ?? null,
    file_name: input.file_name,
    file_url: input.file_url,
    file_size: input.file_size ?? null,
    mime_type: input.mime_type ?? null,
    document_type: input.document_type,
    uploaded_by: prof,
  }).select().single();
  if (error) {
    if (/does not exist|relation/i.test(error.message)) throw new Error('Attachments table not yet migrated — run 00041');
    throw new Error(error.message);
  }
  await createAuditLog('PURCHASE_ATTACHMENT_ADDED', 'purchase_attachments', data.id, null, data);
  return data;
}

export async function getPurchaseAttachments(purchaseOrderId: string) {
  const sb: any = await getSB();
  const { data, error } = await sb.from('purchase_attachments').select('*').eq('purchase_order_id', purchaseOrderId).order('created_at', { ascending: false });
  if (error) {
    if (/does not exist|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}
