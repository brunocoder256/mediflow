/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { insertOne, updateOne, createAuditLog, getSB } from './supabase';
import type { CreateStockCountInput, CountItemInput } from '@/lib/validations/stock';

export async function createStockCount(input: CreateStockCountInput) {
    const sb = await getSB();
    const profileId = await import('./supabase').then(m => m.getProfileId());

    const { data, error } = await sb.from('stock_counts').insert({
        ...input,
        status: 'DRAFT',
        variance_total: 0,
        financial_impact: 0,
        created_by: profileId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(`Failed to create stock count: ${error.message}`);

    await createAuditLog('STOCK_COUNT_CREATED', 'stock_counts', data.id, null, data);
    return data;
}

export async function addCountItems(countId: string, items: CountItemInput[]) {
    const sb = await getSB();
    const profileId = await import('./supabase').then(m => m.getProfileId());

    const countItems = items.map(item => ({
        stock_count_id: countId,
        product_id: item.product_id,
        batch_id: item.batch_id || null,
        system_quantity: 0,
        counted_quantity: item.counted_quantity,
        variance: item.counted_quantity,
        reason: item.reason,
        created_by: profileId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }));

    const { data, error } = await sb.from('stock_count_items').insert(countItems).select();
    if (error) throw new Error(`Failed to add count items: ${error.message}`);
    return data;
}

export async function approveStockCount(countId: string, reason: string) {
    const sb = await getSB();
    const profileId = await import('./supabase').then(m => m.getProfileId());
    const existing = await getSB().then(s => s.from('stock_counts').select('*').eq('id', countId).single());

    const { data, error } = await sb.from('stock_counts').update({
        status: 'APPROVED',
        approved_by: profileId,
        approval_reason: reason,
        updated_at: new Date().toISOString(),
    }).eq('id', countId).select().single();
    if (error) throw new Error(`Failed to approve stock count: ${error.message}`);

    await createAuditLog('STOCK_COUNT_APPROVED', 'stock_counts', countId, null, data);
    return data;
}

export async function postStockCount(countId: string) {
    const sb = await getSB();
    const profileId = await import('./supabase').then(m => m.getProfileId());
    const existing = await sb.from('stock_counts').select('*').eq('id', countId).single();
    const { data, error } = await sb.from('stock_counts').update({
        status: 'POSTED',
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq('id', countId).select().single();
    if (error) throw new Error(`Failed to post stock count: ${error.message}`);

    await createAuditLog('STOCK_COUNT_POSTED', 'stock_counts', countId, existing.data, data);
    return data;
}

export async function getStockCounts(params: { branch_id?: string; page?: number; perPage?: number; status?: string }) {
    const sb = await getSB();
    const { branch_id, page = 1, perPage = 20, status } = params;
    let query = sb.from('stock_counts').select('*', { count: 'exact' });
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false });
    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);
    if (error) throw new Error(`Failed to fetch stock counts: ${error.message}`);
    return { data, count };
}

export async function getStockCountById(id: string) {
    const sb = await getSB();
    const { data, error } = await sb.from('stock_counts')
        .select(`*, stock_count_items(*)`)
        .eq('id', id)
        .single();
    if (error) throw new Error(`Failed to fetch stock count: ${error.message}`);
    return data;
}

