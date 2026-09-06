import { describe, it, expect } from "vitest";
import {
  scoreProduct,
  matchesProduct,
  rankProducts,
  productHaystack,
  type PosSearchable,
} from "../pos-search";

function product(overrides: Partial<PosSearchable>): PosSearchable {
  return {
    name: "Amoxicillin Capsules 500mg",
    generic_name: "Amoxicillin",
    brand_name: "Amoxil",
    manufacturer: "GSK",
    dosage_form: "Capsules",
    strength: "500mg",
    sku: "AMOX-500",
    barcode: "8901234567890",
    category_name: "Antibiotics",
    ...overrides,
  };
}

describe("pos-search scoring", () => {
  it("exact barcode match ranks highest (scan-to-sell)", () => {
    const p = product({});
    expect(scoreProduct(p, "8901234567890")).toBe(10_000);
  });

  it("exact SKU match ranked at 9900", () => {
    const p = product({});
    expect(scoreProduct(p, "amox-500")).toBe(9_900);
  });

  it("exact name match ranked at 9800", () => {
    const p = product({});
    expect(scoreProduct(p, "Amoxicillin Capsules 500mg")).toBe(9_800);
  });

  it("name prefix ranks above substring", () => {
    const prefix = scoreProduct(product({ name: "Amoxicillin Capsules 500mg" }), "amox");
    const suffix = scoreProduct(product({ name: "Co-Amoxiclav Tablets" }), "amox");
    expect(prefix).toBeGreaterThan(suffix);
    // both must actually match
    expect(prefix).toBeGreaterThan(0);
    expect(suffix).toBeGreaterThan(0);
  });

  it("multi-token query matches across words ('amox cap')", () => {
    expect(matchesProduct(product({}), "amox cap")).toBe(true);
  });

  it("multi-token query matches generic+strength ('para 500')", () => {
    const para = product({ name: "Paracetamol Extra", generic_name: "Paracetamol", strength: "500mg", sku: "P-500", barcode: "" });
    expect(matchesProduct(para, "para 500")).toBe(true);
  });

  it("matches on generic name alone", () => {
    expect(matchesProduct(product({ name: "Panadol Tablets" }), "acetaminophen")).toBe(false);
    expect(matchesProduct(product({ name: "Panadol Tablets", generic_name: "Acetaminophen" }), "acetaminophen")).toBe(true);
  });

  it("matches on brand / manufacturer / category", () => {
    expect(matchesProduct(product({}), "amoxil")).toBe(true);
    expect(matchesProduct(product({}), "gsk")).toBe(true);
    expect(matchesProduct(product({}), "antibiotics")).toBe(true);
    expect(matchesProduct(product({}), "capsules 500mg")).toBe(true);
  });

  it("non-matching query is rejected", () => {
    expect(scoreProduct(product({}), "xyzzy-nonexistent")).toBe(-1);
    expect(matchesProduct(product({}), "panadol qwerty")).toBe(false);
  });

  it("ranks barcode above prefix above substring", () => {
    const p = product({});
    const byBarcode = scoreProduct(p, "8901234567890");
    const byPrefix = scoreProduct(p, "amoxicillin cap");
    const bySubstr = scoreProduct(p, "xicillin");
    expect(byBarcode).toBeGreaterThan(byPrefix);
    expect(byPrefix).toBeGreaterThan(bySubstr);
  });
});

describe("pos-search ranking", () => {
  it("rankProducts sorts by relevance and drops non-matches", () => {
    const list = [
      product({ name: "Zinc Sulfate Syrup", generic_name: "Zinc Sulfate", brand_name: "ZincPlus", manufacturer: "NutriLabs", sku: "ZN-01", barcode: "111" }),
      product({ name: "Amoxicillin Syrup 250ml", barcode: "222" }),
      product({ name: "Vitamin C Tablets", generic_name: "Ascorbic Acid", brand_name: "Aura", manufacturer: "HealthCo", sku: "VC-01", barcode: "333" }),
      product({ name: "Co-Amoxiclav Tablets", barcode: "444" }),
      product({ barcode: "555" }),
    ];
    const ranked = rankProducts(list, "amox");
    expect(ranked.map((p) => p.name)).toEqual([
      "Amoxicillin Capsules 500mg",
      "Amoxicillin Syrup 250ml",
      "Co-Amoxiclav Tablets",
    ]);
    expect(ranked.some((p) => p.name === "Vitamin C Tablets")).toBe(false);
    expect(ranked.some((p) => p.name === "Zinc Sulfate Syrup")).toBe(false);
  });
  it("empty query passes everything through unchanged", () => {
    const list = [product({ name: "A" }), product({ name: "B" })];
    expect(rankProducts(list, "   ")).toHaveLength(2);
  });
  it("respects limit", () => {
    const list = [product({ name: "Amox A" }), product({ name: "Amox B" }), product({ name: "Amox C" })];
    expect(rankProducts(list, "amox", 2)).toHaveLength(2);
  });
});

describe("pos-search haystack", () => {
  it("is lowercased and space joined", () => {
    const h = productHaystack(product({}));
    expect(h).toContain("amoxicillin");
    expect(h).toContain("8901234567890");
    expect(h === h.toLowerCase()).toBe(true);
  });
});