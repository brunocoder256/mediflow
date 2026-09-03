import { NextResponse } from 'next/server';
import { getProducts, searchProducts } from '@/lib/services/products';

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
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}