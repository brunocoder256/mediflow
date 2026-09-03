import { NextResponse } from 'next/server';
import { getSalesList, getSaleById } from '@/lib/services/sales';
import { createSaleTransaction } from '@/lib/services/pos';
import { z } from 'zod/v4';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branch_id = searchParams.get('branch_id') ?? undefined;
        const status = searchParams.get('status') ?? undefined;
        const customer_id = searchParams.get('customer_id') ?? undefined;
        const cashier_id = searchParams.get('cashier_id') ?? undefined;
        const payment_method = searchParams.get('payment_method') ?? undefined;
        const date_from = searchParams.get('date_from') ?? searchParams.get('dateFrom') ?? undefined;
        const date_to = searchParams.get('date_to') ?? searchParams.get('dateTo') ?? undefined;
        const search = searchParams.get('search') ?? undefined;
        const page = parseInt(searchParams.get('page') ?? '1');
        const perPage = parseInt(searchParams.get('perPage') ?? '20');
        const id = searchParams.get('id');

        if (id) {
            const data = await getSaleById(id);
            return NextResponse.json(data);
        }

        // Use advanced history query if any advanced filter present
        if (customer_id || cashier_id || payment_method || date_from || date_to || search) {
            const { getSalesHistory } = await import('@/lib/services/sales');
            const data = await getSalesHistory({ branch_id, page, perPage, customer_id, cashier_id, payment_method, status, date_from, date_to, search } as any);
            return NextResponse.json(data);
        }

        const data = await getSalesList({ branch_id, status, page, perPage });
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

const SaleCreateSchema = z.object({
  branch_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().nullable().or(z.literal('')),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1),
    discount: z.number().min(0).optional(),
    discount_type: z.enum(['fixed','percent']).optional()
  })).min(1),
  payments: z.array(z.object({
    method: z.enum(['CASH','MOBILE_MONEY','CARD','BANK','OTHER']),
    amount: z.number().min(0),
    reference: z.string().optional().nullable(),
    provider: z.string().optional().nullable()
  })).min(1),
  operation_id: z.string().uuid().optional(),
  held: z.boolean().optional()
});

export async function POST(request: Request){
  try{
    const body = await request.json();
    if(body.action === 'void'){
      const { voidSale } = await import('@/lib/services/sales');
      const data = await voidSale(body.sale_id, body.reason ?? 'Void requested');
      return NextResponse.json(data);
    }
    const parsed = SaleCreateSchema.parse(body);
    const result = await createSaleTransaction({
      branch_id: parsed.branch_id,
      customer_id: parsed.customer_id || undefined,
      items: parsed.items as any,
      payments: parsed.payments.map(p=>({ method:p.method, amount:p.amount, reference: p.reference ?? undefined, provider: p.provider ?? undefined })) as any,
      operation_id: parsed.operation_id,
      held: parsed.held
    });
    if((result as any).duplicate) return NextResponse.json({ ...result, message: 'Duplicate operation - returned existing' }, { status: 200 });
    return NextResponse.json(result, { status: 201 });
  }catch(e:any){
    const status = e.name === 'ZodError' ? 400 : 400;
    return NextResponse.json({ error: e.message ?? 'Invalid sale', issues: e.issues ?? undefined }, { status });
  }
}