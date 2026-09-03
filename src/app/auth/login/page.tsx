"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

function safeRedirect(path: string | null, fallback: string = "/dashboard"): string {
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (/^[a-zA-Z]+:/.test(path)) return fallback;
  return path;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"), "/dashboard");
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
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
        variant: "success",
      });

      router.push(redirectTo);
      router.refresh();
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

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Sign in to MediFlow</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isLoading}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-[var(--destructive)]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-[var(--primary)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isLoading}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-[var(--destructive)]">
                {errors.password.message}
              </p>
            )}
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

        <div className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-[var(--primary)] hover:underline"
          >
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <>
      <Toaster />
      <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" /></div>}>
        <LoginForm />
      </Suspense>
    </>
  );
}
