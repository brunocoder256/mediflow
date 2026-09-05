"use client";

import * as React from "react";
import { isTrialActive, daysLeftInTrial, type TrialGate } from "@/lib/trial-utils";
import { Phone } from "lucide-react";

export function TrialBanner({ gate }: { gate: TrialGate | null }) {
  const gateRef = React.useRef(gate);
  gateRef.current = gate;
  const [live, setLive] = React.useState(isTrialActive(gate) ? daysLeftInTrial(gate) : 0);

  React.useEffect(() => {
    if (!isTrialActive(gateRef.current)) return;
    const update = () => {
      setLive(daysLeftInTrial(gateRef.current));
      const g = gateRef.current;
      if (isTrialActive(g) && daysLeftInTrial(g) === 0) {
        window.location.reload();
      }
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  if (!isTrialActive(gate) || live <= 0) return null;

  const phone1 = gate?.contact_phone_1 ?? "0759327843";
  const phone2 = gate?.contact_phone_2 ?? "0768082948";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span>
        Free trial ends in{" "}
        <span className="font-semibold">
          {live} day{live !== 1 ? "s" : ""}
        </span>
        . When it ends, contact MediFlow to keep using the system.
      </span>
      <span className="flex items-center gap-1 text-xs font-medium">
        <Phone className="h-3.5 w-3.5" />
        {phone1} / {phone2}
      </span>
    </div>
  );
}