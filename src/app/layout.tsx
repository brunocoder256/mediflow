import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/hooks/use-toast";

export const metadata: Metadata = {
  title: "MediFlow - Drug Shop Management System",
  description:
    "Modern pharmacy and drug shop management, simplified. Manage inventory, POS, sales, and more.",
  keywords: [
    "pharmacy",
    "drug shop",
    "inventory management",
    "POS",
    "point of sale",
    "healthcare",
  ],
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
      </head>
      <body className="antialiased min-h-screen">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}