"use client";

// Functional notification bell: polls the real /api/notifications endpoint,
// shows an unread badge, renders the live list from the database, and lets
// the user mark items (or everything) as read. On desktop it shows a dropdown
// popover; on small screens it opens a bottom sheet that fits the phone.
import * as React from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const TYPE_COLORS: Record<string, string> = {
  low_stock: "bg-amber-500",
  expiry: "bg-orange-500",
  expired: "bg-red-500",
  pending_purchases: "bg-sky-500",
};

function NotificationRows({
  items,
  onSelect,
}: {
  items: NotificationItem[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="px-3 py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <Inbox className="h-6 w-6 opacity-40" />
        No notifications yet
      </div>
    );
  }
  return (
    <>
      {items.map((n) => (
        <DropdownMenuItem
          key={n.id}
          className={`items-start px-3 py-2.5 cursor-pointer whitespace-normal ${n.is_read ? "" : "bg-[var(--primary)]/5"}`}
          onSelect={(e) => {
            e.preventDefault();
            if (!n.is_read) onSelect(n.id);
          }}
        >
          <div className="flex items-start gap-2.5 w-full">
            <span
              className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                n.is_read ? "bg-[var(--muted)]" : TYPE_COLORS[n.type] ?? "bg-[var(--primary)]"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm leading-snug ${n.is_read ? "text-muted-foreground" : "font-medium"}`}>{n.title}</p>
              <p className="text-xs text-muted-foreground leading-snug">{n.message}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">{relativeTime(n.created_at)}</p>
            </div>
          </div>
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function NotificationsMenu() {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [unread, setUnread] = React.useState(0);
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const apply = React.useCallback((j: any) => {
    if (!j || !Array.isArray(j.notifications)) return;
    setItems(j.notifications);
    setUnread(j.unreadCount ?? 0);
  }, []);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) apply(await r.json());
    } catch { /* offline — keep current state */ }
  }, [apply]);

  React.useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const patch = async (body: { id?: string; all?: boolean }) => {
    try {
      const r = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) apply(await r.json());
    } catch { /* offline */ }
  };

  const bell = (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 p-0 text-xs"
        >
          {unread > 99 ? "99+" : unread}
        </Badge>
      )}
    </Button>
  );

  if (isDesktop) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{bell}</DropdownMenuTrigger>
        <DropdownMenuContent className="w-[min(calc(100vw-2rem),380px)]" align="end">
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            <span>Notifications</span>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => void patch({ all: true })}>
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-[min(360px,50dvh)] overflow-y-auto sm:max-h-[360px]">
            <NotificationRows items={items} onSelect={(id) => void patch({ id })} />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setSheetOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 p-0 text-xs"
          >
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
      </Button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="px-0 pb-4 pt-2">
          <SheetHeader className="flex-row items-center justify-between gap-2 px-4 pr-12 sm:text-left">
            <SheetTitle className="text-base">Notifications</SheetTitle>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => void patch({ all: true })}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </SheetHeader>
          <div className="max-h-[60dvh] overflow-y-auto px-1 mt-2">
            <NotificationRows items={items} onSelect={(id) => void patch({ id })} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
