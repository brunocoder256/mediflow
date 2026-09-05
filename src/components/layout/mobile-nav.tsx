"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./sidebar-items";
import { NAV_PERMISSION_MAP } from "@/lib/permissions-catalog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MediFlowMark } from "@/components/brand/mediflow-logo";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Truck,
  Users,
  Receipt,
  RotateCcw,
  DollarSign,
  UserCircle,
  BarChart3,
  FileText,
  Settings,
} from "lucide-react";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/pos": ShoppingCart,
  "/products": Package,
  "/inventory": Warehouse,
  "/purchases": Truck,
  "/suppliers": Users,
  "/sales": Receipt,
  "/returns": RotateCcw,
  "/expenses": DollarSign,
  "/customers": UserCircle,
  "/reports": BarChart3,
  "/users": Users,
  "/audit": FileText,
  "/settings": Settings,
};

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();
  const [permissions, setPermissions] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) {
          if (!cancelled) setPermissions([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setPermissions(data.permissions ?? []);
      } catch {
        if (!cancelled) setPermissions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const visible = navItems.filter((item) => {
    if (permissions === null) return true;
    const required = NAV_PERMISSION_MAP[item.href];
    if (!required) return true;
    if (permissions.includes(required)) return true;
    if (required.startsWith("users.") && permissions.includes("users.manage")) return true;
    if (required.startsWith("settings.") && permissions.includes("settings.manage")) return true;
    if (required.startsWith("customers.") && permissions.includes("customers.manage")) return true;
    return false;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] p-0 flex flex-col overflow-hidden bg-card">
        <SheetHeader className="border-b bg-muted/30 p-4 shrink-0">
          <SheetTitle className="flex items-center gap-3 text-left">
            <MediFlowMark size={36} />
            <div className="flex flex-col">
              <span className="text-base font-semibold leading-none">MediFlow</span>
              <span className="text-xs font-normal text-muted-foreground">Pharmacy Management</span>
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-1 px-3">
            {visible.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              const Icon = iconMap[item.href] || item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-all border",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm border-primary"
                        : "bg-card text-foreground border-transparent hover:bg-accent hover:text-accent-foreground hover:border-border shadow-sm"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                    <span>{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t p-3 shrink-0 bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} MediFlow</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}