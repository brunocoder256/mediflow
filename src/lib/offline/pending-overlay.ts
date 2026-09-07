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

// ---------------------------------------------------------------------------
// Sales (queued POS sales in syncQueue)
// ---------------------------------------------------------------------------

export interface PendingSaleRow {
  id: string;
  operation_id?: string | null;
  sale_number: string;
  sold_at: string;
  cashier_id: string;
  customer_id: string | null;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  status: string;
  branch_id: string;
  sale_items: any[];
  payments: Array<{ payment_method: string; amount: number; reference?: string }>;
  pendingSync: true;
}

const pendingSalesQuery = () =>
  db.syncQueue
    .where("status")
    .equals("pending")
    .filter((e) => e.table_name === "sales")
    .toArray();

export function usePendingSales(): PendingSaleRow[] {
  const rows = useLiveRows(pendingSalesQuery);
  return React.useMemo(
    () =>
      rows
        .map((q: any): PendingSaleRow | null => {
          if (!q) return null;
          const p = q.payload ?? {};
          const payments: any[] = Array.isArray(p.payments) ? p.payments : [];
          const total = payments.reduce((s: number, pm: any) => s + Number(pm.amount ?? 0), 0);
          return {
            id: q.id,
            operation_id: q.operation_id ?? null,
            sale_number: "PENDING…",
            sold_at: q.created_at ?? new Date().toISOString(),
            cashier_id: "",
            customer_id: p.customer_id ?? null,
            total,
            subtotal: total,
            discount: 0,
            tax: 0,
            status: "PENDING_SYNC",
            branch_id: p.branch_id ?? "",
            sale_items: Array.isArray(p.items) ? p.items : [],
            payments: payments.map((pm: any) => ({
              payment_method: pm.method ?? "CASH",
              amount: Number(pm.amount ?? 0),
              reference: pm.reference,
            })),
            pendingSync: true,
          };
        })
        .filter((r): r is PendingSaleRow => !!r),
    [rows]
  );
}

// ---------------------------------------------------------------------------
// Returns (queued sales / purchase returns in cachedReturns)
// ---------------------------------------------------------------------------

export interface PendingReturnRow {
  id: string;
  operation_id?: string | null;
  return_number: string;
  return_type: "SALES" | "PURCHASE";
  sale_id?: string | null;
  purchase_order_id?: string | null;
  supplier_id?: string | null;
  branch_id: string;
  status: string;
  total: number;
  reason?: string | null;
  refund_status?: string;
  credit_status?: string;
  created_at: string;
  _type: "SALES" | "PURCHASE";
  _orig?: string | null;
  _counterparty?: string;
  return_items: any[];
  purchase_return_items: any[];
  pendingSync: true;
}

const pendingReturnsQuery = () =>
  db.cachedReturns.where("sync_status").equals("pending").toArray();

export function usePendingReturns(): PendingReturnRow[] {
  const rows = useLiveRows(pendingReturnsQuery);
  return React.useMemo(
    () =>
      rows
        .map((c: any): PendingReturnRow | null => {
          if (!c) return null;
          const p = c.payload ?? {};
          const items: any[] = Array.isArray(p.items) ? p.items : [];
          const isSales = c.return_type === "SALES";
          const itemsMapped = items.map((it: any) => ({
            ...it,
            quantity: Number(it.quantity ?? 0),
            batch_id: it.batch_id ?? null,
            reason: it.reason_category ?? it.reason ?? null,
            inventory_destination: it.inventory_destination ?? it.condition ?? null,
          }));
          return {
            id: c.id,
            operation_id: c.operation_id ?? null,
            return_number: "PENDING…",
            return_type: c.return_type,
            sale_id: c.sale_id ?? null,
            purchase_order_id: c.purchase_order_id ?? null,
            supplier_id: c.supplier_id ?? null,
            branch_id: c.branch_id ?? "",
            status: "pending",
            total: Number(c.total ?? 0),
            reason: itemsMapped[0]?.reason ?? "Pending sync",
            refund_status: isSales ? "PENDING" : undefined,
            credit_status: isSales ? undefined : "PENDING",
            created_at: c.created_at ?? new Date().toISOString(),
            _type: c.return_type,
            _orig: isSales ? (c.sale_id ?? null) : (c.purchase_order_id ?? null),
            _counterparty: isSales ? (p.customer_name ?? "Walk-in") : (p.supplier_name ?? "Supplier"),
            return_items: isSales ? itemsMapped : [],
            purchase_return_items: isSales ? [] : itemsMapped.map((it: any) => ({ ...it, unit_cost: Number(it.unit_cost ?? 0) })),
            pendingSync: true,
          };
        })
        .filter((r): r is PendingReturnRow => !!r),
    [rows]
  );
}

// ---------------------------------------------------------------------------
// Expenses (queued expense creates in cachedExpenses)
// ---------------------------------------------------------------------------

export interface PendingExpenseRow {
  id: string;
  operation_id?: string | null;
  expense_number: string;
  expense_date: string;
  category: string;
  category_id?: string | null;
  supplier_id?: string | null;
  description: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  approval_status: string;
  posting_status: string;
  branch_id: string;
  reference_number?: string | null;
  notes?: string | null;
  created_by?: string;
  expense_categories?: { name: string } | null;
  suppliers?: { name: string } | null;
  branches?: { name: string } | null;
  pendingSync: true;
}

const pendingExpensesQuery = () =>
  db.cachedExpenses.where("sync_status").equals("pending").toArray();

export function usePendingExpenses(): PendingExpenseRow[] {
  const rows = useLiveRows(pendingExpensesQuery);
  return React.useMemo(
    () =>
      rows
        .map((c: any): PendingExpenseRow | null => {
          if (!c) return null;
          const p = c.payload ?? {};
          const amount = Number(c.amount ?? p.amount ?? 0);
          const tax = Number(c.total_amount ?? amount) - amount || Number(p.tax_amount ?? 0);
          return {
            id: c.id,
            operation_id: c.operation_id ?? null,
            expense_number: "PENDING…",
            expense_date: c.expense_date ?? new Date().toISOString().slice(0, 10),
            category: c.category ?? p.category ?? "",
            category_id: c.category_id ?? p.category_id ?? null,
            supplier_id: c.supplier_id ?? p.supplier_id ?? null,
            description: p.description ?? "",
            amount,
            tax_amount: tax,
            total_amount: Number(c.total_amount ?? amount + tax),
            payment_method: p.payment_method ?? "CASH",
            payment_status: "UNPAID",
            approval_status: "DRAFT",
            posting_status: "UNPOSTED",
            branch_id: c.branch_id ?? "",
            reference_number: p.reference_number ?? null,
            notes: p.notes ?? null,
            created_by: "",
            expense_categories: { name: c.category ?? p.category ?? "" },
            suppliers: null,
            branches: null,
            pendingSync: true,
          };
        })
        .filter((r): r is PendingExpenseRow => !!r),
    [rows]
  );
}

// ---------------------------------------------------------------------------
// Cash (queued registers / sessions / movements / session actions)
// ---------------------------------------------------------------------------

export interface PendingCashRegisterRow {
  id: string;
  operation_id?: string | null;
  name: string;
  code: string;
  branch_id: string;
  created_at: string;
  pendingSync: true;
}

export interface PendingCashSessionRow {
  id: string;
  operation_id?: string | null;
  register_id: string;
  branch_id: string;
  cashier_id: string;
  status: string;
  opening_float: number;
  expected_cash: number | null;
  closing_cash: number | null;
  cash_variance: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  cash_registers?: { name: string; code: string } | null;
  pendingSync: true;
}

export interface PendingCashMovementRow {
  id: string;
  operation_id?: string | null;
  session_id: string;
  branch_id: string;
  type: string;
  direction: "IN" | "OUT";
  amount: number;
  reason?: string | null;
  created_at: string;
  pendingSync: true;
}

export interface PendingCashActionRow {
  id: string;
  operation_id?: string | null;
  action: "close" | "approve" | string;
  session_id: string;
  branch_id: string;
  created_at: string;
  label: string;
  pendingSync: true;
}

export interface PendingCashState {
  registers: PendingCashRegisterRow[];
  sessions: PendingCashSessionRow[];
  movements: PendingCashMovementRow[];
  actions: PendingCashActionRow[];
  total: number;
}

const pendingCashRegistersQuery = () =>
  db.cachedCashRegisters.where("sync_status").equals("pending").toArray();

const pendingCashSessionsQuery = () =>
  db.cachedCashSessions.where("sync_status").equals("pending").toArray();

const pendingCashMovementsQuery = () =>
  db.cachedCashMovements.where("sync_status").equals("pending").toArray();

const pendingCashActionsQuery = () =>
  db.syncQueue
    .where("status")
    .equals("pending")
    .filter((e) => e.table_name === "cash_sessions" && e.operation === "update")
    .toArray();

export function usePendingCash(): PendingCashState {
  const regRows = useLiveRows(pendingCashRegistersQuery);
  const sesRows = useLiveRows(pendingCashSessionsQuery);
  const movRows = useLiveRows(pendingCashMovementsQuery);
  const actRows = useLiveRows(pendingCashActionsQuery);

  return React.useMemo(() => {
    const registers: PendingCashRegisterRow[] = regRows.map((c: any) => ({
      id: c.id,
      operation_id: c.operation_id ?? null,
      name: c.name ?? (c.payload?.name ?? "Register"),
      code: c.code ?? (c.payload?.code ?? ""),
      branch_id: c.branch_id ?? "",
      created_at: c.created_at ?? new Date().toISOString(),
      pendingSync: true,
    }));
    const sessions: PendingCashSessionRow[] = sesRows.map((c: any) => ({
      id: c.id,
      operation_id: c.operation_id ?? null,
      register_id: c.register_id ?? "",
      branch_id: c.branch_id ?? "",
      cashier_id: "",
      status: "PENDING_SYNC",
      opening_float: Number(c.opening_float ?? 0),
      expected_cash: null,
      closing_cash: null,
      cash_variance: null,
      opened_at: c.opened_at ?? c.created_at ?? new Date().toISOString(),
      closed_at: null,
      notes: "Session open queued offline",
      cash_registers: null,
      pendingSync: true,
    }));
    const movements: PendingCashMovementRow[] = movRows.map((c: any) => ({
      id: c.id,
      operation_id: c.operation_id ?? null,
      session_id: c.session_id ?? "",
      branch_id: c.branch_id ?? "",
      type: c.type ?? "CASH_IN",
      direction: c.direction === "OUT" ? "OUT" : "IN",
      amount: Number(c.amount ?? 0),
      reason: c.reason ?? null,
      created_at: c.created_at ?? new Date().toISOString(),
      pendingSync: true,
    }));
    const actions: PendingCashActionRow[] = actRows.map((q: any) => {
      const p = q.payload ?? {};
      const action = p.action ?? "close";
      return {
        id: q.id,
        operation_id: q.operation_id ?? null,
        action,
        session_id: p.session_id ?? "",
        branch_id: p.branch_id ?? "",
        created_at: q.created_at ?? new Date().toISOString(),
        label: action === "approve" ? "Session approval queued" : action === "close" ? "Session close queued" : "Session update queued",
        pendingSync: true,
      };
    });
    return {
      registers,
      sessions,
      movements,
      actions,
      total: registers.length + sessions.length + movements.length + actions.length,
    };
  }, [regRows, sesRows, movRows, actRows]);
}

// ---------------------------------------------------------------------------
// Disposals (queued disposal creates in cachedDisposals)
// ---------------------------------------------------------------------------

export interface PendingDisposalRow {
  id: string;
  operation_id?: string | null;
  server_id?: string | null;
  branch_id: string;
  product_id: string;
  batch_id?: string | null;
  type: "EXPIRED" | "DAMAGED" | "OTHER";
  status: string;
  quantity: number;
  unit_cost: number;
  value: number;
  reason?: string | null;
  method?: string | null;
  product_name?: string | null;
  batch_number?: string | null;
  products?: { name?: string } | null;
  product_batches?: { batch_number?: string | null; expiry_date?: string | null } | null;
  created_at: string;
  pendingSync: true;
}

const pendingDisposalsQuery = () =>
  db.cachedDisposals.where("sync_status").equals("pending").toArray();

export function usePendingDisposals(): PendingDisposalRow[] {
  const rows = useLiveRows(pendingDisposalsQuery);
  return React.useMemo(
    () =>
      rows
        .map((c: any): PendingDisposalRow | null => {
          if (!c) return null;
          const p = c.payload ?? {};
          const qty = Number(c.quantity ?? p.quantity ?? 0);
          const cost = Number(c.unit_cost ?? p.unit_cost ?? 0);
          return {
            id: c.id,
            operation_id: c.operation_id ?? null,
            server_id: c.server_id ?? null,
            branch_id: c.branch_id ?? String(p.branch_id ?? ""),
            product_id: c.product_id ?? String(p.product_id ?? ""),
            batch_id: c.batch_id ?? p.batch_id ?? null,
            type: (c.type ?? p.type ?? "EXPIRED") as any,
            status: c.status ?? "PENDING",
            quantity: qty,
            unit_cost: cost,
            value: qty * cost,
            reason: c.reason ?? p.reason ?? null,
            method: c.method ?? p.method ?? null,
            product_name: c.product_name ?? null,
            batch_number: c.batch_number ?? null,
            products: { name: c.product_name ?? p.product_name ?? null },
            product_batches: { batch_number: c.batch_number ?? null, expiry_date: p.expiry_date ?? null },
            created_at: c.created_at ?? new Date().toISOString(),
            pendingSync: true,
          };
        })
        .filter((r): r is PendingDisposalRow => !!r),
    [rows]
  );
}

// ---------------------------------------------------------------------------
// Shared: re-run a data fetch whenever the global queue flush completes
// ---------------------------------------------------------------------------

export function useMediflowSynced(cb: () => void) {
  const cbRef = React.useRef(cb);
  cbRef.current = cb;
  React.useEffect(() => {
    const handler = () => {
      try {
        cbRef.current();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mediflow:synced", handler);
    return () => window.removeEventListener("mediflow:synced", handler);
  }, []);
}

export function isPendingRow(row: any): boolean {
  return !!(row && (row.pendingSync === true || row.sync_status === "pending_view"));
}