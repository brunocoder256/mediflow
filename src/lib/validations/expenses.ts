import { z } from "zod/v4";

export const createExpenseSchema = z.object({
    branch_id: z.string().uuid(),
    category: z.string(),
    description: z.string().max(1000),
    amount: z.number().min(0.01),
    payment_method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK", "OTHER"]).optional(),
    expense_date: z.string().transform((v) => new Date(v)).refine((d) => !isNaN(d.getTime()), { message: "Invalid date" }),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
