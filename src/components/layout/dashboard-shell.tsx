"use client";

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { BranchProvider } from "@/hooks/branch-context";
import { PreferencesProvider } from "@/hooks/preferences-context";
import { ConfirmProvider } from "@/hooks/use-confirm";
import { setupAutoSync } from "@/lib/offline/sync";
import { invalidateCache } from "@/lib/offline/cached-fetch";
import { tryRestoreServerSession } from "@/lib/offline/reauth";
import { isOfflineSessionAuthorized } from "@/lib/offline/session-signal";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Offline auth guard. The service worker serves cached app-shell HTML when the
  // server is unreachable, so Next middleware NEVER runs offline. Without this
  // guard, opening the installed PWA offline would drop straight into the app
  // shell + local Dexie cache with no passcode. Allow entry only when there is a
  // valid offline passcode grant OR a still-valid cached Supabase session.
  React.useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (typeof navigator === "undefined" || navigator.onLine) return;
      if (isOfflineSessionAuthorized()) return;
      try {
        const supabase = createBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (data.session) return;
      } catch {
        /* offline: session refresh unavailable */
      }
      if (!cancelled) router.replace("/auth/login");
    };
    void verify();
    window.addEventListener("offline", verify);
    return () => {
      cancelled = true;
      window.removeEventListener("offline", verify);
    };
  }, [router]);

  // Global offline-sync: when the device regains connectivity (or every 15s),
  // flush any queued offline writes (products, sales, purchases, customers, ...).
  // Without this, work queued on non-POS pages would never reach the server until
  // the user visited the POS or Sync Center page.
  React.useEffect(() => {
    const invalidateLists = () => {
      for (const prefix of ["/api/products", "/api/inventory", "/api/sales", "/api/purchases", "/api/customers", "/api/suppliers", "/api/returns", "/api/purchase-returns", "/api/expenses", "/api/cash", "/api/disposals", "/api/stock-movements", "/api/reports"]) {
        void invalidateCache(prefix);
      }
    };
    return setupAutoSync((result) => {
      if (!result || result.processed < 1) return;
      invalidateLists();
      try { window.dispatchEvent(new Event("mediflow:synced")); } catch { /* ignore */ }
      toast({ description: "Offline changes synced" });
    });
  }, [toast]);

  // Silent server-session restore: if the user opened the app via offline
  // passcode and the device is now online, re-establish the REAL Supabase
  // session (from the stored refresh token) so APIs authenticate again and the
  // auto-sync above can flush queued offline work. No prompt, no data loss.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const reauth = async () => {
      try {
        await tryRestoreServerSession();
      } catch {
        /* non-blocking */
      }
    };
    void reauth();
    window.addEventListener("online", reauth);
    return () => window.removeEventListener("online", reauth);
  }, []);

  return (
    <BranchProvider>
      <PreferencesProvider>
        <ConfirmProvider>
          <div className="flex h-screen overflow-hidden bg-background">
            {/* Desktop Sidebar */}
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

            {/* Mobile Navigation */}
            <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <Topbar onMenuClick={() => setMobileNavOpen(true)} />
              <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                {children}
              </main>
            </div>
          </div>
        </ConfirmProvider>
      </PreferencesProvider>
    </BranchProvider>
  );
}