"use client";

import { performLogout } from "@/lib/logout";

export function SuperAdminSignOut() {
  return (
    <button
      type="button"
      onClick={async () => {
        await performLogout();
        window.location.assign("/super-admin/login");
      }}
      className="rounded-md bg-destructive/10 px-3 py-1.5 font-medium text-destructive hover:bg-destructive/20"
    >
      Sign out
    </button>
  );
}