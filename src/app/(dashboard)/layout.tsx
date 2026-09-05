import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTrialGate } from "@/lib/trial";
import { TrialBanner } from "@/components/layout/trial-banner";
import DashboardShell from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await getTrialGate();
  if (gate?.status === "trial_expired") {
    redirect("/trial-expired");
  }
  return (
    <DashboardShell>
      <Suspense fallback={null}>
        <TrialBanner gate={gate} />
      </Suspense>
      {children}
    </DashboardShell>
  );
}