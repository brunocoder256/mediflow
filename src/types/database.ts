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
  business_type: string | null;
  registration_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string | null;
  status: string;
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
  created_at: string;
  updated_at: string;
}

/**
 * User profile linked to an auth user.
 */
export interface Profile {
  id: string;
  auth_user_id: string;
  organization_id: string | null;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
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
  is_system_role: boolean;
  created_at: string;
}

/**
 * Granular permission entries.
 */
export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

/**
 * Maps roles to their permitted actions.
 */
export interface RolePermission {
  role_id: string;
  permission_id: string;
}

/**
 * Assigns a role to a user within a branch.
 */
export interface UserRoleEntry {
  user_id: string;
  role_id: string;
  branch_id: string | null;
}

/**
 * Product category (e.g. "Analgesics", "Antibiotics").
 */
export interface Category {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
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
  generic_name: string | null;
  brand_name: string | null;
  sku: string;
  barcode: string | null;
  description: string | null;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A batch/lot of a product with its own expiry and pricing.
 */
export interface ProductBatch {
  id: string;
  organization_id: string;
  branch_id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string;
  purchase_price: number;
  selling_price: number;
  quantity_received: number;
  quantity_available: number;
  received_at: string | null;
  supplier_id: string | null;
  purchase_item_id: string | null;
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
  movement_type: MovementType;
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
  contact_person: string | null;
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
  purchase_number: string;
  status: PurchaseStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  ordered_at: string;
  received_at: string | null;
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
  discount: number;
  tax: number;
  total: number;
  cashier_id: string;
  sold_at: string;
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
  tax: number;
  subtotal: number;
  created_at: string;
}

/**
 * A payment record against a sale.
 */
export interface Payment {
  id: string;
  sale_id: string;
  payment_method: PaymentMethod;
  amount: number;
  reference: string | null;
  status: string;
  paid_at: string;
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
  total: number;
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
  amount: number;
  created_at: string;
}

/**
 * Customer record.
 */
export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
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
  payment_method: PaymentMethod | null;
  expense_date: string;
  created_by: string;
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
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
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
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

/**
 * Registered device for push notifications.
 */
export interface Device {
  id: string;
  organization_id: string;
  branch_id: string | null;
  user_id: string;
  device_identifier: string;
  device_name: string | null;
  last_seen_at: string | null;
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
  branch_id: string | null;
  user_id: string;
  device_id: string | null;
  operation_id: string;
  entity_type: string;
  entity_id: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Organization-level settings.
 */
export interface OrganizationSetting {
  id: string;
  organization_id: string;
  receipt_header: string | null;
  receipt_footer: string | null;
  default_tax_rate: number;
  default_currency: string;
  low_stock_threshold: number;
  expiry_warning_days: number;
  created_at: string;
  updated_at: string;
}

/**
 * Branch-level settings that override organisation defaults.
 */
export interface BranchSetting {
  id: string;
  branch_id: string;
  receipt_prefix: string | null;
  invoice_prefix: string | null;
  default_payment_method: PaymentMethod | null;
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
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'last_login_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      roles: {
        Row: Role;
        Insert: Omit<Role, 'id' | 'created_at'>;
        Update: Partial<Omit<Role, 'id' | 'created_at'>>;
      };
      permissions: {
        Row: Permission;
        Insert: Omit<Permission, 'id'>;
        Update: Partial<Omit<Permission, 'id'>>;
      };
      role_permissions: {
        Row: RolePermission;
        Insert: RolePermission;
        Update: Partial<RolePermission>;
      };
      user_roles: {
        Row: UserRoleEntry;
        Insert: UserRoleEntry;
        Update: Partial<UserRoleEntry>;
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
        Insert: Omit<SyncQueue, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SyncQueue, 'id' | 'created_at' | 'updated_at'>>;
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
