import { z } from 'zod/v4';
export const customerTypes = ['INDIVIDUAL','WALK_IN','CORPORATE','CLINIC','HOSPITAL','ORGANIZATION','INSURANCE','OTHER'] as const;
export const customerStatuses = ['ACTIVE','INACTIVE','BLOCKED'] as const;
export const createCustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  display_name: z.string().max(100).optional(),
  company_name: z.string().max(100).optional(),
  first_name: z.string().max(50).optional().nullable(),
  middle_name: z.string().max(50).optional().nullable(),
  last_name: z.string().max(50).optional().nullable(),
  customer_type: z.enum(customerTypes).optional(),
  phone: z.string().max(20).optional().nullable(),
  alternate_phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(50).optional().nullable(),
  branch_id: z.string().uuid().optional().nullable().or(z.literal('')),
  external_reference: z.string().max(50).optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  credit_limit: z.coerce.number().min(0).optional(),
  payment_terms: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  preferred_contact: z.string().optional().nullable(),
  sms_opt_in: z.boolean().optional(),
  email_opt_in: z.boolean().optional(),
  marketing_opt_in: z.boolean().optional(),
  contact_person: z.string().max(100).optional().nullable(),
}).refine(d=> !!(d.name || d.display_name || d.company_name), { message:'Name or company required', path:['name'] });
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
