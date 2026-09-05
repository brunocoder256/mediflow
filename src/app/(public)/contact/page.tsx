import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { Phone, MessageSquareText, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the MediFlow team to ask questions, request a demo or get help with your pharmacy account.",
};

const CONTACT_PHONES = [
  { label: "Main line", number: "0759327843" },
  { label: "Alt line", number: "0768082948" },
];

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-teal-50 to-white py-16 dark:from-teal-950/30 dark:to-slate-950 dark:border-slate-800">
        <Container className="mx-auto max-w-3xl text-center">
          <SectionHeading
            eyebrow="Contact"
            title="Talk to the MediFlow team."
            description="Questions about MediFlow, getting started, or your account? Reach out and we will help."
          />
        </Container>
      </section>

      <section className="py-16 lg:py-20">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            <Reveal>
              <div className="flex h-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                  <Phone className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Call us</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Speak directly with the team about starting or renewing your MediFlow account.
                </p>
                <ul className="mt-4 space-y-2">
                  {CONTACT_PHONES.map((p) => (
                    <li key={p.number}>
                      <a
                        href={`tel:${p.number}`}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/30"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {p.number}
                        <span className="text-xs font-normal text-slate-400">{p.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={60}>
              <div className="flex h-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                  <MessageSquareText className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Account support</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Got a question about an application, payment or your pharmacy account? Call us and we will help
                  you get up and running.
                </p>
                <Link
                  href={`tel:${CONTACT_PHONES[0]?.number ?? ""}`}
                  className="btn-lift mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
                >
                  Call support now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="flex h-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                  <ArrowRight className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Start or continue</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Ready to run your pharmacy with MediFlow? Create your account or sign in to your existing one.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    href="/auth/signup"
                    className="btn-lift inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
                  >
                    Create Your Account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal className="mx-auto mt-12 max-w-2xl">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Prefer to read first?</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Browse the features, check pricing or read the FAQ to find answers quickly.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/features"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Explore Features
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  View Pricing
                </Link>
                <Link
                  href="/#faq"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Read the FAQ
                </Link>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}