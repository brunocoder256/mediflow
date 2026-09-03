/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getOne, insertOne, updateOne, createAuditLog, getProfileId } from './supabase';
import { productSchema, productUpdateSchema } from '@/lib/validations/products';
import type { ProductInput, ProductUpdateInput } from '@/lib/validations/products';

export async function getProducts() {
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products').select('*').eq('is_active', true).order('name');
    if (error) throw new Error(`Failed to fetch products: ${error.message}`);
    return data;
}

export async function getProductById(id: string) {
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products').select('*').eq('id', id).single();
    if (error) throw new Error(`Failed to fetch product: ${error.message}`);
    return data;
}

export async function createProduct(input: ProductInput) {
    const parsed = productSchema.parse(input);
    const sb = await import('./supabase').then(m => m.getSB());
    const profileId = await getProfileId();
    const { data, error } = await sb.from('products').insert({ ...parsed, created_by: profileId }).select().single();
    if (error) throw new Error(`Failed to create product: ${error.message}`);
    await createAuditLog('PRODUCT_CREATED', 'products', data.id, null, data);
    return data;
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
    const parsed = productUpdateSchema.parse(input);
    const existing = await getOne('products', id);
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products').update({ ...parsed, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update product: ${error.message}`);
    await createAuditLog('PRODUCT_UPDATED', 'products', id, existing, data);
    return data;
}

export async function deactivateProduct(id: string) {
    const existing = await getOne('products', id);
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`Failed to deactivate product: ${error.message}`);
    await createAuditLog('PRODUCT_DEACTIVATED', 'products', id, existing, data);
    return data;
}

export async function searchProducts(query: string) {
    const sb = await import('./supabase').then(m => m.getSB());
    const { data, error } = await sb.from('products')
        .select('*')
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
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
        .eq('products.is_active', true)
        .order('products.name');
    if (error) throw new Error(`Failed to fetch products with stock: ${error.message}`);
    return data;
}

