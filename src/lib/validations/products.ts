import { z } from "zod/v4";

// Controlled vocabularies
export const productTypes = [
  "Human Medicine",
  "Medical Device",
  "Diagnostic / Test Product",
  "Personal Care",
  "Hygiene & Sanitation",
  "First Aid",
  "Nutrition & Wellness",
  "Baby & Maternal Care",
  "Other Pharmacy Product",
] as const;

export const dosageForms = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Oral Liquid",
  "Suspension",
  "Cream",
  "Ointment",
  "Gel",
  "Lotion",
  "Drops",
  "Inhaled Product",
  "Injectable",
  "Suppository",
  "Powder",
  "Sachet",
  "Medical Device",
  "Other",
] as const;

export const strengthUnits = ["mg", "g", "mcg", "ml", "IU", "%", "mg/ml", "units"] as const;
export const routes = ["Oral", "Topical", "Ophthalmic", "Otic", "Nasal", "Inhalation", "Injection", "Rectal", "Vaginal", "Other"] as const;
export const classifications = ["OTC", "Prescription", "Controlled", "Herbal", "Supplement"] as const;
export const taxCategories = ["standard", "zero", "exempt"] as const;

export const productSchema = z.object({
    // Step 1 Identity
    name: z.string().min(1, "Product name is required").max(200),
    generic_name: z.string().max(200).optional().or(z.literal("")),
    brand_name: z.string().max(200).optional().or(z.literal("")),
    sku: z.string().max(50).optional().or(z.literal("")),
    barcode: z.string().max(50).optional().or(z.literal("")),
    product_type: z.enum(productTypes).optional().default("Human Medicine"),
    category_id: z.string().uuid().optional().or(z.literal("")),
    unit_id: z.string().uuid().optional().or(z.literal("")),
    description: z.string().max(1000).optional().or(z.literal("")),
    image_url: z.string().url().optional().or(z.literal("")),
    alternative_names: z.string().max(300).optional().or(z.literal("")),

    // Step 2 Pharma
    strength: z.string().max(50).optional().or(z.literal("")),
    strength_unit: z.enum(strengthUnits).optional().or(z.literal("")),
    dosage_form: z.enum(dosageForms).optional().or(z.literal("")),
    route: z.enum(routes).optional().or(z.literal("")),
    pack_size: z.number().int().min(1).optional().or(z.literal("")),
    units_per_pack: z.number().int().min(1).optional().or(z.literal("")),
    manufacturer: z.string().max(150).optional().or(z.literal("")),
    country_of_origin: z.string().max(100).optional().or(z.literal("")),
    registration_number: z.string().max(100).optional().or(z.literal("")),
    classification: z.enum(classifications).optional().default("OTC"),

    // Step 3 Inventory
    reorder_level: z.number().int().min(0).default(0),
    min_stock: z.number().int().min(0).optional().default(0),
    max_stock: z.number().int().min(0).optional().nullable(),
    reorder_quantity: z.number().int().min(0).optional().nullable(),
    storage_location: z.string().max(100).optional().or(z.literal("")),
    shelf: z.string().max(50).optional().or(z.literal("")),
    rack: z.string().max(50).optional().or(z.literal("")),
    bin: z.string().max(50).optional().or(z.literal("")),
    track_batch: z.boolean().optional().default(true),
    track_expiry: z.boolean().optional().default(true),
    fefo_enabled: z.boolean().optional().default(true),
    allow_negative_stock: z.boolean().optional().default(false),

    // Step 4 Pricing
    default_purchase_cost: z.number().min(0).optional().nullable(),
    default_selling_price: z.number().min(0).optional().nullable(),
    min_selling_price: z.number().min(0).optional().nullable(),
    tax_category: z.enum(taxCategories).optional().default("standard"),
    tax_inclusive: z.boolean().optional().default(false),

    // Step 5 Supplier
    preferred_supplier_id: z.string().uuid().optional().or(z.literal("")),
});

export const productUpdateSchema = productSchema.partial();

export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const productSupplierSchema = z.object({
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier_product_code: z.string().max(50).optional().or(z.literal("")),
  last_purchase_price: z.number().min(0).optional().nullable(),
  is_preferred: z.boolean().optional().default(false),
  lead_time_days: z.number().int().min(0).optional().nullable(),
  minimum_order_quantity: z.number().int().min(0).optional().nullable(),
});
export type ProductSupplierInput = z.infer<typeof productSupplierSchema>;

export const batchSchema = z.object({
    batch_number: z.string().min(1, "Batch number is required").max(50),
    expiry_date: z.string().transform((v) => new Date(v)).refine((d) => !isNaN(d.getTime()), { message: "Invalid expiry date" }),
    purchase_price: z.number().min(0, "Purchase price must be >= 0"),
    selling_price: z.number().min(0, "Selling price must be >= 0"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    received_at: z.string().transform((v) => new Date(v)).refine((d) => !isNaN(d.getTime()), { message: "Invalid date" }).optional().or(z.literal("")),
    supplier_id: z.string().uuid().optional().or(z.literal("")),
});

export const batchUpdateSchema = batchSchema.partial();

export type BatchInput = z.infer<typeof batchSchema>;
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;

export const importRowSchema = z.object({
  name: z.string().min(1),
  generic_name: z.string().optional().or(z.literal("")),
  brand_name: z.string().optional().or(z.literal("")),
  sku: z.string().optional().or(z.literal("")),
  barcode: z.string().optional().or(z.literal("")),
  product_type: z.string().optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  dosage_form: z.string().optional().or(z.literal("")),
  strength: z.string().optional().or(z.literal("")),
  strength_unit: z.string().optional().or(z.literal("")),
  pack_size: z.string().optional().or(z.literal("")),
  manufacturer: z.string().optional().or(z.literal("")),
  reorder_level: z.string().optional().or(z.literal("")),
  min_stock: z.string().optional().or(z.literal("")),
  max_stock: z.string().optional().or(z.literal("")),
  selling_price: z.string().optional().or(z.literal("")),
  purchase_cost: z.string().optional().or(z.literal("")),
  supplier: z.string().optional().or(z.literal("")),
  tax_category: z.string().optional().or(z.literal("")),
});
