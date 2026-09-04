import { NextResponse } from 'next/server';
import { addPurchaseAttachment, getPurchaseAttachments } from '@/lib/services/purchases';
import { purchaseAttachmentSchema } from '@/lib/validations/purchases';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const po = searchParams.get('purchase_order_id');
    if (!po) return NextResponse.json({ error: 'purchase_order_id required' }, { status: 400 });
    const data = await getPurchaseAttachments(po);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Support multipart-ish: if file_url missing but we have file content, store as data url (demo)
    const parsed = purchaseAttachmentSchema.parse(body);
    const data = await addPurchaseAttachment(parsed as any);
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, issues: e.issues }, { status: 400 });
  }
}
