"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registrationSchema, type RegistrationInput } from "@/lib/validations/auth";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toast";
import { Eye, EyeOff } from "lucide-react";

type Created = {
  reference: string;
  trial_ends_at: string;
  trial_days: number;
};

export default function SignupPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    mode: "onBlur",
  });

  async function onSubmit(data: RegistrationInput) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await res.json();
      if (!res.ok) {
        toast({
          title: "Account not created",
          description: j.error || "An unexpected error occurred. Please try again.",
          variant: "error",
        });
        return;
      }
      const reg = j.registration;
      setCreated({ reference: reg.reference, trial_ends_at: reg.trial_ends_at, trial_days: reg.trial_days ?? 3 });

      // Sign the owner in immediately so they land straight on their dashboard.
      const supabase = createBrowserClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.owner_email,
        password: data.password,
      });
      if (!signInErr) {
        toast({ title: "Welcome to MediFlow!", description: "Your 3-day free trial has started.", variant: "success" });
        setTimeout(() => window.location.assign("/dashboard"), 1200);
      } else {
        toast({ title: "Account created!", description: "Sign in with your new password to continue.", variant: "success" });
      }
    } catch {
      toast({
        title: "Something went wrong",
        description: "An unexpected error occurred. Please try again.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (created) {
    return (
      <>
        <Toaster />
        <div className="space-y-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
              </div>
              <CardTitle className="text-2xl">Your MediFlow account is ready</CardTitle>
              <CardDescription>
                Your {created.trial_days}-day free trial has started — your dashboard is loading.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Account reference</p>
                  <p className="mt-1 font-mono text-lg font-bold text-[var(--primary)]">{created.reference}</p>
                </div>
                <div className="rounded-lg border bg-muted p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Trial ends</p>
                  <p className="mt-1 font-semibold">{new Date(created.trial_ends_at).toLocaleDateString()}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                After the free trial you&apos;ll complete your <span className="font-semibold">UGX 20,000</span> monthly payment
                and a MediFlow administrator will activate your account permanently.
              </p>
              <Button onClick={() => window.location.assign("/dashboard")}>Go to Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your MediFlow account</CardTitle>
          <CardDescription>
            Get started with a <span className="font-semibold">3-day free trial</span> — no payment needed today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Pharmacy / Business name</Label>
              <Input
                id="business_name"
                type="text"
                placeholder="ABC Pharmacy"
                autoComplete="organization"
                disabled={isLoading}
                {...register("business_name")}
              />
              {errors.business_name && (
                <p className="text-sm text-[var(--destructive)]">{errors.business_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_type">Business type</Label>
              <Select id="business_type" disabled={isLoading} defaultValue="pharmacy" {...register("business_type")}>
                <option value="pharmacy">Pharmacy</option>
                <option value="drug_shop">Drug Shop</option>
                <option value="clinic">Clinic Pharmacy</option>
                <option value="wholesale">Wholesale / Distributor</option>
                <option value="">Other</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner_full_name">Owner / Administrator name</Label>
              <Input
                id="owner_full_name"
                type="text"
                placeholder="John Doe"
                autoComplete="name"
                disabled={isLoading}
                {...register("owner_full_name")}
              />
              {errors.owner_full_name && (
                <p className="text-sm text-[var(--destructive)]">{errors.owner_full_name.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner_email">Email</Label>
                <Input
                  id="owner_email"
                  type="email"
                  placeholder="owner@example.com"
                  autoComplete="email"
                  disabled={isLoading}
                  {...register("owner_email")}
                />
                {errors.owner_email && (
                  <p className="text-sm text-[var(--destructive)]">{errors.owner_email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner_phone">Phone number</Label>
                <Input
                  id="owner_phone"
                  type="tel"
                  placeholder="+256 700 000 000"
                  autoComplete="tel"
                  disabled={isLoading}
                  {...register("owner_phone")}
                />
                {errors.owner_phone && (
                  <p className="text-sm text-[var(--destructive)]">{errors.owner_phone.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location / Address</Label>
              <Input
                id="location"
                type="text"
                placeholder="Plot 123, Kampala Road"
                autoComplete="street-address"
                disabled={isLoading}
                {...register("location")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 chars, A-z, 0-9"
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-[var(--destructive)]">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-type your password"
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="pr-10"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-[var(--destructive)]">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating your account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-[var(--primary)] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}