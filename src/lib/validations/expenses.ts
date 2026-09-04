import { z } from "zod/v4";

export const createExpenseSchema = z.object({
    branch_id: z.string().uuid(),
    category: z.string().min(1).optional(),
    category_id: z.string().uuid().optional().nullable(),
    subcategory_id: z.string().uuid().optional().nullable(),
    supplier_id: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).min(1),
    reference_number: z.string().max(100).optional().nullable().or(z.literal("")),
    notes: z.string().max(2000).optional().nullable().or(z.literal("")),
    amount: z.number().min(0.01),
    tax_amount: z.number().min(0).default(0),
    tax_inclusive: z.boolean().optional().default(false),
    currency: z.string().max(10).optional().default("UGX"),
    exchange_rate: z.number().min(0).optional().default(1),
    payment_method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK", "PETTY_CASH", "OTHER"]).optional().default("CASH"),
    payment_account_id: z.string().uuid().optional().nullable(),
    expense_date: z.string().min(1).refine((v) => !isNaN(new Date(v).getTime()), { message: "Invalid date" }),
    lines: z.array(z.object({
        category_id: z.string().uuid().optional().nullable(),
        description: z.string().max(500).optional().or(z.literal("")),
        amount: z.number().min(0.01),
        tax_amount: z.number().min(0).default(0),
    })).optional(),
    idempotency_key: z.string().max(100).optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial().extend({
    id: z.string().uuid().optional(),
});

export const expenseActionSchema = z.object({
    id: z.string().uuid(),
    action: z.enum(["submit","approve","reject","pay","post","cancel","reverse","reopen"]),
    reason: z.string().max(500).optional(),
    payment_account_id: z.string().uuid().optional().nullable(),
    payment_method: z.enum(["CASH","MOBILE_MONEY","CARD","BANK","PETTY_CASH","OTHER"]).optional(),
    reversal_reason: z.string().max(500).optional(),
});

export const expenseCategorySchema = z.object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(50),
    parent_id: z.string().uuid().optional().nullable(),
    account_mapping: z.string().max(100).optional().nullable().or(z.literal("")),
    tax_treatment: z.string().max(100).optional().nullable().or(z.literal("")),
    is_active: z.boolean().optional().default(true),
    branch_id: z.string().uuid().optional().nullable(),
    description: z.string().max(500).optional().nullable().or(z.literal("")),
});

export const expenseAttachmentSchema = z.object({
    expense_id: z.string().uuid(),
    file_name: z.string().min(1).max(255),
    file_url: z.string().min(1).max(2000),
    file_size: z.number().int().min(0).optional(),
    mime_type: z.string().max(100).optional(),
    document_type: z.enum(["RECEIPT","INVOICE","PHOTO","PDF","OTHER"]).default("RECEIPT"),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseActionInput = z.infer<typeof expenseActionSchema>;
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
export type ExpenseAttachmentInput = z.infer<typeof expenseAttachmentSchema>;
