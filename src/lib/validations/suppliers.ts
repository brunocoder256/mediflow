import { z } from "zod/v4";

export const supplierTypes = [
  "Pharmaceutical distributor",
  "Wholesaler",
  "Manufacturer",
  "Medical equipment supplier",
  "Laboratory supplier",
  "General supplier",
  "Other",
] as const;

export const supplierStatuses = ["Active", "Inactive", "Suspended", "Under Review"] as const;

export const verificationStatuses = ["Unverified", "Pending", "Verified", "Rejected"] as const;

export const paymentTermsOptions = [
  "Cash",
  "Immediate",
  "7 Days",
  "14 Days",
  "30 Days",
  "60 Days",
  "Custom",
] as const;

export const currencyOptions = ["UGX", "USD", "KES", "TZS", "RWF", "EUR", "GBP"] as const;

const phoneRegex = /^(\+256)?[0-9\s\-()]{7,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name required").max(200),
  supplier_code: z.string().max(30).optional().or(z.literal("")),
  trading_name: z.string().max(200).optional().or(z.literal("")),
  supplier_type: z.enum(supplierTypes).optional().default("Pharmaceutical distributor"),
  supplier_category: z.string().max(100).optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  status: z.enum(supplierStatuses).optional().default("Active"),
  is_active: z.boolean().optional().default(true),

  // Contact
  contact_person: z.string().max(150).optional().or(z.literal("")),
  contact_role: z.string().max(100).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")).refine((v) => !v || phoneRegex.test(v), "Invalid phone — use +256 or local format"),
  phone_alt: z.string().max(20).optional().or(z.literal("")),
  email: z.string().max(150).optional().or(z.literal("")).refine((v) => !v || emailRegex.test(v), "Invalid email"),
  email_alt: z.string().max(150).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  physical_address: z.string().max(500).optional().or(z.literal("")),
  postal_address: z.string().max(300).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  region: z.string().max(100).optional().or(z.literal("")),
  country: z.string().max(100).optional().default("Uganda"),
  website: z.string().url().optional().or(z.literal("")),

  // Business / regulatory
  business_registration_number: z.string().max(100).optional().or(z.literal("")),
  tax_number: z.string().max(100).optional().or(z.literal("")),
  tin: z.string().max(30).optional().or(z.literal("")),
  licence_number: z.string().max(100).optional().or(z.literal("")),
  licence_expiry_date: z.string().optional().or(z.literal("")),
  verification_status: z.enum(verificationStatuses).optional().default("Unverified"),
  verification_date: z.string().optional().or(z.literal("")),
  regulatory_notes: z.string().max(1000).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),

  // Commercial terms
  payment_terms: z.string().max(50).optional().default("30 Days"),
  credit_terms: z.string().max(100).optional().or(z.literal("")),
  credit_limit: z.number().min(0).optional().default(0),
  currency: z.enum(currencyOptions).optional().default("UGX"),
  default_discount: z.number().min(0).max(100).optional().default(0),
  tax_treatment: z.string().max(100).optional().or(z.literal("")),
  minimum_order_value: z.number().min(0).optional().default(0),
  minimum_order_quantity: z.number().int().min(0).optional().default(0),
  lead_time_days: z.number().int().min(0).optional().nullable(),
  delivery_terms: z.string().max(300).optional().or(z.literal("")),
  preferred_payment_method: z.enum(["CASH", "MOBILE_MONEY", "BANK", "CARD", "OTHER"]).optional().or(z.literal("")),
  account_reference: z.string().max(100).optional().or(z.literal("")),
  commercial_notes: z.string().max(1000).optional().or(z.literal("")),

  // Branches
  branch_ids: z.array(z.string().uuid()).optional().default([]),
});

export const supplierUpdateSchema = supplierSchema.partial();

export const supplierProductSchema = z.object({
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier_product_code: z.string().max(50).optional().or(z.literal("")),
  supplier_sku: z.string().max(50).optional().or(z.literal("")),
  supplier_price: z.number().min(0).optional().nullable(),
  current_price: z.number().min(0).optional().nullable(),
  is_preferred: z.boolean().optional().default(false),
  lead_time_days: z.number().int().min(0).optional().nullable(),
  minimum_order_quantity: z.number().int().min(0).optional().nullable(),
  pack_size: z.number().int().min(1).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;
export type SupplierProductInput = z.infer<typeof supplierProductSchema>;
