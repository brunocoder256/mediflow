import { Suspense } from "react";
import { getTrialGate } from "@/lib/trial";
import { TrialBanner } from "@/components/layout/trial-banner";
import { SubscriptionGatePopup } from "@/components/layout/subscription-gate-popup";
import DashboardShell from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await getTrialGate();
  // Keep the owner signed in and on the dashboard, but gate data access with
  // a dismissible popup (data APIs already refuse non-active organizations).
  return (
    <DashboardShell>
      <Suspense fallback={null}>
        {gate?.blocked ? <SubscriptionGatePopup gate={gate} /> : <TrialBanner gate={gate} />}
      </Suspense>
      {children}
    </DashboardShell>
  );
}