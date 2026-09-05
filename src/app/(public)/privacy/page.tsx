import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How MediFlow collects, uses and protects your business and personal data.",
};

const SECTIONS = [
  {
    title: "1. Overview",
    body: "This policy explains how MediFlow handles information collected through the MediFlow pharmacy management system, including registration, account use and support. We are committed to protecting your business data and the privacy of the people in your organization.",
  },
  {
    title: "2. Information we collect",
    body: "When you register, we collect the business name, business type, owner name, email, phone and location you provide. When you use the platform, we store the business data you enter — products, sales, purchases, suppliers, customers, expenses, reports and audit records. We do not collect payment card details through the platform.",
  },
  {
    title: "3. How we use information",
    body: "We use your information to provide and improve the MediFlow service, process your account registration and approval, contact you about your account or payment, and respond to support requests. We do not sell your business data.",
  },
  {
    title: "4. Account & security",
    body: "Your account is protected with role-based access, controlled permissions and audit trails. Access to your pharmacy data is limited to users you authorize, with branch-level control where supported.",
  },
  {
    title: "5. Data storage & access",
    body: "Business data is stored on secure infrastructure and is only accessible to authorized MediFlow administrators when needed to support or maintain the service. Data is never shared with other customers.",
  },
  {
    title: "6. Tenant isolation",
    body: "Each customer's business data is isolated. Your products, sales, customers, suppliers, expenses, reports, users, inventory, settings and audit logs are visible only to your business and authorized administrators — never to another MediFlow customer.",
  },
  {
    title: "7. Patient & clinical information",
    body: "If you store sensitive clinical information within MediFlow, you remain responsible for handling it in line with applicable laws, professional regulations and your obligations to patients. MediFlow does not collect clinical information itself.",
  },
  {
    title: "8. Communications",
    body: "We may contact you by phone or email regarding your account, payment confirmation, approval, renewal and system updates.",
  },
  {
    title: "9. Retention",
    body: "Business data is retained while your account is active. If an account is closed, you may request the export or deletion of your business data, subject to applicable legal and professional obligations.",
  },
  {
    title: "10. Cookies & analytics",
    body: "The MediFlow application uses essential cookies for authentication and session management. We do not use cookies for advertising.",
  },
  {
    title: "11. Changes to this policy",
    body: "We may update this policy from time to time. Significant changes will be communicated through the application where practical.",
  },
  {
    title: "12. Contact",
    body: "For privacy questions, contact the MediFlow team by phone on 0759327843 or 0768082948.",
  },
];

export default function PrivacyPage() {
  return (
    <section className="py-16 lg:py-20">
      <Container className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: 2026</p>
        <div className="mt-8 space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{s.title}</h2>
              <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          Questions about privacy?{" "}
          <Link href="/contact" className="font-semibold text-teal-700 hover:underline dark:text-teal-400">
            Contact us
          </Link>
          .
        </div>
      </Container>
    </section>
  );
}