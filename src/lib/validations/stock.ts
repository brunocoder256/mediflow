import { z } from "zod/v4";

export const createStockCountSchema = z.object({
    branch_id: z.string().uuid(),
    name: z.string().min(1, "Count name is required").max(200),
    scope_type: z.enum(["PRODUCT", "CATEGORY", "ALL"]).default("ALL"),
    scope_id: z.string().uuid().optional().or(z.literal("")),
});

export const countItemSchema = z.object({
    product_id: z.string().uuid(),
    batch_id: z.string().uuid().optional().or(z.literal("")),
    counted_quantity: z.number().int().min(0),
    reason: z.string().max(500).optional().or(z.literal("")),
});

export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;
export type CountItemInput = z.infer<typeof countItemSchema>;