import { EXPIRY_CORRECTION_PERMISSION } from "@/lib/batch-expiry";

export { EXPIRY_CORRECTION_PERMISSION };

export type BatchExpiryCorrection = {
  id: string;
  operation_id: string;
  organization_id: string;
  branch_id: string | null;
  batch_id: string | null;
  product_id: string | null;
  old_expiry_date: string | null;
  new_expiry_date: string | null;
  reason: string;
  status: "APPLIED" | "REJECTED" | "FAILED";
  error_code: string | null;
  error_message: string | null;
  high_impact: boolean;
  requested_by: string | null;
  requested_at: string;
  applied_by: string | null;
  applied_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  requested_by_name?: string | null;
  applied_by_name?: string | null;
};

export type CorrectBatchExpiryInput = {
  batchId: string;
  expectedExpiryDate: string;
  newExpiryDate: string;
  reason: string;
  operationId: string;
};

export type CorrectBatchExpiryResult = {
  success: boolean;
  duplicate?: boolean;
  outcome?: "APPLIED" | "REJECTED" | "FAILED";
  correction_id?: string;
  batch_id?: string;
  branch_id?: string | null;
  product_id?: string | null;
  old_expiry_date?: string | null;
  new_expiry_date?: string | null;
  high_impact?: boolean;
  error_code?: string;
  message?: string;
};

/** Calls the authoritative, atomic PostgreSQL correction RPC. */
export async function correctBatchExpiry(
  sb: any,
  input: CorrectBatchExpiryInput,
): Promise<CorrectBatchExpiryResult> {
  const { data, error } = await sb.rpc("correct_batch_expiry", {
    p_batch_id: input.batchId,
    p_expected_expiry_date: input.expectedExpiryDate,
    p_new_expiry_date: input.newExpiryDate,
    p_reason: input.reason,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error(error.message);
  return data as CorrectBatchExpiryResult;
}

/** Recent correction history for a batch (RLS-scoped + permission-scoped in SQL). */
export async function getBatchExpiryCorrections(
  sb: any,
  batchId: string,
  limit = 20,
): Promise<BatchExpiryCorrection[]> {
  const { data, error } = await sb
    .from("batch_expiry_corrections")
    .select("*")
    .eq("batch_id", batchId)
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as BatchExpiryCorrection[];
  const profileIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.requested_by, row.applied_by])
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const names: Record<string, string> = {};
  if (profileIds.length) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const profile of profiles ?? []) names[profile.id] = profile.full_name;
  }

  return rows.map((row) => ({
    ...row,
    requested_by_name: row.requested_by ? names[row.requested_by] ?? null : null,
    applied_by_name: row.applied_by ? names[row.applied_by] ?? null : null,
  }));
}
