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

class MediFlowDB extends Dexie {
  products!: EntityTable<Product, "id">;
  batches!: EntityTable<Batch, "id">;
  cart!: EntityTable<CartItem, "id">;
  syncQueue!: EntityTable<SyncQueueEntry, "id">;
  pendingSales!: EntityTable<PendingSale, "id">;

  constructor() {
    super("MediFlowDB");

    this.version(1).stores({
      products: "id, organization_id, barcode",
      batches: "id, product_id, branch_id, expiry_date",
      cart: "id, organization_id, branch_id",
      syncQueue: "id, operation_id, status",
      pendingSales: "id, operation_id, status",
    });
  }
}

export const db = new MediFlowDB();

export type { Product, Batch, CartItem, SyncQueueEntry, PendingSale };
