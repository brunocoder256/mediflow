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
    })).min(1),
    notes: z.string().max(1000).optional().or(z.literal("")),
    expected_delivery_date: z.string().optional().or(z.literal("")),
    currency: z.string().max(10).optional(),
    payment_terms: z.string().max(100).optional(),
});

export const receivePurchaseSchema = z.object({
    purchase_order_id: z.string().uuid(),
    received_items: z.array(z.object({
        purchase_item_id: z.string().uuid(),
        product_id: z.string().uuid(),
        quantity_received: z.number().int().min(1),
        unit_cost: z.number().min(0),
        batch_number: z.string().min(1).max(50),
        expiry_date: z.string().min(1).refine((v) => !isNaN(new Date(v).getTime()), { message: "Invalid expiry date" }),
        supplier_id: z.string().uuid(),
        selling_price: z.number().min(0).optional(),
        manufacturing_date: z.string().optional(),
    })).min(1),
});

export const purchaseStatusSchema = z.object({
    purchase_order_id: z.string().uuid(),
    status: z.enum(['DRAFT','PENDING_APPROVAL','APPROVED','SENT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CLOSED','CANCELLED']),
});

export const purchaseAttachmentSchema = z.object({
    purchase_order_id: z.string().uuid(),
    goods_receipt_id: z.string().uuid().optional().nullable(),
    file_name: z.string().min(1).max(255),
    file_url: z.string().min(1).max(2000),
    file_size: z.number().int().min(0).optional(),
    mime_type: z.string().max(100).optional(),
    document_type: z.enum(['SUPPLIER_INVOICE','DELIVERY_NOTE','PURCHASE_ORDER','CREDIT_NOTE','OTHER']),
});

export const supplierPaymentSchema = z.object({
    supplier_id: z.string().uuid(),
    branch_id: z.string().uuid(),
    purchase_order_id: z.string().uuid().optional().nullable(),
    amount: z.number().min(0.01),
    payment_method: z.enum(['CASH','MOBILE_MONEY','CARD','BANK','OTHER']),
    reference: z.string().max(100).optional().or(z.literal("")),
    payment_date: z.string().optional(),
});

export const purchaseReturnSchema = z.object({
    purchase_order_id: z.string().uuid(),
    supplier_id: z.string().uuid(),
    branch_id: z.string().uuid(),
    reason: z.string().min(1).max(500),
    items: z.array(z.object({
        purchase_item_id: z.string().uuid(),
        product_id: z.string().uuid(),
        batch_id: z.string().uuid().optional().nullable(),
        quantity: z.number().int().min(1),
        unit_cost: z.number().min(0),
        reason: z.string().max(200).optional(),
    })).min(1),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
export type PurchaseStatusInput = z.infer<typeof purchaseStatusSchema>;
export type SupplierPaymentInput = z.infer<typeof supplierPaymentSchema>;
export type PurchaseReturnInput = z.infer<typeof purchaseReturnSchema>;
export type PurchaseAttachmentInput = z.infer<typeof purchaseAttachmentSchema>;
