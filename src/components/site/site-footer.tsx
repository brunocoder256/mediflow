import Link from "next/link";
import { MediFlowLogo } from "@/components/brand/mediflow-logo";
import { Container } from "./container";

const PRODUCT_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Login", href: "/auth/login" },
  { label: "Create Account", href: "/auth/signup" },
];

const COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const SUPPORT_LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "FAQ", href: "/#faq" },
  { label: "Contact Support", href: "/contact" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label + link.href}>
            <Link
              href={link.href}
              className="text-sm text-slate-600 transition-colors hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-slate-50 dark:bg-slate-950/60">
      <Container className="py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <MediFlowLogo size={40} />
            <p className="mt-4 max-w-xs text-sm text-slate-600 dark:text-slate-400">
              Modern pharmacy management for better business control.
            </p>
            <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-500">
              UGX 20,000 / month · Simple pricing.
            </p>
          </div>
          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Support" links={SUPPORT_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} MediFlow. All rights reserved.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Pharmacy Management, Simplified.
          </p>
        </div>
      </Container>
    </footer>
  );
}
