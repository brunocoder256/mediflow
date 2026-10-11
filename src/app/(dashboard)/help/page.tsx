import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AskMediFlow } from "@/components/help/ask-mediflow";

export const metadata: Metadata = {
  title: "Ask MediFlow IQ",
  description: "In-app help assistant for MediFlow IQ — POS, products, inventory, purchases and more.",
  robots: { index: false, follow: false },
};

function HelpFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-[60vh] w-full rounded-xl" />
    </div>
  );
}

export default function AskMediFlowPage() {
  return (
    <Suspense fallback={<HelpFallback />}>
      <AskMediFlow />
    </Suspense>
  );
}
