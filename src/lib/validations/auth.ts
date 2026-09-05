import { z } from "zod/v4";

export const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z
  .object({
    full_name: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name is too long"),
    email: z.email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .max(128, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .check((ctx) => {
    if (ctx.value.password !== ctx.value.confirmPassword) {
      ctx.issues.push({
        message: "Passwords do not match",
        path: ["confirmPassword"],
        code: "custom",
        input: ctx.value,
      });
    }
  });

export const forgotPasswordSchema = z.object({
  email: z.email("Please enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .check((ctx) => {
    if (ctx.value.password !== ctx.value.confirmPassword) {
      ctx.issues.push({
        message: "Passwords do not match",
        path: ["confirmPassword"],
        code: "custom",
        input: ctx.value,
      });
    }
  });

export const registrationSchema = z.object({
  business_name: z
    .string()
    .min(2, "Business name is required")
    .max(200, "Business name is too long"),
  business_type: z.string().max(80, "Business type is too long").optional().or(z.literal("")),
  owner_full_name: z
    .string()
    .min(2, "Owner full name is required")
    .max(120, "Owner full name is too long"),
  owner_email: z.email("Please enter a valid email address"),
  owner_phone: z
    .string()
    .min(7, "Phone number is required")
    .max(30, "Phone number is too long"),
  location: z.string().max(200, "Location is too long").optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
