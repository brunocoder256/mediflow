import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Reveal } from "./reveal";
import { PLANS, formatPlanPrice, getPlan, type PlanDefinition } from "@/lib/plans";

export function PricingTable() {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      {PLANS.map((plan) => (
        <PricingCard key={plan.tier} plan={plan} />
      ))}
    </div>
  );
}

export function PricingCard({ plan }: { plan: PlanDefinition }) {
  const recommended = !!plan.recommended;
  return (
    <Reveal className="h-full w-full">
      <div
        className={`relative flex h-full flex-col rounded-3xl border bg-white p-8 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:bg-slate-900 ${
          recommended
            ? "border-teal-300 shadow-teal-900/15 hover:shadow-teal-900/20 dark:border-teal-600"
            : "border-slate-200 shadow-slate-900/5 hover:shadow-slate-900/10 dark:border-slate-700"
        }`}
      >
        {recommended && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Most popular
            </span>
          </div>
        )}

        <h3 className="text-center text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
        <p className="mt-1 text-center text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
          {plan.audience}
        </p>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">{plan.tagline}</p>

        <div className="mt-6 text-center">
          <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {formatPlanPrice(plan.price)}
          </span>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400"> / month</span>
        </div>

        {plan.inherits && (
          <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Everything in {getPlan(plan.inherits).name}, plus:
          </p>
        )}
        <ul className={`${plan.inherits ? "mt-3" : "mt-8"} flex-1 space-y-2.5`}>
          {plan.features.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/40">
                <Check className="h-3 w-3 text-teal-700 dark:text-teal-300" />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <Link
          href="/auth/signup"
          className={`btn-lift mt-8 inline-flex w-full items-center justify-center rounded-lg px-6 py-3.5 text-sm font-semibold shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            recommended
              ? "bg-teal-700 text-white shadow-teal-700/20 hover:bg-teal-800 focus-visible:ring-teal-500"
              : "border border-teal-700 text-teal-700 hover:bg-teal-50 focus-visible:ring-teal-500 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950/30"
          }`}
        >
          Create Your Account
        </Link>
      </div>
    </Reveal>
  );
}
