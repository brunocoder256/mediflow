"use client";

import * as React from "react";
import {
  isTrialActive,
  isPaidActive,
  daysLeftInTrial,
  daysLeftInAccess,
  cacheGate,
  readCachedGate,
  type TrialGate,
} from "@/lib/trial-utils";
import { Phone } from "lucide-react";

export function TrialBanner({ gate }: { gate: TrialGate | null }) {
  // Prefer the fresh server gate, but fall back to the last-known cached gate so
  // the countdown still renders (and still counts down) while offline.
  const [effective, setEffective] = React.useState<TrialGate | null>(gate ?? readCachedGate());
  const effectiveRef = React.useRef(effective);
  effectiveRef.current = effective;
  const gateRef = React.useRef(gate);
  gateRef.current = gate;

  // Keep the cache in sync with the freshest server data.
  React.useEffect(() => {
    if (gate) {
      cacheGate(gate);
      setEffective(gate);
    }
  }, [gate]);

  const [live, setLive] = React.useState(() =>
    isTrialActive(effective) ? daysLeftInTrial(effective) : isPaidActive(effective) ? daysLeftInAccess(effective) : 0,
  );

  React.useEffect(() => {
    const compute = () => {
      const g = effectiveRef.current;
      setLive(isTrialActive(g) ? daysLeftInTrial(g) : isPaidActive(g) ? daysLeftInAccess(g) : 0);
      const t = isTrialActive(g) ? daysLeftInTrial(g) : isPaidActive(g) ? daysLeftInAccess(g) : 0;
      if (t === 0 && gateRef.current) {
        // Expired while the dashboard is open and the server still thinks it's
        // active — let the gate refresh handle the transition.
        window.location.reload();
      }
    };
    compute();
    const t = setInterval(compute, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!isTrialActive(effective) && !isPaidActive(effective)) return null;
  const isTrial = isTrialActive(effective);
  if (live <= 0) return null;

  const phone1 = effective?.contact_phone_1 ?? "0759327843";
  const phone2 = effective?.contact_phone_2 ?? "0768082948";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span>
        {isTrial ? (
          <>
            Free trial ends in{" "}
            <span className="font-semibold">
              {live} day{live !== 1 ? "s" : ""}
            </span>
            . When it ends, contact MediFlow IQ to keep using the system.
          </>
        ) : (
          <>
            Paid access ends in{" "}
            <span className="font-semibold">
              {live} day{live !== 1 ? "s" : ""}
            </span>
            {effective && (effective.paid_cycles ?? 0) > 0 && (
              <span className="text-muted-foreground"> · {effective.paid_cycles} cycle{effective.paid_cycles !== 1 ? "s" : ""} remaining</span>
            )}
            . Renew with MediFlow IQ before this ends to avoid interruption.
          </>
        )}
      </span>
      <span className="flex items-center gap-1 text-xs font-medium">
        <Phone className="h-3.5 w-3.5" />
        {phone1} / {phone2}
      </span>
    </div>
  );
}
