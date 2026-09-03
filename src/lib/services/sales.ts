/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getOne, insertOne, updateOne, createAuditLog, getSB } from './supabase';

export async function getSalesList(params: {
    branch_id?: string; page?: number; perPage?: number; status?: string;
}) {
    const sb = await getSB();
    const { branch_id, page = 1, perPage = 20, status } = params;
    let query = sb.from('sales').select('*', { count: 'exact' });
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);
    query = query.order('sold_at', { ascending: false });
    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);
    if (error) throw new Error(`Failed to fetch sales: ${error.message}`);
    return { data, count };
}

export async function getSaleById(id: string) {
    const sb = await getSB();
    const { data, error } = await sb.from('sales')
        .select(`*, sale_items(*, products(*)), payments(*)`)
        .eq('id', id)
        .single();
    if (error) throw new Error(`Failed to fetch sale: ${error.message}`);
    return data;
}

export async function getSalesHistory(params: {
    branch_id?: string; page?: number; perPage?: number; cashier_id?: string;
    payment_method?: string; customer_id?: string; status?: string;
    date_from?: string; date_to?: string; search?: string;
}) {
    const sb = await getSB();
    const { branch_id, page = 1, perPage = 20, search, ...filters } = params as any;
    let query = sb.from('sales').select('*', { count: 'exact' });
    Object.entries(filters).forEach(([key, value]) => {
        if (value) query = query.eq(key as any, value);
    });
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (search) query = query.ilike('sale_number', `%${search}%`);
    if (params.date_from) query = query.gte('sold_at', params.date_from);
    if (params.date_to) query = query.lte('sold_at', params.date_to);
    query = query.order('sold_at', { ascending: false });
    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);
    if (error) throw new Error(`Failed to fetch sales history: ${error.message}`);
    // payment_method filter via join would need extra query; for now filter by payments if requested
    if (params.payment_method && data) {
      const { data: pays } = await sb.from('payments').select('sale_id').eq('payment_method', params.payment_method);
      const ids = new Set((pays ?? []).map((p:any)=>p.sale_id));
      const filtered = (data as any[]).filter((s:any)=> ids.has(s.id));
      return { data: filtered, count: filtered.length };
    }
    return { data, count };
}

export async function voidSale(id: string, reason: string) {
    const sb = await getSB();
    const existing = await getOne('sales', id);
    const profileId = await import('./supabase').then(m => m.getProfileId());

    const { data, error } = await sb.from('sales')
        .update({ status: 'VOIDED', updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`Failed to void sale: ${error.message}`);

    const saleItems = await sb.from('sale_items').select('*').eq('sale_id', id);
    const branchId = existing.branch_id;
    const orgId = existing.organization_id;

    for (const item of (saleItems.data ?? [])) {
        await sb.from('stock_movements').insert({
            organization_id: orgId,
            branch_id: branchId,
            product_id: item.product_id,
            batch_id: item.batch_id,
            movement_type: 'SALE_RETURN',
            quantity: item.quantity,
            reference_type: 'SALE',
            reference_id: id,
            unit_cost: item.unit_price,
            notes: `Void reversal for sale ${existing.sale_number}`,
            created_by: profileId,
        });
        await increaseBatchQty(item.batch_id, item.quantity);
    }

    await createAuditLog('SALE_VOIDED', 'sales', id, existing, { ...data, reason });
    return data;
}

async function increaseBatchQty(batchId: string, quantity: number) {
    const sb = await getSB();
    const existing = await getOne('product_batches', batchId);
    await sb.from('product_batches')
        .update({ quantity_available: existing.quantity_available + quantity, updated_at: new Date().toISOString() }).eq('id', batchId);
}

