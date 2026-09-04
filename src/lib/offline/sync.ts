import { db } from "./db";

export async function addToSyncQueue(entry: {
  table_name: string;
  operation: "create" | "update" | "delete";
  payload: Record<string, unknown>;
}): Promise<string> {
  const operation_id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.syncQueue.add({
    id: crypto.randomUUID(),
    operation_id,
    table_name: entry.table_name,
    operation: entry.operation,
    payload: entry.payload,
    status: "pending",
    created_at: now,
    retries: 0,
    error: null,
  });

  return operation_id;
}

export async function queuePosSale(payload: Record<string, unknown>, operation_id: string) {
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    operation_id,
    table_name: "sales",
    operation: "create",
    payload,
    status: "pending",
    created_at: new Date().toISOString(),
    retries: 0,
    error: null,
  });
}

export async function checkDuplicateOperation(operation_id: string): Promise<boolean> {
  const existing = await db.syncQueue.where("operation_id").equals(operation_id).first();
  if (existing) return true;
  const pending = await db.pendingSales.where("operation_id").equals(operation_id).first();
  return !!pending;
}

export async function getPendingCount(): Promise<number> {
  return db.syncQueue.where("status").equals("pending").count();
}

export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
  pending: number;
}> {
  const pending = await db.syncQueue.where("status").equals("pending").toArray();

  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await db.syncQueue.update(entry.id, { status: "processing", last_attempt_at: new Date().toISOString() });

      // Sales go to /api/sales (authoritative, idempotent via operation_id)
      let response: Response;
      if (entry.table_name === "sales") {
        response = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry.payload),
        });
      } else {
        response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation_id: entry.operation_id,
            table_name: entry.table_name,
            operation: entry.operation,
            payload: entry.payload,
          }),
        });
      }

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Conflict/insufficient stock -> mark failed with reason (don't auto-retry forever)
        const msg: string = json?.error ?? `Sync failed: ${response.status}`;
        const isConflict = /insufficient|stock|expired|unauthorized|branch/i.test(msg);
        const retries = entry.retries + 1;
        if (isConflict) {
          await db.syncQueue.update(entry.id, {
            status: "failed",
            retries,
            error: msg,
          } as any);
        } else {
          await db.syncQueue.update(entry.id, {
            status: retries >= 3 ? "failed" : "pending",
            retries,
            error: msg,
          } as any);
        }
        failed++;
        continue;
      }

      // success or duplicate (200 with duplicate flag) -> remove
      await db.syncQueue.delete(entry.id);
      processed++;
    } catch (e: any) {
      const retries = entry.retries + 1;
      await db.syncQueue.update(entry.id, {
        status: retries >= 3 ? "failed" : "pending",
        retries,
        error: e?.message ?? "Network error",
        last_attempt_at: new Date().toISOString(),
      } as any);
      failed++;
    }
  }

  const remaining = await db.syncQueue.where("status").equals("pending").count();
  return { processed, failed, pending: remaining };
}

// Auto-sync when coming back online
export function setupAutoSync(onUpdate?: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = async () => {
    if (navigator.onLine) {
      await processSyncQueue();
      onUpdate?.();
    }
  };
  window.addEventListener("online", handler);
  // periodic retry
  const interval = window.setInterval(handler, 15000);
  return () => {
    window.removeEventListener("online", handler);
    clearInterval(interval);
  };
}
