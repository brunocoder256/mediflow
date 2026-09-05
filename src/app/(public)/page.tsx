import type { Metadata } from "next";
import { Hero } from "@/components/site/hero";
import { Container } from "@/components/site/container";
import { SectionHeading } from "@/components/site/section-heading";
import { FeatureCard } from "@/components/site/feature-card";
import { PricingCard } from "@/components/site/pricing-card";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { CtaSection } from "@/components/site/cta-section";
import { Reveal } from "@/components/site/reveal";
import { DashboardPreview } from "@/components/site/dashboard-preview";
import { FAQ_ITEMS } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import {
  Package,
  FileSpreadsheet,
  Eye,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  BarChart3,
  KeyRound,
  FileCheck2,
  Boxes,
  Smartphone,
  CheckCircle2,
  ArrowDown,
  Monitor,
  Tablet,
  Building2,
  Store,
  TrendingUp,
} from "lucide-react";

export const metadata: Metadata = {
  title: "MediFlow — Pharmacy Management System",
  description:
    "MediFlow is a modern pharmacy management system for managing sales, inventory, purchasing, customers, suppliers, expenses and reports from one simple platform. UGX 20,000/month.",
};

const PROBLEMS = [
  {
    icon: Package,
    title: "Losing track of stock",
    description:
      "Know what is in stock, what is running low and what is approaching expiry — before it becomes a problem.",
  },
  {
    icon: FileSpreadsheet,
    title: "Too much manual work",
    description:
      "Reduce repetitive paperwork and disconnected spreadsheets by keeping everything in one place.",
  },
  {
    icon: Eye,
    title: "Limited business visibility",
    description:
      "See sales, expenses, margins, inventory and business performance from one simple overview.",
  },
  {
    icon: ShieldCheck,
    title: "Difficult accountability",
    description:
      "Know which user performed important actions through roles, permissions and audit trails.",
  },
];

const WORKFLOW_STEPS = [
  "Products",
  "Inventory",
  "Purchasing",
  "Sales / POS",
  "Payments",
  "Customers",
  "Expenses",
  "Reports",
  "Audit",
];

const HOW_STEPS = [
  {
    step: "01",
    title: "Create your account",
    description: "Tell us about your pharmacy and submit your registration.",
  },
  {
    step: "02",
    title: "Get approved",
    description: "MediFlow verifies your account and confirms your monthly payment.",
  },
  {
    step: "03",
    title: "Set up your pharmacy",
    description: "Configure your products, users, branches and opening stock.",
  },
  {
    step: "04",
    title: "Start managing",
    description: "Sell, track stock, purchase products and monitor your business.",
  },
];

const WHY_ITEMS = [
  {
    icon: Boxes,
    title: "Know your stock",
    description: "Track quantities, batches and expiry dates across every product.",
  },
  {
    icon: ShoppingCart,
    title: "Sell with confidence",
    description: "Give staff a fast, structured sales workflow with batch-aware stock selection.",
  },
  {
    icon: BarChart3,
    title: "Make better decisions",
    description: "Use real-time business reports and analytics to guide your pharmacy.",
  },
  {
    icon: ShieldCheck,
    title: "Stay accountable",
    description: "Control access and maintain a clear audit trail of important actions.",
  },
];

const WHO_ITEMS = [
  {
    icon: Store,
    title: "Retail Pharmacies",
    description: "Manage daily sales, stock and customers from one connected system.",
  },
  {
    icon: ShoppingCart,
    title: "Drug Shops",
    description: "Keep operations simple, organized and easy to run every day.",
  },
  {
    icon: TrendingUp,
    title: "Growing Pharmacy Businesses",
    description: "Manage more products, staff and operations as your business grows.",
  },
  {
    icon: Building2,
    title: "Multi-Branch Businesses",
    description: "Centralize visibility across branches with branch-level control.",
  },
];

const FEATURES = [
  {
    icon: ShoppingCart,
    title: "Sales & POS",
    description: "Fast pharmacy checkout designed around the counter.",
    bulletPoints: [
      "Barcode scanning & quick product search",
      "Multiple payment methods & receipts",
      "Discounts & credit sales where enabled",
      "Batch-aware, FEFO-aware stock selection",
    ],
    ctaLabel: "Explore Sales",
    ctaHref: "/features#sales",
  },
  {
    icon: Boxes,
    title: "Inventory Management",
    description: "Know exactly what you have — and what you need.",
    bulletPoints: [
      "Stock levels, batches & expiry dates",
      "Low-stock alerts & stock movements",
      "Stock adjustments, transfers & stock takes",
      "Inventory valuation",
    ],
    ctaLabel: "Explore Inventory",
    ctaHref: "/features#inventory",
  },
  {
    icon: Truck,
    title: "Purchasing",
    description: "Manage the journey from supplier to stock.",
    bulletPoints: [
      "Suppliers, purchase requests & orders",
      "Goods received with batch & expiry capture",
      "Purchase returns & supplier balances",
      "Supplier pricing",
    ],
    ctaLabel: "Explore Purchasing",
    ctaHref: "/features#purchasing",
  },
  {
    icon: Users,
    title: "Customers",
    description: "Build better customer relationships.",
    bulletPoints: [
      "Customer profiles & purchase history",
      "Statements & credit management",
      "Payments & returns",
      "Loyalty where implemented",
    ],
  },
  {
    icon: Wallet,
    title: "Expenses & Finance",
    description: "Understand where your money goes.",
    bulletPoints: [
      "Expense tracking with categories",
      "Payment accounts & approvals",
      "Financial reporting",
      "Profitability insights",
    ],
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Turn pharmacy activity into useful information.",
    bulletPoints: [
      "Sales reports & gross profit",
      "Inventory valuation & expiry reports",
      "Purchasing, expense & customer reports",
      "Branch & staff performance",
    ],
  },
  {
    icon: KeyRound,
    title: "Users & Permissions",
    description: "Give every team member the right level of access.",
    bulletPoints: [
      "User accounts with roles",
      "Permissions & branch access",
      "Session management",
      "Staff accountability",
    ],
  },
  {
    icon: FileCheck2,
    title: "Audit & Control",
    description: "Know what happened and who did it.",
    bulletPoints: [
      "Activity & transaction history",
      "Stock adjustments & user actions",
      "Approval history",
      "Before/after change capture",
    ],
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Trust strip */}
      <section className="border-y border-slate-200 bg-slate-50/70 py-8 dark:border-slate-800 dark:bg-slate-900/40">
        <Container>
          <Reveal>
            <p className="text-center text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Everything you need to stay in control
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {["Sales & POS", "Inventory & Expiry", "Purchasing", "Customers", "Expenses", "Reports", "Staff & Permissions", "Audit & Control"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                    {item}
                  </div>
                ),
              )}
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Problem section */}
      <section className="py-16 lg:py-24" id="problems">
        <Container>
          <SectionHeading
            eyebrow="The problem"
            title="Pharmacy management shouldn't be complicated."
            description="Too many pharmacies juggle paper, spreadsheets and disconnected tools. MediFlow gives you one clear view of the business."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((p, i) => (
              <FeatureCard key={p.title} icon={p.icon} title={p.title} description={p.description} delay={i * 60} />
            ))}
          </div>
        </Container>
      </section>

      {/* Workflow / solution */}
      <section className="bg-slate-50/70 py-16 lg:py-24 dark:bg-slate-900/40" id="solutions">
        <Container>
          <SectionHeading
            eyebrow="The solution"
            title="Meet MediFlow. Your pharmacy's connected workspace."
            description="MediFlow connects the important parts of pharmacy operations instead of forcing staff to work across disconnected systems."
          />
          <Reveal className="mt-12 mx-auto max-w-4xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
                {WORKFLOW_STEPS.map((step, i) => (
                  <li key={step} className="relative">
                    <span
                      className={cn(
                        "flex h-full w-full items-center justify-center rounded-lg border px-2 py-2.5 text-center text-xs font-semibold sm:text-sm",
                        i === WORKFLOW_STEPS.length - 1
                          ? "border-teal-600 bg-teal-700 text-white shadow-sm"
                          : "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
                      )}
                    >
                      {step}
                    </span>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 rotate-90 items-center justify-center text-slate-400 lg:flex"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
                One connected workspace — from products and stock, through to sales, reports and audit.
              </p>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Features section */}
      <section className="py-16 lg:py-24" id="features">
        <Container>
          <SectionHeading
            eyebrow="Features"
            title="Everything your pharmacy needs."
            description="Real pharmacy workflows, organized the way your team actually works."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <FeatureCard
                key={f.title}
                icon={f.icon}
                title={f.title}
                description={f.description}
                bulletPoints={f.bulletPoints}
                ctaLabel={f.ctaLabel}
                ctaHref={f.ctaHref}
                delay={(i % 4) * 60}
              />
            ))}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="bg-slate-50/70 py-16 lg:py-24 dark:bg-slate-900/40" id="how-it-works">
        <Container>
          <SectionHeading
            eyebrow="Getting started"
            title="How MediFlow works."
            description="A simple path from first visit to running your pharmacy on MediFlow."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 80}>
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-700">
                  <span className="absolute -right-2 -top-5 text-7xl font-extrabold text-teal-50 dark:text-teal-900/30">
                    {s.step}
                  </span>
                  <div className="relative">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white shadow-sm">
                      {s.step}
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Pricing */}
      <section className="py-16 lg:py-24" id="pricing">
        <Container>
          <SectionHeading
            eyebrow="Pricing"
            title="Simple pricing for your pharmacy."
            description="One price. Full access. No complicated tiers."
          />
          <div className="mt-12">
            <PricingCard />
          </div>
        </Container>
      </section>

      {/* Why MediFlow */}
      <section className="bg-slate-50/70 py-16 lg:py-24 dark:bg-slate-900/40" id="why">
        <Container>
          <SectionHeading
            eyebrow="Why MediFlow"
            title="More control. Less guesswork."
            description="Outcome-focused benefits for pharmacy owners and their teams."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_ITEMS.map((item, i) => (
              <FeatureCard key={item.title} icon={item.icon} title={item.title} description={item.description} delay={i * 60} />
            ))}
          </div>
        </Container>
      </section>

      {/* Who it's for */}
      <section className="py-16 lg:py-24" id="who">
        <Container>
          <SectionHeading
            eyebrow="Who it's for"
            title="Built for the way pharmacy businesses operate."
            description="From single drug shops to growing multi-branch pharmacy businesses."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHO_ITEMS.map((item, i) => (
              <FeatureCard key={item.title} icon={item.icon} title={item.title} description={item.description} delay={i * 60} />
            ))}
          </div>
        </Container>
      </section>

      {/* Devices / mobile-first message */}
      <section className="bg-slate-50/70 py-16 lg:py-24 dark:bg-slate-900/40">
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-400">
              Works on your devices
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Your pharmacy doesn&apos;t stop when you leave the counter.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Access the information you need from modern computers, tablets and mobile devices where supported
              by the current application.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-400">
              {[
                "Responsive dashboard that adapts to your screen",
                "Continue working from a tablet on the shop floor",
                "Check stock and sales from your phone where supported",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex items-end justify-center gap-3 sm:gap-4">
              <div className="w-1/3 rounded-xl border border-slate-200 bg-white p-3 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
                <Monitor className="mx-auto h-8 w-8 text-teal-700 sm:h-10 sm:w-10" />
                <p className="mt-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">Desktop</p>
              </div>
              <div className="w-1/3 rounded-xl border border-slate-200 bg-white p-3 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
                <Tablet className="mx-auto h-8 w-8 text-teal-700 sm:h-10 sm:w-10" />
                <p className="mt-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">Tablet</p>
              </div>
              <div className="w-1/3 rounded-xl border border-slate-200 bg-white p-3 pt-6 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 sm:p-4 sm:pt-8">
                <Smartphone className="mx-auto h-8 w-8 text-teal-700 sm:h-9 sm:w-9" />
                <p className="mt-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">Mobile</p>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Product preview */}
      <section className="py-16 lg:py-24" id="product-preview">
        <Container>
          <SectionHeading
            eyebrow="Product preview"
            title="A look at the MediFlow dashboard."
            description="The same connected workspace your team would use every day — sales, stock, expiry and reporting in one place."
          />
          <Reveal className="mt-12 mx-auto max-w-3xl">
            <DashboardPreview />
          </Reveal>
        </Container>
      </section>

      {/* Security / trust */}
      <section className="bg-slate-50/70 py-16 lg:py-24 dark:bg-slate-900/40">
        <Container>
          <SectionHeading
            eyebrow="Security"
            title="Your business data stays yours."
            description="MediFlow is built around controlled access, accountability and protected business data."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Role-based access control",
              "User accountability",
              "Audit history",
              "Controlled permissions",
              "Secure authentication",
              "Branch-level access",
            ].map((item, i) => (
              <Reveal key={item} delay={i * 40}>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-teal-600" />
                  {item}
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-24" id="faq">
        <Container>
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions."
            description="Answers to the questions pharmacy owners ask us most."
          />
          <div className="mt-12">
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </Container>
      </section>

      <CtaSection />
    </>
  );
}