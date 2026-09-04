import { NextResponse } from 'next/server';
import { getProducts, searchProducts, createProduct, updateProduct, deactivateProduct } from '@/lib/services/products';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (id) {
            const { getProductDetail } = await import('@/lib/services/products');
            const detail = await getProductDetail(id);
            return NextResponse.json(detail);
        }
        const search = searchParams.get('search') ?? undefined;
        const category_id = searchParams.get('category_id') ?? undefined;
        const product_type = searchParams.get('product_type') ?? undefined;
        const status = searchParams.get('status') ?? undefined;
        const supplier_id = searchParams.get('supplier_id') ?? undefined;
        const lowStock = searchParams.get('lowStock') === 'true' ? true : undefined;
        const expiring = searchParams.get('expiring') === 'true' ? true : undefined;
        const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
        const perPage = searchParams.get('perPage') ? Number(searchParams.get('perPage')) : undefined;

        // Search param via GET (fuzzy)
        if (search && !category_id && !product_type && !status) {
            // Use paginated getProducts which already supports search; but keep fast path
            const result = await getProducts({ search, category_id, product_type, status, supplier_id, page, perPage });
            return NextResponse.json(result);
        }

        const result = await getProducts({ category_id, product_type, status, supplier_id, search, page, perPage, lowStock, expiring });
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Bulk import
        if (body.action === 'bulk_import') {
            const { bulkImportProducts } = await import('@/lib/services/products');
            const res = await bulkImportProducts(body.rows ?? []);
            return NextResponse.json(res);
        }
        // Product-supplier link
        if (body.action === 'link_supplier') {
            const { linkSupplier } = await import('@/lib/services/products');
            const data = await linkSupplier(body);
            return NextResponse.json(data, { status: 201 });
        }
        if (body.action === 'unlink_supplier') {
            const { unlinkSupplier } = await import('@/lib/services/products');
            await unlinkSupplier(body.id);
            return NextResponse.json({ success: true });
        }
        // Search via POST legacy
        const { search } = body;
        if (search) {
            const results = await searchProducts(search);
            return NextResponse.json(results);
        }
        // Create product – full master payload
        if (body.name) {
            const product = await createProduct(body);
            return NextResponse.json(product, { status: 201 });
        }
        return NextResponse.json({ error: 'Invalid request: provide name or search' }, { status: 400 });
    } catch (error: any) {
        const msg = error?.issues ? JSON.stringify(error.issues) : error.message;
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, action, ...patch } = body;
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
        if (action === 'deactivate') {
            const data = await deactivateProduct(id);
            return NextResponse.json(data);
        }
        if (action === 'reactivate') {
            const { reactivateProduct } = await import('@/lib/services/products');
            const data = await reactivateProduct(id);
            return NextResponse.json(data);
        }
        const data = await updateProduct(id, patch);
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
