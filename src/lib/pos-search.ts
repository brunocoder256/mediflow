// Fast, relevance-ranked product search shared by the POS.

export type PosSearchable = {
  name: string;
  generic_name?: string | null;
  brand_name?: string | null;
  manufacturer?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  sku?: string | null;
  barcode?: string | null;
  category_name?: string | null;
};

export function productHaystack(p: PosSearchable): string {
  return [
    p.name,
    p.generic_name,
    p.brand_name,
    p.manufacturer,
    p.dosage_form,
    p.strength,
    p.sku,
    p.barcode,
    p.category_name,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" ");
}

export function tokenizeQuery(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Relevance score of a product against a query, or -1 when it does not match.
 *
 * Ranking (higher wins):
 *  - exact barcode / exact SKU / exact name (scan-to-sell cases) win outright
 *  - name prefix beats substring matches
 *  - every whitespace-separated token must match somewhere in the haystack so
 *    "amox cap" finds "Amoxicillin Capsules" and "para 500" finds "Paracetamol 500mg"
 *  - among substring matches, the earliest match position ranks higher, with a
 *    bias toward matches inside the product name
 */
export function scoreProduct(p: PosSearchable, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const tokens = tokenizeQuery(q);
  const haystack = productHaystack(p);
  const name = (p.name ?? "").toLowerCase();
  const barcode = (p.barcode ?? "").toLowerCase();
  const sku = (p.sku ?? "").toLowerCase();

  if (barcode && barcode === q) return 10_000;
  if (sku && sku === q) return 9_900;
  if (name === q) return 9_800;

  if (name.startsWith(q)) return 9_000 - Math.min(q.length, 100);

  if (!tokens.every((t) => haystack.includes(t))) return -1;

  let firstIdx = Infinity;
  for (const t of tokens) {
    const idx = haystack.indexOf(t);
    if (idx >= 0 && idx < firstIdx) firstIdx = idx;
  }
  if (!Number.isFinite(firstIdx) || firstIdx < 0) return -1;

  const nameBias = name.includes(q) ? 2_000 : 0;
  return nameBias + 1_000 - Math.min(firstIdx, 999);
}

export function matchesProduct(p: PosSearchable, query: string): boolean {
  return scoreProduct(p, query) >= 0;
}

export function rankProducts<T extends PosSearchable>(
  list: T[],
  query: string,
  limit?: number,
): T[] {
  if (!query.trim()) return [...list];
  return list
    .map((p) => ({ p, s: scoreProduct(p, query) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .slice(0, limit ?? list.length)
    .map((x) => x.p);
}