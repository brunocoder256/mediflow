// ---------------------------------------------------------------------------
// Database Types – MediFlow Drug Shop Management System
//
// All id fields are `string` (UUID). Financial amounts are `number`
// (maps to `numeric(14,2)` in PostgreSQL). Timestamps are `string` (ISO 8601).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enum-like string literal unions
// ---------------------------------------------------------------------------

/** Movement direction for inventory tracking. */
export type MovementType = 'in' | 'out' | 'adjustment' | 'transfer';

/** Current state of a sale. */
export type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'refunded';

/** Current state of a purchase order. */
export type PurchaseStatus =
  | 'draft'
  | 'pending'
  | 'ordered'
  | 'received'
  | 'cancelled';

/** Accepted payment methods. */
export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'mobile_money'
  | 'bank_transfer'
  | 'credit'
  | 'other';

/** Role of a user within the application. */
export type UserRole = 'admin' | 'manager' | 'cashier' | 'inventory' | 'viewer';

/** General status flag used across several tables. */
export type ActiveStatus = 'active' | 'inactive';

/** Notification delivery states. */
export type NotificationStatus = 'unread' | 'read' | 'archived';

/** Type of device registered for push notifications. */
export type DeviceType = 'web' | 'android' | 'ios';

/** Sync operation types for offline queue. */
export type SyncOperation = 'create' | 'update' | 'delete';

/** Expense categories. */
export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'salaries'
  | 'supplies'
  | 'maintenance'
  | 'marketing'
  | 'other';

// ---------------------------------------------------------------------------
// Row types – one per database table
// ---------------------------------------------------------------------------

/**
 * Represents an organization (tenant) in the multi-tenant system.
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A physical branch belonging to an organization.
 */
export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User profile linked to an auth user.
 */
export interface Profile {
  id: string;
  organization_id: string | null;
  branch_id: string | null;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Named roles that can be assigned to users.
 */
export interface Role {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Granular permission entries.
 */
export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
  created_at: string;
}

/**
 * Maps roles to their permitted actions.
 */
export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

/**
 * Assigns a role to a user within an organization.
 */
export interface UserRoleEntry {
  id: string;
  user_id: string;
  role_id: string;
  organization_id: string;
  branch_id: string | null;
  created_at: string;
}

/**
 * Product category (e.g. "Analgesics", "Antibiotics").
 */
export interface Category {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Measurement unit (e.g. "tablet", "bottle", "box").
 */
export interface Unit {
  id: string;
  organization_id: string;
  name: string;
  abbreviation: string;
  created_at: string;
}

/**
 * A sellable product (drug / medical item).
 */
export interface Product {
  id: string;
  organization_id: string;
  category_id: string | null;
  unit_id: string | null;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  manufacturer: string | null;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  is_active: boolean;
  requires_prescription: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A batch/lot of a product with its own expiry and cost.
 */
export interface ProductBatch {
  id: string;
  product_id: string;
  branch_id: string;
  batch_number: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  expiry_date: string;
  received_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Immutable record of every stock change.
 */
export interface StockMovement {
  id: string;
  organization_id: string;
  branch_id: string;
  product_id: string;
  batch_id: string | null;
  type: MovementType;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  performed_by: string;
  created_at: string;
}

/**
 * External supplier entity.
 */
export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Header record for a purchase from a supplier.
 */
export interface PurchaseOrder {
  id: string;
  organization_id: string;
  branch_id: string;
  supplier_id: string;
  order_number: string;
  status: PurchaseStatus;
  total_amount: number;
  paid_amount: number;
  notes: string | null;
  expected_date: string | null;
  received_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Individual line item within a purchase order.
 */
export interface PurchaseItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  batch_number: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  expiry_date: string;
  received_quantity: number;
  created_at: string;
}

/**
 * Header record for a customer sale.
 */
export interface Sale {
  id: string;
  organization_id: string;
  branch_id: string;
  sale_number: string;
  customer_id: string | null;
  status: SaleStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
  served_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Individual line item within a sale.
 */
export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  created_at: string;
}

/**
 * A payment record (full or partial) against a sale or purchase order.
 */
export interface Payment {
  id: string;
  organization_id: string;
  reference_type: 'sale' | 'purchase_order';
  reference_id: string;
  amount: number;
  method: PaymentMethod;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

/**
 * A return initiated by a customer for a completed sale.
 */
export interface Return {
  id: string;
  organization_id: string;
  branch_id: string;
  sale_id: string;
  return_number: string;
  reason: string | null;
  total_refund: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  processed_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Individual item being returned.
 */
export interface ReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  unit_price: number;
  refund_amount: number;
  created_at: string;
}

/**
 * Customer record.
 */
export interface Customer {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  loyalty_points: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Business expense entry.
 */
export interface Expense {
  id: string;
  organization_id: string;
  branch_id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  receipt_url: string | null;
  expense_date: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Audit log entry for compliance and debugging.
 */
export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * In-app notification.
 */
export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  status: NotificationStatus;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

/**
 * Registered device for push notifications.
 */
export interface Device {
  id: string;
  user_id: string;
  token: string;
  type: DeviceType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Queued change for offline-to-online synchronization.
 */
export interface SyncQueue {
  id: string;
  organization_id: string;
  user_id: string;
  table_name: string;
  record_id: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  synced: boolean;
  created_at: string;
  synced_at: string | null;
}

/**
 * Organization-level settings stored as key-value pairs.
 */
export interface OrganizationSetting {
  id: string;
  organization_id: string;
  key: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Branch-level settings that override organisation defaults.
 */
export interface BranchSetting {
  id: string;
  branch_id: string;
  organization_id: string;
  key: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Database schema type (used by Supabase generics)
// ---------------------------------------------------------------------------

/**
 * Mirrors the Supabase-generated Database type. Extend this as your schema
 * grows – each key maps to a schema → table → Row / Insert / Update shape.
 */
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>>;
      };
      branches: {
        Row: Branch;
        Insert: Omit<Branch, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Branch, 'id' | 'created_at' | 'updated_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      roles: {
        Row: Role;
        Insert: Omit<Role, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Role, 'id' | 'created_at' | 'updated_at'>>;
      };
      permissions: {
        Row: Permission;
        Insert: Omit<Permission, 'id' | 'created_at'>;
        Update: Partial<Omit<Permission, 'id' | 'created_at'>>;
      };
      role_permissions: {
        Row: RolePermission;
        Insert: Omit<RolePermission, 'id' | 'created_at'>;
        Update: Partial<Omit<RolePermission, 'id' | 'created_at'>>;
      };
      user_roles: {
        Row: UserRoleEntry;
        Insert: Omit<UserRoleEntry, 'id' | 'created_at'>;
        Update: Partial<Omit<UserRoleEntry, 'id' | 'created_at'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Category, 'id' | 'created_at' | 'updated_at'>>;
      };
      units: {
        Row: Unit;
        Insert: Omit<Unit, 'id' | 'created_at'>;
        Update: Partial<Omit<Unit, 'id' | 'created_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>;
      };
      product_batches: {
        Row: ProductBatch;
        Insert: Omit<ProductBatch, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProductBatch, 'id' | 'created_at' | 'updated_at'>>;
      };
      stock_movements: {
        Row: StockMovement;
        Insert: Omit<StockMovement, 'id' | 'created_at'>;
        Update: Partial<Omit<StockMovement, 'id' | 'created_at'>>;
      };
      suppliers: {
        Row: Supplier;
        Insert: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>;
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>>;
      };
      purchase_items: {
        Row: PurchaseItem;
        Insert: Omit<PurchaseItem, 'id' | 'created_at'>;
        Update: Partial<Omit<PurchaseItem, 'id' | 'created_at'>>;
      };
      sales: {
        Row: Sale;
        Insert: Omit<Sale, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Sale, 'id' | 'created_at' | 'updated_at'>>;
      };
      sale_items: {
        Row: SaleItem;
        Insert: Omit<SaleItem, 'id' | 'created_at'>;
        Update: Partial<Omit<SaleItem, 'id' | 'created_at'>>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, 'id' | 'created_at'>;
        Update: Partial<Omit<Payment, 'id' | 'created_at'>>;
      };
      returns: {
        Row: Return;
        Insert: Omit<Return, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Return, 'id' | 'created_at' | 'updated_at'>>;
      };
      return_items: {
        Row: ReturnItem;
        Insert: Omit<ReturnItem, 'id' | 'created_at'>;
        Update: Partial<Omit<ReturnItem, 'id' | 'created_at'>>;
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Customer, 'id' | 'created_at' | 'updated_at'>>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Expense, 'id' | 'created_at' | 'updated_at'>>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'>;
        Update: Partial<Omit<AuditLog, 'id' | 'created_at'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>;
      };
      devices: {
        Row: Device;
        Insert: Omit<Device, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Device, 'id' | 'created_at' | 'updated_at'>>;
      };
      sync_queue: {
        Row: SyncQueue;
        Insert: Omit<SyncQueue, 'id' | 'created_at'>;
        Update: Partial<Omit<SyncQueue, 'id' | 'created_at'>>;
      };
      organization_settings: {
        Row: OrganizationSetting;
        Insert: Omit<OrganizationSetting, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<
          Omit<OrganizationSetting, 'id' | 'created_at' | 'updated_at'>
        >;
      };
      branch_settings: {
        Row: BranchSetting;
        Insert: Omit<BranchSetting, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<BranchSetting, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
