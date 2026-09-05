"use client";

// Catalog read-cache: hydrates products, per-branch stock (batches), branches,
// categories and settings into IndexedDB when online, and reads them back so
// the POS / products / purchases screens keep working fully offline.

import { db, type Product } from "./db";

export const CATALOG_STORAGE_KEY = "mediflow_catalog_hydrated_at";

export async function getCatalogMeta() {
  try {
    return await db.catalogMeta.get("catalog");
  } catch {
    return null;
  }
}

export async function getCatalogDirtyCount(): Promise<number> {
  try {
    return await db.products.where("sync_status").equals("pending").count();
  } catch {
    return 0;
  }
}

/**
 * Pull the full catalog + reference data into IndexedDB. Tolerant: partial
 * failures are ignored so one bad endpoint never blocks the rest. Locally
 *-created pending products/drafts are preserved (not overwritten).
 */
export async function hydrateCatalog(): Promise<{ products: number; stock: number }> {
  const results = { products: 0, stock: 0 };
  const [p, inv, set, cats] = await Promise.allSettled([
    fetch("/api/products").then((r) => r.json()),
    fetch("/api/inventory").then((r) => r.json()),
    fetch("/api/settings").then((r) => r.json()),
    fetch("/api/categories").then((r) => r.json()),
  ]);

  if (p.status === "fulfilled") {
    const list = Array.isArray(p.value) ? p.value : p.value?.data ?? [];
    const pendingDrafts = await db.products.where("sync_status").equals("pending").toArray().catch(() => []);
    // Keep any locally-created draft rows (not on the server yet) — only the
    // server rows are re-hydrated over the cache.
    const serverIds = new Set((list as any[]).map((x: any) => x.id));
    const serverRows: Product[] = (list as any[]).map((x: any) => ({ ...x, sync_status: "synced" as const }));
    const merged: Product[] = [
      ...serverRows,
      ...pendingDrafts.filter((d) => !serverIds.has(d.id)),
    ];
    await db.products.bulkPut(merged as any).catch(() => {});
    results.products = merged.length;
  }

  if (inv.status === "fulfilled") {
    const rows: any[] = (inv.value as any)?.stock ?? [];
    const mapped = rows.map((b: any) => ({
      id: String(b.id),
      product_id: String(b.product_id),
      branch_id: String(b.branch_id),
      batch_number: b.batch_number ?? null,
      quantity_available: Number(b.quantity_available ?? 0),
      quantity: Number(b.quantity_available ?? 0),
      expiry_date: b.expiry_date ?? null,
      cost_price: Number(b.cost_price ?? b.purchase_price ?? 0),
      purchase_price: Number(b.purchase_price ?? 0),
      selling_price: Number(b.selling_price ?? 0),
      created_at: b.created_at,
      updated_at: b.updated_at,
    }));
    await db.batches.bulkPut(mapped as any).catch(() => {});
    results.stock = mapped.length;
  }

  if (set.status === "fulfilled") {
    const payload = set.value ?? {};
    await db.orgSettings.put({ id: "org", payload, updated_at: new Date().toISOString() } as any).catch(() => {});
    const branches: any[] = (payload as any).branches ?? [];
    await db.branches.bulkPut(branches.map((b: any) => ({ ...b, sync_status: "synced" }))).catch(() => {});
  }

  if (cats.status === "fulfilled") {
    const c = Array.isArray(cats.value) ? cats.value : cats.value?.data ?? [];
    await db.categories.bulkPut(c).catch(() => {});
  }

  await db.catalogMeta.put({ id: "catalog", hydrated_at: new Date().toISOString(), productCount: results.products, branchCount: (await db.branches.count().catch(() => 0)), stockCount: results.stock } as any).catch(() => {});
  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, new Date().toISOString());
  } catch { /* ignore */ }
  return results;
}

export async function readCachedBranches(): Promise<any[]> {
  try {
    return await db.branches.orderBy("name").toArray();
  } catch {
    return [];
  }
}

export async function readCachedCategories(): Promise<any[]> {
  try {
    return await db.categories.orderBy("name").toArray();
  } catch {
    return [];
  }
}

export async function readCachedSettings(): Promise<Record<string, any> | null> {
  try {
    const doc = await db.orgSettings.get("org");
    return doc?.payload ?? null;
  } catch {
    return null;
  }
}

export async function readCachedProducts(): Promise<Product[]> {
  try {
    return await db.products.toArray();
  } catch {
    return [];
  }
}

/** Per-branch stock rows (batches) from the cache, nearest-expiry first. */
export async function readCachedStock(branchId?: string): Promise<any[]> {
  try {
    const rows = branchId
      ? await db.batches.where("branch_id").equals(branchId).toArray()
      : await db.batches.toArray();
    return rows.sort((a, b) => {
      const d = (s: string | null) => (s ? new Date(s).getTime() : Number.MAX_SAFE_INTEGER);
      return d(a.expiry_date) - d(b.expiry_date);
    });
  } catch {
    return [];
  }
}

export function hasCatalogCache(): boolean {
  return typeof localStorage !== "undefined" && !!localStorage.getItem(CATALOG_STORAGE_KEY);
}

/**
 * Builds the POS product list (stock + prices + FEFO/expiry info) purely from
 * the IndexedDB cache — mirrors the online mapping in pos/page.tsx so the
 * offline view is identical to the online one.
 */
export async function readPosCatalog(branchId: string, expiryWarningDays: number): Promise<any[]> {
  const [products, stock, settings] = await Promise.all([
    readCachedProducts(),
    readCachedStock(branchId),
    readCachedSettings(),
  ]);
  const warningDays = expiryWarningDays || ((settings?.organization_settings as any)?.expiry_warning_days ?? 90);

  const map: Record<string, { qty: number; price: number; batches: any[] }> = {};
  for (const b of stock) {
    const pid = b.product_id;
    if (!map[pid]) map[pid] = { qty: 0, price: Number(b.selling_price ?? 0), batches: [] };
    map[pid].qty += Number(b.quantity_available ?? 0);
    map[pid].batches.push(b);
    if (!map[pid].price) map[pid].price = Number(b.selling_price ?? 0);
  }

  const now = new Date();
  return products
    .filter((p: any) => p.is_active !== false)
    .map((p: any) => {
      const s = map[p.id];
      const batches = (s?.batches ?? []).sort(
        (a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime(),
      );
      let expiry_status: any = "ok";
      let near_days: number | null = null;
      let fefo: any = null;
      if (batches.length) {
        const valid = batches.filter(
          (b) => b.expiry_date && new Date(b.expiry_date) > now && Number(b.quantity_available) > 0,
        );
        if (valid.length === 0) {
          expiry_status = s && s.qty > 0 ? "expired" : "out";
          if ((s?.qty ?? 0) === 0) expiry_status = "out";
        } else {
          fefo = { batch_number: valid[0].batch_number, expiry_date: valid[0].expiry_date };
          const d = Math.ceil((new Date(valid[0].expiry_date).getTime() - now.getTime()) / 86400000);
          if (d <= warningDays) {
            expiry_status = "near";
            near_days = d;
          }
        }
      } else if ((s?.qty ?? 0) === 0) {
        expiry_status = "out";
      }
      return {
        id: p.id,
        name: p.name,
        generic_name: p.generic_name ?? null,
        sku: p.sku ?? "",
        barcode: p.barcode ?? null,
        stock: s?.qty ?? 0,
        price: batches.find((b) => Number(b.quantity_available) > 0 && b.expiry_date && new Date(b.expiry_date) > now)?.selling_price ?? s?.price ?? 0,
        category_id: p.category_id ?? null,
        batches,
        fefo_batch: fefo,
        expiry_status,
        near_expiry_days: near_days,
        _cached: true,
      };
    });
}