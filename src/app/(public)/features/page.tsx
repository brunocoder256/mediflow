import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { Container } from "@/components/site/container";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { CtaSection } from "@/components/site/cta-section";
import {
  ShoppingCart,
  Boxes,
  Truck,
  Users,
  Wallet,
  BarChart3,
  KeyRound,
  FileCheck2,
  Barcode,
  Search,
  UserCheck,
  Receipt,
  Percent,
  CreditCard,
  AlertTriangle,
  CalendarClock,
  Repeat,
  Boxes as BoxesIcon,
  ArrowLeftRight,
  Calculator,
  FileText,
  ClipboardList,
  Undo2,
  History,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore MediFlow's pharmacy features — sales & POS, inventory with batch and expiry tracking, purchasing, customers, expenses, reports, users and audit.",
};

const FEATURE_SECTIONS = [
  {
    id: "sales",
    title: "Sales & POS",
    description: "Fast pharmacy checkout with everything the counter needs.",
    icon: ShoppingCart,
    points: [
      { icon: Barcode, label: "Barcode scanning", detail: "Scan to add products instantly." },
      { icon: Search, label: "Product search", detail: "Find any item quickly by name or code." },
      { icon: UserCheck, label: "Customer selection", detail: "Attach sales to the right customer." },
      { icon: CreditCard, label: "Multiple payment methods", detail: "Cash, mobile money, card, bank and more." },
      { icon: Receipt, label: "Receipts", detail: "Clear receipts for every sale." },
      { icon: Percent, label: "Discounts", detail: "Apply discounts with control." },
      { icon: FileText, label: "Credit sales", detail: "Credit sales where enabled on your account." },
      { icon: Boxes, label: "Batch-aware selling", detail: "Track which batch was sold." },
    ],
  },
  {
    id: "inventory",
    title: "Inventory Management",
    description: "Know exactly what you have, what is running low and what is expiring.",
    icon: BoxesIcon,
    points: [
      { icon: Boxes, label: "Stock levels", detail: "Real-time quantities per product and batch." },
      { icon: CalendarClock, label: "Batch & expiry tracking", detail: "Track expiry dates on every batch." },
      { icon: AlertTriangle, label: "Low-stock alerts", detail: "Get warned before you run out." },
      { icon: History, label: "Stock movements", detail: "Full history of what changed and why." },
      { icon: Repeat, label: "Stock adjustments", detail: "Correct stock with approval where needed." },
      { icon: ClipboardList, label: "Stock takes", detail: "Count and reconcile physical stock." },
      { icon: ArrowLeftRight, label: "Transfers", detail: "Move stock between branches." },
      { icon: Calculator, label: "Inventory valuation", detail: "Understand the value of what you hold." },
    ],
  },
  {
    id: "purchasing",
    title: "Purchasing",
    description: "Manage the journey from supplier to stock.",
    icon: Truck,
    points: [
      { icon: Users, label: "Suppliers", detail: "Keep supplier profiles and contacts." },
      { icon: ClipboardList, label: "Purchase requests & orders", detail: "Request, raise and track orders." },
      { icon: FileText, label: "Goods received", detail: "Receive stock with batch and expiry capture." },
      { icon: Undo2, label: "Purchase returns", detail: "Return stock to suppliers cleanly." },
      { icon: Calculator, label: "Supplier pricing & balances", detail: "Track what you owe and to whom." },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    description: "Build better customer relationships.",
    icon: Users,
    points: [
      { icon: Users, label: "Customer profiles", detail: "Store key details per customer." },
      { icon: History, label: "Purchase history", detail: "See every purchase a customer has made." },
      { icon: FileText, label: "Statements", detail: "Clear statements for credit customers." },
      { icon: CreditCard, label: "Payments & credit", detail: "Manage balances and credit limits." },
      { icon: Undo2, label: "Returns", detail: "Process customer returns." },
    ],
  },
  {
    id: "finance",
    title: "Expenses & Finance",
    description: "Understand where your money goes.",
    icon: Wallet,
    points: [
      { icon: Wallet, label: "Expense tracking", detail: "Record and organise business expenses." },
      { icon: Boxes, label: "Categories & accounts", detail: "Group expenses by category and account." },
      { icon: FileCheck2, label: "Approvals", detail: "Control who approves spending." },
      { icon: BarChart3, label: "Financial reporting", detail: "See profit and spending clearly." },
    ],
  },
  {
    id: "reports",
    title: "Reports & Analytics",
    description: "Turn pharmacy activity into useful information.",
    icon: BarChart3,
    points: [
      { icon: BarChart3, label: "Sales reports", detail: "Daily, weekly and monthly performance." },
      { icon: Calculator, label: "Gross profit", detail: "Understand your margins." },
      { icon: Boxes, label: "Inventory valuation", detail: "The current value of your stock." },
      { icon: CalendarClock, label: "Expiry reports", detail: "Stay ahead of what is expiring." },
      { icon: Truck, label: "Purchasing reports", detail: "What you bought and from whom." },
      { icon: Users, label: "Customer & supplier reports", detail: "Understand your relationships." },
    ],
  },
  {
    id: "users",
    title: "Users & Permissions",
    description: "Give every team member the right level of access.",
    icon: KeyRound,
    points: [
      { icon: KeyRound, label: "User accounts", detail: "Add and manage your team." },
      { icon: FileCheck2, label: "Roles", detail: "Assign clear roles and responsibilities." },
      { icon: FileCheck2, label: "Permissions", detail: "Granular control over what each user can do." },
      { icon: Boxes, label: "Branch access", detail: "Limit users to the branches they need." },
      { icon: History, label: "Session management", detail: "Keep sessions visible and controlled." },
    ],
  },
  {
    id: "audit",
    title: "Audit & Control",
    description: "Know what happened and who did it.",
    icon: FileCheck2,
    points: [
      { icon: History, label: "Activity history", detail: "A record of important system actions." },
      { icon: History, label: "Transaction history", detail: "Trace sales, purchases and payments." },
      { icon: Repeat, label: "Stock adjustments", detail: "See who changed stock and why." },
      { icon: KeyRound, label: "User actions", detail: "Attribute actions to the right person." },
      { icon: FileCheck2, label: "Approval history", detail: "Track decisions and who made them." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-teal-50 to-white py-16 dark:from-teal-950/30 dark:to-slate-950 dark:border-slate-800">
        <Container className="text-center">
          <SectionHeading
            eyebrow="Features"
            title="Everything your pharmacy needs."
            description="From the counter to the back office, MediFlow connects sales, stock, purchasing, customers, expenses and reports in one system."
          />
        </Container>
      </section>

      {FEATURE_SECTIONS.map((section, idx) => (
        <section
          key={section.id}
          id={section.id}
          className={cn("scroll-mt-20 py-16 lg:py-20", idx % 2 === 1 && "bg-slate-50/70 dark:bg-slate-900/40")}
        >
          <Container>
            <Reveal>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-md shadow-teal-900/10">
                  <section.icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                    {section.title}
                  </h2>
                  <p className="mt-1 text-lg text-slate-600 dark:text-slate-400">{section.description}</p>
                </div>
              </div>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.points.map((point, i) => (
                <Reveal key={point.label} delay={i * 40}>
                  <div className="flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-700">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                      <point.icon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{point.label}</p>
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{point.detail}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      ))}

      <CtaSection />
    </>
  );
}