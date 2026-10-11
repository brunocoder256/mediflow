import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  askHelp,
  rankArticles,
  scoreArticle,
  getArticleAnswer,
  filterHelpLinks,
  isSafeHref,
  detectLiveDataIntent,
  FALLBACK_MESSAGE,
} from "../engine";
import { getArticle, HELP_ARTICLES } from "../knowledge-base";
import type { HelpArticle } from "../types";

function articleIdFor(query: string, contextModule?: string) {
  const result = askHelp(query, { contextModule });
  return result.answer.kind === "answer" ? result.answer.articleId : `(${result.answer.kind})`;
}

describe("required example questions", () => {
  it("'How do I use POS?' returns POS help", () => {
    expect(articleIdFor("How do I use POS?")).toBe("pos-complete-sale");
  });

  it("'How can I sell a product?' returns POS help", () => {
    expect(articleIdFor("How can I sell a product?")).toBe("pos-complete-sale");
  });

  it("'How do I add a new medicine?' returns product help", () => {
    expect(articleIdFor("How do I add a new medicine?")).toBe("products-add");
  });

  it("'How can I check expired stock?' returns expiry help", () => {
    expect(articleIdFor("How can I check expired stock?")).toBe("inventory-expiry");
  });

  it("'How do I record a supplier purchase?' returns purchase help", () => {
    expect(articleIdFor("How do I record a supplier purchase?")).toBe("purchases-create");
  });

  it("'Why can't I access Reports?' returns the access article", () => {
    expect(articleIdFor("Why can't I access Reports?")).toBe("access-permissions");
  });

  it("'What is the capital of France?' is rejected", () => {
    const r = askHelp("What is the capital of France?");
    expect(r.answer.kind).toBe("fallback");
    if (r.answer.kind === "fallback") expect(r.answer.message).toBe(FALLBACK_MESSAGE);
  });

  it("'Tell me a joke.' is rejected", () => {
    expect(askHelp("Tell me a joke.").answer.kind).toBe("fallback");
  });
});

describe("matching behaviour", () => {
  it("matches exact questions", () => {
    const r = askHelp("How do I use the POS?");
    expect(r.answer.kind).toBe("answer");
    expect(r.matches[0].articleId).toBe("pos-complete-sale");
  });

  it("matches alternative phrasings and synonyms", () => {
    expect(articleIdFor("how can a cashier complete a transaction")).toBe("pos-complete-sale");
    expect(articleIdFor("how do i ring up a sale")).toBe("pos-complete-sale");
    expect(articleIdFor("where do i see quantity on hand")).toBe("inventory-stock-levels");
    expect(articleIdFor("add a vendor")).toBe("suppliers-manage");
  });

  it("matches case-insensitively", () => {
    expect(articleIdFor("HOW DO I ADD A PRODUCT")).toBe("products-add");
  });

  it("matches common misspellings", () => {
    expect(articleIdFor("how do i add a medcine")).toBe("products-add");
    expect(articleIdFor("how do i check expirary dates")).toBe("inventory-expiry");
    expect(articleIdFor("add a suplier")).toBe("suppliers-manage");
  });

  it("ranks the best article when several share keywords", () => {
    // Products and POS both mention "product"; "add" should select Products.
    expect(articleIdFor("how do i add a product")).toBe("products-add");
    // Purchases vs suppliers both mention supplier; "purchase" selects Purchases.
    expect(articleIdFor("how do i record a supplier purchase")).toBe("purchases-create");
  });

  it("returns a lower confidence for weaker matches", () => {
    const strong = askHelp("How do I use the POS?");
    const weak = askHelp("add a supplier");
    expect(strong.answer.kind).toBe("answer");
    expect(weak.answer.kind).toBe("answer");
    if (strong.answer.kind === "answer" && weak.answer.kind === "answer") {
      expect(weak.answer.confidence).toBeLessThan(strong.answer.confidence);
    }
  });

  it("never matches on a single unrelated shared word", () => {
    // Mentions "stock" but is not a MediFlow question.
    expect(askHelp("what is the stock market doing today").answer.kind).not.toBe("answer");
  });
});

describe("empty and unsupported input", () => {
  it("treats empty input as an empty prompt", () => {
    expect(askHelp("").answer.kind).toBe("empty");
  });

  it("treats whitespace-only input as empty", () => {
    expect(askHelp("     ").answer.kind).toBe("empty");
  });

  it("rejects unsupported / nonexistent features", () => {
    expect(askHelp("how do i integrate with whatsapp").answer.kind).toBe("fallback");
    expect(askHelp("how do i bake a cake").answer.kind).toBe("fallback");
  });
});

describe("navigation links and permissions", () => {
  it("returns safe internal links", () => {
    const r = askHelp("How do I use the POS?");
    expect(r.answer.kind).toBe("answer");
    if (r.answer.kind === "answer") {
      expect(r.answer.links.length).toBeGreaterThan(0);
      for (const l of r.answer.links) {
        expect(isSafeHref(l.href)).toBe(true);
        expect(l.href.startsWith("/")).toBe(true);
      }
      expect(r.answer.links[0].href).toBe("/pos");
    }
  });

  it("rejects unsafe hrefs", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("http://evil.example.com")).toBe(false);
    expect(isSafeHref("//evil.example.com")).toBe(false);
    expect(isSafeHref("/pos")).toBe(true);
  });

  it("hides links the user cannot access (permission-aware)", () => {
    const links = [{ label: "Open Reports", href: "/reports", permission: "reports.view" }];
    expect(filterHelpLinks(links, []).length).toBe(0);
    expect(filterHelpLinks(links, ["reports.view"]).length).toBe(1);
    // Unknown permissions (loading/offline) are shown optimistically.
    expect(filterHelpLinks(links, null).length).toBe(1);
  });
});

describe("context-aware prioritisation", () => {
  it("boosts the current module's articles", () => {
    const article = getArticle("inventory-stock-levels")!;
    const withContext = scoreArticle(article, "how do i view stock", "inventory");
    const withoutContext = scoreArticle(article, "how do i view stock", null);
    expect(withContext.score).toBeGreaterThan(withoutContext.score);
    expect(withContext.contextBonus).toBe(25);
  });

  it("ranks a module's article first when context matches", () => {
    const ranked = rankArticles("how do i view a batch", "inventory");
    expect(ranked[0].module).toBe("inventory");
  });
});

describe("safety and robustness", () => {
  it("does not echo raw HTML from user input", () => {
    const r = askHelp("<script>alert(1)</script> or tell me a joke");
    // Either a fallback or an answer — never an executable payload in the title.
    expect(r.answer.title).not.toContain("<script>");
  });

  it("handles malformed / incomplete articles without throwing", () => {
    const malformed = {
      id: "x",
    } as Partial<HelpArticle>;
    expect(() => scoreArticle(malformed as unknown as HelpArticle, "anything")).not.toThrow();
    expect(typeof scoreArticle(malformed as unknown as HelpArticle, "anything").score).toBe("number");
  });

  it("returns null for an unknown article id", () => {
    expect(getArticleAnswer("does-not-exist")).toBeNull();
  });

  it("never throws for arbitrary question strings", () => {
    for (const q of ["", "  ", "???", "😀", "a".repeat(2000), "DROP TABLE users;"]) {
      expect(() => askHelp(q)).not.toThrow();
    }
  });
});

describe("live-data questions", () => {
  it("detects live-data intent", () => {
    expect(detectLiveDataIntent("which products are currently low in stock")).toBe(true);
    expect(detectLiveDataIntent("how many sales do I have today")).toBe(true);
  });

  it("treats 'how do I' questions as documentation questions", () => {
    expect(detectLiveDataIntent("how do I check low stock")).toBe(false);
    expect(detectLiveDataIntent("how can I view stock levels")).toBe(false);
  });

  it("adds a note and never invents figures for live-data questions", () => {
    const r = askHelp("which products are currently low in stock");
    if (r.answer.kind === "answer") {
      expect(r.answer.note).toBeTruthy();
      // No fabricated numbers in the answer text.
      expect(/\b\d{2,}\b/.test(r.answer.intro)).toBe(false);
    }
  });
});

describe("offline capability", () => {
  it("matching engine performs no network or database access", () => {
    for (const file of ["engine.ts", "knowledge-base.ts", "normalize.ts"]) {
      const src = readFileSync(resolve(__dirname, "..", file), "utf8");
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/supabase/i);
      expect(src).not.toMatch(/from ['"]@\/lib\/offline/);
    }
  });

  it("answers deterministically without connectivity", () => {
    const a = askHelp("How do I use the POS?");
    const b = askHelp("How do I use the POS?");
    expect(JSON.stringify(a.answer)).toBe(JSON.stringify(b.answer));
  });
});

describe("knowledge base integrity", () => {
  it("has unique ids and non-empty required fields", () => {
    const ids = new Set<string>();
    for (const a of HELP_ARTICLES) {
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.intro.length).toBeGreaterThan(0);
      expect(a.questions.length).toBeGreaterThan(0);
      expect(a.steps.length).toBeGreaterThan(0);
    }
  });

  it("only links to routes that exist in the app", () => {
    const known = new Set([
      "/dashboard", "/pos", "/cash", "/products", "/inventory", "/purchases", "/suppliers",
      "/sales", "/returns", "/expenses", "/customers", "/reports", "/users", "/audit",
      "/settings", "/sync",
    ]);
    for (const a of HELP_ARTICLES) {
      if (a.route) expect(known.has(a.route)).toBe(true);
      for (const rid of a.relatedArticleIds ?? []) {
        expect(getArticle(rid)).toBeTruthy();
      }
    }
  });
});
