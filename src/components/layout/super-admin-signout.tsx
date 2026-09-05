"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export function SuperAdminSignOut() {
  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createBrowserClient();
        await supabase.auth.signOut();
        window.location.assign("/super-admin/login");
      }}
      className="rounded-md bg-destructive/10 px-3 py-1.5 font-medium text-destructive hover:bg-destructive/20"
    >
      Sign out
    </button>
  );
}