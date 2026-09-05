import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { DashboardPreview } from "@/components/site/dashboard-preview";
import { Phone, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Request a MediFlow demo or walkthrough. See how the dashboard, POS, inventory and reports work for your pharmacy.",
};

const DEMO_STEPS = [
  "Your daily dashboard — sales, stock, expiry and profit at a glance",
  "A fast POS sale with batch-aware stock selection",
  "Receiving stock and capturing batch & expiry dates",
  "Tracking customers, credit and payments",
  "Reports that show how your pharmacy is performing",
];

export default function DemoPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-teal-50 to-white py-16 dark:from-teal-950/30 dark:to-slate-950 dark:border-slate-800">
        <Container className="mx-auto max-w-3xl text-center">
          <SectionHeading
            eyebrow="Demo"
            title="See MediFlow in action."
            description="Book a short walkthrough with the MediFlow team and see exactly how the system works for a pharmacy like yours."
          />
          <Reveal className="mt-8">
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="tel:0759327843"
                className="btn-lift inline-flex items-center gap-2 rounded-lg bg-teal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Phone className="h-4 w-4" />
                Request a demo — call 0759327843
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Create Your Account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="py-16 lg:py-20">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-400">
              What the demo covers
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              A real walkthrough, tailored to your pharmacy.
            </h2>
            <ul className="mt-6 space-y-3">
              {DEMO_STEPS.map((step) => (
                <li key={step} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
              The walkthrough is free and takes about 15 minutes. Call the MediFlow team to arrange a time.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <DashboardPreview />
          </Reveal>
        </Container>
      </section>
    </>
  );
}