import { NextResponse } from 'next/server';
import { getReturns, createReturn } from '@/lib/services/returns';
import { z } from 'zod/v4';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branch_id = searchParams.get('branch_id') ?? undefined;
        const page = parseInt(searchParams.get('page') ?? '1');
        const perPage = parseInt(searchParams.get('perPage') ?? '20');
        const data = await getReturns({ branch_id, page, perPage });
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
const ReturnSchema = z.object({
  sale_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  items: z.array(z.object({ sale_item_id: z.string().uuid(), product_id: z.string().uuid(), batch_id: z.string().uuid(), quantity: z.number().int().min(1), reason: z.string().optional(), return_condition: z.enum(['SELLABLE','DAMAGED','COMPROMISED','EXPIRED']).optional() })).min(1),
  reason: z.string().optional()
});
export async function POST(req: Request){
  try{
    const body = await req.json();
    const parsed = ReturnSchema.parse(body);
    const data = await createReturn({ sale_id: parsed.sale_id, branch_id: parsed.branch_id, items: parsed.items.map(i=>({ ...i, reason: i.reason ?? 'Customer return', return_condition: (i.return_condition ?? 'SELLABLE') as any })), reason: parsed.reason });
    return NextResponse.json(data, {status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}