import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/hooks/use-toast";

export const metadata: Metadata = {
  title: {
    default: "MediFlow — Pharmacy Management System",
    template: "%s — MediFlow",
  },
  description:
    "MediFlow is a modern pharmacy management system for managing sales, inventory, purchasing, customers, suppliers, expenses and reports from one connected platform.",
  keywords: [
    "pharmacy",
    "drug shop",
    "pharmacy management system",
    "inventory management",
    "POS",
    "point of sale",
    "expiry tracking",
    "healthcare",
    "Uganda",
    "Africa",
  ],
  applicationName: "MediFlow",
  openGraph: {
    title: "MediFlow — Pharmacy Management System",
    description:
      "One connected system for running your pharmacy. Manage sales, stock, purchases, customers, suppliers, expenses and reports.",
    type: "website",
    locale: "en_UG",
    siteName: "MediFlow",
    images: [{ url: "/mediflow-logo.png", width: 1254, height: 1254, alt: "MediFlow logo" }],
  },
  twitter: {
    card: "summary",
    title: "MediFlow — Pharmacy Management System",
    description:
      "One connected system for running your pharmacy. Manage sales, stock, purchases, customers, suppliers, expenses and reports.",
    images: ["/mediflow-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f766e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/icon-32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="canonical" href="https://mediflow.vercel.app/" />
      </head>
      <body className="antialiased min-h-screen">
        <ToastProvider>{children}</ToastProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});}`,
          }}
        />
      </body>
    </html>
  );
}