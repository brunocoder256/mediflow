import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Reveal } from "./reveal";

const INCLUDED = [
  "Full MediFlow system access",
  "Sales & POS",
  "Inventory management",
  "Batch & expiry tracking",
  "Purchasing & suppliers",
  "Customers",
  "Expenses",
  "Reports & analytics",
  "Users & permissions",
  "Audit trail",
  "Updates and improvements",
];

export function PricingCard() {
  return (
    <Reveal className="mx-auto w-full max-w-md">
      <div className="relative rounded-3xl border border-teal-200 bg-white p-8 shadow-xl shadow-teal-900/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-teal-900/15 dark:border-teal-700 dark:bg-slate-900">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Recommended
          </span>
        </div>

        <h3 className="text-center text-xl font-bold text-slate-900 dark:text-white">MediFlow</h3>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
          One connected system for your pharmacy
        </p>

        <div className="mt-6 text-center">
          <span className="text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            UGX 20,000
          </span>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400"> / month</span>
        </div>

        <ul className="mt-8 space-y-2.5">
          {INCLUDED.map((item) => (
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
          className="btn-lift mt-8 inline-flex w-full items-center justify-center rounded-lg bg-teal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 hover:shadow-lg hover:shadow-teal-700/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          Create Your Account
        </Link>
        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Account activation is subject to payment confirmation and administrator approval.
        </p>
      </div>
    </Reveal>
  );
}