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
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Waiting for approval</CardTitle>
            <CardDescription>
              Your application has been submitted to the MediFlow administrators.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="rounded-lg border bg-muted p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Your reference</p>
              <p className="mt-1 font-mono text-xl font-bold">{reference}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              One of our administrators will contact you to complete your registration
              (including your phone number). Once your account is approved, you will be able
              to sign in to your pharmacy.
            </p>
            <Button variant="outline" onClick={() => setReference(null)}>
              Submit another application
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your pharmacy account</CardTitle>
          <CardDescription>
            Apply to start using MediFlow for your drug shop or pharmacy
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