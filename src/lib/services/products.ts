/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getOne, insertOne, updateOne, createAuditLog, getProfileId, getOrgId } from './supabase';
import { productSchema, productUpdateSchema, productSupplierSchema } from '@/lib/validations/products';
import type { ProductInput, ProductUpdateInput, ProductSupplierInput } from '@/lib/validations/products';

export async function getProducts(params?: { category_id?: string; product_type?: string; status?: string; supplier_id?: string; search?: string; page?: number; perPage?: number; expiring?: boolean; lowStock?: boolean }) {
    const sb = await import('./supabase').then(m => m.getSB());
    let query = sb.from('products').select('*, categories(name), units(name, abbreviation)', { count: 'exact' }).order('name');
    if (params?.category_id) query = query.eq('category_id', params.category_id);
    if (params?.product_type) query = query.eq('product_type', params.product_type);
    if (params?.status === 'active') query = query.eq('is_active', true);
    if (params?.status === 'inactive') query = query.eq('is_active', false);
    if (params?.search) {
        const q = params.search;
        query = query.or(`name.ilike.%${q}%,generic_name.ilike.%${q}%,brand_name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%,manufacturer.ilike.%${q}%`);
    }
    if (params?.page && params?.perPage) {
        const from = (params.page - 1) * params.perPage;
        query = query.range(from, from + params.perPage - 1);
    }
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch products: ${error.message}`);
    // Post-filter supplier if needed (requires join)
    let filtered = data as any[];
    if (params?.supplier_id) {
        const { data: links } = await sb.from('product_suppliers').select('product_id').eq('supplier_id', params.supplier_id);
        const ids = new Set((links ?? []).map((l: any) => l.product_id));
        filtered = filtered.filter((p: any) => ids.has(p.id));
    }
    return { data: filtered, count };
}

export async function getProductById(id: string) {
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products').select('*, categories(name), units(name, abbreviation)').eq('id', id).single();
    if (error) throw new Error(`Failed to fetch product: ${error.message}`);
    return data;
}

export async function getProductDetail(id: string) {
    const sb = await import('./supabase').then(m => m.getSB());
    const [product, batches, suppliers, movements, priceHistory, audit] = await Promise.all([
        sb.from('products').select('*, categories(name), units(name, abbreviation)').eq('id', id).single().then(r => { if (r.error) throw new Error(r.error.message); return r.data; }),
        sb.from('product_batches').select('*, branches(name), suppliers(name)').eq('product_id', id).order('expiry_date').then(r => (r.error ? [] : r.data ?? [])),
        sb.from('product_suppliers').select('*, suppliers(id, name)').eq('product_id', id).then(r => (r.error ? [] : r.data ?? [])),
        sb.from('stock_movements').select('*, branches(name), product_batches(batch_number)').eq('product_id', id).order('created_at', { ascending: false }).limit(50).then(r => (r.error ? [] : r.data ?? [])),
        sb.from('price_history').select('*').eq('product_id', id).order('created_at', { ascending: false }).limit(20).then(r => (r.error ? [] : r.data ?? [])),
        sb.from('audit_logs').select('*').eq('entity_type', 'products').eq('entity_id', id).order('created_at', { ascending: false }).limit(20).then(r => (r.error ? [] : r.data ?? [])),
    ]);
    // Compute stock by branch
    const stockByBranch: Record<string, number> = {};
    let totalStock = 0;
    let lowStock = false;
    let expiringQty = 0;
    const now = new Date();
    const warnDays = 30;
    for (const b of (batches as any[]) ?? []) {
        totalStock += Number(b.quantity_available);
        const br = b.branch_id ?? 'unknown';
        stockByBranch[br] = (stockByBranch[br] ?? 0) + Number(b.quantity_available);
        if (b.expiry_date) {
            const days = Math.ceil((new Date(b.expiry_date).getTime() - now.getTime()) / 86400000);
            if (days >= 0 && days <= warnDays) expiringQty += Number(b.quantity_available);
        }
    }
    const p = product as any;
    if (p.reorder_level != null && totalStock <= Number(p.reorder_level)) lowStock = true;

    return { product, batches, suppliers, movements, priceHistory, audit, stockByBranch, totalStock, lowStock, expiringQty };
}

export async function createProduct(input: ProductInput) {
    const parsed = productSchema.parse(input);
    const sb = await import('./supabase').then(m => m.getSB());
    const profileId = await getProfileId();
    const orgId = await getOrgId();
    // Clean empty UUID strings -> null
    const clean: any = { ...parsed, organization_id: orgId };
    if (!clean.category_id) clean.category_id = null;
    if (!clean.unit_id) clean.unit_id = null;
    if (!clean.preferred_supplier_id) clean.preferred_supplier_id = null;
    // Uniqueness checks (server will also enforce via index where possible)
    if (clean.sku) {
        const { data: dup } = await sb.from('products').select('id').eq('organization_id', orgId).eq('sku', clean.sku).maybeSingle();
        if (dup) throw new Error(`SKU already exists: ${clean.sku}`);
    }
    if (clean.barcode) {
        const { data: dup } = await sb.from('products').select('id').eq('organization_id', orgId).eq('barcode', clean.barcode).maybeSingle();
        if (dup) throw new Error(`Barcode already exists: ${clean.barcode}`);
    }
    const { data, error } = await sb.from('products').insert(clean).select().single();
    if (error) throw new Error(`Failed to create product: ${error.message}`);
    await createAuditLog('PRODUCT_CREATED', 'products', data.id, null, data);
    // Price history if pricing provided (field_name CHECK allows 'purchase_price'/'selling_price' only)
    if (parsed.default_selling_price != null) {
        await sb.from('price_history').insert({ organization_id: orgId, product_id: data.id, field_name: 'selling_price', old_value: null, new_value: String(parsed.default_selling_price), changed_by: profileId, reason: 'Product created' });
    }
    if (parsed.default_purchase_cost != null) {
        await sb.from('price_history').insert({ organization_id: orgId, product_id: data.id, field_name: 'purchase_price', old_value: null, new_value: String(parsed.default_purchase_cost), changed_by: profileId, reason: 'Product created' });
    }
    // Opening stock (optional initial_stock) — creates a sellable FEFO batch + stock movement
    // so the product is immediately available in POS instead of locked at 0 until a purchase is received.
    const opening = (input as any).initial_stock;
    if (opening && Number(opening.quantity) > 0) {
        const qty = Math.floor(Number(opening.quantity));
        const { data: branchesRes } = await sb.from('branches').select('id').eq('organization_id', orgId).eq('is_active', true).order('created_at', { ascending: true }).limit(1);
        const branchId = opening.branch_id || branchesRes?.[0]?.id;
        if (!branchId) throw new Error(`Created product but no active branch for opening stock`);
        const today = new Date();
        const openYmd = today.toISOString().slice(0, 10).replace(/-/g, '');
        const batchNumber = (opening.batch_number || '').trim() || `OPEN-${openYmd}-${String(Math.floor(1000 + Math.random() * 9000))}`;
        const expiryDate = opening.expiry_date ? new Date(opening.expiry_date) : new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
        const purchasePrice = Number(opening.purchase_price ?? parsed.default_purchase_cost ?? 0);
        const sellingPrice = Number(opening.selling_price ?? parsed.default_selling_price ?? 0);
        const { data: batch, error: bErr } = await sb.from('product_batches').insert({
            organization_id: orgId, branch_id: branchId, product_id: data.id, batch_number: batchNumber,
            expiry_date: expiryDate.toISOString().slice(0, 10), purchase_price: purchasePrice, selling_price: sellingPrice,
            quantity_received: qty, quantity_available: qty, received_at: today.toISOString().slice(0, 10),
        }).select().single();
        if (bErr) throw new Error(`Created product — opening stock failed: ${bErr.message}`);
        const { error: mErr } = await sb.from('stock_movements').insert({
            organization_id: orgId, branch_id: branchId, product_id: data.id, batch_id: batch.id,
            movement_type: 'OPENING_BALANCE', quantity: qty, reference_type: 'PRODUCT', reference_id: data.id,
            unit_cost: purchasePrice, notes: 'Opening balance — product created', created_by: profileId,
        });
        if (mErr) { await sb.from('product_batches').delete().eq('id', batch.id); throw new Error(`Opening stock movement failed: ${mErr.message}`); }
        await createAuditLog('BATCH_CREATED', 'product_batches', batch.id, null, batch);
        await createAuditLog('STOCK_OPENING', 'products', data.id, null, { quantity: qty, batch_number: batchNumber, expiry_date: expiryDate.toISOString().slice(0, 10), branch_id: branchId });
    }
    return data;
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
    const parsed = productUpdateSchema.parse(input);
    const existing = await getOne('products', id);
    const sb = await import('./supabase').then(m => m.getSB());
    const clean: any = { ...parsed, updated_at: new Date().toISOString() };
    if (clean.category_id === '') clean.category_id = null;
    if (clean.unit_id === '') clean.unit_id = null;
    if (clean.preferred_supplier_id === '') clean.preferred_supplier_id = null;
    // Track price changes (min_selling_price is a policy floor — not recorded in price_history)
    const priceFields = ['default_selling_price', 'default_purchase_cost'] as const;
    const orgId = await getOrgId();
    const profileId = await getProfileId();
    const { data, error } = await sb.from('products').update(clean).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update product: ${error.message}`);
    await createAuditLog('PRODUCT_UPDATED', 'products', id, existing as any, data);
    for (const f of priceFields) {
        if (clean[f] !== undefined && clean[f] !== (existing as any)?.[f]) {
            await sb.from('price_history').insert({ organization_id: orgId, product_id: id, field_name: f === 'default_selling_price' ? 'selling_price' : 'purchase_price', old_value: (existing as any)?.[f] != null ? String((existing as any)[f]) : null, new_value: clean[f] != null ? String(clean[f]) : null, changed_by: profileId, reason: 'Product updated' });
        }
    }
    return data;
}

export async function deactivateProduct(id: string) {
    const existing = await getOne('products', id);
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`Failed to deactivate product: ${error.message}`);
    await createAuditLog('PRODUCT_DEACTIVATED', 'products', id, existing as any, data);
    return data;
}

export async function reactivateProduct(id: string) {
    const existing = await getOne('products', id);
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`Failed to reactivate: ${error.message}`);
    await createAuditLog('PRODUCT_REACTIVATED', 'products', id, existing as any, data);
    return data;
}

export async function searchProducts(query: string) {
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products')
        .select('*')
        .or(`name.ilike.%${query}%,generic_name.ilike.%${query}%,brand_name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%,manufacturer.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(20);
    if (error) throw new Error(`Failed to search products: ${error.message}`);
    return data;
}

export async function getProductsWithStock() {
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products')
        .select(`
            *,
            product_batches(
                id, batch_number, expiry_date, quantity_available, purchase_price, selling_price
            )
        `)
        .eq('is_active', true)
        .order('name');
    if (error) throw new Error(`Failed to fetch products with stock: ${error.message}`);
    return data;
}

// Product-Supplier
export async function getProductSuppliers(productId: string) {
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('product_suppliers').select('*, suppliers(id, name, phone)').eq('product_id', productId);
    if (error) throw new Error(error.message);
    return data;
}
export async function linkSupplier(input: ProductSupplierInput) {
    const parsed = productSupplierSchema.parse(input);
    const sb = await import('./supabase').then(m => m.getSB());
    const orgId = await getOrgId();
    const { data, error } = await sb.from('product_suppliers').insert({ ...parsed, organization_id: orgId }).select().single();
    if (error) throw new Error(`Failed to link supplier: ${error.message}`);
    await createAuditLog('PRODUCT_SUPPLIER_LINKED', 'product_suppliers', data.id, null, data);
    return data;
}
export async function unlinkSupplier(id: string) {
    const sb = await import('./supabase').then(m => m.getSB());
    const { error } = await sb.from('product_suppliers').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
}

// Bulk import preview + commit
export async function bulkImportProducts(rows: any[]) {
    const results: { success: number; failed: number; errors: any[] } = { success: 0, failed: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
            await createProduct({
                name: r.name,
                sku: r.sku || '',
                barcode: r.barcode || '',
                category_id: r.category_id || '',
                unit_id: r.unit_id || '',
                description: r.description || '',
                generic_name: r.generic_name || '',
                brand_name: r.brand_name || '',
                reorder_level: Number(r.reorder_level) || 0,
                manufacturer: r.manufacturer || '',
                dosage_form: r.dosage_form || undefined,
                strength: r.strength || '',
                product_type: r.product_type || 'Human Medicine',
            } as any);
            results.success++;
        } catch (e: any) {
            results.failed++;
            results.errors.push({ row: i + 1, error: e.message, data: r });
        }
    }
    return results;
}
