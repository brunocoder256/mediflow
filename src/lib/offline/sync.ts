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

export async function queueSupplierCreate(payload: Record<string, unknown>): Promise<string> {
  const op = crypto.randomUUID();
  const id = crypto.randomUUID();
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    operation_id: op,
    table_name: "suppliers",
    operation: "create",
    payload: { ...payload, _offlineId: id, _operationId: op },
    status: "pending",
    created_at: new Date().toISOString(),
    retries: 0,
    error: null,
  });
  try{
    await db.cachedSuppliers.add({
      id,
      name: String((payload as any).name ?? "Draft Supplier"),
      supplier_code: null,
      supplier_type: (payload as any).supplier_type ?? null,
      status: "Active",
      phone: (payload as any).phone ?? null,
      email: (payload as any).email ?? null,
      is_active: true,
      payload,
      sync_status: "pending",
      operation_id: op,
      updated_at: new Date().toISOString(),
    } as any);
  }catch{}
  return op;
}

export async function queueSupplierUpdate(id: string, payload: Record<string, unknown>): Promise<string> {
  const op = crypto.randomUUID();
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    operation_id: op,
    table_name: "suppliers",
    operation: "update",
    payload: { id, ...payload, _operationId: op },
    status: "pending",
    created_at: new Date().toISOString(),
    retries: 0,
    error: null,
  });
  return op;
}

export async function getSupplierPendingCount(): Promise<number> {
  try{
    const c = await db.cachedSuppliers.where("sync_status").equals("pending").count();
    const q = await db.syncQueue.where("table_name").equals("suppliers").count();
    return Math.max(c, q);
  }catch{ return 0; }
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

export async function queueReturnCreate(payload: Record<string, unknown>, type: "SALES"|"PURCHASE"): Promise<string>{
  const op=crypto.randomUUID(); const id=crypto.randomUUID();
  await db.syncQueue.add({ id:crypto.randomUUID(), operation_id:op, table_name:"returns", operation:"create", payload:{ ...payload, _offlineId:id, _operationId:op, _returnType:type }, status:"pending", created_at:new Date().toISOString(), retries:0, error:null });
  try{
    await db.cachedReturns.add({ id, return_type:type, sale_id:(payload as any).sale_id ?? null, purchase_order_id:(payload as any).purchase_order_id ?? null, supplier_id:(payload as any).supplier_id ?? null, branch_id:(payload as any).branch_id ?? "", status:"pending", total: Number((payload as any).total ?? 0), payload, sync_status:"pending", operation_id:op, created_at:new Date().toISOString() } as any);
  }catch{}
  return op;
}

export async function getReturnsPendingCount(): Promise<number>{
  try{ const c=await db.cachedReturns.where("sync_status").equals("pending").count(); const q=await db.syncQueue.where("table_name").equals("returns").count(); return Math.max(c,q); }catch{ return 0; }
}

export async function getPurchasePendingCount(): Promise<number> {
  try{
    const c = await db.cachedPurchases.where("sync_status").equals("pending").count();
    const q = await db.syncQueue.where("table_name").equals("purchases").count();
    return Math.max(c, q);
  }catch{ return 0; }
}

export async function queueExpenseCreate(payload: Record<string, unknown>): Promise<string> {
  const op = crypto.randomUUID(); const id=crypto.randomUUID();
  await db.syncQueue.add({ id: crypto.randomUUID(), operation_id: op, table_name: "expenses", operation: "create", payload: { ...payload, _offlineId:id, _operationId:op, idempotency_key: op }, status:"pending", created_at:new Date().toISOString(), retries:0, error:null });
  try{
    await db.cachedExpenses.add({ id, branch_id: String((payload as any).branch_id ?? ""), category: String((payload as any).category ?? ""), category_id: (payload as any).category_id ?? null, supplier_id: (payload as any).supplier_id ?? null, amount: Number((payload as any).amount ?? 0), total_amount: Number((payload as any).amount ?? 0)+Number((payload as any).tax_amount??0), expense_date: String((payload as any).expense_date ?? new Date().toISOString().slice(0,10)), approval_status:"DRAFT", payment_status:"UNPAID", payload, sync_status:"pending", operation_id:op, created_at:new Date().toISOString() } as any);
  }catch{}
  return op;
}
export async function getExpensePendingCount(): Promise<number> {
  try{ const c=await db.cachedExpenses.where("sync_status").equals("pending").count(); const q=await db.syncQueue.where("table_name").equals("expenses").count(); return Math.max(c,q); }catch{return 0;}
}
export async function queueCustomerCreate(payload: Record<string, unknown>): Promise<string> {
  const op=crypto.randomUUID(); const id=crypto.randomUUID();
  await db.syncQueue.add({ id:crypto.randomUUID(), operation_id:op, table_name:"customers", operation:"create", payload:{...payload, _offlineId:id, _operationId:op}, status:"pending", created_at:new Date().toISOString(), retries:0, error:null });
  try{
    await db.cachedCustomers.add({ id, name: String((payload as any).display_name ?? (payload as any).name ?? "Customer"), display_name: String((payload as any).display_name ?? (payload as any).name ?? ""), phone: (payload as any).phone ?? null, email: (payload as any).email ?? null, branch_id: (payload as any).branch_id ?? null, customer_type: (payload as any).customer_type ?? "INDIVIDUAL", status:"ACTIVE", is_active:true, payload, sync_status:"pending", operation_id:op, created_at:new Date().toISOString()} as any);
  }catch{}
  return op;
}
export async function queueCustomerUpdate(id:string, payload: Record<string, unknown>): Promise<string>{
  const op=crypto.randomUUID();
  await db.syncQueue.add({ id:crypto.randomUUID(), operation_id:op, table_name:"customers", operation:"update", payload:{id, ...payload, _operationId:op}, status:"pending", created_at:new Date().toISOString(), retries:0, error:null });
  return op;
}
export async function getCustomerPendingCount(): Promise<number>{
  try{ const c=await db.cachedCustomers.where("sync_status").equals("pending").count(); const q=await db.syncQueue.where("table_name").equals("customers").count(); return Math.max(c,q);}catch{return 0;}
}

// ---------------------------------------------------------------------------
// Offline cash register / session / movement support
// ---------------------------------------------------------------------------

export function queueCashRegisterCreate(payload: Record<string, unknown>): Promise<string> {
  return queueGenericCreate("cash_registers", "cachedCashRegisters", payload,
    (d, op) => db.cachedCashRegisters.add({
      id: crypto.randomUUID(),
      branch_id: String((payload as any).branch_id ?? ""),
      name: String((payload as any).name ?? "Register"),
      code: String((payload as any).code ?? ""),
      is_active: true,
      payload,
      sync_status: "pending" as any,
      operation_id: op,
      created_at: new Date().toISOString(),
    } as any));
}

export function queueCashSessionOpen(payload: Record<string, unknown>): Promise<string> {
  return queueGenericCreate("cash_sessions", "cachedCashSessions", payload,
    (d, op) => db.cachedCashSessions.add({
      id: crypto.randomUUID(),
      register_id: String((payload as any).register_id ?? ""),
      branch_id: String((payload as any).branch_id ?? ""),
      cashier_id: "",
      status: "OPEN",
      opening_float: Number((payload as any).opening_float ?? 0),
      expected_cash: null,
      closing_cash: null,
      cash_variance: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      notes: String((payload as any).notes ?? null),
      payload,
      sync_status: "pending" as any,
      operation_id: op,
      created_at: new Date().toISOString(),
    } as any));
}

// Queue a cash session write action (e.g. "close") for offline replay.
export function queueCashSessionAction(
  payload: Record<string, unknown>,
): Promise<string> {
  const op = crypto.randomUUID();
  return db.syncQueue.add({
    id: crypto.randomUUID(),
    operation_id: op,
    table_name: "cash_sessions",
    operation: "update",
    payload: { ...payload, _operationId: op, _actionFromQueue: true },
    status: "pending",
    created_at: new Date().toISOString(),
    retries: 0,
    error: null,
  }).then(() => op);
}

export function queueCashMovement(payload: Record<string, unknown>): Promise<string> {
  return queueGenericCreate("cash_movements", "cachedCashMovements", payload,
    (d, op) => db.cachedCashMovements.add({
      id: crypto.randomUUID(),
      session_id: String((payload as any).session_id ?? ""),
      branch_id: String((payload as any).branch_id ?? ""),
      type: String((payload as any).type ?? "CASH_IN"),
      direction: (payload as any).direction === "OUT" ? "OUT" : "IN",
      amount: Number((payload as any).amount ?? 0),
      reason: (payload as any).reason ?? null,
      payload,
      sync_status: "pending" as any,
      operation_id: op,
      created_at: new Date().toISOString(),
    } as any));
}

export function queueProductCreate(payload: Record<string, unknown>): Promise<string> {
  return queueGenericCreate("products", "cachedProducts", payload,
    (d, op) => db.cachedProducts.add({
      id: crypto.randomUUID(),
      name: String((payload as any).name ?? "Product"),
      sku: (payload as any).sku ?? null,
      barcode: (payload as any).barcode ?? null,
      is_active: true,
      payload,
      sync_status: "pending" as any,
      operation_id: op,
      created_at: new Date().toISOString(),
    } as any));
}

export function queueProductUpdate(id: string, payload: Record<string, unknown>): Promise<string> {
  const op = crypto.randomUUID();
  return db.syncQueue.add({
    id: crypto.randomUUID(),
    operation_id: op,
    table_name: "products",
    operation: "update",
    payload: { id, ...payload, _operationId: op },
    status: "pending",
    created_at: new Date().toISOString(),
    retries: 0,
    error: null,
  }).then(() => op);
}

export function queueProductToggle(id: string, active: boolean): Promise<string> {
  return queueProductUpdate(id, { action: active ? "deactivate" : "reactivate" });
}

async function queueGenericCreate(
  tableName: string,
  cachedTable: "cachedCashRegisters" | "cachedCashSessions" | "cachedCashMovements" | "cachedProducts",
  payload: Record<string, unknown>,
  addCached: (d: any, op: string) => Promise<unknown>,
): Promise<string> {
  const op = crypto.randomUUID();
  const internal: any = { ...payload, _operationId: op };
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    operation_id: op,
    table_name: tableName,
    operation: "create",
    payload: internal,
    status: "pending",
    created_at: new Date().toISOString(),
    retries: 0,
    error: null,
  });
  try { await addCached(tableName, op); } catch {}
  return op;
}

export async function getCashPendingCount(): Promise<number> {
  try {
    const s = await db.cachedCashSessions.where("sync_status").equals("pending").count();
    const m = await db.cachedCashMovements.where("sync_status").equals("pending").count();
    const r = await db.cachedCashRegisters.where("sync_status").equals("pending").count();
    const q = await db.syncQueue.where("table_name").equals("cash_sessions").or("table_name").equals("cash_movements").or("table_name").equals("cash_registers").count();
    return Math.max(s + m + r, q);
  } catch { return 0; }
}

export async function getProductPendingCount(): Promise<number> {
  try {
    const c = await db.cachedProducts.where("sync_status").equals("pending").count();
    const q = await db.syncQueue.where("table_name").equals("products").count();
    return Math.max(c, q);
  } catch { return 0; }
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
        const payload: any = entry.payload;
        if (entry.operation === "create" && !payload.action) {
          response = await fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          response = await fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }
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
      } else if (entry.table_name === "returns") {
        const payload:any=entry.payload; const offId=payload._offlineId; const op=payload._operationId ?? entry.operation_id; const rType=payload._returnType ?? "SALES"; const clean:any={...payload}; delete clean._offlineId; delete clean._operationId; delete clean._returnType;
        if(rType==="PURCHASE"){
          response = await fetch("/api/purchase-returns",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...clean, operation_id: op }) });
        } else {
          response = await fetch("/api/returns",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...clean, operation_id: op }) });
        }
        if(response.ok){
          if(offId){ try{ await db.cachedReturns.update(offId,{ sync_status:"synced" as any }); }catch{} }
          else if(op){ try{ const c=await db.cachedReturns.where("operation_id").equals(op).first(); if(c) await db.cachedReturns.update(c.id,{ sync_status:"synced" as any }); }catch{} }
        }
      } else if (entry.table_name === "expenses") {
        const payload:any=entry.payload; const offId=payload._offlineId; const op=payload._operationId ?? entry.operation_id; const clean:any={...payload}; delete clean._offlineId; delete clean._operationId; // keep idempotency_key
        response = await fetch("/api/expenses",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...clean, idempotency_key: op }) });
        if(response.ok){
          if(offId){ try{ await db.cachedExpenses.update(offId,{ sync_status:"synced" as any }); }catch{} }
          else if(op){ try{ const c=await db.cachedExpenses.where("operation_id").equals(op).first(); if(c) await db.cachedExpenses.update(c.id,{ sync_status:"synced" as any }); }catch{} }
        }
      } else if (entry.table_name === "customers") {
        const payload:any=entry.payload; const offId=payload._offlineId; const op=payload._operationId ?? entry.operation_id; const clean:any={...payload}; delete clean._offlineId; delete clean._operationId;
        if(entry.operation==="create"){
          response = await fetch("/api/customers",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...clean, continue_anyway: false }) });
        } else {
          const cid=clean.id; delete clean.id;
          response = await fetch("/api/customers",{ method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id: cid, ...clean }) });
        }
        if(response.ok){
          if(offId){ try{ await db.cachedCustomers.update(offId,{ sync_status:"synced" as any }); }catch{} }
          else if(op){ try{ const c=await db.cachedCustomers.where("operation_id").equals(op).first(); if(c) await db.cachedCustomers.update(c.id,{ sync_status:"synced" as any }); }catch{} }
        } else {
          // duplicate detection — mark as failed not retry infinitely
          const txt=await response.text().catch(()=> "");
          if(txt.includes("similar customer") || response.status===409){
            await db.syncQueue.update(entry.id,{ status:"failed", error:"Duplicate customer — review" } as any);
            if(offId) try{ await db.cachedCustomers.update(offId,{ sync_status:"failed" as any }); }catch{}
            failed++; continue;
          }
        }
      } else if (entry.table_name === "suppliers") {
        const payload: any = entry.payload;
        const offId = payload._offlineId;
        const op = payload._operationId ?? entry.operation_id;
        // filter internal keys
        const clean: any = { ...payload };
        delete clean._offlineId; delete clean._operationId;
        if (entry.operation === "create") {
          response = await fetch("/api/suppliers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(clean),
          });
        } else {
          const sid = clean.id;
          delete clean.id;
          response = await fetch(`/api/suppliers?id=${sid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(clean),
          });
        }
        if (response.ok && offId) {
          try{ await db.cachedSuppliers.update(offId, { sync_status: "synced" as any }); }catch{}
          // also remove local cached pending after sync success - keep but mark synced
        } else if (response.ok && op) {
          try{
            const c = await db.cachedSuppliers.where("operation_id").equals(op).first();
            if(c) await db.cachedSuppliers.update(c.id, { sync_status: "synced" as any });
          }catch{}
        }
      } else if (entry.table_name === "cash_registers") {
        const payload: any = entry.payload;
        const op = payload._operationId ?? entry.operation_id;
        const clean: any = { ...payload };
        delete clean._operationId;
        response = await fetch("/api/cash/registers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clean),
        });
        if (response.ok) {
          try{ const c = await db.cachedCashRegisters.where("operation_id").equals(op).first(); if(c) await db.cachedCashRegisters.update(c.id, { sync_status: "synced" as any }); }catch{}
        }
      } else if (entry.table_name === "cash_sessions") {
        const payload: any = entry.payload;
        const op = payload._operationId ?? entry.operation_id;
        const clean: any = { ...payload };
        delete clean._operationId; delete clean._actionFromQueue;
        const action = clean.action || "open";
        response = await fetch("/api/cash/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...clean }),
        });
        if (response.ok) {
          try{ const c = await db.cachedCashSessions.where("operation_id").equals(op).first(); if(c) await db.cachedCashSessions.update(c.id, { sync_status: "synced" as any }); }catch{}
        }
      } else if (entry.table_name === "cash_movements") {
        const payload: any = entry.payload;
        const op = payload._operationId ?? entry.operation_id;
        const clean: any = { ...payload };
        delete clean._operationId;
        response = await fetch("/api/cash/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "movement", ...clean }),
        });
        if (response.ok) {
          try{ const c = await db.cachedCashMovements.where("operation_id").equals(op).first(); if(c) await db.cachedCashMovements.update(c.id, { sync_status: "synced" as any }); }catch{}
        }
      } else if (entry.table_name === "products") {
        const payload: any = entry.payload;
        const op = payload._operationId ?? entry.operation_id;
        const clean: any = { ...payload };
        delete clean._operationId;
        if (entry.operation === "update") {
          const pid = clean.id;
          delete clean.id;
          response = await fetch("/api/products", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: pid, ...clean }),
          });
        } else {
          response = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(clean),
          });
        }
        if (response.ok) {
          try{ const c = await db.cachedProducts.where("operation_id").equals(op).first(); if(c) await db.cachedProducts.update(c.id, { sync_status: "synced" as any }); }catch{}
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
          try{
            const op = (entry.payload as any)._operationId ?? entry.operation_id;
            const c = await db.cachedPurchases.where("operation_id").equals(op).first();
            if(c) await db.cachedPurchases.update(c.id, { sync_status: "failed" as any });
            const cs = await db.cachedSuppliers.where("operation_id").equals(op).first();
            if(cs) await db.cachedSuppliers.update(cs.id, { sync_status: "failed" as any });
            const cr = await db.cachedReturns.where("operation_id").equals(op).first();
            if(cr) await db.cachedReturns.update(cr.id, { sync_status: "failed" as any });
            const ce = await db.cachedExpenses.where("operation_id").equals(op).first();
            if(ce) await db.cachedExpenses.update(ce.id, { sync_status: "failed" as any });
            const cc = await db.cachedCustomers.where("operation_id").equals(op).first();
            if(cc) await db.cachedCustomers.update(cc.id, { sync_status: "failed" as any });
            const ccr = await db.cachedCashRegisters.where("operation_id").equals(op).first();
            if(ccr) await db.cachedCashRegisters.update(ccr.id, { sync_status: "failed" as any });
            const ccs = await db.cachedCashSessions.where("operation_id").equals(op).first();
            if(ccs) await db.cachedCashSessions.update(ccs.id, { sync_status: "failed" as any });
            const ccm = await db.cachedCashMovements.where("operation_id").equals(op).first();
            if(ccm) await db.cachedCashMovements.update(ccm.id, { sync_status: "failed" as any });
            const cpr = await db.cachedProducts.where("operation_id").equals(op).first();
            if(cpr) await db.cachedProducts.update(cpr.id, { sync_status: "failed" as any });
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

  if (processed > 0 && typeof window !== "undefined") {
    try { localStorage.setItem("mediflow_last_sync", new Date().toISOString()); } catch { /* ignore */ }
  }
  const remaining = await db.syncQueue.where("status").equals("pending").count();
  return { processed, failed, pending: remaining };
}

// Auto-sync when coming back online
export function setupAutoSync(onUpdate?: (result: { processed: number; failed: number; pending: number }) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = async () => {
    if (navigator.onLine) {
      const result = await processSyncQueue();
      onUpdate?.(result);
    }
  };
  window.addEventListener("online", handler);
  const interval = window.setInterval(handler, 15000);
  return () => {
    window.removeEventListener("online", handler);
    clearInterval(interval);
  };
}
