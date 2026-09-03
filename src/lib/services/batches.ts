/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getOne, insertOne, updateOne, createAuditLog, getSB } from './supabase';

export async function getBatchesByProduct(productId: string) {
    const sb = await getSB();
    const { data, error } = await sb.from('product_batches')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('expiry_date');
    if (error) throw new Error(`Failed to fetch batches: ${error.message}`);
    return data;
}

export async function getAvailableBatch(productId: string, branchId: string, quantity: number) {
    const sb = await getSB();
    const { data, error } = await sb.from('product_batches')
        .select('*')
        .eq('product_id', productId)
        .eq('branch_id', branchId)
        .gte('quantity_available', quantity)
        .gt('expiry_date', new Date().toISOString())
        .eq('is_active', true)
        .order('expiry_date', { ascending: true })
        .limit(1)
        .single();
    if (error) throw new Error(`No eligible batch found: ${error.message}`);
    return data;
}

export async function createBatch(input: {
    product_id: string; branch_id: string; batch_number: string;
    expiry_date: string; purchase_price: number; selling_price: number;
    quantity: number; supplier_id?: string; received_at?: string;
}) {
    const sb = await getSB();
    const profileId = await import('./supabase').then(m => m.getProfileId());
    const { data, error } = await sb.from('product_batches').insert({
        ...input,
        quantity_received: input.quantity,
        quantity_available: input.quantity,
        received_at: input.received_at ?? new Date().toISOString(),
        created_by: profileId,
    }).select().single();
    if (error) throw new Error(`Failed to create batch: ${error.message}`);
    await createAuditLog('BATCH_CREATED', 'product_batches', data.id, null, data);
    return data;
}

export async function updateBatchQuantity(batchId: string, newQuantity: number) {
    const existing = await getOne('product_batches', batchId);
    const sb = await getSB();
    const { data, error } = await sb.from('product_batches')
        .update({ quantity_available: newQuantity, updated_at: new Date().toISOString() }).eq('id', batchId).select().single();
    if (error) throw new Error(`Failed to update batch: ${error.message}`);
    await createAuditLog('BATCH_QUANTITY_UPDATED', 'product_batches', batchId, existing, data);
    return data;
}

export async function reduceBatchQuantity(batchId: string, quantity: number) {
    const existing = await getOne('product_batches', batchId);
    if (!existing || existing.quantity_available < quantity) {
        throw new Error(`Insufficient stock in batch ${batchId}`);
    }
    const sb = await getSB();
    const { data, error } = await sb.from('product_batches')
        .update({
            quantity_available: existing.quantity_available - quantity,
            quantity_received: existing.quantity_received - quantity,
            updated_at: new Date().toISOString(),
        }).eq('id', batchId).select().single();
    if (error) throw new Error(`Failed to reduce batch: ${error.message}`);
    await createAuditLog('BATCH_QUANTITY_REDUCED', 'product_batches', batchId, existing, data);
    return data;
}

export async function increaseBatchQuantity(batchId: string, quantity: number) {
    const existing = await getOne('product_batches', batchId);
    const sb = await getSB();
    const { data, error } = await sb.from('product_batches')
        .update({
            quantity_available: existing.quantity_available + quantity,
            updated_at: new Date().toISOString(),
        }).eq('id', batchId).select().single();
    if (error) throw new Error(`Failed to increase batch: ${error.message}`);
    await createAuditLog('BATCH_QUANTITY_INCREASED', 'product_batches', batchId, existing, data);
    return data;
}

export async function getStockOverview() {
    const sb = await getSB();
    const { data, error } = await sb.from('product_batches')
        .select(`
            *,
            products(id, name, category_id, reorder_level),
            branches(id, name)
        `)
        .eq('is_active', true);
    if (error) throw new Error(`Failed to fetch stock overview: ${error.message}`);
    return data;
}

export async function getLowStockItems() {
    const sb = await getSB();
    const { data, error } = await sb.from('product_batches')
        .select(`
            *,
            products(id, name, reorder_level)
        `)
        .lte('quantity_available', 'products.reorder_level')
        .eq('is_active', true)
        .order('quantity_available');
    if (error) throw new Error(`Failed to fetch low stock: ${error.message}`);
    return data;
}

export async function getExpiringItems(days: number = 90) {
    const sb = await getSB();
    const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb.from('product_batches')
        .select('*')
        .lte('expiry_date', threshold)
        .gt('expiry_date', new Date().toISOString())
        .eq('is_active', true)
        .order('expiry_date');
    if (error) throw new Error(`Failed to fetch expiring items: ${error.message}`);
    return data;
}

export async function getExpiredItems() {
    const sb = await getSB();
    const { data, error } = await sb.from('product_batches')
        .select('*')
        .lte('expiry_date', new Date().toISOString())
        .eq('is_active', true)
        .order('expiry_date');
    if (error) throw new Error(`Failed to fetch expired items: ${error.message}`);
    return data;
}

export async function getInventoryValue() {
    const sb = await getSB();
    const { data, error } = await sb.from('product_batches')
        .select('quantity_available, purchase_price')
        .eq('is_active', true);
    if (error) throw new Error(`Failed to fetch inventory value: ${error.message}`);
    return data;
}

