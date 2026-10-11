"use client";

// Top-bar entry point for the "Ask MediFlow IQ" help assistant. Passing the
// current path as `from` lets the assistant prioritise help for the module the
// user is currently in, without adding a button to every page.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export function HelpAssistantButton() {
  const pathname = usePathname() || "/dashboard";
  const href = `/help?from=${encodeURIComponent(pathname)}`;

  return (
    <Link
      href={href}
      aria-label="Ask MediFlow IQ"
      title="Ask MediFlow IQ"
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
    >
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="hidden lg:inline">Ask MediFlow IQ</span>
    </Link>
  );
}
