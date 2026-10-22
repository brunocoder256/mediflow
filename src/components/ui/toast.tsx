"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast, type Toast } from "@/hooks/use-toast";

type ToastVariant = "default" | "success" | "error" | "warning";

const variantMeta: Record<
  ToastVariant,
  { Icon: typeof Info; accent: string; iconWrap: string }
> = {
  success: {
    Icon: CheckCircle2,
    accent: "bg-emerald-500",
    iconWrap: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  },
  error: {
    Icon: AlertCircle,
    accent: "bg-rose-500",
    iconWrap: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  },
  warning: {
    Icon: AlertTriangle,
    accent: "bg-amber-500",
    iconWrap: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  },
  default: {
    Icon: Info,
    accent: "bg-teal-500",
    iconWrap: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variant = toast.variant ?? "default";
  const { Icon, accent, iconWrap } = variantMeta[variant];
  const duration = toast.duration ?? 5000;

  return (
    <div
      role="status"
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "animate-toast-in pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-white/70",
        "bg-white/90 text-slate-900 shadow-[0_18px_45px_-16px_rgba(15,23,42,0.45)] backdrop-blur-xl",
        "dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1.5", accent)} aria-hidden />
      <div className="flex items-start gap-3 py-3.5 pl-5 pr-3">
        <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", iconWrap)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          {toast.title && <p className="text-sm font-semibold leading-5">{toast.title}</p>}
          {toast.description && (
            <p className="mt-0.5 break-words text-sm leading-5 text-slate-600 dark:text-slate-300">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                onDismiss(toast.id);
              }}
              className="mt-1.5 rounded text-xs font-semibold text-teal-700 underline underline-offset-2 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-current dark:text-teal-400"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/10 dark:hover:text-slate-100"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {duration > 0 && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-black/5 dark:bg-white/10" aria-hidden>
          <span
            className={cn("animate-toast-progress block h-full w-full", accent)}
            style={{ animationDuration: `${duration}ms` }}
          />
        </span>
      )}
    </div>
  );
}

function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:top-4 sm:px-4">
      {toasts.slice(-5).map((t) => (
        <div key={t.id} className="pointer-events-auto w-full max-w-md">
          <ToastItem toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}

export { Toaster, ToastItem };
