"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registrationSchema, type RegistrationInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toast";

export default function SignupPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
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
          title: "Application not submitted",
          description: j.error || "An unexpected error occurred. Please try again.",
          variant: "error",
        });
        return;
      }
      setReference(j.registration?.reference ?? null);
      toast({
        title: "Application submitted!",
        description: "The MediFlow team will review your application.",
        variant: "success",
      });
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

  if (reference) {
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
              <CardTitle className="text-2xl">Registration received</CardTitle>
              <CardDescription>
                Your MediFlow account has been created successfully.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="rounded-lg border bg-muted p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Your account reference</p>
                <p className="mt-1 font-mono text-2xl font-bold text-[var(--primary)]">{reference}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Your account status</p>
                <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse-soft" />
                  Pending Payment &amp; Approval
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Complete your UGX 20,000 monthly payment and submit your payment reference. A MediFlow
                administrator will review your registration and activate your account.
              </p>
              <Button variant="outline" onClick={() => setReference(null)}>
                Submit another application
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">MediFlow Monthly Access</CardTitle>
              <CardDescription>
                <span className="text-lg font-bold text-foreground">UGX 20,000</span>
                <span className="text-muted-foreground"> / month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Pay securely via mobile money or bank, then call or message the MediFlow team with your payment
                reference to complete activation.
              </p>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Call to confirm payment</p>
                <p className="mt-1 font-semibold">
                  <a href="tel:0759327843" className="text-[var(--primary)] hover:underline">0759 327 843</a>
                  {" · "}
                  <a href="tel:0768082948" className="text-[var(--primary)] hover:underline">0768 082 948</a>
                </p>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Quote your account reference <span className="font-mono font-semibold">{reference}</span> when
                you confirm your payment.
              </p>
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
            Get started with MediFlow for your pharmacy. Your account will be reviewed and activated
            after payment confirmation.
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Submitting...
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