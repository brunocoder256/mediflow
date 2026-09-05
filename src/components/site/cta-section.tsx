import Link from "next/link";
import { Container } from "./container";
import { Reveal } from "./reveal";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-16 lg:py-20">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-700 to-teal-600 px-6 py-14 text-center shadow-xl shadow-teal-900/20 sm:px-12">
            <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-teal-950/30 blur-3xl" />
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ready to take control of your pharmacy?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-teal-50">
              Start your MediFlow registration today.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/signup"
                className="btn-lift group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-bold text-teal-800 shadow-lg hover:bg-teal-50 sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-700"
              >
                Create Your Account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex w-full items-center justify-center rounded-lg border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                Contact Us
              </Link>
            </div>
            <p className="mt-6 text-sm font-medium text-teal-100">UGX 20,000 / month</p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}