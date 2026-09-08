"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserClient } from "@/lib/supabase/client";
import { performLogout } from "@/lib/logout";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import {
  hasPasscode,
  setPasscode as configurePasscode,
  verifyPasscode,
  authorizeOfflineSession,
  storeReauthToken,
} from "@/lib/passcode";
import { readUserContext } from "@/lib/offline/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toast";
import {
  Eye,
  EyeOff,
  WifiOff,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

function safeRedirect(path: string | null, fallback: string = "/dashboard"): string {
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (/^[a-zA-Z]+:/.test(path)) return fallback;
  return path;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"), "/dashboard");
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [offline, setOffline] = useState(false);

  // Passcode mode
  const [offlineReady, setOfflineReady] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeLoading, setPasscodeLoading] = useState(false);

  // Passcode setup (prompted after a successful online login)
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupCode, setSetupCode] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);
  const [pendingSetup, setPendingSetup] = useState<{
    email: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    const update = () => {
      const off = typeof navigator !== "undefined" && !navigator.onLine;
      setOffline(off);
      // Show passcode access whenever a passcode + cached context exist.
      setOfflineReady(hasPasscode() && !!readUserContext());
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function setupPasscode() {
    if (!/^\d{4}$/.test(setupCode)) {
      toast({ title: "Invalid passcode", description: "Use exactly 4 digits.", variant: "error" });
      return;
    }
    if (setupCode !== setupConfirm) {
      toast({ title: "Passcodes don’t match", variant: "error" });
      return;
    }
    if (!pendingSetup) return;
    setSetupSaving(true);
    const res = await configurePasscode(pendingSetup.email, pendingSetup.password, setupCode);
    setSetupSaving(false);
    if (!res.ok) {
      toast({ title: "Couldn’t save passcode", description: res.error, variant: "error" });
      return;
    }
    toast({ title: "Passcode saved", description: "You can now sign in offline with your 4-digit passcode." });
    setSetupOpen(false);
    setSetupCode("");
    setSetupConfirm("");
    setPendingSetup(null);
    setOfflineReady(true);
  }

  async function handlePasscodeSignIn() {
    if (!/^\d{4}$/.test(passcode)) {
      toast({ title: "Enter your 4-digit passcode", variant: "error" });
      return;
    }
    setPasscodeLoading(true);
    const res = await verifyPasscode(passcode);
    setPasscodeLoading(false);
    if (!res.ok) {
      toast({ title: "Passcode rejected", description: res.error, variant: "error" });
      setPasscode("");
      return;
    }
    // Authorize the offline session so middleware lets the app shell through.
    authorizeOfflineSession();
    toast({ title: "Welcome back", description: "Signed in offline with passcode." });
    window.location.assign(redirectTo);
  }

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        // Record the failed attempt for account lockout (best-effort; never breaks login)
        try {
          await (supabase as any).rpc("record_failed_login", { p_email: data.email });
        } catch {
          /* non-blocking */
        }
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "error",
        });
        return;
      }

      // Clear any prior failed-attempt/lock state on a successful login
      try {
        await (supabase as any).rpc("clear_failed_login", { p_email: data.email });
      } catch {
        /* non-blocking */
      }

      // Verify session was actually persisted (cookie via @supabase/ssr)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session && !signInData.session) {
        toast({
          title: "Sign in failed",
          description: "No session was created. Check your credentials or project URL/key and try again.",
          variant: "error",
        });
        return;
      }

      // Persist the refresh token (bound to this user) so the app can silently
      // restore a REAL server session when this device comes back online after
      // an offline passcode session.
      const liveSession = session ?? signInData.session;
      if (liveSession?.refresh_token) {
        storeReauthToken(liveSession.refresh_token, data.email);
      }

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
        variant: "success",
      });

      // Super Admin accounts go straight to the administration panel
      const { data: isAdmin } = await (supabase as any).rpc("is_super_admin");
      if (isAdmin === true) {
        window.location.assign("/super-admin/accounts");
        return;
      }

      // Client accounts are gated by organization status.
      // Trial-expired / suspended owners stay signed in so they land on the
      // dashboard where a dismissible subscription popup explains how to
      // complete payment (instead of being logged out).
      const { data: trial } = await (supabase as any).rpc("get_my_access_status");
      if (trial && trial.status !== "active") {
        if (trial.reason === "subscription_over" || trial.blocked === true) {
          window.location.assign("/dashboard");
          return;
        }
        await performLogout();
        toast({
          title: "Account not accessible",
          description:
            trial.status === "none"
              ? "This account has no organization. Contact MediFlow IQ administration."
              : `Your organization's account is ${trial.status}. Contact MediFlow IQ administration.`,
          variant: "error",
        });
        return;
      }

      // Offer offline passcode setup so the user can sign in without a connection.
      // Only show when a passcode isn't already configured for this device.
      if (!hasPasscode()) {
        setPendingSetup({ email: data.email.trim().toLowerCase(), password: data.password });
        setSetupOpen(true);
        return;
      }

      // Use hard navigation so middleware (edge) sees the fresh sb-* cookies
      // on a full request. router.push + refresh is flaky with @supabase/ssr.
      window.location.assign(redirectTo);
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
        {offline && offlineReady && (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-teal-300/60 bg-teal-50 px-3 py-2 text-left text-xs text-teal-900">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              You&apos;re offline but can sign in with your passcode. Your saved work is
              safe and will sync when you&apos;re back online.
            </span>
          </div>
        )}
        {offline && !offlineReady && (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900">
            <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              You&apos;re offline. Normal sign-in needs an internet connection. Work saved
              on this device is safe and will sync when you&apos;re back online.
            </span>
          </div>
        )}
        <CardTitle className="text-2xl">Sign in to MediFlow IQ</CardTitle>
        <CardDescription>
          {offline && offlineReady
            ? "Enter your passcode to access your account offline"
            : "Enter your credentials to access your account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {offline && offlineReady ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passcode">Offline passcode</Label>
              <Input
                id="passcode"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                placeholder="••••"
                value={passcode}
                disabled={passcodeLoading}
                onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-center text-2xl tracking-[0.5em]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePasscodeSignIn();
                }}
              />
            </div>
            <Button className="w-full" disabled={passcodeLoading || passcode.length !== 4} onClick={handlePasscodeSignIn}>
              {passcodeLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Verifying...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Sign in with passcode
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={() => setOfflineReady(false)}
              className="w-full text-center text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Use email &amp; password instead
            </button>
          </div>
        ) : (
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-0.5"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
        )}

        {/* Passcode shortcut when online but a passcode is configured */}
        {!offline && !offlineReady && hasPasscode() && (
          <div className="mt-4 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setOfflineReady(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
            >
              <KeyRound className="h-4 w-4" />
              Sign in with passcode
            </button>
          </div>
        )}

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

      {/* Passcode setup modal */}
      <Dialog open={setupOpen} onOpenChange={(o) => { setSetupOpen(o); if (!o) { setPendingSetup(null); window.location.assign(redirectTo); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
              Set your offline passcode
            </DialogTitle>
            <DialogDescription>
              Create a 4-digit passcode so you can sign in and keep working even when
              you have no internet connection. It&apos;s stored securely on this device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Passcode (4 digits)</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-center text-2xl tracking-[0.4em]"
              />
            </div>
            <div className="space-y-1">
              <Label>Confirm passcode</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-center text-2xl tracking-[0.4em]"
                onKeyDown={(e) => { if (e.key === "Enter") setupPasscode(); }}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSetupOpen(false)}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
              >
                Skip
              </button>
              <Button
                className="flex-1"
                disabled={setupSaving || setupCode.length !== 4 || setupConfirm.length !== 4}
                onClick={setupPasscode}
              >
                {setupSaving ? "Saving..." : "Set passcode"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
