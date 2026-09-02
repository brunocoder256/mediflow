// Re-exports from database types
export type {
  MovementType,
  SaleStatus,
  PurchaseStatus,
  PaymentMethod,
  UserRole,
  ActiveStatus,
  NotificationStatus,
  DeviceType,
  SyncOperation,
  ExpenseCategory,
  Organization,
  Branch,
  Profile,
  Role,
  Permission,
  RolePermission,
  UserRoleEntry,
  Category,
  Unit,
  Product,
  ProductBatch,
  StockMovement,
  Supplier,
  PurchaseOrder,
  PurchaseItem,
  Sale,
  SaleItem,
  Payment,
  Return,
  ReturnItem,
  Customer,
  Expense,
  AuditLog,
  Notification,
  Device,
  SyncQueue,
  OrganizationSetting,
  BranchSetting,
  Database,
} from './database';

// Convenience type aliases
export type OrganizationRow = import('./database').Organization;
export type BranchRow = import('./database').Branch;
export type ProductRow = import('./database').Product;
export type SaleRow = import('./database').Sale;
export type PurchaseOrderRow = import('./database').PurchaseOrder;
export type CustomerRow = import('./database').Customer;
export type SupplierRow = import('./database').Supplier;
