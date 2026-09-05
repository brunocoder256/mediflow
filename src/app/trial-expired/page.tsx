"use client";

import * as React from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Hourglass, Phone, LogOut, RefreshCw, Loader2 } from "lucide-react";

type Gate = {
  organization_id: string | null;
  organization_name: string | null;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  trial_days: number;
  contact_phone_1: string;
  contact_phone_2: string;
};

export default function TrialExpiredPage() {
  const [gate, setGate] = React.useState<Gate | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [signingOut, setSigningOut] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/trial");
      const j = await r.json();
      if (!j?.status) return;
      setGate(j as Gate);
    } catch {
      /* keep last state */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    // Keep listening for the Super Admin's approval while this screen is open —
    // the moment the account is activated the app reloads on its own.
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  // Auto-reload the account the instant the Super Admin approves it.
  React.useEffect(() => {
    if (gate?.status === "active") {
      window.location.assign("/dashboard");
    }
  }, [gate]);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/auth/login");
  };

  const recheck = async () => {
    const supabase = createBrowserClient();
    const { data } = await (supabase as any).rpc("get_my_trial_status");
    if (data && data.status === "active") {
      window.location.assign("/dashboard");
    } else {
      await load();
    }
  };

  const awaitingApproval = gate?.status === "trial_expired";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Hourglass className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">{awaitingApproval ? "Free trial ended" : "Access paused"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {gate?.organization_name ?? "This account"}&apos;s 3-day free trial has ended.
          </p>

          <div className="mt-5 rounded-md border bg-muted/20 p-4 text-left text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground">
              {awaitingApproval && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
              Status:
              <span className="text-amber-600">
                {awaitingApproval ? "Waiting for approval" : "Suspended"}
              </span>
            </p>
            <p className="mt-2 text-muted-foreground">
              {awaitingApproval ? (
                <>
                  To keep using MediFlow, finish your monthly payment with MediFlow and the MediFlow
                  administrators will activate your account. Your dashboard will{" "}
                  <span className="font-medium text-foreground">reload automatically</span> as soon as your
                  account is approved.
                </>
              ) : (
                "Your account is not currently active. Contact MediFlow administrators to reactivate it."
              )}
            </p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center gap-3 font-medium">
                <Phone className="h-4 w-4 text-primary" />
                <a href={`tel:${gate?.contact_phone_1 ?? "0759327843"}`} className="hover:underline">
                  {gate?.contact_phone_1 ?? "0759327843"}
                </a>
              </li>
              <li className="flex items-center gap-3 font-medium">
                <Phone className="h-4 w-4 text-primary" />
                <a href={`tel:${gate?.contact_phone_2 ?? "0768082948"}`} className="hover:underline">
                  {gate?.contact_phone_2 ?? "0768082948"}
                </a>
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">MediFlow · Pharmacy Management System · UGX 20,000/month</p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button variant="outline" onClick={recheck} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" /> Check again
            </Button>
            <Button variant="ghost" onClick={signOut} disabled={signingOut}>
              <LogOut className="h-4 w-4 mr-2" /> {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}