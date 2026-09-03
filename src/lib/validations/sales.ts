import { z } from "zod/v4";

export const createSaleSchema = z.object({
    branch_id: z.string().uuid(),
    customer_id: z.string().uuid().optional().or(z.literal("")),
    items: z.array(z.object({
        product_id: z.string().uuid(),
        batch_id: z.string().uuid(),
        quantity: z.number().int().min(1),
        unit_price: z.number().min(0),
        discount: z.number().min(0).default(0),
        tax: z.number().min(0).default(0),
    })),
    discount: z.number().min(0).default(0),
    tax_rate: z.number().min(0).max(100).default(0),
    payment_method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK", "OTHER"]),
    payment_amount: z.number().min(0),
    operation_id: z.string().uuid().optional(),
});

export const createSaleItemSchema = z.object({
    product_id: z.string().uuid(),
    batch_id: z.string().uuid(),
    quantity: z.number().int().min(1),
    unit_price: z.number().min(0),
    discount: z.number().min(0).default(0),
    tax: z.number().min(0).default(0),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreateSaleItemInput = z.infer<typeof createSaleItemSchema>;

export const holdSaleSchema = z.object({
    branch_id: z.string().uuid(),
    customer_id: z.string().uuid().optional().or(z.literal("")),
    items: z.array(z.object({
        product_id: z.string().uuid(),
        batch_id: z.string().uuid(),
        quantity: z.number().int().min(1),
        unit_price: z.number().min(0),
        discount: z.number().min(0).default(0),
        tax: z.number().min(0).default(0),
    })),
    discount: z.number().min(0).default(0),
    tax_rate: z.number().min(0).max(100).default(0),
});
