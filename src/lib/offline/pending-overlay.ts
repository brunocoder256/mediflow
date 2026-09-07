"use client";

// Offline-first overlay: reads queued (unsynced) items from the local IndexedDB
// caches and exposes them as live lists/rows so pages can merge them into their
// rendered data. This makes work done offline appear immediately in the UI
// (tagged with `pendingSync: true`) instead of being invisible until a sync
// round-trip completes.

import * as React from "react";
import { liveQuery } from "dexie";
import { db } from "./db";

export type PendingTag = { pendingSync: true };

function useLiveRows<T>(query: () => Promise<T[]>): T[] {
  const [rows, setRows] = React.useState<T[]>([]);
  React.useEffect(() => {
    const observable = liveQuery(query);
    const sub = observable.subscribe({
      next: (v) => setRows((v ?? []) as T[]),
      error: () => {},
    });
    return () => {
      sub.unsubscribe();
    };
  }, [query]);
  return rows;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface PendingProductRow {
  id: string;
  operation_id?: string | null;
  name: string;
  generic_name?: string | null;
  brand_name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  product_type?: string;
  category_id?: string | null;
  unit_id?: string | null;
  description?: string | null;
  strength?: string;
  strength_unit?: string;
  dosage_form?: string;
  route?: string;
  pack_size?: number | null;
  units_per_pack?: number | null;
  manufacturer?: string;
  registration_number?: string;
  classification?: string;
  reorder_level: number;
  min_stock: number;
  max_stock?: number | null;
  reorder_quantity?: number | null;
  default_purchase_cost?: number | null;
  default_selling_price?: number | null;
  min_selling_price?: number | null;
  is_active: boolean;
  created_at: string;
  totalStock: number;
  expiringQty: number;
  initial_stock?: { quantity: number; batch_number?: string; expiry_date?: string } | null;
  pendingSync: true;
}

const pendingProductsQuery = () =>
  db.cachedProducts.where("sync_status").equals("pending").toArray();

const pendingSuppliersQuery = () =>
  db.cachedSuppliers.where("sync_status").equals("pending").toArray();

const pendingCustomersQuery = () =>
  db.cachedCustomers.where("sync_status").equals("pending").toArray();

const pendingPurchasesQuery = () =>
  db.cachedPurchases.where("sync_status").equals("pending").toArray();

export function usePendingProducts(): PendingProductRow[] {
  const rows = useLiveRows(pendingProductsQuery);
  return React.useMemo(
    () =>
      rows
        .map((c: any): PendingProductRow | null => {
          const p = c?.payload ?? {};
          const opening = p.initial_stock;
          const openingQty = opening && Number(opening?.quantity) > 0 ? Math.floor(Number(opening.quantity)) : 0;
          return {
            id: c.id,
            operation_id: c.operation_id ?? null,
            name: c.name ?? p.name ?? "Product",
            generic_name: p.generic_name ?? null,
            brand_name: p.brand_name ?? null,
            sku: p.sku || c.sku || null,
            barcode: p.barcode || c.barcode || null,
            product_type: p.product_type ?? "Human Medicine",
            category_id: p.category_id ?? null,
            unit_id: p.unit_id ?? null,
            description: p.description ?? null,
            strength: p.strength ?? "",
            strength_unit: p.strength_unit ?? "",
            dosage_form: p.dosage_form ?? "",
            route: p.route ?? "",
            pack_size: p.pack_size != null ? Number(p.pack_size) : null,
            units_per_pack: p.units_per_pack != null ? Number(p.units_per_pack) : null,
            manufacturer: p.manufacturer ?? "",
            registration_number: p.registration_number ?? "",
            classification: p.classification ?? "OTC",
            reorder_level: Number(p.reorder_level ?? 0),
            min_stock: Number(p.min_stock ?? 0),
            max_stock: p.max_stock != null ? Number(p.max_stock) : null,
            reorder_quantity: p.reorder_quantity != null ? Number(p.reorder_quantity) : null,
            default_purchase_cost: p.default_purchase_cost != null ? Number(p.default_purchase_cost) : null,
            default_selling_price: p.default_selling_price != null ? Number(p.default_selling_price) : null,
            min_selling_price: p.min_selling_price != null ? Number(p.min_selling_price) : null,
            is_active: true,
            created_at: c.created_at ?? new Date().toISOString(),
            totalStock: openingQty,
            expiringQty: 0,
            initial_stock:
              opening && openingQty > 0
                ? {
                    quantity: openingQty,
                    batch_number: opening.batch_number || undefined,
                    expiry_date: opening.expiry_date || undefined,
                  }
                : null,
            pendingSync: true,
          };
        })
        .filter((r): r is PendingProductRow => !!r),
    [rows]
  );
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export interface PendingSupplierRow {
  id: string;
  operation_id?: string | null;
  name: string;
  supplier_code?: string | null;
  supplier_type?: string | null;
  status?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  is_active?: boolean;
  balance?: number;
  credit_limit?: number;
  created_at: string;
  pendingSync: true;
}

export function usePendingSuppliers(): PendingSupplierRow[] {
  const rows = useLiveRows(pendingSuppliersQuery);
  return React.useMemo(
    () =>
      rows
        .map((c: any): PendingSupplierRow | null => {
          if (!c) return null;
          const p = c.payload ?? {};
          return {
            id: c.id,
            operation_id: c.operation_id ?? null,
            name: c.name ?? p.name ?? "Supplier",
            supplier_code: p.supplier_code || c.supplier_code || null,
            supplier_type: p.supplier_type || c.supplier_type || null,
            status: p.status || c.status || "Active",
            phone: p.phone || c.phone || null,
            email: p.email || c.email || null,
            city: p.city || c.city || null,
            region: p.region || null,
            country: p.country || c.country || null,
            is_active: c.is_active ?? true,
            balance: 0,
            credit_limit: Number(p.credit_limit ?? 0),
            created_at: c.updated_at ?? c.created_at ?? new Date().toISOString(),
            pendingSync: true,
          };
        })
        .filter((r): r is PendingSupplierRow => !!r),
    [rows]
  );
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface PendingCustomerRow {
  id: string;
  operation_id?: string | null;
  display_name?: string | null;
  name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  customer_type?: string;
  phone?: string | null;
  email?: string | null;
  branch_id?: string | null;
  credit_limit?: number;
  status?: string;
  is_active?: boolean;
  created_at: string;
  pendingSync: true;
}

export function usePendingCustomers(): PendingCustomerRow[] {
  const rows = useLiveRows(pendingCustomersQuery);
  return React.useMemo(
    () =>
      rows
        .map((c: any): PendingCustomerRow | null => {
          if (!c) return null;
          const p = c.payload ?? {};
          return {
            id: c.id,
            operation_id: c.operation_id ?? null,
            display_name: c.display_name || p.display_name || p.name || null,
            name: c.name || p.name || null,
            company_name: p.company_name ?? null,
            first_name: p.first_name ?? null,
            last_name: p.last_name ?? null,
            customer_type: p.customer_type || c.customer_type || "INDIVIDUAL",
            phone: p.phone || c.phone || null,
            email: p.email || c.email || null,
            branch_id: p.branch_id || c.branch_id || null,
            credit_limit: Number(p.credit_limit ?? 0),
            status: p.status || "ACTIVE",
            is_active: c.is_active ?? true,
            created_at: c.created_at ?? new Date().toISOString(),
            pendingSync: true,
          };
        })
        .filter((r): r is PendingCustomerRow => !!r),
    [rows]
  );
}

// ---------------------------------------------------------------------------
// Purchases (queued PO create)
// ---------------------------------------------------------------------------

export interface PendingPurchaseRow {
  id: string;
  operation_id?: string | null;
  purchase_number: string;
  supplier_id: string;
  branch_id: string;
  status: string;
  total: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  created_at: string;
  items_count: number;
  pendingSync: true;
}

export function usePendingPurchases(): PendingPurchaseRow[] {
  const rows = useLiveRows(pendingPurchasesQuery);
  return React.useMemo(
    () =>
      rows
        .map((c: any): PendingPurchaseRow | null => {
          if (!c) return null;
          const p = c.payload ?? {};
          const items: any[] = p.items ?? [];
          const total = items.reduce(
            (s: number, l: any) =>
              s +
              Number(l.quantity_ordered ?? 0) * Number(l.unit_cost ?? 0) -
              Number(l.discount ?? 0) +
              Number(l.tax ?? 0),
            0
          );
          return {
            id: c.id,
            operation_id: c.operation_id ?? null,
            purchase_number: "PENDING…",
            supplier_id: p.supplier_id || c.supplier_id || "",
            branch_id: p.branch_id || c.branch_id || "",
            status: "PENDING_SYNC",
            total,
            subtotal: total,
            discount: 0,
            tax: 0,
            created_at: c.created_at ?? new Date().toISOString(),
            items_count: items.length,
            pendingSync: true,
          };
        })
        .filter((r): r is PendingPurchaseRow => !!r),
    [rows]
  );
}

// ---------------------------------------------------------------------------
// Stock overlay: pending product opening stock + queued purchase "receive"
// ---------------------------------------------------------------------------

export interface PendingBatchRow {
  id: string;
  product_id: string;
  branch_id: string;
  batch_number: string;
  quantity_available: number;
  quantity_received: number;
  purchase_price: number;
  selling_price: number;
  expiry_date: string;
  is_active: boolean;
  products?: { name?: string; sku?: string; barcode?: string; reorder_level?: number } | null;
  branches?: { name?: string } | null;
  suppliers?: { name?: string } | null;
  pendingSync: true;
}

export function usePendingStock(): PendingBatchRow[] {
  const products = usePendingProducts();
  const [receives, setReceives] = React.useState<any[]>([]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const entries = await db.syncQueue.where("table_name").equals("purchases").toArray();
        const pendingReceives = entries.filter(
          (e) => e.status === "pending" && (e as any).payload?.action === "receive"
        );
        setReceives(pendingReceives);
      } catch {
        setReceives([]);
      }
    };
    void load();
    const id = window.setInterval(load, 3000);
    return () => window.clearInterval(id);
  }, []);

  return React.useMemo(() => {
    const rows: PendingBatchRow[] = [];
    for (const p of products) {
      const opening = (p as any).initial_stock;
      const openingQty = opening && Number(opening.quantity) > 0 ? Number(opening.quantity) : 0;
      if (!openingQty) continue;
      rows.push({
        id: `${p.id}-stock`,
        product_id: p.id,
        branch_id: "",
        batch_number: opening.batch_number || `OPEN-${p.created_at.slice(0, 10).replace(/-/g, "")}`,
        quantity_available: openingQty,
        quantity_received: openingQty,
        purchase_price: Number(p.default_purchase_cost ?? 0),
        selling_price: Number(p.default_selling_price ?? 0),
        expiry_date: opening.expiry_date || new Date(new Date().getFullYear() + 2, 0, 1).toISOString().slice(0, 10),
        is_active: true,
        products: { name: p.name, sku: p.sku ?? undefined, barcode: p.barcode ?? undefined, reorder_level: p.reorder_level },
        branches: null,
        suppliers: null,
        pendingSync: true,
      });
    }
    for (const entry of receives) {
      const payload = (entry as any).payload ?? {};
      const receivedItems: any[] = payload.received_items ?? [];
      const branchId = payload.branch_id ?? "";
      for (const it of receivedItems) {
        if (!it || !it.product_id) continue;
        const qty = Number(it.quantity_received ?? 0);
        if (qty <= 0) continue;
        rows.push({
          id: `${entry.id}-${it.product_id}`,
          product_id: it.product_id,
          branch_id: it.branch_id || branchId || "",
          batch_number: it.batch_number || "Pending",
          quantity_available: qty,
          quantity_received: qty,
          purchase_price: Number(it.unit_cost ?? 0),
          selling_price: Number(it.selling_price ?? Math.round((Number(it.unit_cost ?? 0) * 1.5 * 100) / 100)),
          expiry_date: it.expiry_date || new Date(new Date().getFullYear() + 2, 0, 1).toISOString().slice(0, 10),
          is_active: true,
          products: null,
          branches: null,
          suppliers: null,
          pendingSync: true,
        });
      }
    }
    return rows;
  }, [products, receives]);
}

export function isPendingRow(row: any): boolean {
  return !!(row && (row.pendingSync === true || row.sync_status === "pending_view"));
}