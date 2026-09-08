/* eslint-disable @typescript-eslint/no-explicit-any */
// Local stock reservation for offline POS sales. When a sale is queued while
// offline the server cannot decrement anything yet, so we mirror the effect the
// online `fetchProducts` refresh has: reduce the in-memory stock plus every cached
// `/api/inventory` / `/api/products` snapshot stored in the offline read-cache.
import { db, type DataCacheEntry } from "./db";

export type OfflineSaleLine = { product_id: string; quantity: number };

interface FefoBatch {
  id?: string;
  expiry_date: string;
  quantity_available: number | string;
}

interface StockRow extends FefoBatch {
  product_id?: string;
  branch_id?: string;
}

// Decrement `quantity` from the earliest-expiry sellable rows first (mirrors the
// server side `create_pos_sale` FEFO allocation: non-expired, qty > 0, expiry ASC).
// Output keeps the original row order and never drops a row below 0.
export function fefoDecrement<T extends FefoBatch>(
  rows: T[],
  quantity: number,
): { rows: T[]; remaining: number } {
  const qty = Number(quantity) || 0;
  if (qty <= 0) return { rows: rows.map((r) => ({ ...r })), remaining: 0 };
  const out = rows.map((r) => ({ ...r }));
  const now = Date.now();
  const eligible = out
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => Number(r.quantity_available) > 0 && new Date(r.expiry_date).getTime() > now)
    .sort((a, b) => new Date(a.r.expiry_date).getTime() - new Date(b.r.expiry_date).getTime());
  let remaining = qty;
  for (const { r } of eligible) {
    if (remaining <= 0) break;
    const avail = Number(r.quantity_available);
    const take = Math.min(remaining, avail);
    (r as { quantity_available: number }).quantity_available = avail - take;
    remaining -= take;
  }
  return { rows: out, remaining: Math.max(0, remaining) };
}

function decrementRowsArray(
  rows: StockRow[] | undefined,
  items: OfflineSaleLine[],
  branchId: string,
): StockRow[] | null {
  if (!Array.isArray(rows) || rows.length === 0 || !items.length) return null;
  let out: StockRow[] | null = null;
  let changed = false;
  const indexes: number[] = [];
  const group: StockRow[] = [];
  for (const it of items) {
    const qty = Number(it.quantity || 0);
    if (!(qty > 0)) continue;
    indexes.length = 0;
    group.length = 0;
    rows.forEach((r, idx) => {
      if (r.product_id === it.product_id && (r.branch_id === branchId || r.branch_id == null)) {
        indexes.push(idx);
        group.push({ ...r });
      }
    });
    if (!group.length) continue;
    if (!out) out = rows.map((r) => ({ ...r }));
    const { rows: dec } = fefoDecrement(group as StockRow[], qty);
    for (let i = 0; i < dec.length; i++) {
      const prev = Number(rows[indexes[i]].quantity_available ?? 0);
      const next = Number(dec[i].quantity_available ?? 0);
      if (next !== prev) changed = true;
      out[indexes[i]] = dec[i];
    }
  }
  return changed ? out : null;
}

// Decrement the readable snapshot of `/api/inventory` (stock, lowStock, expiring,
// expired and every expiry bucket). Rows only for the sale's branch are touched, so
// a POS sale on one branch leaves the other branches' cached stock intact.
export function decrementInventoryPayload(
  payload: unknown,
  items: OfflineSaleLine[],
  branchId: string,
): unknown | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, any>;
  let changed = false;
  const next: Record<string, any> = { ...p };
  for (const key of ["stock", "lowStock", "expiring", "expired"]) {
    const rows = decrementRowsArray(next[key], items, branchId);
    if (rows) {
      next[key] = rows;
      changed = true;
    }
  }
  if (p.buckets && typeof p.buckets === "object") {
    const buckets: Record<string, any> = { ...(p.buckets as Record<string, any>) };
    for (const bkey of Object.keys(buckets)) {
      const rows = decrementRowsArray(buckets[bkey], items, branchId);
      if (rows) {
        buckets[bkey] = rows;
        changed = true;
      }
    }
    if (changed) next.buckets = buckets;
  }
  return changed ? next : null;
}

// Decrement product payloads cached from `/api/products`. The POS-style rows
// (search=...&pos=1) carry `stock` + `batches[]` which are mapped FEFO; any other
// row shape with a numeric `stock` is decremented directly. Plain catalog rows
// (no stock fields) are left untouched and the function returns null.
export function decrementProductsPayload(
  payload: unknown,
  items: OfflineSaleLine[],
  _branchId: string,
): unknown | null {
  if (!payload || typeof payload !== "object") return null;
  const isArray = Array.isArray(payload);
  const rows: any[] = isArray ? (payload as any[]) : Array.isArray((payload as any).data) ? (payload as any).data : null;
  if (!rows) return null;
  const out = rows.map((r: any) => ({ ...r }));
  let changed = false;
  for (const it of items) {
    const qty = Number(it.quantity || 0);
    if (!(qty > 0)) continue;
    const idx = out.findIndex((r: any) => r.id === it.product_id);
    if (idx < 0) continue;
    const row = out[idx];
    if (Array.isArray(row.batches)) {
      const { rows: dec } = fefoDecrement(row.batches, qty);
      row.batches = dec;
      row.stock = dec.reduce((s: number, b: any) => s + Number(b.quantity_available ?? 0), 0);
      changed = true;
    } else if (row.stock !== undefined) {
      const prev = Number(row.stock ?? 0);
      const next = Math.max(0, prev - qty);
      if (next !== prev) {
        row.stock = next;
        changed = true;
      }
    }
  }
  if (!changed) return null;
  return isArray ? out : { ...(payload as Record<string, any>), data: out };
}

// After an offline POS sale, reserve the sold units in the offline read-cache so the
// Inventory, Products and POS pages all show the reduced stock without a network
// request — mirroring the live `fetchProducts` refresh that runs after an online sale.
export async function applyOfflineSaleStockAdjustment(
  items: OfflineSaleLine[],
  branchId: string,
): Promise<void> {
  if (!items?.length || !branchId) return;
  let entries: DataCacheEntry[];
  try {
    entries = await db.dataCache.toArray();
  } catch {
    return;
  }
  if (!entries.length) return;
  const cachedAt = new Date().toISOString();
  for (const entry of entries) {
    try {
      let next: unknown;
      if (entry.url.startsWith("/api/inventory")) {
        next = decrementInventoryPayload(entry.payload, items, branchId);
      } else if (entry.url.startsWith("/api/products")) {
        next = decrementProductsPayload(entry.payload, items, branchId);
      }
      if (next) {
        await db.dataCache.put({ ...entry, payload: next, cached_at: cachedAt });
      }
    } catch {
      // A cache-update failure must never block the sale that already queued.
    }
  }
}