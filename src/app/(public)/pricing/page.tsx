import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";
import { SectionHeading } from "@/components/site/section-heading";
import { PricingTable } from "@/components/site/pricing-card";
import { Reveal } from "@/components/site/reveal";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { buildMetadata, JsonLd } from "@/lib/seo";
import { PLANS, MIN_PLAN_PRICE, formatPlanPrice } from "@/lib/plans";
import { Check } from "lucide-react";

export const metadata: Metadata = buildMetadata({
  title: "Pricing",
  description:
    "MediFlow IQ plans start at UGX 20,000 per month — Starter for drug shops, Pharmacy Pro for retail pharmacies and Enterprise for chains. Full system access on every plan, no hidden fees.",
  path: "/pricing",
  keywords: ["pharmacy software pricing", "MediFlow IQ cost", "UGX 20000 pharmacy system", "pharmacy management pricing Uganda"],
});

const FAQ_PRICING = [
  {
    question: "How much does MediFlow IQ cost?",
    answer:
      "MediFlow IQ has three plans: Starter at UGX 20,000 per month for drug shops, Pharmacy Pro at UGX 50,000 per month for retail pharmacies, and Enterprise at UGX 100,000 per month for chains and wholesalers.",
  },
  {
    question: "What is the difference between the plans?",
    answer:
      "Starter is built for single-counter drug shops. Pharmacy Pro adds purchasing, supplier and customer credit, returns and richer reporting for a full retail pharmacy. Enterprise adds multi-branch management, transfers, stock counts, approval workflows and a full audit trail for chains and wholesalers.",
  },
  {
    question: "Does a lower plan limit what I can use?",
    answer:
      "Every plan currently unlocks the full MediFlow IQ system. The lists show what each plan is designed around, and higher plans include everything in the plans below them.",
  },
  {
    question: "How is payment handled?",
    answer:
      "After you create your account, a MediFlow IQ administrator verifies your payment and activates your account. Payment details are shared during the registration process.",
  },
  {
    question: "Can I change my plan later?",
    answer:
      "Yes. Contact the MediFlow IQ team to move your account to a different plan — we'll update it for you.",
  },
  {
    question: "Can more than one staff member use MediFlow IQ?",
    answer:
      "Yes. Your MediFlow IQ account supports multiple users with role-based access and permissions.",
  },
];

const PRICING_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "MediFlow IQ — Pharmacy Management System",
  description:
    "One connected system for running your pharmacy — sales & POS, inventory with batch and expiry tracking, purchasing, suppliers, customers, expenses, reports, users and audit.",
  brand: { "@type": "Brand", name: "MediFlow IQ" },
  offers: {
    "@type": "AggregateOffer",
    lowPrice: String(MIN_PLAN_PRICE),
    highPrice: String(Math.max(...PLANS.map((p) => p.price))),
    offerCount: PLANS.length,
    priceCurrency: "UGX",
    availability: "https://schema.org/InStock",
    url: "/pricing",
  },
};

const PRICING_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_PRICING.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={PRICING_SCHEMA} />
      <JsonLd data={PRICING_FAQ_SCHEMA} />
      <section className="border-b border-slate-200 bg-gradient-to-b from-teal-50 to-white py-16 dark:from-teal-950/30 dark:to-slate-950 dark:border-slate-800">
        <Container className="text-center">
          <SectionHeading
            eyebrow="Pricing"
            title="A plan for every pharmacy."
            description={`Starter for drug shops, Pharmacy Pro for retail pharmacies and Enterprise for chains. Plans start at ${formatPlanPrice(MIN_PLAN_PRICE)} per month.`}
          />
        </Container>
      </section>

      <section className="py-16 lg:py-20">
        <Container>
          <PricingTable />

          <Reveal className="mx-auto mt-12 max-w-2xl">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <h3 className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Check className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                What&apos;s included
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Starter is built for drug shops, Pharmacy Pro for full retail pharmacies, and Enterprise for chains
                and wholesalers. Every plan currently unlocks the full MediFlow IQ system, and higher plans build on
                the ones below — including sales & POS, inventory with batch and expiry tracking, purchasing &
                suppliers, customers, expenses, reports & analytics, users & permissions and audit trail.
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400 sm:flex-row">
                <span>Have questions about billing?</span>
                <Link href="/contact" className="font-semibold text-teal-700 hover:underline dark:text-teal-400">
                  Contact the MediFlow IQ team →
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