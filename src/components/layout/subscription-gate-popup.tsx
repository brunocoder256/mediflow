"use client";

import * as React from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Phone, Hourglass, X, LogOut, Loader2, Ban } from "lucide-react";
import type { TrialGate } from "@/lib/trial-utils";

/**
 * Subscription / trial gate popup.
 *
 * When the signed-in owner's account is blocked (trial or paid window expired,
 * or account suspended), a dismissible popup is shown on top of the dashboard
 * reminding them to complete the monthly payment with MediFlow and that admin
 * approval is pending. The user can close it, but it reappears after 1 minute
 * until the account is re-activated. The popup polls every 8s and reloads the
 * app automatically the moment the Super Admin approves. Data itself is already
 * refused server-side (non-active organizations fail all data APIs), so any
 * page action surfaces "unable to load data — subscription over".
 */
export function SubscriptionGatePopup({ gate }: { gate: TrialGate | null }) {
  const [dismissed, setDismissed] = React.useState(false);
  const [live, setLive] = React.useState<TrialGate | null>(gate);
  const [signingOut, setSigningOut] = React.useState(false);
  const gateRef = React.useRef(gate);
  gateRef.current = gate;

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/trial");
      const j = await r.json();
      if (j?.status) setLive(j as TrialGate);
    } catch {
      /* keep last state */
    }
  }, []);

  // 8s poll for the Super Admin's approval.
  React.useEffect(() => {
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  // Re-show the popup 1 minute after it was dismissed (if still blocked).
  React.useEffect(() => {
    if (!dismissed) return;
    const t = setTimeout(() => setDismissed(false), 60_000);
    return () => clearTimeout(t);
  }, [dismissed]);

  // Reload to the freshly-approved dashboard the instant the account unblocks.
  const effective = live ?? gateRef.current;
  React.useEffect(() => {
    if (effective && !effective.blocked && effective.status === "active") {
      window.location.reload();
    }
  }, [effective]);

  if (!effective?.blocked) return null;

  const waitingApproval = effective.reason === "subscription_over";

  const signOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
    } catch {
      /* noop */
    } finally {
      window.location.assign("/auth/login");
    }
  };

  return (
    <>
      {/* Persistent top strip: expresses the data-access state even when the
          popup is dismissed. */}
      <div className="sticky top-0 z-40 w-full border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
        {waitingApproval ? (
          <>
            Unable to load data — <span className="font-semibold">subscription over</span>. To keep working, complete
            your UGX 20,000/month payment with MediFlow.{" "}
            <a href={`tel:${effective.contact_phone_1 ?? "0759327843"}`} className="font-semibold underline">
              {effective.contact_phone_1 ?? "0759327843"}
            </a>
          </>
        ) : (
          <>
            Unable to load data — account <span className="font-semibold">{effective.status}</span>. Contact MediFlow to
            reactivate.
          </>
        )}
      </div>

      {!dismissed && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border bg-background p-6 text-center shadow-xl">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          {waitingApproval ? <Hourglass className="h-7 w-7" /> : <Ban className="h-7 w-7" />}
        </div>

        <h2 className="mt-4 text-xl font-bold">
          {waitingApproval ? "Your subscription is over" : "Access paused"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {effective.organization_name ?? "This account"} can&apos;t access data until the subscription is renewed.
          To keep working, complete your <span className="font-semibold">UGX 20,000/month</span> payment with
          MediFlow.
        </p>

        <div className="mt-5 rounded-md border bg-muted/20 p-4 text-left text-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">
            {waitingApproval && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
            Status:
            <span className="text-amber-600">{waitingApproval ? "Waiting for approval" : "Account suspended"}</span>
          </p>
          <p className="mt-2 text-muted-foreground">
            {waitingApproval ? (
              <>
                Your payment is with the MediFlow administrators. Your dashboard will{" "}
                <span className="font-medium text-foreground">reload automatically</span> the moment it&apos;s approved.
                Until then, your data can&apos;t be loaded (subscription over).
              </>
            ) : (
              "Your account is not active. Contact MediFlow administrators to reactivate it."
            )}
          </p>
          <ul className="mt-3 space-y-2">
            <li className="flex items-center gap-3 font-medium">
              <Phone className="h-4 w-4 text-primary" />
              <a href={`tel:${effective.contact_phone_1 ?? "0759327843"}`} className="hover:underline">
                {effective.contact_phone_1 ?? "0759327843"}
              </a>
            </li>
            <li className="flex items-center gap-3 font-medium">
              <Phone className="h-4 w-4 text-primary" />
              <a href={`tel:${effective.contact_phone_2 ?? "0768082948"}`} className="hover:underline">
                {effective.contact_phone_2 ?? "0768082948"}
              </a>
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button variant="outline" onClick={load}>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking for approval…
          </Button>
          <Button variant="ghost" onClick={signOut} disabled={signingOut}>
            <LogOut className="mr-2 h-4 w-4" /> {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          This reminder will return in a minute until your account is approved.
        </p>
      </div>
        </div>
      )}
    </>
  );
}
