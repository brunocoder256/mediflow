"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useToast, type Toast } from "@/hooks/use-toast";

type ToastVariant = "default" | "success" | "error" | "warning";

const variantStyles: Record<ToastVariant, string> = {
  default: "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]",
  success: "border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
  error: "border-[var(--destructive)]/50 bg-[var(--destructive)]/10 text-[var(--destructive)]",
  warning: "border-yellow-500/50 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all",
        "animate-in slide-in-from-top-full fade-in-0",
        variantStyles[toast.variant ?? "default"],
      )}
    >
      <div className="flex-1 space-y-1">
        {toast.title && (
          <p className="text-sm font-semibold">{toast.title}</p>
        )}
        {toast.description && (
          <p className="text-sm opacity-90">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

export { Toaster, ToastItem };
