import { NextResponse } from 'next/server';
import { getSalesList, getSaleById, submitBill, completeBillPayment, cancelBill, confirmHandover } from '@/lib/services/sales';
import { createSaleTransaction } from '@/lib/services/pos';
import { sanitizeError } from '@/lib/security';
import { z } from 'zod/v4';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branch_id = searchParams.get('branch_id') ?? undefined;
        const status = searchParams.get('status') ?? undefined;
        const handover_status = searchParams.get('handover_status') ?? undefined;
        const customer_id = searchParams.get('customer_id') ?? undefined;
        const cashier_id = searchParams.get('cashier_id') ?? undefined;
        const payment_method = searchParams.get('payment_method') ?? undefined;
        const date_from = searchParams.get('date_from') ?? searchParams.get('dateFrom') ?? undefined;
        const date_to = searchParams.get('date_to') ?? searchParams.get('dateTo') ?? undefined;
        const search = searchParams.get('search') ?? searchParams.get('q') ?? undefined;
        const page = parseInt(searchParams.get('page') ?? '1');
        const perPage = parseInt(searchParams.get('perPage') ?? '20');
        const id = searchParams.get('id');
        const kpi = searchParams.get('kpi');
        const product_id = searchParams.get('product_id') ?? undefined;
        const batch_id = searchParams.get('batch_id') ?? undefined;
        const category_id = searchParams.get('category_id') ?? undefined;
        const amount_min = searchParams.get('amount_min') ? Number(searchParams.get('amount_min')) : undefined;
        const amount_max = searchParams.get('amount_max') ? Number(searchParams.get('amount_max')) : undefined;

        if (kpi === '1'){
            const { getSalesKPIs } = await import('@/lib/services/sales');
            const data = await getSalesKPIs(branch_id);
            return NextResponse.json(data);
        }

        if (id) {
            const data = await getSaleById(id);
            return NextResponse.json(data);
        }

        // Use advanced history query if any advanced filter present
        if (customer_id || cashier_id || payment_method || date_from || date_to || search || product_id || batch_id || category_id || amount_min || amount_max || status || branch_id || handover_status) {
            const { getSalesHistory } = await import('@/lib/services/sales');
            const data = await getSalesHistory({ branch_id, page, perPage, customer_id, cashier_id, payment_method, status, handover_status, date_from, date_to, search, product_id, batch_id, category_id, amount_min, amount_max } as any);
            return NextResponse.json(data);
        }

        const data = await getSalesList({ branch_id, status, page, perPage });
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[sales] GET error:', error?.message);
        return NextResponse.json({ error: sanitizeError(error?.message ?? '') }, { status: 500 });
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
  held: z.boolean().optional(),
  sold_at: z.string().datetime({ offset: true }).optional()
});

const SubmitBillSchema = z.object({
  action: z.literal('submit_bill'),
  branch_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1),
    discount: z.number().min(0).optional(),
    discount_type: z.enum(['fixed','percent']).optional()
  })).min(1),
  operation_id: z.string().optional(),
  sold_at: z.string().datetime({ offset: true }).optional()
});

const CompleteBillSchema = z.object({
  action: z.literal('complete_bill'),
  sale_id: z.string().uuid(),
  payments: z.array(z.object({
    method: z.enum(['CASH','MOBILE_MONEY','CARD','BANK','OTHER']),
    amount: z.number().min(0),
    reference: z.string().optional().nullable(),
    provider: z.string().optional().nullable()
  })).min(1),
  payment_operation_id: z.string().optional()
});

const CancelBillSchema = z.object({
  action: z.literal('cancel_bill'),
  sale_id: z.string().uuid(),
  reason: z.string().optional()
});

const ConfirmHandoverSchema = z.object({
  action: z.literal('confirm_handover'),
  sale_id: z.string().uuid()
});

export async function POST(request: Request){
  try{
    const body = await request.json();
    if(body.action === 'void'){
      const { voidSale } = await import('@/lib/services/sales');
      const data = await voidSale(body.sale_id, body.reason ?? 'Void requested');
      return NextResponse.json(data);
    }
    // Workflow B — separate salesperson / cashier checkout. All authorization,
    // plan/workflow gating and stock integrity are enforced inside the RPCs.
    if(body.action === 'submit_bill'){
      const parsed = SubmitBillSchema.parse(body);
      const result = await submitBill({
        branch_id: parsed.branch_id,
        customer_id: parsed.customer_id || undefined,
        items: parsed.items as any,
        operation_id: parsed.operation_id,
        sold_at: parsed.sold_at
      });
      if((result as any).duplicate) return NextResponse.json({ ...result, message: 'Duplicate operation - returned existing bill' }, { status: 200 });
      return NextResponse.json(result, { status: 201 });
    }
    if(body.action === 'complete_bill'){
      const parsed = CompleteBillSchema.parse(body);
      const result = await completeBillPayment({
        sale_id: parsed.sale_id,
        payments: parsed.payments.map(p=>({ method:p.method, amount:p.amount, reference: p.reference ?? undefined, provider: p.provider ?? undefined })) as any,
        payment_operation_id: parsed.payment_operation_id
      });
      if((result as any).duplicate) return NextResponse.json({ ...result, message: 'Payment already processed' }, { status: 200 });
      return NextResponse.json(result, { status: 201 });
    }
    if(body.action === 'cancel_bill'){
      const parsed = CancelBillSchema.parse(body);
      const result = await cancelBill(parsed.sale_id, parsed.reason ?? 'Cancelled');
      return NextResponse.json(result);
    }
    if(body.action === 'confirm_handover'){
      const parsed = ConfirmHandoverSchema.parse(body);
      const result = await confirmHandover(parsed.sale_id);
      return NextResponse.json(result);
    }
    const parsed = SaleCreateSchema.parse(body);
    const result = await createSaleTransaction({
      branch_id: parsed.branch_id,
      customer_id: parsed.customer_id || undefined,
      items: parsed.items as any,
      payments: parsed.payments.map(p=>({ method:p.method, amount:p.amount, reference: p.reference ?? undefined, provider: p.provider ?? undefined })) as any,
      operation_id: parsed.operation_id,
      held: parsed.held,
      sold_at: parsed.sold_at
    });
    if((result as any).duplicate) return NextResponse.json({ ...result, message: 'Duplicate operation - returned existing' }, { status: 200 });
    return NextResponse.json(result, { status: 201 });
  }catch(e:any){
    console.error('[sales] POST error:', e?.message);
    const status = e.name === 'ZodError' ? 400 : 400;
    const issues = e.name === 'ZodError' ? e.issues ?? undefined : undefined;
    return NextResponse.json({ error: sanitizeError(e?.message ?? 'Invalid sale'), ...(issues ? { issues } : {}) }, { status });
  }
}