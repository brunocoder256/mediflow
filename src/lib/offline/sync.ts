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

export async function queuePurchaseCreate(payload: Record<string, unknown>): Promise<string> {
  const op = crypto.randomUUID();
  const id = crypto.randomUUID();
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    operation_id: op,
    table_name: "purchases",
    operation: "create",
    payload: { ...payload, _offlineId: id, _operationId: op },
    status: "pending",
    created_at: new Date().toISOString(),
    retries: 0,
    error: null,
  });
  // also cache locally for immediate UI
  try{
    await db.cachedPurchases.add({
      id,
      supplier_id: (payload as any).supplier_id ?? "",
      branch_id: (payload as any).branch_id ?? "",
      status: "DRAFT",
      payload,
      sync_status: "pending",
      created_at: new Date().toISOString(),
      operation_id: op,
    });
  }catch{}
  return op;
}

export async function queuePurchaseReceive(payload: Record<string, unknown>): Promise<string> {
  const op = crypto.randomUUID();
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    operation_id: op,
    table_name: "purchases",
    operation: "update",
    payload: { action: "receive", ...payload, _operationId: op },
    status: "pending",
    created_at: new Date().toISOString(),
    retries: 0,
    error: null,
  });
  return op;
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

export async function getPurchasePendingCount(): Promise<number> {
  try{
    const c = await db.cachedPurchases.where("sync_status").equals("pending").count();
    const q = await db.syncQueue.where("table_name").equals("purchases").count();
    return Math.max(c, q);
  }catch{ return 0; }
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

      let response: Response;
      if (entry.table_name === "sales") {
        response = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry.payload),
        });
      } else if (entry.table_name === "purchases") {
        // purchases: route to /api/purchases with idempotency via operation_id
        const payload: any = entry.payload;
        // creation
        if (entry.operation === "create" && !payload.action) {
          response = await fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          // receive or other actions
          response = await fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }
        // on success, mark cached purchase synced
        if (response.ok) {
          const op = (payload as any)._operationId ?? entry.operation_id;
          const offId = (payload as any)._offlineId;
          if (offId) {
            try{ await db.cachedPurchases.update(offId, { sync_status: "synced" as any }); }catch{}
          } else if (op) {
            try{
              const c = await db.cachedPurchases.where("operation_id").equals(op).first();
              if(c) await db.cachedPurchases.update(c.id, { sync_status: "synced" as any });
            }catch{}
          }
        }
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
        const msg: string = json?.error ?? `Sync failed: ${response.status}`;
        const isConflict = /insufficient|stock|expired|unauthorized|branch|duplicate/i.test(msg);
        const retries = entry.retries + 1;
        if (isConflict) {
          await db.syncQueue.update(entry.id, {
            status: "failed",
            retries,
            error: msg,
          } as any);
          // also mark cached purchase failed
          try{
            const op = (entry.payload as any)._operationId ?? entry.operation_id;
            const c = await db.cachedPurchases.where("operation_id").equals(op).first();
            if(c) await db.cachedPurchases.update(c.id, { sync_status: "failed" as any });
          }catch{}
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
  const interval = window.setInterval(handler, 15000);
  return () => {
    window.removeEventListener("online", handler);
    clearInterval(interval);
  };
}
