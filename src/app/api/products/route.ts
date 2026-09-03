import { NextResponse } from 'next/server';
import { getProducts, searchProducts, createProduct } from '@/lib/services/products';

export async function GET() {
    try {
        const products = await getProducts();
        return NextResponse.json(products);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { search } = body;
        if (search) {
            const results = await searchProducts(search);
            return NextResponse.json(results);
        }
        // Create product – handle Add Product dialog
        if (body.name) {
            const product = await createProduct({
                name: body.name,
                sku: body.sku ?? '',
                barcode: body.barcode ?? '',
                category_id: body.category_id ?? '',
                unit_id: body.unit_id ?? '',
                description: body.description ?? '',
                generic_name: body.generic_name ?? '',
                brand_name: body.brand_name ?? '',
                reorder_level: body.reorder_level != null ? Number(body.reorder_level) : 10,
            });
            return NextResponse.json(product, { status: 201 });
        }
        return NextResponse.json({ error: 'Invalid request: provide name or search' }, { status: 400 });
    } catch (error: any) {
        const msg = error?.issues ? JSON.stringify(error.issues) : error.message;
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}