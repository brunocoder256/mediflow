/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getOne, insertOne, createAuditLog, getSB } from './supabase';
import type { CreatePurchaseInput } from '@/lib/validations/purchases';

export async function createPurchase(input: CreatePurchaseInput) {
    const sb = await getSB();
    const profileId = await import('./supabase').then(m => m.getProfileId());
    const purchaseNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const subtotal = input.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);
    const discount = 0;
    const tax = input.items.reduce((s, i) => s + i.tax, 0);
    const total = subtotal - discount + tax;

    const { data, error } = await sb.from('purchase_orders').insert({
        branch_id: input.branch_id,
        supplier_id: input.supplier_id,
        purchase_number: purchaseNumber,
        status: 'DRAFT',
        subtotal, discount, tax, total,
        created_by: profileId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(`Failed to create purchase: ${error.message}`);

    const purchaseItems = input.items.map(item => ({
        purchase_order_id: data.id,
        product_id: item.product_id,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_cost: item.unit_cost,
        discount: item.discount,
        tax: item.tax,
        subtotal: item.quantity_ordered * item.unit_cost,
    }));

    await sb.from('purchase_items').insert(purchaseItems);
    await createAuditLog('PURCHASE_CREATED', 'purchase_orders', data.id, null, data);
    return data;
}

export async function receivePurchase(input: {
    purchase_order_id: string;
    received_items: Array<{
        purchase_item_id: string; product_id: string; quantity_received: number;
        unit_cost: number; batch_number: string; expiry_date: string; supplier_id: string;
    }>;
}) {
    const sb = await getSB();
    const profileId = await import('./supabase').then(m => m.getProfileId());
    const { purchase_order_id, received_items } = input;

    const po = await getOne('purchase_orders', purchase_order_id);
    if (!po) throw new Error('Purchase order not found');

    const receivedQuantities: Record<string, number> = {};
    for (const item of received_items) {
        receivedQuantities[item.purchase_item_id] = (receivedQuantities[item.purchase_item_id] ?? 0) + item.quantity_received;
    }

    const { data: batch, error: batchErr } = await sb.from('product_batches').insert({
        organization_id: po.organization_id,
        branch_id: po.branch_id,
        product_id: received_items[0].product_id,
        batch_number: received_items[0].batch_number,
        expiry_date: received_items[0].expiry_date,
        purchase_price: received_items[0].unit_cost,
        selling_price: received_items[0].unit_cost * 1.5,
        quantity_received: received_items.reduce((s, i) => s + i.quantity_received, 0),
        quantity_available: received_items.reduce((s, i) => s + i.quantity_received, 0),
        received_at: new Date().toISOString(),
        supplier_id: received_items[0].supplier_id,
        purchase_item_id: received_items[0].purchase_item_id,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).select().single();
    if (batchErr) throw new Error(`Failed to create batch: ${batchErr.message}`);

    const totalReceived = received_items.reduce((s, i) => s + i.quantity_received * i.unit_cost, 0);

    let status: string = 'RECEIVED';
    const orderedQty = await sb.from('purchase_items').select('quantity_ordered').eq('id', received_items[0].purchase_item_id).single();
    const totalOrdered = (orderedQty.data as any)?.quantity_ordered ?? 0;
    const totalReceivedQty = received_items.reduce((s, i) => s + i.quantity_received, 0);
    if (totalReceivedQty < totalOrdered) status = 'PARTIALLY_RECEIVED';

    await sb.from('purchase_orders').update({
        status, received_at: new Date().toISOString(), total: totalReceived,
        updated_at: new Date().toISOString(),
    }).eq('id', purchase_order_id);

    for (const item of received_items) {
        await sb.from('stock_movements').insert({
            organization_id: po.organization_id,
            branch_id: po.branch_id,
            product_id: item.product_id,
            batch_id: batch.id,
            movement_type: 'PURCHASE',
            quantity: item.quantity_received,
            reference_type: 'PURCHASE_ORDER',
            reference_id: purchase_order_id,
            unit_cost: item.unit_cost,
            notes: `Received PO ${po.purchase_number}`,
            created_by: profileId,
        });
    }

    await createAuditLog('PURCHASE_RECEIVED', 'purchase_orders', purchase_order_id, po, { status });
    return { purchase: await getOne('purchase_orders', purchase_order_id), batch };
}

export async function getPurchases(params: { branch_id?: string; page?: number; perPage?: number; status?: string }) {
    const sb = await getSB();
    const { branch_id, page = 1, perPage = 20, status } = params;
    let query = sb.from('purchase_orders').select('*', { count: 'exact' });
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false });
    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);
    if (error) throw new Error(`Failed to fetch purchases: ${error.message}`);
    return { data, count };
}

export async function getPurchaseById(id: string) {
    const sb = await getSB();
    const { data, error } = await sb.from('purchase_orders')
        .select(`*, purchase_items(*, products(*))`)
        .eq('id', id)
        .single();
    if (error) throw new Error(`Failed to fetch purchase: ${error.message}`);
    return data;
}

