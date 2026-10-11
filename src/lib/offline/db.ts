import Dexie, { type EntityTable } from "dexie";

interface Product {
  id: string;
  organization_id: string;
  barcode: string;
  name: string;
  description?: string;
  category?: string;
  unit_price: number;
  cost_price: number;
  created_at: string;
  updated_at: string;
}

interface Batch {
  id: string;
  product_id: string;
  branch_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  cost_price: number;
  created_at: string;
  updated_at: string;
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

// Offline cash register cache (mirrors cash_registers)
interface CachedCashRegister {
  id: string;
  branch_id: string;
  name: string;
  code: string;
  is_active?: boolean;
  payload: Record<string, unknown>;
  sync_status: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string | null;
  created_at: string;
  updated_at?: string;
}

// Offline cash session (packaged so the page can render and Reflect writes locally)
interface CachedCashSession {
  id: string;
  register_id: string;
  branch_id: string;
  cashier_id: string;
  status: "OPEN" | "CLOSING" | "CLOSED" | "APPROVAL_REQUIRED" | "APPROVED";
  opening_float: number;
  expected_cash: number | null;
  closing_cash: number | null;
  cash_variance: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  payload: Record<string, unknown>;
  sync_status: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string | null;
  created_at: string;
  updated_at?: string;
}

// Offline cash movements (CASH_IN / CASH_OUT recorded offline)
interface CachedCashMovement {
  id: string;
  session_id: string;
  branch_id: string;
  type: string;
  direction: "IN" | "OUT";
  amount: number;
  reason?: string | null;
  payload: Record<string, unknown>;
  sync_status: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string | null;
  created_at: string;
}

// Offline product master (create/update products offline)
interface CachedProduct {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  is_active?: boolean;
  payload: Record<string, unknown>;
  sync_status: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string | null;
  created_at: string;
  updated_at?: string;
}

// Offline disposals (mirror of disposal workflow: PENDING → APPROVED → DISPOSED)
interface CachedDisposal {
  id: string;
  branch_id: string;
  product_id: string;
  batch_id?: string | null;
  type: "EXPIRED" | "DAMAGED" | "OTHER";
  status: string;
  quantity: number;
  unit_cost: number;
  reason?: string | null;
  method?: string | null;
  product_name?: string | null;
  batch_number?: string | null;
  payload: Record<string, unknown>;
  sync_status: "synced" | "pending" | "failed";
  operation_id?: string | null;
  server_id?: string | null;
  created_at: string;
}

// Generic offline read-cache: stores raw JSON responses keyed by API URL.
interface DataCacheEntry {
  id: string;
  url: string;
  payload: unknown;
  cached_at: string;
  stale_at?: string | null;
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
  dataCache!: EntityTable<DataCacheEntry, "id">;
  cachedCashRegisters!: EntityTable<CachedCashRegister, "id">;
  cachedCashSessions!: EntityTable<CachedCashSession, "id">;
  cachedCashMovements!: EntityTable<CachedCashMovement, "id">;
  cachedProducts!: EntityTable<CachedProduct, "id">;
  cachedDisposals!: EntityTable<CachedDisposal, "id">;
  cachedTransfers!: EntityTable<CachedTransfer, "id">;
  cachedStockCounts!: EntityTable<CachedStockCount, "id">;
  cachedSupplierPayments!: EntityTable<CachedSupplierPayment, "id">;
  cachedPayments!: EntityTable<CachedPayment, "id">;
  cachedSettings!: EntityTable<CachedSettings, "id">;
  cachedBranches!: EntityTable<CachedBranch, "id">;
  cachedUsers!: EntityTable<CachedUser, "id">;
  cachedRoles!: EntityTable<CachedRole, "id">;

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

    this.version(7).stores({
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
      dataCache: "id, url, cached_at",
    }).upgrade(async (tx) => {
      // v7 generic read-cache (dataCache)
    });

    this.version(8).stores({
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
      dataCache: "id, url, cached_at",
      cachedCashRegisters: "id, branch_id, sync_status",
      cachedCashSessions: "id, register_id, branch_id, status, sync_status",
      cachedCashMovements: "id, session_id, branch_id, type, direction, sync_status",
      cachedProducts: "id, name, sku, barcode, is_active, sync_status",
    }).upgrade(async (tx) => {
      // v8 cash & product offline
    });

    this.version(9).stores({
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
      dataCache: "id, url, cached_at",
      cachedCashRegisters: "id, branch_id, sync_status",
      cachedCashSessions: "id, register_id, branch_id, status, sync_status",
      cachedCashMovements: "id, session_id, branch_id, type, direction, sync_status",
      cachedProducts: "id, name, sku, barcode, is_active, sync_status",
      cachedDisposals: "id, branch_id, product_id, type, status, sync_status",
    }).upgrade(async (tx) => {
      // v9 disposals offline
    });

    this.version(10).stores({
      products: null,
      batches: null,
      cart: null,
      pendingSales: null,
      syncQueue: "id, operation_id, status, table_name, created_at",
      cachedPurchases: "id, branch_id, supplier_id, status, sync_status",
      cachedSuppliers: "id, name, supplier_code, status, sync_status",
      cachedReturns: "id, branch_id, return_type, status, sync_status",
      cachedExpenses: "id, branch_id, expense_number, approval_status, payment_status, sync_status",
      cachedCustomers: "id, customer_code, name, phone, email, branch_id, sync_status",
      dataCache: "id, url, cached_at",
      cachedCashRegisters: "id, branch_id, sync_status",
      cachedCashSessions: "id, register_id, branch_id, status, sync_status, operation_id",
      cachedCashMovements: "id, session_id, branch_id, type, direction, sync_status, operation_id",
      cachedProducts: "id, name, sku, barcode, is_active, sync_status",
      cachedDisposals: "id, branch_id, product_id, type, status, sync_status, server_id, operation_id",
      cachedTransfers: "id, branch_id, source_branch_id, destination_branch_id, status, sync_status, operation_id",
      cachedStockCounts: "id, branch_id, status, sync_status, operation_id",
      cachedSupplierPayments: "id, supplier_id, purchase_order_id, branch_id, sync_status, operation_id",
      cachedPayments: "id, customer_id, branch_id, sync_status, operation_id",
      cachedSettings: "id, organization_id, updated_at",
      cachedBranches: "id, organization_id, is_active",
      cachedUsers: "id, organization_id, branch_id",
      cachedRoles: "id, organization_id",
    }).upgrade(async (tx) => {
      // v10 cleanup + add indexes
    });
  }
}

export const db = new MediFlowDB();

// Whenever a new write is queued, ask the service worker to schedule a
// Background Sync so the queue flushes even if the tab is later closed.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  db.syncQueue.hook("creating", () => {
    void import("./background-sync")
      .then((m) => m.requestBackgroundSync())
      .catch(() => {});
  });
}


interface CachedTransfer {
  id: string;
  branch_id: string;
  source_branch_id?: string | null;
  destination_branch_id?: string | null;
  status: string;
  sync_status: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

interface CachedStockCount {
  id: string;
  branch_id: string;
  status: string;
  sync_status: "synced" | "pending" | "failed" | "pending_sync";
  operation_id?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

interface CachedSupplierPayment {
  id: string;
  supplier_id: string;
  purchase_order_id?: string | null;
  branch_id: string;
  sync_status: string;
  operation_id?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface CachedPayment {
  id: string;
  customer_id: string;
  branch_id: string;
  sync_status: string;
  operation_id?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface CachedSettings {
  id: string;
  organization_id: string;
  updated_at: string;
  payload: Record<string, unknown>;
}

interface CachedBranch {
  id: string;
  organization_id: string;
  is_active?: boolean;
  payload: Record<string, unknown>;
  sync_status?: string;
}

interface CachedUser {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  payload: Record<string, unknown>;
  sync_status?: string;
}

interface CachedRole {
  id: string;
  organization_id: string;
  payload: Record<string, unknown>;
}

export type { Product, Batch, CartItem, SyncQueueEntry, PendingSale, CachedPurchase, CachedSupplier, CachedReturn, CachedExpense, CachedCustomer, DataCacheEntry, CachedCashRegister, CachedCashSession, CachedCashMovement, CachedProduct, CachedDisposal, CachedTransfer, CachedStockCount, CachedSupplierPayment, CachedPayment, CachedSettings, CachedBranch, CachedUser, CachedRole };
