import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDisposal: vi.fn(),
  approveDisposal: vi.fn(),
  disposeStock: vi.fn(),
  getDisposals: vi.fn(),
}));

vi.mock("@/lib/services/disposals", () => ({
  createDisposal: mocks.createDisposal,
  approveDisposal: mocks.approveDisposal,
  disposeStock: mocks.disposeStock,
  getDisposals: mocks.getDisposals,
}));

import { POST } from "@/app/api/disposals/route";

const BRANCH_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const BATCH_ID = "33333333-3333-4333-8333-333333333333";
const DISPOSAL_ID = "44444444-4444-4444-8444-444444444444";

const validCreate = {
  action: "create",
  branch_id: BRANCH_ID,
  type: "EXPIRED",
  product_id: PRODUCT_ID,
  batch_id: BATCH_ID,
  quantity: 5,
  unit_cost: 1200,
  reason: "Expired in stock",
  operation_id: "op-1",
};

function post(body: unknown) {
  return new Request("http://localhost/api/disposals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/disposals", () => {
  it("creates a disposal for a specific batch and forwards the idempotency key", async () => {
    mocks.createDisposal.mockResolvedValue({ id: DISPOSAL_ID, status: "PENDING" });

    const res = await POST(post(validCreate));

    expect(res.status).toBe(201);
    expect(mocks.createDisposal).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: BRANCH_ID,
        product_id: PRODUCT_ID,
        batch_id: BATCH_ID,
        quantity: 5,
        unit_cost: 1200,
        operation_id: "op-1",
      }),
    );
  });

  it("rejects a disposal without a batch before touching stock", async () => {
    const res = await POST(post({ ...validCreate, batch_id: undefined }));

    expect(res.status).toBe(400);
    expect(mocks.createDisposal).not.toHaveBeenCalled();
  });

  it("approves through the authoritative service", async () => {
    mocks.approveDisposal.mockResolvedValue({ id: DISPOSAL_ID, status: "APPROVED" });

    const res = await POST(post({ action: "approve", id: DISPOSAL_ID }));

    expect(res.status).toBe(200);
    expect(mocks.approveDisposal).toHaveBeenCalledWith(DISPOSAL_ID);
  });

  it("disposes through the authoritative service with the selected method", async () => {
    mocks.disposeStock.mockResolvedValue({ id: DISPOSAL_ID, status: "DISPOSED" });

    const res = await POST(post({ action: "dispose", id: DISPOSAL_ID, method: "INCINERATION" }));

    expect(res.status).toBe(200);
    expect(mocks.disposeStock).toHaveBeenCalledWith(DISPOSAL_ID, "INCINERATION");
  });

  it("maps a missing stock.dispose permission to 403", async () => {
    mocks.createDisposal.mockRejectedValue(
      new Error("Forbidden: missing permission stock.dispose"),
    );

    const res = await POST(post(validCreate));

    expect(res.status).toBe(403);
  });

  it("maps over-disposal to 409 so the client reloads instead of retrying forever", async () => {
    mocks.disposeStock.mockRejectedValue(
      new Error("Quantity exceeds available batch stock (3 available)"),
    );

    const res = await POST(post({ action: "dispose", id: DISPOSAL_ID, method: "SCRAP" }));

    expect(res.status).toBe(409);
  });

  it("rejects disposing a pending (unapproved) disposal with 409", async () => {
    mocks.disposeStock.mockRejectedValue(new Error("Must be approved before disposal"));

    const res = await POST(post({ action: "dispose", id: DISPOSAL_ID }));

    expect(res.status).toBe(409);
  });

  it("requires an id for approve/dispose actions", async () => {
    const res = await POST(post({ action: "approve" }));

    expect(res.status).toBe(400);
    expect(mocks.approveDisposal).not.toHaveBeenCalled();
  });
});
