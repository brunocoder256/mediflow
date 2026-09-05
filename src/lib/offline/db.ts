import Dexie, { type EntityTable } from "dexie";

// Catalog product: mirrored from /api/products, or a locally-created draft
// (sync_status 'pending') awaiting sync with the server.
interface Product {
  id: string;
  organization_id?: string | null;
  name: string;
  generic_name?: string | null;
  brand_name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  category_id?: string | null;
  product_type?: string | null;
  unit?: string | null;
  description?: string | null;
  is_active?: boolean;
  is_sellable?: boolean;
  is_purchasable?: boolean;
  reorder_level?: number | null;
  default_selling_price?: number | null;
  owner_cost?: number | null;
  tax_rate?: number | null;
  created_at?: string;
  updated_at?: string;
  sync_status?: "synced" | "pending" | "failed";
  operation_id?: string | null;
}

// Batch/stock row mirrored from /api/inventory (per branch).
interface Batch {
  id: string;
  product_id: string;
  branch_id: string;
  batch_number: string | null;
  quantity_available: number;
  quantity: number;
  expiry_date: string | null;
  cost_price?: number | null;
  purchase_price?: number | null;
  selling_price?: number | null;
  created_at?: string;
  updated_at?: string;
}

// Reference data for offline reads.
interface CachedBranch {
  id: string;
  organization_id?: string | null;
  name: string;
  code?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CachedCategory {
  id: string;
  organization_id?: string | null;
  name: string;
  code?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Single document (id 'org') holding /api/settings payload.
interface OrgSettingsDoc {
  id: string;
  payload: Record<string, unknown>;
  updated_at: string;
}

// Maps locally-created draft ids to the server ids assigned at sync time, so
// later queued sales/purchases/returns referencing a drafts id can be rewritten.
interface IdMapEntry {
  local_id: string;
  server_id: string;
  table_name?: string;
  updated_at: string;
}

interface CatalogMeta {
  id: string;
  hydrated_at: string;
  productCount: number;
  branchCount: number;
  stockCount: number;
}

interface CartItem {
  id: string;
  organization_id: string;
  branch_id: string;
  product_id: string;
  batch_id?: string;
  name: string;
  unit_price: number;
  quantity: number;
  added_at: string;
}

interface SyncQueueEntry {
  id: string;
  operation_id: string;
  table_name: string;
  operation: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  retries: number;
  error?: string | null;
  last_attempt_at?: string | null;
}

interface PendingSale {
  id: string;
  operation_id: string;
  organization_id: string;
  branch_id: string;
  items: Record<string, unknown>[];
  total: number;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  synced_at?: string;
}

interface CachedPurchase {
  id: string;
  purchase_number?: string;
  supplier_id: string;
  branch_id: string;
  status: string;
  total?: number;
  payload: Record<string, unknown>;
  sync_status: "synced" | "pending" | "failed";
  created_at: string;
  updated_at?: string;
  operation_id?: string;
}

interface CachedReturn {
  id: string;
  return_number?: string;
  return_type: "SALES"|"PURCHASE";
  sale_id?: string | null;
  purchase_order_id?: string | null;
  supplier_id?: string | null;
  branch_id: string;
  status: string;
  total?: number;
  payload: Record<string, unknown>;
  sync_status: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string;
  created_at: string;
}

interface CachedSupplier {
  id: string;
  name: string;
  supplier_code?: string | null;
  supplier_type?: string | null;
  status?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  is_active?: boolean;
  payload?: Record<string, unknown>;
  sync_status?: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string | null;
  updated_at: string;
}

interface CachedExpense {
  id: string;
  expense_number?: string | null;
  branch_id: string;
  category?: string | null;
  category_id?: string | null;
  supplier_id?: string | null;
  amount?: number;
  total_amount?: number;
  expense_date: string;
  approval_status: string;
  payment_status: string;
  payload: Record<string, unknown>;
  sync_status: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string | null;
  created_at: string;
  updated_at?: string;
}
interface CachedCustomer {
  id: string;
  customer_code?: string | null;
  name: string;
  display_name?: string | null;
  phone?: string | null;
  email?: string | null;
  branch_id?: string | null;
  customer_type?: string | null;
  status?: string | null;
  is_active?: boolean;
  payload: Record<string, unknown>;
  sync_status: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string | null;
  created_at: string;
  updated_at?: string;
}

class MediFlowDB extends Dexie {
  products!: EntityTable<Product, "id">;
  batches!: EntityTable<Batch, "id">;
  cart!: EntityTable<CartItem, "id">;
  syncQueue!: EntityTable<SyncQueueEntry, "id">;
  pendingSales!: EntityTable<PendingSale, "id">;
  cachedPurchases!: EntityTable<CachedPurchase, "id">;
  cachedSuppliers!: EntityTable<CachedSupplier, "id">;
  cachedReturns!: EntityTable<CachedReturn, "id">;
  cachedExpenses!: EntityTable<CachedExpense, "id">;
  cachedCustomers!: EntityTable<CachedCustomer, "id">;
  branches!: EntityTable<CachedBranch, "id">;
  categories!: EntityTable<CachedCategory, "id">;
  orgSettings!: EntityTable<OrgSettingsDoc, "id">;
  idMap!: EntityTable<IdMapEntry, "local_id">;
  catalogMeta!: EntityTable<CatalogMeta, "id">;

  constructor() {
    super("MediFlowDB");

    this.version(1).stores({
      products: "id, organization_id, barcode",
      batches: "id, product_id, branch_id, expiry_date",
      cart: "id, organization_id, branch_id",
      syncQueue: "id, operation_id, status",
      pendingSales: "id, operation_id, status",
    });

    this.version(2).stores({
      products: "id, organization_id, barcode",
      batches: "id, product_id, branch_id, expiry_date",
      cart: "id, organization_id, branch_id",
      syncQueue: "id, operation_id, status",
      pendingSales: "id, operation_id, status",
      cachedPurchases: "id, branch_id, supplier_id, status, sync_status",
      cachedSuppliers: "id, name",
    }).upgrade(async (tx) => {
      // No data migration needed
    });

    this.version(3).stores({
      products: "id, organization_id, barcode",
      batches: "id, product_id, branch_id, expiry_date",
      cart: "id, organization_id, branch_id",
      syncQueue: "id, operation_id, status",
      pendingSales: "id, operation_id, status",
      cachedPurchases: "id, branch_id, supplier_id, status, sync_status",
      cachedSuppliers: "id, name, supplier_code, status, sync_status",
    }).upgrade(async (tx) => {
      // v3 extend cachedSuppliers with sync fields
    });

    this.version(4).stores({
      products: "id, organization_id, barcode",
      batches: "id, product_id, branch_id, expiry_date",
      cart: "id, organization_id, branch_id",
      syncQueue: "id, operation_id, status",
      pendingSales: "id, operation_id, status",
      cachedPurchases: "id, branch_id, supplier_id, status, sync_status",
      cachedSuppliers: "id, name, supplier_code, status, sync_status",
      cachedReturns: "id, branch_id, return_type, status, sync_status",
    }).upgrade(async (tx) => {
      // v4 returns offline
    });

    this.version(5).stores({
      products: "id, organization_id, barcode",
      batches: "id, product_id, branch_id, expiry_date",
      cart: "id, organization_id, branch_id",
      syncQueue: "id, operation_id, status",
      pendingSales: "id, operation_id, status",
      cachedPurchases: "id, branch_id, supplier_id, status, sync_status",
      cachedSuppliers: "id, name, supplier_code, status, sync_status",
      cachedReturns: "id, branch_id, return_type, status, sync_status",
      cachedExpenses: "id, branch_id, expense_number, approval_status, payment_status, sync_status",
    }).upgrade(async (tx) => {
      // v5 expenses offline
    });

    this.version(6).stores({
      products: "id, organization_id, barcode",
      batches: "id, product_id, branch_id, expiry_date",
      cart: "id, organization_id, branch_id",
      syncQueue: "id, operation_id, status",
      pendingSales: "id, operation_id, status",
      cachedPurchases: "id, branch_id, supplier_id, status, sync_status",
      cachedSuppliers: "id, name, supplier_code, status, sync_status",
      cachedReturns: "id, branch_id, return_type, status, sync_status",
      cachedExpenses: "id, branch_id, expense_number, approval_status, payment_status, sync_status",
      cachedCustomers: "id, customer_code, name, phone, email, branch_id, sync_status",
    }).upgrade(async (tx) => {
      // v6 customers offline
    });

    // v7: catalog read-cache (products/batches/branches/categories/settings),
    // idMap for locally-created drafts, and catalog hydration metadata.
    this.version(7).stores({
      products: "id, organization_id, name, barcode, category_id, is_active, sync_status",
      batches: "id, product_id, branch_id, batch_number, expiry_date",
      cart: "id, organization_id, branch_id",
      syncQueue: "id, operation_id, status, table_name",
      pendingSales: "id, operation_id, status",
      cachedPurchases: "id, branch_id, supplier_id, status, sync_status",
      cachedSuppliers: "id, name, supplier_code, status, sync_status",
      cachedReturns: "id, branch_id, return_type, status, sync_status",
      cachedExpenses: "id, branch_id, expense_number, approval_status, payment_status, sync_status",
      cachedCustomers: "id, customer_code, name, phone, email, branch_id, sync_status",
      branches: "id, organization_id",
      categories: "id, organization_id",
      orgSettings: "id",
      idMap: "local_id, server_id",
      catalogMeta: "id",
    }).upgrade(async (tx) => {
      // v7 catalog cache + id map — no data migration needed
    });
  }
}

export const db = new MediFlowDB();

export type { Product, Batch, CartItem, SyncQueueEntry, PendingSale, CachedPurchase, CachedSupplier, CachedReturn, CachedExpense, CachedCustomer, CachedBranch, CachedCategory, OrgSettingsDoc, IdMapEntry, CatalogMeta };
