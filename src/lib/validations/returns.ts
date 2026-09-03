import { z } from "zod/v4";

export const createReturnSchema = z.object({
    sale_id: z.string().uuid(),
    branch_id: z.string().uuid(),
    items: z.array(z.object({
        sale_item_id: z.string().uuid(),
        product_id: z.string().uuid(),
        batch_id: z.string().uuid(),
        quantity: z.number().int().min(1),
        reason: z.enum(["DEFECTIVE", "EXPIRED", "WRONG_ITEM", "DAMAGED", "OTHER"]),
        return_condition: z.enum(["SELLABLE", "DAMAGED", "COMPROMISED", "EXPIRED"]).default("SELLABLE"),
    })),
    reason: z.string().max(500).optional().or(z.literal("")),
    refund_method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK", "OTHER"]).optional(),
});

export const createRefundSchema = z.object({
    sale_id: z.string().uuid(),
    return_id: z.string().uuid(),
    amount: z.number().min(0),
    payment_method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK", "OTHER"]),
    reference: z.string().max(100).optional().or(z.literal("")),
    reason: z.string().max(500).optional().or(z.literal("")),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
