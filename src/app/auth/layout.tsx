import Link from "next/link";
import { ToastProvider } from "@/hooks/use-toast";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white px-4 py-12 dark:from-gray-900 dark:to-gray-950">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
              MediFlow
            </h1>
          </Link>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Drug Shop Management System
          </p>
        </div>
        <div className="w-full max-w-md">{children}</div>
        <p className="mt-8 text-center text-xs text-[var(--muted-foreground)]">
          &copy; {new Date().getFullYear()} MediFlow. All rights reserved.
        </p>
      </div>
    </ToastProvider>
  );
}
