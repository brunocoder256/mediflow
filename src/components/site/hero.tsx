import Link from "next/link";
import { Container } from "./container";
import { DashboardPreview } from "./dashboard-preview";
import { ArrowRight, PlayCircle, Check } from "lucide-react";

const TRUST_ITEMS = ["Sales & POS", "Inventory & Expiry", "Purchasing", "Customers", "Expenses", "Reports"];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft decorative gradient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-teal-50 via-white to-white dark:from-teal-950/30 dark:via-slate-950 dark:to-slate-950" />
        <div className="absolute -top-40 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-teal-100/60 blur-3xl dark:bg-teal-900/20" />
      </div>

      <Container className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-700 dark:border-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
            Built for modern pharmacies
          </p>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            Run your pharmacy with{" "}
            <span className="bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent">
              confidence.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            MediFlow brings sales, inventory, purchasing, customers, suppliers, expenses and reports
            together in one simple pharmacy management system.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/signup"
              className="btn-lift group inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 hover:shadow-lg hover:shadow-teal-700/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              Create Your Account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <PlayCircle className="h-4 w-4" />
              Explore MediFlow
            </Link>
          </div>

          <div className="mt-6 flex flex-col items-start gap-1 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white">
              UGX 20,000<span className="font-normal text-slate-500 dark:text-slate-400"> / month</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400">Simple pricing. No complicated plans.</p>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
            {TRUST_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-teal-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <DashboardPreview className="mx-auto w-full max-w-xl lg:max-w-none" />
      </Container>
    </section>
  );
}