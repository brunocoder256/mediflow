import { z } from "zod/v4";
import { isValidDateOnly } from "@/lib/batch-expiry";

export const batchExpiryCorrectionSchema = z.object({
  batch_id: z.string().uuid(),
  // Optimistic concurrency: the expiry the user saw when opening the form.
  expected_expiry_date: z.string().refine(isValidDateOnly, "Current expiry date is invalid"),
  new_expiry_date: z
    .string()
    .refine(isValidDateOnly, "Enter a valid expiry date (YYYY-MM-DD)"),
  reason: z
    .string()
    .trim()
    .min(5, "A correction reason of at least 5 characters is required")
    .max(500, "Correction reason must be 500 characters or fewer"),
  operation_id: z.string().uuid(),
});

export type BatchExpiryCorrectionInput = z.infer<typeof batchExpiryCorrectionSchema>;
