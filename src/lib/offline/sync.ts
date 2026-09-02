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
  });

  return operation_id;
}

export async function checkDuplicateOperation(
  operation_id: string
): Promise<boolean> {
  const existing = await db.syncQueue
    .where("operation_id")
    .equals(operation_id)
    .first();

  if (existing) return true;

  const pending = await db.pendingSales
    .where("operation_id")
    .equals(operation_id)
    .first();

  return !!pending;
}

export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  const pending = await db.syncQueue
    .where("status")
    .equals("pending")
    .toArray();

  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await db.syncQueue.update(entry.id, { status: "processing" });

      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_id: entry.operation_id,
          table_name: entry.table_name,
          operation: entry.operation,
          payload: entry.payload,
        }),
      });

      if (!response.ok) throw new Error(`Sync failed: ${response.status}`);

      await db.syncQueue.delete(entry.id);
      processed++;
    } catch {
      const retries = entry.retries + 1;
      await db.syncQueue.update(entry.id, {
        status: retries >= 3 ? "failed" : "pending",
        retries,
      });
      failed++;
    }
  }

  return { processed, failed };
}
