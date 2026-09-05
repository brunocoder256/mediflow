import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SuperAdminSignOut } from "@/components/layout/super-admin-signout";
import { MediFlowMark } from "@/components/brand/mediflow-logo";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const sb: any = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/super-admin/login");

  const { data: isAdmin } = await sb.rpc("is_super_admin");
  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center">
          <h1 className="text-xl font-bold">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is not authorized to use the MediFlow Administration panel. Please sign out and try the main
            application.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Link href="/super-admin/accounts" className="flex items-center gap-2">
              <MediFlowMark size={28} />
              <span className="font-semibold">MediFlow Administration</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/super-admin/accounts" className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              Account Management
            </Link>
            <SuperAdminSignOut />
          </div>
        </div>
      </header>
      <main className="p-4 lg:p-6">{children}</main>
    </div>
  );
}