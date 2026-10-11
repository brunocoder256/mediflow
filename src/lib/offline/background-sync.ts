"use client";

// Requests a Background Sync flush of the offline write queue so queued POS /
// inventory / cash writes are replayed even when the user has left the tab
// (supported browsers fire the SW `sync` event once connectivity returns).

export const MEDIFLOW_SYNC_TAG = "mediflow-sync";

export async function requestBackgroundSync(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if ("sync" in reg) {
      await (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(
        MEDIFLOW_SYNC_TAG,
      );
    }
  } catch {
    // Background Sync unsupported / registration failed — foreground auto-sync
    // (setupAutoSync) still covers the common case.
  }
}
