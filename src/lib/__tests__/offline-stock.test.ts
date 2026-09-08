import { describe, it, expect } from "vitest";
import {
  fefoDecrement,
  decrementInventoryPayload,
  decrementProductsPayload,
  type OfflineSaleLine,
} from "../offline/offline-stock";

function batch(id: string, expiry: string, qty: number) {
  return { id, expiry_date: expiry, quantity_available: qty };
}
function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
}

describe("fefoDecrement", () => {
  it("takes from the earliest expiry batch first", () => {
    const { rows } = fefoDecrement([batch("b1", inDays(10), 5), batch("b2", inDays(2), 3)], 4);
    expect(rows[0].quantity_available).toBe(4); // later expiry (b1) minus 1
    expect(rows[1].quantity_available).toBe(0); // earlier expiry (b2) fully consumed
  });

  it("skips expired batches and reports the remainder", () => {
    const { rows, remaining } = fefoDecrement([batch("old", inDays(-5), 10), batch("fresh", inDays(5), 2)], 4);
    expect(rows[0].quantity_available).toBe(10); // expired untouched
    expect(rows[1].quantity_available).toBe(0);  // fresh consumed fully
    expect(remaining).toBe(2);
  });

  it("never decrements below zero", () => {
    const { rows, remaining } = fefoDecrement([batch("b1", inDays(3), 1)], 5);
    expect(rows[0].quantity_available).toBe(0);
    expect(remaining).toBe(4);
  });

  it("preserves input order", () => {
    const input = [batch("b1", inDays(9), 2), batch("b2", inDays(1), 1)];
    const { rows } = fefoDecrement(input, 1);
    expect(rows.map((r) => r.id)).toEqual(["b1", "b2"]);
  });
});

describe("decrementInventoryPayload", () => {
  const items: OfflineSaleLine[] = [{ product_id: "p1", quantity: 3 }];
  const branchA = "branch-a";
  const branchB = "branch-b";

  it("decrements matching product+branch rows across stock/lowStock/expiring/expired/buckets", () => {
    const exp = inDays(20);
    const payload = {
      stock: [
        { id: "x1", product_id: "p1", branch_id: branchA, quantity_available: 5, expiry_date: exp },
        { id: "x2", product_id: "p1", branch_id: branchB, quantity_available: 9, expiry_date: exp },
        { id: "x3", product_id: "p2", branch_id: branchA, quantity_available: 4, expiry_date: exp },
      ],
      lowStock: [{ id: "x1", product_id: "p1", branch_id: branchA, quantity_available: 5, expiry_date: exp }],
      expiring: [{ id: "x1", product_id: "p1", branch_id: branchA, quantity_available: 5, expiry_date: exp }],
      expired: [],
      buckets: {
        exp30: [{ id: "x1", product_id: "p1", branch_id: branchA, quantity_available: 5, expiry_date: exp }],
        exp90: [],
      },
      inventoryValue: [],
      kpi: {},
    };
    const next: any = decrementInventoryPayload(payload, items, branchA);
    expect(next.stock).toEqual([
      { id: "x1", product_id: "p1", branch_id: branchA, quantity_available: 2, expiry_date: exp },
      { id: "x2", product_id: "p1", branch_id: branchB, quantity_available: 9, expiry_date: exp },
      { id: "x3", product_id: "p2", branch_id: branchA, quantity_available: 4, expiry_date: exp },
    ]);
    expect(next.lowStock[0].quantity_available).toBe(2);
    expect(next.expiring[0].quantity_available).toBe(2);
    expect(next.buckets.exp30[0].quantity_available).toBe(2);
  });

  it("returns null when nothing matches the sale branch", () => {
    const payload = {
      stock: [{ id: "x2", product_id: "p1", branch_id: branchB, quantity_available: 9, expiry_date: inDays(20) }],
    };
    expect(decrementInventoryPayload(payload, items, branchA)).toBeNull();
  });

  it("caps quantities at zero on the inventory side too", () => {
    const payload = {
      stock: [{ id: "x1", product_id: "p1", branch_id: branchA, quantity_available: 2, expiry_date: inDays(20) }],
    };
    const next: any = decrementInventoryPayload(payload, items, branchA);
    expect(next.stock[0].quantity_available).toBe(0);
  });
});

describe("decrementProductsPayload", () => {
  const items: OfflineSaleLine[] = [{ product_id: "p1", quantity: 3 }];

  it("decrements POS-style rows with batches FEFO and recomputes stock", () => {
    const payload = {
      data: [
        {
          id: "p1",
          name: "Action medicine",
          stock: 7,
          batches: [
            { id: "b2", batch_number: "LATE", expiry_date: inDays(20), quantity_available: 2 },
            { id: "b1", batch_number: "EARLY", expiry_date: inDays(5), quantity_available: 5 },
          ],
        },
      ],
    };
    const next: any = decrementProductsPayload(payload, items, "branch-a");
    expect(next.data[0].stock).toBe(4); // 7 sold 3
    expect(next.data[0].batches[1].quantity_available).toBe(2); // earliest batch consumed 3
  });

  it("decrements a plain numeric stock when no batches are present", () => {
    const payload = { data: [{ id: "p1", name: "X", stock: 4 }] };
    const next: any = decrementProductsPayload(payload, items, "branch-a");
    expect(next.data[0].stock).toBe(1);
  });

  it("returns null for catalog rows that have no stock fields", () => {
    const payload = { data: [{ id: "p1", name: "X", sku: "SKU" }] };
    expect(decrementProductsPayload(payload, items, "branch-a")).toBeNull();
  });
});