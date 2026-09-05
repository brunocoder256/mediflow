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
export type MovementType = 'PURCHASE' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'OPENING_BALANCE' | 'EXPIRED' | 'DAMAGED';

/** Current state of a sale. */
export type SaleStatus = 'COMPLETED' | 'HELD' | 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

/** Current state of a purchase order. Full pharmacy approval workflow. */
export type PurchaseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';

/** Accepted payment methods. */
export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK' | 'OTHER';

/** Role of a user within the application. */
export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'stock_manager' | 'viewer';

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

/** Payment status. */
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

/** Stock count lifecycle. */
export type StockCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'COUNTED' | 'REVIEW' | 'APPROVED' | 'POSTED' | 'CANCELLED';

/** Purchase return status. */
export type PurchaseReturnStatus = 'pending' | 'approved' | 'completed' | 'cancelled';

/** Refund status. */
export type RefundStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

/** Stock adjustment status. */
export type StockAdjustmentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'CANCELLED';

/** Transfer status. */
export type TransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

/** Stock count scope type. */
export type StockCountScopeType = 'PRODUCT' | 'CATEGORY' | 'ALL';

/** Return condition for returned stock. */
export type ReturnCondition = 'SELLABLE' | 'DAMAGED' | 'COMPROMISED' | 'EXPIRED';

/** Cash session status. */
export type CashSessionStatus = 'OPEN' | 'CLOSING' | 'CLOSED' | 'APPROVAL_REQUIRED' | 'APPROVED';

/** Cash movement types. */
export type CashMovementType = 'OPENING_FLOAT' | 'SALE' | 'REFUND' | 'CASH_IN' | 'CASH_OUT' | 'ADJUSTMENT' | 'CLOSING_ADJUSTMENT';

/** Cash movement direction. */
export type CashDirection = 'IN' | 'OUT';

/** Disposal types. */
export type DisposalType = 'EXPIRED' | 'DAMAGED' | 'OTHER';
export type DisposalStatus = 'PENDING' | 'APPROVED' | 'DISPOSED' | 'CANCELLED';

/** Payment reconciliation. */
export type ReconciliationStatus = 'UNRECONCILED' | 'MATCHED' | 'RECONCILED' | 'DISPUTED' | 'CANCELLED';

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
  plan: string;
  trial_ends_at: string | null;
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
  email?: string | null;
  username?: string | null;
  avatar_url: string | null;
  is_active: boolean;
  status?: 'invited' | 'active' | 'inactive' | 'suspended' | 'locked' | 'pending_invitation';
  default_branch_id?: string | null;
  failed_login_attempts?: number;
  locked_until?: string | null;
  invitation_sent_at?: string | null;
  invitation_accepted_at?: string | null;
  invited_by?: string | null;
  suspended_reason?: string | null;
  deactivated_reason?: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserBranch {
  user_id: string;
  branch_id: string;
  is_default: boolean;
  created_at: string;
}

export interface UserPermissionOverride {
  user_id: string;
  permission_id: string;
  effect: 'grant' | 'deny';
  created_at: string;
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
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
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
 * A sellable product (drug / medical item) — master definition, batch data lives in product_batches.
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
  alternative_names: string | null;
  image_url: string | null;
  product_type: string | null;
  strength: string | null;
  strength_unit: string | null;
  dosage_form: string | null;
  route: string | null;
  pack_size: number | null;
  units_per_pack: number | null;
  manufacturer: string | null;
  country_of_origin: string | null;
  registration_number: string | null;
  classification: string | null;
  reorder_level: number;
  min_stock: number | null;
  max_stock: number | null;
  reorder_quantity: number | null;
  storage_location: string | null;
  shelf: string | null;
  rack: string | null;
  bin: string | null;
  track_batch: boolean;
  track_expiry: boolean;
  fefo_enabled: boolean;
  allow_negative_stock: boolean;
  default_purchase_cost: number | null;
  default_selling_price: number | null;
  min_selling_price: number | null;
  tax_category: string | null;
  tax_inclusive: boolean;
  preferred_supplier_id: string | null;
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
    unit_cost: number | null;
    notes: string | null;
    created_by: string | null;
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
    ordered_at: string | null;
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
    quantity_ordered: number;
    quantity_received: number;
    unit_cost: number;
    discount: number;
    tax: number;
    subtotal: number;
    created_at: string;
}

/** Goods Received Note — one per receive transaction (GRN). */
export interface GoodsReceipt {
  id: string;
  organization_id: string;
  branch_id: string;
  purchase_order_id: string;
  grn_number: string;
  status: 'DRAFT' | 'RECEIVED' | 'CANCELLED';
  received_by: string | null;
  received_at: string;
  notes: string | null;
  total_quantity: number;
  total_value: number;
  created_at: string;
  updated_at: string;
}
export interface GoodsReceiptItem {
  id: string;
  goods_receipt_id: string;
  purchase_item_id: string;
  product_id: string;
  batch_id: string | null;
  quantity_received: number;
  unit_cost: number;
  batch_number: string | null;
  expiry_date: string | null;
  amount: number;
  created_at: string;
}

/** Document attachment for a purchase/GRN (supplier invoice, delivery note, etc). */
export interface PurchaseAttachment {
  id: string;
  organization_id: string;
  purchase_order_id: string;
  goods_receipt_id: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: 'SUPPLIER_INVOICE' | 'DELIVERY_NOTE' | 'PURCHASE_ORDER' | 'CREDIT_NOTE' | 'OTHER';
  uploaded_by: string | null;
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
    organization_id: string;
    branch_id: string;
    sale_id: string | null;
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
    return_number: string;
    sale_id: string;
    reason: string | null;
    total: number;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    processed_by: string | null;
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
 * Customer record — 360 ERP-grade (spec sections 3-40).
 */
export type CustomerType = 'INDIVIDUAL' | 'WALK_IN' | 'CORPORATE' | 'CLINIC' | 'HOSPITAL' | 'ORGANIZATION' | 'INSURANCE' | 'OTHER';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export interface Customer {
    id: string;
    organization_id: string;
    customer_code: string | null;
    customer_type: CustomerType;
    name: string;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    display_name: string | null;
    company_name: string | null;
    phone: string | null;
    alternate_phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    branch_id: string | null;
    status: CustomerStatus;
    external_reference: string | null;
    tax_id: string | null;
    credit_limit: number;
    payment_terms: string | null;
    loyalty_points: number;
    preferred_contact: string | null;
    sms_opt_in: boolean;
    email_opt_in: boolean;
    marketing_opt_in: boolean;
    contact_person: string | null;
    notes: string | null;
    is_active: boolean;
    merged_into_id: string | null;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}
export interface CustomerNote {
    id: string;
    organization_id: string;
    customer_id: string;
    content: string;
    author_id: string | null;
    visibility: 'INTERNAL' | 'SHARED';
    created_at: string;
    updated_at: string;
}
export interface CustomerMerge {
    id: string;
    organization_id: string;
    master_customer_id: string;
    merged_customer_id: string;
    merged_customer_snapshot: Record<string, unknown>;
    merged_by: string | null;
    reason: string | null;
    sales_moved: number;
    payments_moved: number;
    returns_moved: number;
    created_at: string;
}
export interface CustomerLoyaltyLedger {
    id: string;
    organization_id: string;
    customer_id: string;
    sale_id: string | null;
    points: number;
    type: 'EARNED' | 'REDEEMED' | 'ADJUSTMENT' | 'EXPIRED';
    reference: string | null;
    created_by: string | null;
    created_at: string;
}

/**
 * Business expense entry — ERP-grade (spec sections 3-40).
 */
export interface Expense {
    id: string;
    organization_id: string;
    branch_id: string;
    expense_number: string | null;
    category: string | null;
    category_id: string | null;
    subcategory_id: string | null;
    supplier_id: string | null;
    description: string;
    reference_number: string | null;
    amount: number;
    tax_amount: number | null;
    total_amount: number | null;
    currency: string | null;
    exchange_rate: number | null;
    payment_method: PaymentMethod | string | null;
    payment_account_id: string | null;
    payment_status: string | null;
    approval_status: string | null;
    posting_status: string | null;
    expense_date: string;
    created_by: string;
    submitted_by: string | null;
    approved_by: string | null;
    paid_by: string | null;
    paid_at: string | null;
    payment_date: string | null;
    notes: string | null;
    reversal_of: string | null;
    reversal_reason: string | null;
    idempotency_key: string | null;
    is_reversal: boolean | null;
    tax_inclusive: boolean | null;
    status?: string | null;
    receipt_reference?: string | null;
    created_at: string;
    updated_at: string;
}

export interface ExpenseCategoryRow {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  parent_id: string | null;
  account_mapping: string | null;
  tax_treatment: string | null;
  is_active: boolean;
  branch_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseLine {
  id: string;
  expense_id: string;
  organization_id: string;
  category_id: string | null;
  description: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
}

export interface ExpenseAttachment {
  id: string;
  organization_id: string;
  expense_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface ExpenseApproval {
  id: string;
  organization_id: string;
  expense_id: string;
  action: string;
  actor_id: string | null;
  reason: string | null;
  previous_status: string | null;
  new_status: string | null;
  created_at: string;
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
  type: string;
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
 * Single-row platform configuration (id = 1): trial defaults + contact phones.
 */
export interface PlatformSetting {
  id: number;
  trial_days: number;
  contact_phone_1: string;
  contact_phone_2: string;
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

/**
 * Physical stock count session.
 */
export interface StockCount {
    id: string;
    organization_id: string;
    branch_id: string;
    name: string;
    status: StockCountStatus;
    scope_type: StockCountScopeType;
    scope_id: string | null;
    counted_by: string | null;
    approved_by: string | null;
    approval_reason: string | null;
    posted_at: string | null;
    variance_total: number;
    financial_impact: number;
    notes: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

/**
 * Individual line item in a stock count.
 */
export interface StockCountItem {
    id: string;
    stock_count_id: string;
    product_id: string;
    batch_id: string | null;
    system_quantity: number;
    counted_quantity: number;
    variance: number;
    reason: string | null;
    notes: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

/**
 * Return of goods to a supplier.
 */
export interface PurchaseReturn {
    id: string;
    organization_id: string;
    branch_id: string;
    purchase_order_id: string;
    supplier_id: string;
    return_number: string;
    reason: string | null;
    total: number;
    status: PurchaseReturnStatus;
    approved_by: string | null;
    processed_by: string | null;
    approved_at: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

/**
 * Line item within a purchase return.
 */
export interface PurchaseReturnItem {
    id: string;
    purchase_return_id: string;
    purchase_item_id: string;
    product_id: string;
    batch_id: string | null;
    quantity: number;
    unit_cost: number;
    amount: number;
    reason: string | null;
    created_at: string;
}

/**
 * Refund of a customer payment.
 */
export interface Refund {
    id: string;
    organization_id: string;
    branch_id: string;
    sale_id: string;
    return_id: string | null;
    refund_number: string;
    amount: number;
    payment_method: PaymentMethod;
    reference: string | null;
    status: RefundStatus;
    processed_by: string;
    approved_by: string | null;
    reason: string | null;
    processed_at: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Controlled stock adjustment record.
 */
export interface StockAdjustment {
    id: string;
    organization_id: string;
    branch_id: string;
    adjustment_number: string;
    reason: string;
    notes: string | null;
    status: StockAdjustmentStatus;
    total_variance: number;
    financial_impact: number;
    requested_by: string;
    approved_by: string | null;
    approved_at: string | null;
    approval_reason: string | null;
    posted_at: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Line item within a stock adjustment.
 */
export interface AdjustmentItem {
    id: string;
    stock_adjustment_id: string;
    product_id: string;
    batch_id: string | null;
    adjustment_type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    quantity: number;
    unit_cost: number;
    amount: number;
    reason: string | null;
    notes: string | null;
    created_at: string;
}

/**
 * Inter-branch stock transfer.
 */
export interface Transfer {
    id: string;
    organization_id: string;
    source_branch_id: string;
    destination_branch_id: string;
    transfer_number: string;
    status: TransferStatus;
    requested_by: string;
    received_by: string | null;
    received_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Line item within a transfer.
 */
export interface TransferItem {
    id: string;
    transfer_id: string;
    product_id: string;
    batch_id: string | null;
    quantity: number;
    unit_cost: number;
    created_at: string;
}

/**
 * Price change history for audit and reporting.
 */
export interface PriceHistory {
    id: string;
    organization_id: string;
    product_id: string;
    batch_id: string | null;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string;
    reason: string | null;
    effective_date: string;
    created_at: string;
}

export interface CashRegister {
    id: string;
    organization_id: string;
    branch_id: string;
    name: string;
    code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CashSession {
    id: string;
    organization_id: string;
    branch_id: string;
    register_id: string;
    cashier_id: string;
    status: CashSessionStatus;
    opening_float: number;
    expected_cash: number;
    closing_cash: number | null;
    cash_variance: number | null;
    opened_at: string;
    closed_at: string | null;
    closed_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface CashMovement {
    id: string;
    organization_id: string;
    branch_id: string;
    session_id: string;
    type: CashMovementType;
    amount: number;
    direction: CashDirection;
    reference_type: string | null;
    reference_id: string | null;
    reason: string | null;
    created_by: string | null;
    created_at: string;
}

export interface SupplierPayment {
    id: string;
    organization_id: string;
    branch_id: string;
    supplier_id: string;
    purchase_order_id: string | null;
    amount: number;
    payment_method: PaymentMethod;
    reference: string | null;
    payment_date: string;
    created_by: string | null;
    created_at: string;
}

export interface Disposal {
    id: string;
    organization_id: string;
    branch_id: string;
    type: DisposalType;
    status: DisposalStatus;
    product_id: string;
    batch_id: string | null;
    quantity: number;
    unit_cost: number;
    reason: string | null;
    condition: string | null;
    reported_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
    disposed_at: string | null;
    disposal_method: string | null;
    notes: string | null;
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
      customer_notes: {
        Row: CustomerNote;
        Insert: Omit<CustomerNote, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CustomerNote, 'id' | 'created_at' | 'updated_at'>>;
      };
      customer_merges: {
        Row: CustomerMerge;
        Insert: Omit<CustomerMerge, 'id' | 'created_at'>;
        Update: Partial<Omit<CustomerMerge, 'id' | 'created_at'>>;
      };
      customer_loyalty_ledger: {
        Row: CustomerLoyaltyLedger;
        Insert: Omit<CustomerLoyaltyLedger, 'id' | 'created_at'>;
        Update: Partial<Omit<CustomerLoyaltyLedger, 'id' | 'created_at'>>;
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
      platform_settings: {
        Row: PlatformSetting;
        Insert: Partial<PlatformSetting>;
        Update: Partial<PlatformSetting>;
      };
      branch_settings: {
        Row: BranchSetting;
        Insert: Omit<BranchSetting, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<BranchSetting, 'id' | 'created_at' | 'updated_at'>>;
      };
      stock_counts: {
        Row: StockCount;
        Insert: Omit<StockCount, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<StockCount, 'id' | 'created_at' | 'updated_at'>>;
      };
      stock_count_items: {
        Row: StockCountItem;
        Insert: Omit<StockCountItem, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<StockCountItem, 'id' | 'created_at' | 'updated_at'>>;
      };
      purchase_returns: {
        Row: PurchaseReturn;
        Insert: Omit<PurchaseReturn, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PurchaseReturn, 'id' | 'created_at' | 'updated_at'>>;
      };
      purchase_return_items: {
        Row: PurchaseReturnItem;
        Insert: Omit<PurchaseReturnItem, 'id' | 'created_at'>;
        Update: Partial<Omit<PurchaseReturnItem, 'id' | 'created_at'>>;
      };
      refunds: {
        Row: Refund;
        Insert: Omit<Refund, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Refund, 'id' | 'created_at' | 'updated_at'>>;
      };
      stock_adjustments: {
        Row: StockAdjustment;
        Insert: Omit<StockAdjustment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<StockAdjustment, 'id' | 'created_at' | 'updated_at'>>;
      };
      adjustment_items: {
        Row: AdjustmentItem;
        Insert: Omit<AdjustmentItem, 'id' | 'created_at'>;
        Update: Partial<Omit<AdjustmentItem, 'id' | 'created_at'>>;
      };
      transfers: {
        Row: Transfer;
        Insert: Omit<Transfer, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Transfer, 'id' | 'created_at' | 'updated_at'>>;
      };
      transfer_items: {
        Row: TransferItem;
        Insert: Omit<TransferItem, 'id' | 'created_at'>;
        Update: Partial<Omit<TransferItem, 'id' | 'created_at'>>;
      };
      price_history: {
        Row: PriceHistory;
        Insert: Omit<PriceHistory, 'id' | 'created_at'>;
        Update: Partial<Omit<PriceHistory, 'id' | 'created_at'>>;
      };
      cash_registers: {
        Row: CashRegister;
        Insert: Omit<CashRegister, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CashRegister, 'id' | 'created_at' | 'updated_at'>>;
      };
      cash_sessions: {
        Row: CashSession;
        Insert: Omit<CashSession, 'id' | 'created_at' | 'updated_at' | 'opened_at'>;
        Update: Partial<Omit<CashSession, 'id' | 'created_at' | 'updated_at'>>;
      };
      cash_movements: {
        Row: CashMovement;
        Insert: Omit<CashMovement, 'id' | 'created_at'>;
        Update: Partial<Omit<CashMovement, 'id' | 'created_at'>>;
      };
      supplier_payments: {
        Row: SupplierPayment;
        Insert: Omit<SupplierPayment, 'id' | 'created_at'>;
        Update: Partial<Omit<SupplierPayment, 'id' | 'created_at'>>;
      };
      disposals: {
        Row: Disposal;
        Insert: Omit<Disposal, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Disposal, 'id' | 'created_at' | 'updated_at'>>;
      };
      goods_receipts: {
        Row: GoodsReceipt;
        Insert: Omit<GoodsReceipt, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<GoodsReceipt, 'id' | 'created_at' | 'updated_at'>>;
      };
      goods_receipt_items: {
        Row: GoodsReceiptItem;
        Insert: Omit<GoodsReceiptItem, 'id' | 'created_at'>;
        Update: Partial<Omit<GoodsReceiptItem, 'id' | 'created_at'>>;
      };
      purchase_attachments: {
        Row: PurchaseAttachment;
        Insert: Omit<PurchaseAttachment, 'id' | 'created_at'>;
        Update: Partial<Omit<PurchaseAttachment, 'id' | 'created_at'>>;
      };
      expense_categories: {
        Row: ExpenseCategoryRow;
        Insert: Omit<ExpenseCategoryRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ExpenseCategoryRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      expense_lines: {
        Row: ExpenseLine;
        Insert: Omit<ExpenseLine, 'id' | 'created_at'>;
        Update: Partial<Omit<ExpenseLine, 'id' | 'created_at'>>;
      };
      expense_attachments: {
        Row: ExpenseAttachment;
        Insert: Omit<ExpenseAttachment, 'id' | 'created_at'>;
        Update: Partial<Omit<ExpenseAttachment, 'id' | 'created_at'>>;
      };
      expense_approvals: {
        Row: ExpenseApproval;
        Insert: Omit<ExpenseApproval, 'id' | 'created_at'>;
        Update: Partial<Omit<ExpenseApproval, 'id' | 'created_at'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
