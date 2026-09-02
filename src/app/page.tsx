import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white dark:from-gray-900 dark:to-gray-950">
      <main className="mx-auto max-w-2xl px-6 text-center">
        <div className="mb-8">
          <h1 className="text-5xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
            MediFlow
          </h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
            Modern pharmacy and drug shop management, simplified.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Get Started
          </Link>
        </div>

        <div className="mt-16 grid gap-6 text-left sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 text-2xl">💊</div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Inventory
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Batch-aware inventory with expiry tracking and FEFO.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 text-2xl">🛒</div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Point of Sale
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Fast POS with offline support and receipt generation.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 text-2xl">📊</div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Reports
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Sales, inventory, financial reports and analytics.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
