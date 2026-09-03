/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getOne, insertOne, createAuditLog, getSB } from './supabase';

export async function createReturn(input: {
    sale_id: string; branch_id: string;
    items: Array<{ sale_item_id: string; product_id: string; batch_id: string; quantity: number; reason: string; return_condition: string }>;
    reason?: string;
}) {
    const sb = await getSB();
    const profileId = await import('./supabase').then(m => m.getProfileId());
    const returnNumber = `RET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const sale = await getOne('sales', input.sale_id);
    if (!sale) throw new Error('Sale not found');

    const total = input.items.reduce((s, i) => s + i.quantity * i.quantity * 0, 0);

    const { data, error } = await sb.from('returns').insert({
        organization_id: sale.organization_id,
        branch_id: input.branch_id,
        return_number: returnNumber,
        sale_id: input.sale_id,
        reason: input.reason,
        total,
        status: 'pending',
        created_by: profileId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(`Failed to create return: ${error.message}`);

    const returnItems = input.items.map(item => ({
        return_id: data.id,
        sale_item_id: item.sale_item_id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        amount: item.quantity * 0,
    }));

    await sb.from('return_items').insert(returnItems);

    for (const item of input.items) {
        if (item.return_condition === 'SELLABLE') {
            await sb.from('stock_movements').insert({
                organization_id: sale.organization_id,
                branch_id: input.branch_id,
                product_id: item.product_id,
                batch_id: item.batch_id,
                movement_type: 'SALE_RETURN',
                quantity: item.quantity,
                reference_type: 'RETURN',
                reference_id: data.id,
                notes: `Return ${returnNumber}`,
                created_by: profileId,
            });
            await increaseBatchQty(item.batch_id, item.quantity);
        } else {
            await sb.from('stock_movements').insert({
                organization_id: sale.organization_id,
                branch_id: input.branch_id,
                product_id: item.product_id,
                batch_id: item.batch_id,
                movement_type: 'DAMAGED',
                quantity: item.quantity,
                reference_type: 'RETURN',
                reference_id: data.id,
                notes: `Return ${returnNumber} - ${item.return_condition}`,
                created_by: profileId,
            });
        }
    }

    await createAuditLog('SALE_RETURNED', 'returns', data.id, sale, data);
    return data;
}

async function increaseBatchQty(batchId: string, quantity: number) {
    const sb = await getSB();
    const existing = await getOne('product_batches', batchId);
    await sb.from('product_batches')
        .update({ quantity_available: existing.quantity_available + quantity, updated_at: new Date().toISOString() }).eq('id', batchId);
}

export async function getReturns(params: { branch_id?: string; page?: number; perPage?: number }) {
    const sb = await getSB();
    const { branch_id, page = 1, perPage = 20 } = params;
    let query = sb.from('returns').select('*', { count: 'exact' });
    if (branch_id) query = query.eq('branch_id', branch_id);
    query = query.order('created_at', { ascending: false });
    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);
    if (error) throw new Error(`Failed to fetch returns: ${error.message}`);
    return { data, count };
}

