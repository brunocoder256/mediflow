import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";
import { SectionHeading } from "@/components/site/section-heading";
import { PricingCard } from "@/components/site/pricing-card";
import { Reveal } from "@/components/site/reveal";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "MediFlow costs UGX 20,000 per month. One simple price, full access — no complicated plans or hidden fees.",
};

const FAQ_PRICING = [
  {
    question: "How much does MediFlow cost?",
    answer:
      "MediFlow currently costs UGX 20,000 per month — one simple price. There are no complicated tiers or hidden fees.",
  },
  {
    question: "Why is there a one-price model?",
    answer:
      "We keep pricing straightforward so pharmacy owners can focus on running their business rather than decoding subscription tiers.",
  },
  {
    question: "How is payment handled?",
    answer:
      "After you create your account, a MediFlow administrator verifies your payment and activates your account. Payment details are shared during the registration process.",
  },
  {
    question: "Can more than one staff member use MediFlow?",
    answer:
      "Yes. Your MediFlow account supports multiple users with role-based access and permissions.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-teal-50 to-white py-16 dark:from-teal-950/30 dark:to-slate-950 dark:border-slate-800">
        <Container className="text-center">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple pricing for your pharmacy."
            description="One connected system for running your pharmacy. One clear monthly price."
          />
        </Container>
      </section>

      <section className="py-16 lg:py-20">
        <Container>
          <PricingCard />

          <Reveal className="mx-auto mt-12 max-w-2xl">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <h3 className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Check className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                What&apos;s included
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Every account includes the full MediFlow system — sales & POS, inventory with batch and expiry
                tracking, purchasing & suppliers, customers, expenses, reports & analytics, users & permissions,
                and audit trail. Updates and improvements are included.
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400 sm:flex-row">
                <span>Have questions about billing?</span>
                <Link href="/contact" className="font-semibold text-teal-700 hover:underline dark:text-teal-400">
                  Contact the MediFlow team →
                </Link>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="bg-slate-50/70 py-16 dark:bg-slate-900/40">
        <Container>
          <SectionHeading eyebrow="Pricing FAQ" title="Pricing questions, answered." />
          <div className="mt-12">
            <FaqAccordion items={FAQ_PRICING} />
          </div>
        </Container>
      </section>
    </>
  );
}