import { z } from "zod/v4";

export const createPurchaseSchema = z.object({
    branch_id: z.string().uuid(),
    supplier_id: z.string().uuid(),
    items: z.array(z.object({
        product_id: z.string().uuid(),
        quantity_ordered: z.number().int().min(1),
        unit_cost: z.number().min(0),
        discount: z.number().min(0).default(0),
        tax: z.number().min(0).default(0),
    })),
    notes: z.string().max(1000).optional().or(z.literal("")),
});

export const receivePurchaseSchema = z.object({
    purchase_order_id: z.string().uuid(),
    received_items: z.array(z.object({
        purchase_item_id: z.string().uuid(),
        product_id: z.string().uuid(),
        quantity_received: z.number().int().min(1),
        unit_cost: z.number().min(0),
        batch_number: z.string().min(1).max(50),
        expiry_date: z.string().transform((v) => new Date(v)).refine((d) => !isNaN(d.getTime()), { message: "Invalid expiry date" }),
        supplier_id: z.string().uuid(),
    })),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
