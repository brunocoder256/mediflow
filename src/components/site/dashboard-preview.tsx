import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShoppingCart,
} from "lucide-react";

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {/* Main dashboard card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            MediFlow Dashboard
          </div>
        </div>

        <div className="p-5">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                Today&apos;s Sales
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg dark:text-white">
                UGX 1,245,000
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Package className="h-3.5 w-3.5 text-sky-600" />
                Stock Value
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg dark:text-white">
                UGX 18.4M
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                Gross Profit
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg dark:text-white">
                UGX 412,000
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Low Stock
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg dark:text-white">
                24 items
              </p>
            </div>
          </div>

          {/* Chart mock */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Sales this week</p>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                +18%
              </span>
            </div>
            <div className="mt-3 flex h-16 items-end gap-1.5">
              {[40, 62, 48, 78, 55, 90, 70].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className={cn(
                    "flex-1 rounded-t-md",
                    i === 5 ? "bg-teal-600" : "bg-teal-200 dark:bg-slate-700",
                  )}
                />
              ))}
            </div>
          </div>

          {/* Recent sales rows */}
          <div className="mt-3 space-y-2">
            {[
              { name: "Antacid Tablets", qty: "×2", price: "UGX 8,000" },
              { name: "Pain Relief Syrup", qty: "×1", price: "UGX 15,500" },
              { name: "Vitamin C", qty: "×3", price: "UGX 12,000" },
            ].map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                  <ShoppingCart className="h-3.5 w-3.5 text-teal-600" />
                  {row.name}
                  <span className="text-slate-400">{row.qty}</span>
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">{row.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating indicator cards */}
      <div className="animate-float absolute -right-3 -top-5 hidden rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg shadow-slate-900/10 sm:block dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">24 products low in stock</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Reorder suggested</p>
          </div>
        </div>
      </div>

      <div className="animate-float-slow absolute -bottom-5 -left-3 hidden rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg shadow-slate-900/10 sm:block dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
            <Clock className="h-4 w-4 text-teal-700" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">12 batches expiring soon</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Plan your sales</p>
          </div>
        </div>
      </div>
    </div>
  );
}