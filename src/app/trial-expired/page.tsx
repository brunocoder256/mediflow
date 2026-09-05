"use client";

import * as React from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Hourglass, Phone, LogOut, RefreshCw } from "lucide-react";

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
      setGate(j ?? null);
    } catch {
      setGate(null);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/auth/login");
  };

  // If a re-check finds the account has been re-activated, send them to the app.
  const recheck = async () => {
    const supabase = createBrowserClient();
    const { data } = await (supabase as any).rpc("get_my_trial_status");
    if (data && data.status === "active") {
      window.location.assign("/dashboard");
    } else {
      await load();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Hourglass className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Trial period ended</h1>
          <p className="mt-2 text-sm text-muted-foreground">{gate?.organization_name ?? "This account"}&apos;s 3-day free trial has ended.</p>

          <div className="mt-5 rounded-md border bg-muted/20 p-4 text-left text-sm">
            <p className="font-medium text-foreground">
              Status: <span className="text-amber-600">Waiting for admin approval</span>
            </p>
            <p className="mt-2 text-muted-foreground">
              To continue using MediFlow, kindly contact us to activate your account:
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
            <p className="mt-3 text-xs text-muted-foreground">MediFlow · Pharmacy Management System</p>
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