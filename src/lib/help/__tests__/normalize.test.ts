import { describe, it, expect } from "vitest";
import {
  normalizeText,
  tokens,
  meaningfulTokens,
  singularize,
  searchKeys,
} from "../normalize";

describe("help normalize", () => {
  it("is case-insensitive", () => {
    expect(normalizeText("HOW DO I USE POS")).toBe(normalizeText("how do i use pos"));
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(normalizeText("How do I use POS?!!")).toBe("how do i use pos");
    expect(normalizeText("add    a   product")).toBe("add a product");
  });

  it("normalizes typographic apostrophes", () => {
    expect(normalizeText("can\u2019t access")).toBe(normalizeText("cant access"));
  });

  it("corrects common misspellings", () => {
    expect(tokens("reciept")).toContain("receipt");
    expect(tokens("inventry")).toContain("inventory");
    expect(tokens("suplier")).toContain("supplier");
    expect(tokens("expirary")).toContain("expiry");
  });

  it("expands common abbreviations", () => {
    expect(tokens("create a po")).toContain("purchase");
    expect(tokens("grn")).toContain("receive");
  });

  it("handles singular/plural without breaking acronyms", () => {
    expect(singularize("products")).toBe("product");
    expect(singularize("sales")).toBe("sale");
    expect(singularize("expenses")).toBe("expense");
    expect(singularize("batches")).toBe("batch");
    expect(singularize("pos")).toBe("pos");
    expect(singularize("access")).toBe("access");
  });

  it("removes stopwords for meaningful matching", () => {
    expect(meaningfulTokens("how do i use the pos")).toEqual(["pos"]);
  });

  it("expands synonyms to canonical concepts", () => {
    expect(searchKeys("sell medicine").has("pos")).toBe(true);
    expect(searchKeys("sell medicine").has("product")).toBe(true);
    expect(searchKeys("stock").has("inventory")).toBe(true);
  });

  it("handles empty and whitespace input", () => {
    expect(normalizeText("")).toBe("");
    expect(tokens("   ")).toEqual([]);
    expect(searchKeys("").size).toBe(0);
  });
});
