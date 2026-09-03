import { z } from "zod/v4";

export const productSchema = z.object({
    name: z.string().min(1, "Product name is required").max(200),
    generic_name: z.string().max(200).optional().or(z.literal("")),
    brand_name: z.string().max(200).optional().or(z.literal("")),
    sku: z.string().max(50).optional().or(z.literal("")),
    barcode: z.string().max(50).optional().or(z.literal("")),
    category_id: z.string().uuid().optional().or(z.literal("")),
    unit_id: z.string().uuid().optional().or(z.literal("")),
    description: z.string().max(1000).optional().or(z.literal("")),
    reorder_level: z.number().int().min(0).default(0),
});

export const productUpdateSchema = productSchema.partial();

export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

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
