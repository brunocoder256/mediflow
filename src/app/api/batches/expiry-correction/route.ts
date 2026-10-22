import { NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/security';
import { requireAuth, hasPermissionInOrg } from '@/lib/auth';
import { batchExpiryCorrectionSchema } from '@/lib/validations/batches';
import {
  correctBatchExpiry,
  getBatchExpiryCorrections,
  EXPIRY_CORRECTION_PERMISSION,
} from '@/lib/services/batch-expiry';
import { syncInventoryNotifications } from '@/lib/services/notifications';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function httpStatusFor(code?: string, fallback = 400): number {
  switch (code) {
    case 'PERMISSION_DENIED':
    case 'UNAUTHORIZED_BATCH':
    case 'UNAUTHORIZED_BRANCH':
      return 403;
    case 'BATCH_NOT_FOUND':
      return 404;
    case 'STALE_BATCH':
    case 'UNCHANGED':
    case 'OPERATION_ID_CONFLICT':
      return 409;
    case 'REASON_REQUIRED':
    case 'REASON_TOO_LONG':
    case 'INVALID_DATE':
      return 400;
    default:
      return fallback;
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : '';
}

function statusForError(message: string): number {
  if (/unauthenticated|not authenticated/i.test(message)) return 401;
  if (/deactivated|disabled|suspended|locked/i.test(message)) return 403;
  if (/forbidden|permission|unauthorized/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  if (/required|invalid|must be|outside|too long|too short/i.test(message)) return 400;
  return 500;
}

/** Recent expiry corrections for one batch, scoped by organization/branch RLS. */
export async function GET(req: Request) {
  try {
    const { sb, ctx } = await requireAuth();
    const canView =
      (await hasPermissionInOrg(sb, ctx.organizationId, EXPIRY_CORRECTION_PERMISSION)) ||
      (await hasPermissionInOrg(sb, ctx.organizationId, 'audit.view'));
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden: expiry correction history is not available' }, { status: 403 });
    }

    const batchId = new URL(req.url).searchParams.get('batch_id');
    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 });
    }
    if (!UUID_RE.test(batchId)) {
      return NextResponse.json({ error: 'batch_id must be a valid UUID' }, { status: 400 });
    }

    const data = await getBatchExpiryCorrections(sb, batchId);
    return NextResponse.json({ data });
  } catch (e) {
    const message = messageOf(e);
    return NextResponse.json(
      { error: statusForError(message) === 500 ? sanitizeError(message) : message },
      { status: statusForError(message) },
    );
  }
}

/**
 * Authoritative expiry correction endpoint.
 *
 * The client only supplies the batch id and the values it observed. The RPC
 * resolves the actor, organization and branch from the authenticated session,
 * enforces the dedicated permission, locks the row, validates an optimistic
 * concurrency token, writes the audit history and updates the batch atomically.
 */
export async function POST(req: Request) {
  try {
    const { sb, ctx } = await requireAuth();
    const body = await req.json().catch(() => null);

    const parsed = batchExpiryCorrectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid correction request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await correctBatchExpiry(sb, {
      batchId: parsed.data.batch_id,
      expectedExpiryDate: parsed.data.expected_expiry_date,
      newExpiryDate: parsed.data.new_expiry_date,
      reason: parsed.data.reason,
      operationId: parsed.data.operation_id,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: httpStatusFor(result.error_code) });
    }

    // Refresh expiry-derived alerts from authoritative batch data. Notification
    // fan-out is best-effort; a failure must not undo an already-committed,
    // audited correction.
    try {
      await syncInventoryNotifications(ctx.organizationId, result.branch_id ?? null);
    } catch (error) {
      console.error('[batch-expiry] notification refresh failed:', messageOf(error));
    }

    return NextResponse.json(result);
  } catch (e) {
    const message = messageOf(e);
    const status = statusForError(message);
    return NextResponse.json(
      { error: status === 500 ? sanitizeError(message) : message },
      { status },
    );
  }
}
