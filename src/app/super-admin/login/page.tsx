"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toast";

function SuperAdminLogin() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) {
        toast({ title: "Sign in failed", description: error.message, variant: "error" });
        return;
      }

      const { data: isAdmin } = await (supabase as any).rpc("is_super_admin");
      if (isAdmin !== true) {
        await supabase.auth.signOut();
        toast({
          title: "Access denied",
          description: "This account is not authorized to use the Admin panel.",
          variant: "error",
        });
        return;
      }

      toast({ title: "Welcome back!", description: "Signed in to the Admin panel.", variant: "success" });
      window.location.assign("/super-admin/accounts");
    } catch {
      toast({ title: "Something went wrong", description: "An unexpected error occurred.", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white px-4 py-12 dark:from-gray-900 dark:to-gray-950">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <h1 className="text-3xl font-bold tracking-tight text-teal-600 dark:text-teal-400">MediFlow</h1>
        </Link>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Administration</p>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Super Admin Access</CardTitle>
          <CardDescription>Manage MediFlow client accounts and access</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@mediflow.com"
                autoComplete="email"
                disabled={isLoading}
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-[var(--destructive)]">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
                {...register("password")}
              />
              {errors.password && <p className="text-sm text-[var(--destructive)]">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-8 text-center text-xs text-[var(--muted-foreground)]">
        &copy; {new Date().getFullYear()} MediFlow. All rights reserved.
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <Toaster />
      <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" /></div>}>
        <SuperAdminLogin />
      </Suspense>
    </>
  );
}