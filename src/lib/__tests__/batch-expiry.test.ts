import { describe, expect, it } from "vitest";
import {
  assessExpiryCorrection,
  daysUntilExpiry,
  formatExpiryDate,
  isValidDateOnly,
  orderBatchesByFefo,
  validateExpiryCorrection,
} from "../batch-expiry";
import { batchExpiryCorrectionSchema } from "../validations/batches";

describe("isValidDateOnly", () => {
  it("accepts real calendar dates including leap days", () => {
    expect(isValidDateOnly("2024-02-29")).toBe(true);
    expect(isValidDateOnly("2026-10-22")).toBe(true);
  });

  it("rejects impossible or malformed dates", () => {
    expect(isValidDateOnly("2023-02-29")).toBe(false);
    expect(isValidDateOnly("2026-13-01")).toBe(false);
    expect(isValidDateOnly("2026-04-31")).toBe(false);
    expect(isValidDateOnly("2026-1-1")).toBe(false);
    expect(isValidDateOnly("")).toBe(false);
    expect(isValidDateOnly("1899-12-31")).toBe(false);
  });
});

describe("date-only arithmetic", () => {
  it("does not shift a date because of time-of-day or timezone", () => {
    expect(daysUntilExpiry("2026-10-25", new Date(Date.UTC(2026, 9, 22, 23, 59)))).toBe(3);
    expect(assessExpiryCorrection("2027-01-01", "2027-01-02").daysShift).toBe(1);
    expect(formatExpiryDate("2027-01-15")).toContain("2027");
  });

  it("reports expired dates as negative days", () => {
    expect(daysUntilExpiry("2026-10-21", new Date(Date.UTC(2026, 9, 22)))).toBe(-1);
  });
});

describe("assessExpiryCorrection", () => {
  it("flags shifts greater than 180 days as high impact", () => {
    const today = new Date(Date.UTC(2026, 0, 1));
    expect(assessExpiryCorrection("2026-12-31", "2027-12-31", today).highImpact).toBe(true);
    expect(assessExpiryCorrection("2026-12-31", "2027-01-01", today).highImpact).toBe(false);
    expect(assessExpiryCorrection("2026-01-01", "2026-06-30", today).highImpact).toBe(false);
  });

  it("flags past expiry dates as high impact", () => {
    const result = assessExpiryCorrection("2027-06-01", "2026-01-01", new Date(Date.UTC(2026, 9, 22)));
    expect(result.isPast).toBe(true);
    expect(result.highImpact).toBe(true);
  });

  it("treats the expiry day itself as immediately unusable", () => {
    const result = assessExpiryCorrection("2027-06-01", "2026-10-22", new Date(Date.UTC(2026, 9, 22)));
    expect(result.isPast).toBe(true);
    expect(result.highImpact).toBe(true);
    expect(daysUntilExpiry("2026-10-22", new Date(Date.UTC(2026, 9, 22)))).toBe(0);
  });

  it("detects an unchanged expiry", () => {
    const result = assessExpiryCorrection("2027-06-01", "2027-06-01");
    expect(result.unchanged).toBe(true);
    expect(result.daysShift).toBe(0);
  });
});

describe("validateExpiryCorrection", () => {
  const base = { oldExpiryDate: "2027-06-01", newExpiryDate: "2027-12-01" };

  it("requires a reason of at least 5 characters", () => {
    expect(validateExpiryCorrection({ ...base, reason: "   " }).ok).toBe(false);
    expect(validateExpiryCorrection({ ...base, reason: "typo" }).ok).toBe(false);
    expect(validateExpiryCorrection({ ...base, reason: "supplier typo" }).ok).toBe(true);
  });

  it("rejects unchanged and invalid dates", () => {
    expect(validateExpiryCorrection({ ...base, newExpiryDate: "2027-06-01", reason: "supplier typo" }).ok).toBe(false);
    expect(validateExpiryCorrection({ ...base, newExpiryDate: "2027-02-30", reason: "supplier typo" }).ok).toBe(false);
  });

  it("allows a deliberate past-date correction", () => {
    const result = validateExpiryCorrection({ ...base, newExpiryDate: "2026-01-01", reason: "packaging error" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.assessment.highImpact).toBe(true);
  });
});

describe("orderBatchesByFefo", () => {
  it("orders by earliest expiry and keeps invalid dates last", () => {
    const rows = [
      { id: "c", expiry_date: "2027-05-01" },
      { id: "a", expiry_date: "2026-01-01" },
      { id: "x", expiry_date: "not-a-date" },
      { id: "b", expiry_date: "2026-12-31" },
    ];
    expect(orderBatchesByFefo(rows).map((r) => r.id)).toEqual(["a", "b", "c", "x"]);
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "x", "b"]);
  });
});

describe("batchExpiryCorrectionSchema", () => {
  const valid = {
    batch_id: "11111111-1111-4111-8111-111111111111",
    expected_expiry_date: "2027-06-01",
    new_expiry_date: "2027-12-01",
    reason: "  supplier confirmed misprint  ",
    operation_id: "22222222-2222-4222-8222-222222222222",
  };

  it("accepts a valid correction and trims the reason", () => {
    const parsed = batchExpiryCorrectionSchema.parse(valid);
    expect(parsed.reason).toBe("supplier confirmed misprint");
  });

  it("rejects short reasons, invalid dates and non-uuid ids", () => {
    expect(batchExpiryCorrectionSchema.safeParse({ ...valid, reason: "typo" }).success).toBe(false);
    expect(batchExpiryCorrectionSchema.safeParse({ ...valid, new_expiry_date: "2027-02-30" }).success).toBe(false);
    expect(batchExpiryCorrectionSchema.safeParse({ ...valid, operation_id: "not-a-uuid" }).success).toBe(false);
  });
});
