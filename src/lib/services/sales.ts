/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getOne, insertOne, updateOne, createAuditLog, getSB, getOrgId, getProfileId } from './supabase';

export async function getSalesList(params: {
    branch_id?: string; page?: number; perPage?: number; status?: string;
}) {
    const sb = await getSB();
    const { branch_id, page = 1, perPage = 20, status } = params;
    let query = sb.from('sales').select('*, customers(name), profiles!sales_cashier_id_fkey(full_name)', { count: 'exact' });
    if (branch_id && branch_id !== 'all') query = query.eq('branch_id', branch_id);
    if (status && status !== 'all') query = query.eq('status', status);
    query = query.order('sold_at', { ascending: false });
    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);
    if (error) throw new Error(`Failed to fetch sales: ${error.message}`);
    return { data, count };
}

export async function getSaleById(id: string) {
    const sb = await getSB();
    const { data, error } = await sb.from('sales')
        .select(`*, sale_items(*, products(name,sku,barcode), product_batches!sale_items_batch_id_fkey(batch_number, expiry_date)), payments(*), customers(name, phone, email), profiles!sales_cashier_id_fkey(full_name)`)
        .eq('id', id)
        .single();
    if (error) {
        // fallback without joins if FK name mismatched
        const { data: d2, error: e2 } = await sb.from('sales').select(`*, sale_items(*, products(name,sku,barcode)), payments(*)`).eq('id', id).single();
        if (e2) throw new Error(`Failed to fetch sale: ${error.message}`);
        // enrich fallback
        const [movs, audit, returns] = await Promise.all([
            sb.from('stock_movements').select('*').eq('reference_id', id).eq('reference_type','SALE').then((r:any)=> r.data ?? []).catch(()=>[]),
            sb.from('audit_logs').select('*').eq('entity_id', id).order('created_at',{ascending:false}).limit(50).then((r:any)=> r.data ?? []).catch(()=>[]),
            sb.from('returns').select('id, return_number, status, total, created_at').eq('sale_id', id).then((r:any)=> r.data ?? []).catch(()=>[]),
        ]);
        return { ...d2, stock_movements: movs, audit_logs: audit, returns };
    }
    // enrich with movements/audit/returns even when first query succeeded
    const [movs, audit, returns] = await Promise.all([
        sb.from('stock_movements').select('*').eq('reference_id', id).eq('reference_type','SALE').then((r:any)=> r.data ?? []).catch(()=>[]),
        sb.from('audit_logs').select('*').eq('entity_id', id).order('created_at',{ascending:false}).limit(50).then((r:any)=> r.data ?? []).catch(()=>[]),
        sb.from('returns').select('id, return_number, status, total, created_at').eq('sale_id', id).then((r:any)=> r.data ?? []).catch(()=>[]),
    ]);
    return { ...data, stock_movements: movs, audit_logs: audit, returns };
}

export async function getSalesKPIs(branch_id?: string){
    const sb:any = await getSB();
    const orgId = await getOrgId();
    let q = sb.from('sales').select('id, status, total, discount, tax, subtotal, sold_at, branch_id, customer_id').eq('organization_id', orgId);
    if(branch_id && branch_id!=='all') q=q.eq('branch_id', branch_id);
    const { data } = await q;
    const list = (data ?? []) as any[];
    const today = new Date().toISOString().slice(0,10);
    const todaySales = list.filter(r=> r.sold_at?.slice(0,10)===today && r.status==='COMPLETED');
    const totalToday = todaySales.reduce((a:any,r:any)=> a+Number(r.total),0);
    const grossToday = todaySales.reduce((a:any,r:any)=> a+Number(r.subtotal),0);
    const discountToday = todaySales.reduce((a:any,r:any)=> a+Number(r.discount),0);
    const taxToday = todaySales.reduce((a:any,r:any)=> a+Number(r.tax),0);
    const avgSale = todaySales.length ? totalToday / todaySales.length : 0;
    const completed = list.filter(r=> r.status==='COMPLETED');
    const held = list.filter(r=> r.status==='HELD').length;
    const voided = list.filter(r=> r.status==='VOIDED').length;
    const refunded = list.filter(r=> r.status==='REFUNDED' || r.status==='PARTIALLY_REFUNDED').length;
    // payment method breakdown via payments table
    let paid = 0;
    const credit = 0;
    try{
        const { data: pays } = await sb.from('payments').select('amount, payment_method, sale_id').in('sale_id', list.map((r:any)=>r.id).slice(0,200));
        paid = (pays ?? []).reduce((a:any,p:any)=> a+Number(p.amount),0);
    }catch{}
    // profit via COGS: sum unit_cost * qty from stock_movements? simplified
    return {
        today: { count: todaySales.length, total: totalToday, subtotal: grossToday, discount: discountToday, tax: taxToday, avg: avgSale },
        total: { count: list.length, completed: completed.length, held, voided, refunded },
        paid,
        gross: completed.reduce((a:any,r:any)=> a+Number(r.total),0),
    };
}

export async function getSalesHistory(params: {
    branch_id?: string; page?: number; perPage?: number; cashier_id?: string;
    payment_method?: string; customer_id?: string; status?: string;
    date_from?: string; date_to?: string; search?: string;
    product_id?: string; batch_id?: string; category_id?: string;
    amount_min?: number; amount_max?: number;
}) {
    const sb = await getSB();
    const { branch_id, page = 1, perPage = 20, search, product_id, batch_id, category_id, amount_min, amount_max, ...filters } = params as any;
    let query = sb.from('sales').select('*, customers(name, phone), profiles!sales_cashier_id_fkey(full_name), sale_items(product_id, batch_id, products(name,sku,barcode))', { count: 'exact' });
    // exact filters
    Object.entries(filters).forEach(([key, value]) => {
        if (value && value!=='all') query = query.eq(key as any, value);
    });
    if (branch_id && branch_id!=='all') query = query.eq('branch_id', branch_id);
    if (search && search.trim()){
        // try server ilike on sale_number ; broader search fallback client-side
        const s = search.trim();
        query = query.or(`sale_number.ilike.%${s}%`);
    }
    if (params.date_from) query = query.gte('sold_at', params.date_from);
    if (params.date_to) query = query.lte('sold_at', params.date_to + 'T23:59:59');
    if (amount_min) query = query.gte('total', amount_min);
    if (amount_max) query = query.lte('total', amount_max);
    query = query.order('sold_at', { ascending: false });
    const from = (page - 1) * perPage;
    // fetch slightly larger window if we have product/batch search to filter
    const fetchSize = (product_id || batch_id || category_id || search) ? perPage * 5 : perPage;
    const rangeFrom = search || product_id || batch_id || category_id ? 0 : from;
    const rangeTo = search || product_id || batch_id || category_id ? fetchSize -1 : from + perPage -1;
    const { data, error, count } = await query.range(rangeFrom, rangeTo);
    if (error) throw new Error(`Failed to fetch sales history: ${error.message}`);
    let list = (data ?? []) as any[];

    // product/batch/category filtering via sale_items
    if(product_id || batch_id || category_id){
        list = list.filter((s:any)=> (s.sale_items ?? []).some((it:any)=>{
            if(product_id && it.product_id!==product_id) return false;
            if(batch_id && it.batch_id!==batch_id) return false;
            if(category_id && it.products?.category_id!==category_id) return false;
            return true;
        }));
    }
    // comprehensive search fallback: check across customer, cashier, product, sku, barcode, batch, payment ref
    if(search && search.trim()){
        const s = search.trim().toLowerCase();
        // fetch payment refs for these sales
        const payMap:Record<string,string> = {};
        try{
            const { data: pays } = await sb.from('payments').select('sale_id, reference, payment_method').in('sale_id', list.map((x:any)=>x.id));
            for(const p of (pays??[]) as any[]) payMap[p.sale_id] = (payMap[p.sale_id] ? payMap[p.sale_id]+' ' : '') + `${p.reference ?? ''} ${p.payment_method ?? ''}`;
        }catch{}
        list = list.filter((srow:any)=>
            srow.sale_number?.toLowerCase().includes(s) ||
            srow.customers?.name?.toLowerCase().includes(s) ||
            srow.customers?.phone?.toLowerCase().includes(s) ||
            srow.profiles?.full_name?.toLowerCase().includes(s) ||
            srow.cashier_id?.toLowerCase().includes(s) ||
            (payMap[srow.id] ?? '').toLowerCase().includes(s) ||
            (srow.sale_items ?? []).some((it:any)=> it.products?.name?.toLowerCase().includes(s) || it.products?.sku?.toLowerCase().includes(s) || it.products?.barcode?.toLowerCase().includes(s) || it.batch_id?.toLowerCase().includes(s) )
        );
        // re-paginate after filter
        const paged = list.slice(from, from+perPage);
        // payment_method post-filter if needed (more accurate than earlier simple)
        if (params.payment_method && params.payment_method!=='all') {
          const { data: pays } = await sb.from('payments').select('sale_id').eq('payment_method', params.payment_method);
          const ids = new Set((pays ?? []).map((p:any)=>p.sale_id));
          const filtered = paged.filter((s:any)=> ids.has(s.id));
          return { data: filtered, count: filtered.length + (list.length>filtered.length? list.length:0) };
        }
        return { data: paged, count: list.length };
    }

    // payment_method filter (if not already handled via search)
    if (params.payment_method && params.payment_method!=='all' && data) {
      const { data: pays } = await sb.from('payments').select('sale_id').eq('payment_method', params.payment_method);
      const ids = new Set((pays ?? []).map((p:any)=>p.sale_id));
      const filtered = list.filter((s:any)=> ids.has(s.id));
      // paginate filtered
      const paged = filtered.slice(from, from+perPage);
      return { data: paged, count: filtered.length };
    }
    // if we fetched larger window for filtering, slice to page
    if(product_id || batch_id || category_id){
        const paged = list.slice(from, from+perPage);
        return { data: paged, count: list.length };
    }
    return { data, count };
}

export async function voidSale(id: string, reason: string) {
    const sb = await getSB();
    const existing = await getOne('sales', id);
    if(!existing) throw new Error('Sale not found');
    if(existing.status==='VOIDED') throw new Error('Already voided');
    const profileId = await getProfileId();

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
            notes: `Void reversal for sale ${existing.sale_number} — ${reason}`,
            created_by: profileId,
        });
        await increaseBatchQty(item.batch_id, item.quantity);
    }

    await createAuditLog('SALE_VOIDED', 'sales', id, existing as any, { ...data, reason });
    // create void audit for returns visibility
    return data;
}

async function increaseBatchQty(batchId: string, quantity: number) {
    const sb = await getSB();
    const existing = await getOne('product_batches', batchId);
    if(!existing) return;
    await sb.from('product_batches')
        .update({ quantity_available: Number((existing as any).quantity_available) + quantity, updated_at: new Date().toISOString() }).eq('id', batchId);
}
