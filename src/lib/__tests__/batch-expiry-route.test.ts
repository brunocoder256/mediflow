import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  hasPermissionInOrg: vi.fn(),
  correctBatchExpiry: vi.fn(),
  getBatchExpiryCorrections: vi.fn(),
  syncInventoryNotifications: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
  hasPermissionInOrg: mocks.hasPermissionInOrg,
}));

vi.mock("@/lib/services/batch-expiry", () => ({
  correctBatchExpiry: mocks.correctBatchExpiry,
  getBatchExpiryCorrections: mocks.getBatchExpiryCorrections,
  EXPIRY_CORRECTION_PERMISSION: "inventory.batch_expiry.correct",
}));

vi.mock("@/lib/services/notifications", () => ({
  syncInventoryNotifications: mocks.syncInventoryNotifications,
}));

import { GET, POST } from "@/app/api/batches/expiry-correction/route";

const BATCH_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";

const validBody = {
  batch_id: BATCH_ID,
  expected_expiry_date: "2027-06-01",
  new_expiry_date: "2027-12-01",
  reason: "Supplier confirmed the pack was misprinted",
  operation_id: OPERATION_ID,
};

function post(body: unknown = validBody) {
  return new Request("http://localhost/api/batches/expiry-correction", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function get(batchId: string | null = BATCH_ID) {
  const url = new URL("http://localhost/api/batches/expiry-correction");
  if (batchId !== null) url.searchParams.set("batch_id", batchId);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue({
    sb: {},
    ctx: { profileId: "profile-1", organizationId: "org-1" },
  });
  mocks.hasPermissionInOrg.mockResolvedValue(true);
  mocks.syncInventoryNotifications.mockResolvedValue(0);
});

describe("POST /api/batches/expiry-correction", () => {
  it("applies a valid correction and refreshes notifications", async () => {
    mocks.correctBatchExpiry.mockResolvedValue({
      success: true,
      duplicate: false,
      correction_id: "correction-1",
      batch_id: BATCH_ID,
      branch_id: "branch-1",
      product_id: "product-1",
      old_expiry_date: "2027-06-01",
      new_expiry_date: "2027-12-01",
      high_impact: false,
    });

    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(mocks.correctBatchExpiry).toHaveBeenCalledWith({}, {
      batchId: BATCH_ID,
      expectedExpiryDate: "2027-06-01",
      newExpiryDate: "2027-12-01",
      reason: validBody.reason,
      operationId: OPERATION_ID,
    });
    expect(mocks.syncInventoryNotifications).toHaveBeenCalledWith("org-1", "branch-1");
  });

  it("passes the same operation id on retry (idempotent client contract)", async () => {
    mocks.correctBatchExpiry
      .mockResolvedValueOnce({ success: true, duplicate: false, branch_id: "branch-1" })
      .mockResolvedValueOnce({ success: true, duplicate: true, branch_id: "branch-1" });

    const first = await POST(post());
    const second = await POST(post());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.correctBatchExpiry).toHaveBeenCalledTimes(2);
    expect(mocks.correctBatchExpiry.mock.calls[0][1].operationId).toBe(OPERATION_ID);
    expect(mocks.correctBatchExpiry.mock.calls[1][1].operationId).toBe(OPERATION_ID);
  });

  it("returns 403 for a permission denial without refreshing notifications", async () => {
    mocks.correctBatchExpiry.mockResolvedValue({
      success: false,
      outcome: "REJECTED",
      error_code: "PERMISSION_DENIED",
      message: "You do not have permission to correct batch expiry dates",
    });

    const res = await POST(post());
    expect(res.status).toBe(403);
    expect(mocks.syncInventoryNotifications).not.toHaveBeenCalled();
  });

  it("returns 409 for a stale batch so the UI can reload", async () => {
    mocks.correctBatchExpiry.mockResolvedValue({
      success: false,
      outcome: "REJECTED",
      error_code: "STALE_BATCH",
      message: "This batch was changed by another user.",
    });

    const res = await POST(post());
    expect(res.status).toBe(409);
  });

  it("returns 409 when an operation id was already used for another batch", async () => {
    mocks.correctBatchExpiry.mockResolvedValue({
      success: false,
      outcome: "REJECTED",
      error_code: "OPERATION_ID_CONFLICT",
      message: "This operation id was already used for a different batch",
    });

    const res = await POST(post());
    expect(res.status).toBe(409);
    expect(mocks.syncInventoryNotifications).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies before calling the RPC", async () => {
    const res = await POST(post({ ...validBody, new_expiry_date: "2027-02-30" }));
    expect(res.status).toBe(400);
    expect(mocks.correctBatchExpiry).not.toHaveBeenCalled();
  });

  it("keeps the committed correction successful when notification refresh fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.correctBatchExpiry.mockResolvedValue({
      success: true,
      duplicate: false,
      branch_id: "branch-1",
    });
    mocks.syncInventoryNotifications.mockRejectedValue(new Error("notification store down"));

    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("returns 401 when the session is missing", async () => {
    mocks.requireAuth.mockRejectedValue(new Error("Not authenticated"));
    const res = await POST(post());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.requireAuth.mockRejectedValue(new Error("Account deactivated"));
    const res = await POST(post());
    expect(res.status).toBe(403);
  });
});

describe("GET /api/batches/expiry-correction", () => {
  it("returns history for an authorized user", async () => {
    mocks.getBatchExpiryCorrections.mockResolvedValue([
      { id: "correction-1", status: "APPLIED" },
    ]);
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: "correction-1", status: "APPLIED" }] });
  });

  it("requires either the correction permission or audit.view", async () => {
    mocks.hasPermissionInOrg.mockResolvedValue(false);
    const res = await GET(get());
    expect(res.status).toBe(403);
    expect(mocks.getBatchExpiryCorrections).not.toHaveBeenCalled();
  });

  it("allows audit viewers to read correction history", async () => {
    mocks.hasPermissionInOrg.mockImplementation(async (_sb, _org, code) => code === "audit.view");
    mocks.getBatchExpiryCorrections.mockResolvedValue([]);
    const res = await GET(get());
    expect(res.status).toBe(200);
  });

  it("validates the batch id before querying", async () => {
    const missing = await GET(get(null));
    const malformed = await GET(get("not-a-uuid"));
    expect(missing.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(mocks.getBatchExpiryCorrections).not.toHaveBeenCalled();
  });
});
