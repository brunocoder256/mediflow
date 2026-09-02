"use client";

import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function SyncStatus() {
  const { isOnline } = useOnlineStatus();

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        isOnline
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="h-3 w-3" />
          ONLINE
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          OFFLINE
        </>
      )}
    </div>
  );
}

export function SyncingBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
      <RefreshCw className="h-3 w-3 animate-spin" />
      SYNCING
    </div>
  );
}
