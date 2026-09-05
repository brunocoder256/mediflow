"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./sidebar-items";
import { NAV_PERMISSION_MAP } from "@/lib/permissions-catalog";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [permissions, setPermissions] = React.useState<string[] | null>(null);

  React.useEffect(() => {
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
  }, []);

  const visible = navItems.filter((item) => {
    if (permissions === null) return true; // show all while loading to avoid flash-empty
    const required = NAV_PERMISSION_MAP[item.href];
    if (!required) return true;
    if (permissions.includes(required)) return true;
    // legacy manage grants
    if (required.startsWith("users.") && permissions.includes("users.manage")) return true;
    if (required.startsWith("settings.") && permissions.includes("settings.manage")) return true;
    if (required.startsWith("customers.") && permissions.includes("customers.manage")) return true;
    // owners with many perms: if they have users.manage show almost everything already covered
    return false;
  });

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-card transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]",
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            MF
          </div>
          {!collapsed && <span className="font-semibold text-lg">MediFlow</span>}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {visible.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-2",
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-2">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronsLeft className="h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
