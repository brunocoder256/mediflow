import type { Metadata } from "next";
import { Container } from "@/components/site/container";
import { SectionHeading } from "@/components/site/section-heading";
import { FeatureCard } from "@/components/site/feature-card";
import { Reveal } from "@/components/site/reveal";
import { CtaSection } from "@/components/site/cta-section";
import { Cross, MapPin, Users, HeartHandshake, ShieldCheck, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "MediFlow is a modern pharmacy and drug-shop management platform built to help pharmacy businesses in Uganda and across Africa run their daily operations from one connected system.",
};

const VALUES = [
  {
    icon: Cross,
    title: "Pharmacy-first",
    description:
      "We design around how pharmacies actually work — batches, expiry dates, counter sales and controlled stock.",
  },
  {
    icon: Users,
    title: "For real pharmacy teams",
    description:
      "From the owner to the cashier, every role gets an experience that matches their job.",
  },
  {
    icon: HeartHandshake,
    title: "Honest & practical",
    description:
      "No hype, no fake features — just reliable software that helps you run a better pharmacy.",
  },
  {
    icon: ShieldCheck,
    title: "Built on trust",
    description:
      "Roles, permissions and audit trails keep your business data protected and accountable.",
  },
  {
    icon: Zap,
    title: "Simple to use",
    description:
      "A pharmacy owner should understand MediFlow in seconds — not after weeks of training.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-teal-50 to-white py-16 dark:from-teal-950/30 dark:to-slate-950 dark:border-slate-800">
        <Container className="mx-auto max-w-3xl text-center">
          <SectionHeading
            eyebrow="About MediFlow"
            title="MediFlow is a modern pharmacy management platform."
            description="We build software that helps pharmacy businesses — in Uganda, across Africa and beyond — manage sales, stock, purchasing, customers, suppliers, expenses and reports from one connected system."
          />
        </Container>
      </section>

      <section className="py-16 lg:py-20">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v, i) => (
              <FeatureCard key={v.title} icon={v.icon} title={v.title} description={v.description} delay={i * 60} />
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-slate-50/70 py-16 dark:bg-slate-900/40">
        <Container className="grid gap-10 md:grid-cols-3">
          <Reveal className="md:col-span-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              One connected system for running your pharmacy.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              MediFlow exists because pharmacy operations are too often split across paper, spreadsheets and
              disconnected tools. Stock is recorded in one place, sales in another, and nobody has a clear view
              of the whole business.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              We bring the important parts together — products, inventory, purchasing, sales, payments, customers,
              expenses, reports and audit — so the people running a pharmacy can see everything and stay in control.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                <MapPin className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">Built for local pharmacy businesses</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Designed with Ugandan drug shops and pharmacies in mind — including UGX pricing and local business
                workflows.
              </p>
            </div>
          </Reveal>
        </Container>
      </section>

      <CtaSection />
    </>
  );
}