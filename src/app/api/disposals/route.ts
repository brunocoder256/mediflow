import { NextResponse } from "next/server";
import { sanitizeError } from '@/lib/security';
import { createDisposal, approveDisposal, disposeStock, getDisposals } from "@/lib/services/disposals";
import { z } from "zod/v4";

function statusForError(message: string): number {
  if (/not authenticated|unauthenticated/i.test(message)) return 401;
  if (/forbidden|permission|unauthorized/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  if (/already been completed|already used|exceeds available|must be approved|cancelled/i.test(message)) return 409;
  if (/required|invalid|must be|negative|greater than zero|too long|does not belong|does not match|no batch/i.test(message)) return 400;
  return 500;
}

function errorResponse(e: any) {
  const message = e?.message ?? '';
  const status = statusForError(message);
  return NextResponse.json(
    { error: status === 500 ? sanitizeError(message) : message, issues: e?.issues },
    { status },
  );
}

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
  batch_id: z.string().min(1, "A batch is required to dispose stock"),
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative(),
  reason: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  operation_id: z.string().min(1).max(100).optional(),
});

const ActionSchema = z.object({
  action: z.enum(["approve", "dispose"]),
  id: z.string().min(1),
  method: z.string().max(100).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body?.action === "approve" || body?.action === "dispose") {
      const parsedAction = ActionSchema.safeParse(body);
      if (!parsedAction.success) {
        return NextResponse.json(
          { error: "id is required", issues: parsedAction.error.issues },
          { status: 400 },
        );
      }
      if (parsedAction.data.action === "approve") {
        return NextResponse.json(await approveDisposal(parsedAction.data.id));
      }
      return NextResponse.json(
        await disposeStock(parsedAction.data.id, parsedAction.data.method ?? undefined),
      );
    }

    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid disposal request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = await createDisposal({
      branch_id: parsed.data.branch_id,
      type: parsed.data.type,
      product_id: parsed.data.product_id,
      batch_id: parsed.data.batch_id,
      quantity: parsed.data.quantity,
      unit_cost: parsed.data.unit_cost,
      reason: parsed.data.reason ?? undefined,
      condition: parsed.data.condition ?? undefined,
      operation_id: parsed.data.operation_id,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return errorResponse(e);
  }
}
