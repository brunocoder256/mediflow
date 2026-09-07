import { NextResponse } from "next/server";
import { sanitizeError } from '@/lib/security';
import { createDisposal, approveDisposal, disposeStock, getDisposals } from "@/lib/services/disposals";
import { z } from "zod/v4";

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const id = p.get("id");
    if (id) {
      const all = await getDisposals({});
      const row = all.find((d: any) => d.id === id);
      if (!row) return NextResponse.json({ error: "Disposal not found" }, { status: 404 });
      return NextResponse.json(row);
    }
    const data = await getDisposals({
      branch_id: p.get("branch_id") ?? undefined,
      status: p.get("status") ?? undefined,
      type: p.get("type") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e?.message ?? '') }, { status: 500 });
  }
}

const CreateSchema = z.object({
  branch_id: z.string().min(1),
  type: z.enum(["EXPIRED", "DAMAGED", "OTHER"]),
  product_id: z.string().min(1),
  batch_id: z.string().nullable().optional(),
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative(),
  reason: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "approve") {
      if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
      return NextResponse.json(await approveDisposal(body.id));
    }
    if (body.action === "dispose") {
      if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
      return NextResponse.json(await disposeStock(body.id, body.method ?? undefined));
    }
    const parsed = CreateSchema.parse(body);
    const data = await createDisposal({
      branch_id: parsed.branch_id,
      type: parsed.type,
      product_id: parsed.product_id,
      batch_id: parsed.batch_id ?? undefined,
      quantity: parsed.quantity,
      unit_cost: parsed.unit_cost,
      reason: parsed.reason ?? undefined,
      condition: parsed.condition ?? undefined,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e?.message ?? ''), issues: e.issues }, { status: 400 });
  }
}