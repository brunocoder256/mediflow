import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for using the MediFlow pharmacy management system.",
};

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating a MediFlow account, you agree to these terms. If you are registering on behalf of a pharmacy, drug shop or other business, you confirm that you are authorized to represent that business.",
  },
  {
    title: "2. The MediFlow service",
    body: "MediFlow provides pharmacy management software covering sales, inventory, purchasing, customers, suppliers, expenses and reports. Your account is created through a registration and approval process and becomes active after payment verification and administrator approval.",
  },
  {
    title: "3. Account activation & payment",
    body: "MediFlow is currently offered at UGX 20,000 per month. Account activation is subject to payment confirmation and administrator approval. Paying for a month activates your account for that month; continued access is subject to the current billing arrangement agreed with the MediFlow team.",
  },
  {
    title: "4. Your responsibilities",
    body: "You are responsible for keeping your login credentials secure, controlling who on your team has access, and making sure your team uses MediFlow lawfully and in line with professional pharmacy practice. You are responsible for the accuracy of the data you enter.",
  },
  {
    title: "5. Account use & user management",
    body: "You may set up multiple users with roles and permissions. As the account owner, you are responsible for the actions taken by users on your account and for managing access when staff change.",
  },
  {
    title: "6. Data ownership & privacy",
    body: "The business data you enter into MediFlow belongs to your business. MediFlow stores this data to provide the service. See the Privacy Policy for details on how data is handled. Doctors' and patients' confidential information must be handled in line with applicable laws and professional obligations.",
  },
  {
    title: "7. Acceptable use",
    body: "You may not attempt to access another customer's account or data, interfere with the service, reverse engineer the platform, or use MediFlow for unlawful purposes. Your account may be suspended if it is linked to abuse or fraudulent activity.",
  },
  {
    title: "8. Service availability",
    body: "We work to keep MediFlow available and reliable, but we do not guarantee uninterrupted availability. Where offline support is available, syncing is best-effort and subject to your internet connection.",
  },
  {
    title: "9. Changes to the service",
    body: "MediFlow may improve, add or remove features over time. Changes to the platform will be communicated through the application where practical.",
  },
  {
    title: "10. Suspension & termination",
    body: "MediFlow may suspend or terminate an account for non-payment, breach of these terms, fraudulent activity, or at the request of the account owner. We do not silently delete registration records.",
  },
  {
    title: "11. Limitation of liability",
    body: "MediFlow is provided as is, to the extent permitted by law. To the maximum extent permitted, MediFlow is not liable for indirect or consequential losses arising from use of the service. Nothing in these terms limits liability that cannot be limited by law.",
  },
  {
    title: "12. Contact",
    body: "For questions about these terms, contact the MediFlow team by phone on 0759327843 or 0768082948.",
  },
];

export default function TermsPage() {
  return (
    <section className="py-16 lg:py-20">
      <Container className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Terms of Service
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
          Questions about these terms?{" "}
          <Link href="/contact" className="font-semibold text-teal-700 hover:underline dark:text-teal-400">
            Contact us
          </Link>
          .
        </div>
      </Container>
    </section>
  );
}