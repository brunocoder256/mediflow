/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB, getProfileId, getOrgId, createAuditLog } from "./supabase";
import { supplierSchema } from "@/lib/validations/suppliers";

function cleanEmpty(v: any) {
  if (v === "" || v === undefined) return null;
  return v;
}

export async function getSuppliers(params?: {
  search?: string;
  supplier_type?: string;
  status?: string;
  city?: string;
  branch_id?: string;
  page?: number;
  perPage?: number;
  includeInactive?: boolean;
}) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Missing organization");
  let q = sb.from("suppliers").select("*", { count: "exact" }).eq("organization_id", orgId).order("name");

  // default hide inactive unless requested
  if (!params?.includeInactive) {
    if (params?.status) q = q.eq("status", params.status);
    else q = q.neq("status", "Inactive");
  } else if (params?.status) {
    q = q.eq("status", params.status);
  }

  if (params?.supplier_type && params.supplier_type !== "all") q = q.eq("supplier_type", params.supplier_type);
  if (params?.city) q = q.eq("city", params.city);

  // branch filter via junction if exists
  let branchSupplierIds: string[] | null = null;
  if (params?.branch_id && params.branch_id !== "all") {
    try {
      const { data: links } = await sb.from("supplier_branches").select("supplier_id").eq("branch_id", params.branch_id).eq("is_active", true);
      branchSupplierIds = (links ?? []).map((l: any) => l.supplier_id);
      if ((branchSupplierIds as string[]).length === 0) return { data: [], count: 0 };
    } catch {
      // table missing -> ignore
    }
  }

  if (params?.search && params.search.trim()) {
    const s = params.search.trim();
    // server-side ilike on name/code/phone/email/contact
    q = q.or(`name.ilike.%${s}%,supplier_code.ilike.%${s}%,contact_person.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,business_registration_number.ilike.%${s}%,city.ilike.%${s}%`);
  }

  if (params?.page && params?.perPage) {
    const from = (params.page - 1) * params.perPage;
    q = q.range(from, from + params.perPage - 1);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  let list = (data ?? []) as any[];
  if (branchSupplierIds && branchSupplierIds.length>=0) {
    const set = new Set(branchSupplierIds as string[]);
    list = list.filter((s: any) => set.has(s.id));
  }

  // enrich with balances (transaction-derived, never stale local)
  // Use rpc if available, fallback to computed
  const enriched = await Promise.all(
    list.map(async (s: any) => {
      try {
        let bal: number = 0;
        try {
          const { data: rb } = await sb.rpc("get_supplier_balance", { p_supplier_id: s.id, p_org_id: orgId });
          bal = rb?.[0]?.balance ?? rb?.balance ?? 0;
        } catch {
          // fallback: compute from purchase_orders + payments
          const [{ data: pos }, { data: pays }, { data: rets }] = await Promise.all([
            sb.from("purchase_orders").select("total").eq("supplier_id", s.id).eq("organization_id", orgId).neq("status", "CANCELLED"),
            sb.from("supplier_payments").select("amount").eq("supplier_id", s.id).eq("organization_id", orgId),
            sb.from("purchase_returns").select("total").eq("supplier_id", s.id).eq("organization_id", orgId).in("status", ["approved", "completed"]).then((r: any) => r).catch(() => ({ data: [] })) as any,
          ]);
          const ordered = (pos ?? []).reduce((a: number, p: any) => a + Number(p.total), 0);
          const paid = (pays ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
          const ret = (rets?.data ?? rets ?? []).reduce((a: number, r: any) => a + Number(r.total ?? 0), 0);
          bal = ordered - paid - ret;
        }
        return { ...s, balance: Number(bal) };
      } catch {
        return { ...s, balance: 0 };
      }
    })
  );

  // attach counts: products, open POs
  for (const s of enriched) {
    try {
      const [{ count: pc }, { data: pos }] = await Promise.all([
        sb.from("product_suppliers").select("id", { count: "exact", head: true }).eq("supplier_id", s.id).then((r: any) => ({ count: r.count ?? 0 })).catch(() => ({ count: 0 })) as any,
        sb.from("purchase_orders").select("status").eq("supplier_id", s.id).eq("organization_id", orgId).in("status", ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "SENT", "APPROVED", "PENDING_APPROVAL"]).then((r: any) => r).catch(() => ({ data: [] })) as any,
      ]);
      (s as any).products_count = pc ?? 0;
      (s as any).open_pos = (pos ?? []).length;
      (s as any).last_purchase_at = null; // filled in detail
    } catch {}
  }

  return { data: enriched, count: count ?? enriched.length };
}

export async function getSupplierById(id: string) {
  const sb: any = await getSB();
  const { data, error } = await sb.from("suppliers").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSupplierDetail(id: string) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Missing organization");

  const supplier = await getSupplierById(id);

  // All supplier-related aggregates in parallel
  const [products, priceHistory, audit, branches, notes, documents] = await Promise.all([
    sb.from("product_suppliers").select("*, products(id,name,sku,barcode,generic_name,strength,dosage_form,preferred_supplier_id)").eq("supplier_id", id).then((r: any) => r.data ?? []).catch(() => []),
    sb.from("supplier_price_history").select("*, products(name)").eq("supplier_id", id).order("effective_date", { ascending: false }).limit(50).then((r: any) => r.data ?? []).catch(() => []),
    sb.from("audit_logs").select("*").eq("entity_id", id).order("created_at", { ascending: false }).limit(50).then((r: any) => r.data ?? []).catch(() => []),
    sb.from("supplier_branches").select("*, branches(id,name,code)").eq("supplier_id", id).then((r: any) => r.data ?? []).catch(() => []),
    sb.from("supplier_notes").select("*, profiles:created_by(id)").eq("supplier_id", id).order("created_at", { ascending: false }).limit(50).then((r: any) => r.data ?? []).catch(() => []),
    sb.from("supplier_documents").select("*").eq("supplier_id", id).order("created_at", { ascending: false }).then((r: any) => r.data ?? []).catch(() => []),
  ]);

  // Purchases / POs
  const { data: pos } = await sb.from("purchase_orders").select("*, purchase_items(*, products(name)), branches(name)").eq("supplier_id", id).eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50);
  const poIds = (pos ?? []).map((p: any) => p.id);

  // Derived stats
  let grns: any[] = [];
  let batches: any[] = [];
  let payments: any[] = [];
  let returns: any[] = [];
  let movements: any[] = [];
  try {
    const [grRes, batRes, payRes, retRes, movRes] = await Promise.all([
      poIds.length ? sb.from("goods_receipts").select("*, goods_receipt_items(*)").in("purchase_order_id", poIds).order("received_at", { ascending: false }).limit(30).then((r: any) => r).catch(() => ({ data: [] })) as any : { data: [] },
      sb.from("product_batches").select("*, products(name), purchase_orders:purchase_item_id(purchase_orders(purchase_number))").eq("supplier_id", id).eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50).then((r: any) => r).catch(() => ({ data: [] })) as any,
      sb.from("supplier_payments").select("*").eq("supplier_id", id).eq("organization_id", orgId).order("payment_date", { ascending: false }).limit(50).then((r: any) => r).catch(() => ({ data: [] })) as any,
      poIds.length ? sb.from("purchase_returns").select("*, purchase_return_items(*)").in("purchase_order_id", poIds).order("created_at", { ascending: false }).limit(20).then((r: any) => r).catch(() => ({ data: [] })) as any : { data: [] },
      sb.from("stock_movements").select("*").eq("organization_id", orgId).in("reference_id", poIds.length ? poIds : ["00000000-0000-0000-0000-000000000000"]).eq("movement_type", "PURCHASE").limit(50).then((r: any) => r).catch(() => ({ data: [] })) as any,
    ]);
    grns = grRes?.data ?? [];
    batches = batRes?.data ?? [];
    payments = payRes?.data ?? [];
    returns = retRes?.data ?? [];
    movements = movRes?.data ?? [];
  } catch {}

  // Balance & KPIs
  let balance = 0;
  try {
    const { data: rb } = await sb.rpc("get_supplier_balance", { p_supplier_id: id, p_org_id: orgId });
    balance = Number(rb?.[0]?.balance ?? rb?.balance ?? 0);
  } catch {
    const ordered = (pos ?? []).filter((p: any) => p.status !== "CANCELLED" && p.status !== "DRAFT").reduce((a: number, p: any) => a + Number(p.total), 0);
    const paid = (payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
    const ret = (returns ?? []).reduce((a: number, r: any) => a + Number(r.total ?? 0), 0);
    balance = ordered - paid - ret;
  }
  const totalPurchased = (pos ?? []).filter((p: any) => p.status !== "CANCELLED").reduce((a: number, p: any) => a + Number(p.total), 0);
  const totalPaid = (payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
  const openPOs = (pos ?? []).filter((p: any) => ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "ORDERED", "PARTIALLY_RECEIVED"].includes(p.status));
  const outstandingFromPOs = (pos ?? []).reduce((acc: any, p: any) => {
    const rec = (p.purchase_items ?? []).reduce((s: number, it: any) => s + Number(it.quantity_received ?? 0), 0);
    const ord = (p.purchase_items ?? []).reduce((s: number, it: any) => s + Number(it.quantity_ordered ?? 0), 0);
    return { rec: acc.rec + rec, ord: acc.ord + ord };
  }, { rec: 0, ord: 0 });

  // Price history aggregated per product
  const priceTrend: Record<string, any[]> = {};
  for (const h of priceHistory as any[]) {
    if (!priceTrend[h.product_id]) priceTrend[h.product_id] = [];
    priceTrend[h.product_id].push(h);
  }

  // Performance: delivery + quality + financial + pricing
  const closedPOs = (pos ?? []).filter((p: any) => ["RECEIVED", "CLOSED"].includes(p.status));
  let avgLeadTime: number | null = null;
  let onTime = 0;
  let late = 0;
  if (pos && pos.length) {
    const withDates = (pos as any[]).filter((p) => p.expected_delivery_date && p.received_at);
    if (withDates.length) {
      let sum = 0;
      for (const p of withDates) {
        const exp = new Date(p.expected_delivery_date).getTime();
        const rec = new Date(p.received_at).getTime();
        const diff = Math.round((rec - exp) / 86400000);
        sum += Math.max(0, Math.round((rec - new Date(p.created_at).getTime()) / 86400000));
        if (diff <= 0) onTime++; else late++;
      }
      avgLeadTime = Math.round(sum / withDates.length);
    }
  }
  const returnsCount = (returns as any[]).length;
  const partialCount = (pos ?? []).filter((p: any) => p.status === "PARTIALLY_RECEIVED").length;

  // Timeline: union of events sorted by date
  const timeline: any[] = [];
  timeline.push({ date: supplier.created_at, type: "Supplier created", user: supplier.created_by, ref: supplier.supplier_code, desc: supplier.name });
  for (const p of (pos ?? [])) timeline.push({ date: p.created_at, type: `PO ${p.status}`, user: p.created_by, ref: p.purchase_number, amount: Number(p.total), status: p.status });
  for (const g of (grns as any[])) timeline.push({ date: g.received_at, type: "Goods received", user: g.received_by, ref: g.grn_number, amount: Number(g.total_value), qty: g.total_quantity });
  for (const pay of (payments as any[])) timeline.push({ date: pay.payment_date, type: "Payment", user: pay.created_by, ref: pay.reference, amount: Number(pay.amount) });
  for (const r of (returns as any[])) timeline.push({ date: r.created_at, type: "Purchase return", user: r.created_by, ref: r.return_number, amount: Number(r.total), status: r.status });
  for (const a of (audit as any[])) {
    if (!timeline.some((t) => t.date === a.created_at && t.type === a.action))
      timeline.push({ date: a.created_at, type: a.action, user: a.created_by, ref: a.entity_id?.slice(0, 8), desc: String(a.new_values ?? "").slice(0, 80) });
  }
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Statement aggregated via getSupplierStatement(); timeline already sorted

  return {
    supplier,
    detail: {
      products,
      pos,
      grns,
      batches,
      payments,
      returns,
      movements,
      priceHistory,
      audit,
      branches,
      notes,
      documents,
      timeline: timeline.slice(0, 80),
      kpi: {
        totalPurchased,
        totalPaid,
        balance,
        openPOs: openPOs.length,
        productsCount: (products as any[]).length,
        returnsValue: (returns as any[]).reduce((a: number, r: any) => a + Number(r.total ?? 0), 0),
        lastPurchaseAt: (pos ?? [])[0]?.created_at ?? null,
        lastPurchaseValue: (pos ?? [])[0]?.total ?? null,
        avgLeadTime,
        onTimeRate: withDatesLengthDenom(pos),
        partialCount,
        returnsCount,
        purchaseCount: (pos ?? []).length,
      },
      performance: {
        avgLeadTime,
        onTime,
        late,
        partial: partialCount,
        returns: returnsCount,
        totalPOs: (pos ?? []).length,
        completed: closedPOs.length,
      },
      priceTrend,
    },
  };
}

function withDatesLengthDenom(pos: any[] | null) {
  if (!pos || pos.length === 0) return null;
  const withDates = pos.filter((p) => p.expected_delivery_date && p.received_at);
  if (withDates.length === 0) return null;
  let onTime = 0;
  for (const p of withDates) {
    if (new Date(p.received_at).getTime() <= new Date(p.expected_delivery_date).getTime()) onTime++;
  }
  return Math.round((onTime / withDates.length) * 100);
}

export async function createSupplier(input: any) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  const profileId = await getProfileId();
  if (!orgId) throw new Error("Missing organization");
  if (!profileId) throw new Error("Unauthenticated");

  const parsed = supplierSchema.parse(input);

  // duplicate detection by name/phone/email within same org
  const { data: dups } = await sb.from("suppliers").select("id,name,phone,email").eq("organization_id", orgId).ilike("name", parsed.name.trim()).limit(5);
  if (dups && dups.length > 0) {
    // warn but allow if different phone; if same phone throw
    const samePhone = dups.find((d: any) => d.phone && parsed.phone && d.phone === parsed.phone);
    if (samePhone) throw new Error(`A supplier with similar name/phone already exists: ${samePhone.name}`);
  }
  if (parsed.phone) {
    const { data: phoneDup } = await sb.from("suppliers").select("id,name").eq("organization_id", orgId).eq("phone", parsed.phone).limit(1);
    if (phoneDup && phoneDup.length > 0) throw new Error(`Phone already used by supplier: ${phoneDup[0].name}`);
  }
  // supplier_code uniqueness handled by index; if provided check
  if (parsed.supplier_code) {
    const { data: codeDup } = await sb.from("suppliers").select("id").eq("organization_id", orgId).eq("supplier_code", parsed.supplier_code).limit(1);
    if (codeDup && codeDup.length > 0) throw new Error(`Supplier code already exists: ${parsed.supplier_code}`);
  }

  // normalize is_active/status sync
  const isActive = parsed.is_active ?? (parsed.status ? parsed.status === "Active" : true);
  const status = parsed.status ?? (isActive ? "Active" : "Inactive");

  const payload: any = {
    organization_id: orgId,
    name: parsed.name.trim(),
    supplier_code: cleanEmpty(parsed.supplier_code),
    trading_name: cleanEmpty(parsed.trading_name),
    supplier_type: parsed.supplier_type ?? "Pharmaceutical distributor",
    supplier_category: cleanEmpty(parsed.supplier_category),
    description: cleanEmpty(parsed.description),
    status,
    is_active: isActive,
    contact_person: cleanEmpty(parsed.contact_person),
    contact_role: cleanEmpty(parsed.contact_role),
    phone: cleanEmpty(parsed.phone),
    phone_alt: cleanEmpty(parsed.phone_alt),
    email: cleanEmpty(parsed.email),
    email_alt: cleanEmpty(parsed.email_alt),
    address: cleanEmpty(parsed.address ?? parsed.physical_address),
    physical_address: cleanEmpty(parsed.physical_address),
    postal_address: cleanEmpty(parsed.postal_address),
    city: cleanEmpty(parsed.city),
    region: cleanEmpty(parsed.region),
    country: parsed.country ?? "Uganda",
    website: cleanEmpty(parsed.website),
    business_registration_number: cleanEmpty(parsed.business_registration_number),
    tax_number: cleanEmpty(parsed.tax_number ?? parsed.tin),
    tin: cleanEmpty(parsed.tin ?? parsed.tax_number),
    licence_number: cleanEmpty(parsed.licence_number),
    licence_expiry_date: cleanEmpty(parsed.licence_expiry_date),
    verification_status: parsed.verification_status ?? "Unverified",
    verification_date: cleanEmpty(parsed.verification_date),
    regulatory_notes: cleanEmpty(parsed.regulatory_notes),
    notes: cleanEmpty(parsed.notes),
    payment_terms: parsed.payment_terms ?? "30 Days",
    credit_terms: cleanEmpty(parsed.credit_terms),
    credit_limit: parsed.credit_limit ?? 0,
    currency: parsed.currency ?? "UGX",
    default_discount: parsed.default_discount ?? 0,
    tax_treatment: cleanEmpty(parsed.tax_treatment),
    minimum_order_value: parsed.minimum_order_value ?? 0,
    minimum_order_quantity: parsed.minimum_order_quantity ?? 0,
    lead_time_days: parsed.lead_time_days ?? null,
    delivery_terms: cleanEmpty(parsed.delivery_terms),
    preferred_payment_method: cleanEmpty(parsed.preferred_payment_method),
    account_reference: cleanEmpty(parsed.account_reference),
    commercial_notes: cleanEmpty(parsed.commercial_notes),
    created_by: profileId,
    updated_by: profileId,
  };

  // Insert with fallback if new columns not yet migrated (col does not exist)
  let data: any = null;
  const { data: d1, error: e1 } = await sb.from("suppliers").insert(payload).select().single();
  if (e1 && /column.*does not exist/i.test(e1.message)) {
    // fallback: strip new columns down to legacy set
    const legacy: any = {
      organization_id: orgId,
      name: payload.name,
      contact_person: payload.contact_person,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      tax_number: payload.tax_number,
      notes: payload.notes,
      is_active: payload.is_active,
    };
    const { data: d2, error: e2 } = await sb.from("suppliers").insert(legacy).select().single();
    if (e2) throw new Error(e2.message);
    data = d2;
  } else if (e1) {
    throw new Error(e1.message);
  } else data = d1;

  // supplier_branches junction if branch_ids provided and table exists
  if (parsed.branch_ids && parsed.branch_ids.length > 0) {
    try {
      for (const bid of parsed.branch_ids) {
        await sb.from("supplier_branches").insert({ organization_id: orgId, supplier_id: data.id, branch_id: bid, is_active: true });
      }
    } catch {}
  }

  await createAuditLog("SUPPLIER_CREATED", "suppliers", data.id, null, data);
  return data;
}

export async function updateSupplier(id: string, input: any) {
  const sb: any = await getSB();
  const existing = await getSupplierById(id);
  const orgId = await getOrgId();
  const profileId = await getProfileId();

  const parsed: any = supplierSchema.partial().parse(input);
  const patch: any = { updated_by: profileId, updated_at: new Date().toISOString() };

  // Map fields; only include those provided
  const map: Record<string, string> = {
    name: "name",
    supplier_code: "supplier_code",
    trading_name: "trading_name",
    supplier_type: "supplier_type",
    supplier_category: "supplier_category",
    description: "description",
    status: "status",
    contact_person: "contact_person",
    contact_role: "contact_role",
    phone: "phone",
    phone_alt: "phone_alt",
    email: "email",
    email_alt: "email_alt",
    address: "address",
    physical_address: "physical_address",
    postal_address: "postal_address",
    city: "city",
    region: "region",
    country: "country",
    website: "website",
    business_registration_number: "business_registration_number",
    tax_number: "tax_number",
    tin: "tin",
    licence_number: "licence_number",
    licence_expiry_date: "licence_expiry_date",
    verification_status: "verification_status",
    verification_date: "verification_date",
    regulatory_notes: "regulatory_notes",
    notes: "notes",
    payment_terms: "payment_terms",
    credit_terms: "credit_terms",
    credit_limit: "credit_limit",
    currency: "currency",
    default_discount: "default_discount",
    tax_treatment: "tax_treatment",
    minimum_order_value: "minimum_order_value",
    minimum_order_quantity: "minimum_order_quantity",
    lead_time_days: "lead_time_days",
    delivery_terms: "delivery_terms",
    preferred_payment_method: "preferred_payment_method",
    account_reference: "account_reference",
    commercial_notes: "commercial_notes",
  };
  for (const [k, col] of Object.entries(map)) {
    if (parsed[k] !== undefined) patch[col] = parsed[k] === "" ? null : parsed[k];
  }
  if (parsed.is_active !== undefined) {
    patch.is_active = parsed.is_active;
    if (!parsed.status) patch.status = parsed.is_active ? "Active" : "Inactive";
  }
  if (parsed.status && parsed.is_active === undefined) {
    patch.is_active = parsed.status === "Active";
  }

  // duplicate name check if name changed
  if (patch.name && patch.name !== existing.name) {
    const { data: dups } = await sb.from("suppliers").select("id").eq("organization_id", orgId).eq("name", patch.name).neq("id", id).limit(1);
    if (dups && dups.length > 0) throw new Error("Supplier name already exists");
  }

  let data: any = null;
  const { data: d1, error: e1 } = await sb.from("suppliers").update(patch).eq("id", id).select().single();
  if (e1 && /column.*does not exist/i.test(e1.message)) {
    // fallback to legacy columns only
    const legacy: any = {};
    if (patch.name !== undefined) legacy.name = patch.name;
    if (patch.contact_person !== undefined) legacy.contact_person = patch.contact_person;
    if (patch.phone !== undefined) legacy.phone = patch.phone;
    if (patch.email !== undefined) legacy.email = patch.email;
    if (patch.address !== undefined) legacy.address = patch.address;
    if (patch.tax_number !== undefined) legacy.tax_number = patch.tax_number;
    if (patch.notes !== undefined) legacy.notes = patch.notes;
    if (patch.is_active !== undefined) legacy.is_active = patch.is_active;
    const { data: d2, error: e2 } = await sb.from("suppliers").update(legacy).eq("id", id).select().single();
    if (e2) throw new Error(e2.message);
    data = d2;
  } else if (e1) throw new Error(e1.message);
  else data = d1;

  // branch_ids sync if provided
  if (parsed.branch_ids !== undefined) {
    try {
      await sb.from("supplier_branches").delete().eq("supplier_id", id);
      for (const bid of parsed.branch_ids) {
        await sb.from("supplier_branches").insert({ organization_id: orgId, supplier_id: id, branch_id: bid, is_active: true });
      }
    } catch {}
  }

  await createAuditLog("SUPPLIER_UPDATED", "suppliers", id, existing as any, data);
  return data;
}

export async function setSupplierStatus(id: string, status: string) {
  const sb: any = await getSB();
  const existing: any = await getSupplierById(id);
  // guard destructive delete: if has purchases/payments, don't allow hard delete — use status
  if (status === "Inactive" || status === "Suspended" || status === "Under Review" || status === "Active") {
    const { data: pos } = await sb.from("purchase_orders").select("id").eq("supplier_id", id).limit(1);
    // allow status change regardless but audit
  }
  return updateSupplier(id, { status, is_active: status === "Active" } as any);
}

export async function deleteSupplier(id: string) {
  const sb: any = await getSB();
  // Check historical transactions — soft guard
  const { data: pos } = await sb.from("purchase_orders").select("id").eq("supplier_id", id).limit(1);
  const { data: pays } = await sb.from("supplier_payments").select("id").eq("supplier_id", id).limit(1);
  if ((pos && pos.length > 0) || (pays && pays.length > 0)) {
    throw new Error("Cannot delete supplier with historical transactions — deactivate instead (status Inactive)");
  }
  const existing = await getSupplierById(id);
  const { error } = await sb.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await createAuditLog("SUPPLIER_DELETED", "suppliers", id, existing as any, null);
  return true;
}

export async function getSupplierStatement(supplierId: string, params?: { from?: string; to?: string }) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  const { data: pos } = await sb.from("purchase_orders").select("purchase_number,total,created_at,status").eq("supplier_id", supplierId).eq("organization_id", orgId).neq("status", "CANCELLED").order("created_at", { ascending: true });
  const { data: pays } = await sb.from("supplier_payments").select("amount,payment_date,reference,payment_method").eq("supplier_id", supplierId).eq("organization_id", orgId).order("payment_date", { ascending: true });
  const { data: rets } = await sb.from("purchase_returns").select("return_number,total,created_at,status").eq("supplier_id", supplierId).eq("organization_id", orgId).order("created_at", { ascending: true }).then((r:any)=>r).catch(()=>({data:[]})) as any;

  const entries: any[] = [];
  for (const p of (pos ?? [])) entries.push({ date: p.created_at, ref: p.purchase_number, desc: `Purchase ${p.status}`, debit: Number(p.total), credit: 0, balance: 0 });
  for (const pay of (pays ?? [])) entries.push({ date: pay.payment_date, ref: pay.reference ?? "PAY", desc: `Payment ${pay.payment_method}`, debit: 0, credit: Number(pay.amount), balance: 0 });
  for (const r of ((rets as any)?.data ?? rets ?? [])) entries.push({ date: r.created_at, ref: r.return_number, desc: `Return ${r.status}`, debit: 0, credit: Number(r.total), balance: 0 });
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let bal = 0;
  for (const e of entries) { bal += (e.debit - e.credit); e.balance = bal; }
  const from = params?.from ? new Date(params.from) : null;
  const to = params?.to ? new Date(params.to) : null;
  let filtered = entries;
  if (from) filtered = filtered.filter((e) => new Date(e.date) >= from);
  if (to) filtered = filtered.filter((e) => new Date(e.date) <= to);
  const opening = entries.filter((e) => from && new Date(e.date) < from).reduce((a, e) => a + e.debit - e.credit, 0);
  return { entries: filtered, opening, closing: bal };
}

export async function linkSupplierProduct(input: any) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  const { data, error } = await sb.from("product_suppliers").insert({ organization_id: orgId, ...input }).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog("SUPPLIER_PRODUCT_LINKED", "product_suppliers", data.id, null, data);
  return data;
}
export async function unlinkSupplierProduct(id: string) {
  const sb: any = await getSB();
  const { error } = await sb.from("product_suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await createAuditLog("SUPPLIER_PRODUCT_UNLINKED", "product_suppliers", id, null, null);
  return true;
}
export async function getSupplierProducts(supplierId: string) {
  const sb: any = await getSB();
  const { data } = await sb.from("product_suppliers").select("*, products(*)").eq("supplier_id", supplierId);
  return data ?? [];
}
export async function getSupplierPriceHistory(supplierId: string, productId?: string) {
  const sb: any = await getSB();
  let q = sb.from("supplier_price_history").select("*, products(name)").eq("supplier_id", supplierId).order("effective_date", { ascending: false }).limit(50);
  if (productId) q = q.eq("product_id", productId);
  const { data } = await q;
  return data ?? [];
}
export async function addSupplierNote(supplierId: string, note: string) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  const { data, error } = await sb.from("supplier_notes").insert({ organization_id: orgId, supplier_id: supplierId, note, created_by: pid }).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog("SUPPLIER_NOTE_ADDED", "supplier_notes", data.id, null, data);
  return data;
}
export async function addSupplierDocument(supplierId: string, input: { file_name: string; file_url: string; file_size?: number; mime_type?: string; document_type: string }) {
  const sb: any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  const { data, error } = await sb.from("supplier_documents").insert({ organization_id: orgId, supplier_id: supplierId, ...input, uploaded_by: pid }).select().single();
  if (error) throw new Error(error.message);
  await createAuditLog("SUPPLIER_DOCUMENT_ADDED", "supplier_documents", data.id, null, data);
  return data;
}

export async function requestCreditApproval(supplierId: string, requestedLimit: number, reason?: string){
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  const supplier = await getSupplierById(supplierId);
  const prev = Number(supplier.credit_limit ?? 0);
  // threshold: >20% or >500k UGX requires approval; otherwise auto-approve if caller has permission
  const diffPct = prev===0 ? 100 : Math.abs(requestedLimit - prev)/prev*100;
  const needsApproval = diffPct > 20 || Math.abs(requestedLimit - prev) > 500000;
  if(!needsApproval){
    return updateSupplier(supplierId, { credit_limit: requestedLimit } as any);
  }
  const { data, error } = await sb.from('supplier_credit_approvals').insert({ organization_id: orgId, supplier_id: supplierId, requested_by: pid, previous_limit: prev, requested_limit: requestedLimit, reason: reason ?? null, status: 'PENDING' }).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('SUPPLIER_CREDIT_APPROVAL_REQUESTED','supplier_credit_approvals',data.id,null,data);
  return { approval: data, needsApproval: true };
}
export async function getCreditApprovals(supplierId?: string){
  const sb:any = await getSB();
  let q = sb.from('supplier_credit_approvals').select('*, suppliers(name)').order('created_at',{ascending:false}).limit(50);
  if(supplierId) q=q.eq('supplier_id', supplierId);
  const { data } = await q;
  return data ?? [];
}
export async function decideCreditApproval(id: string, decision: 'APPROVED'|'REJECTED', _note?: string){
  const sb:any = await getSB();
  const pid = await getProfileId();
  const { data: appr, error: e0 } = await sb.from('supplier_credit_approvals').select('*').eq('id', id).single();
  if(e0) throw new Error(e0.message);
  if(appr.status !== 'PENDING') throw new Error('Already decided');
  const { data, error } = await sb.from('supplier_credit_approvals').update({ status: decision, approved_by: pid, decided_at: new Date().toISOString() }).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  if(decision === 'APPROVED'){
    await updateSupplier(appr.supplier_id, { credit_limit: appr.requested_limit } as any);
  }
  await createAuditLog('SUPPLIER_CREDIT_'+decision,'supplier_credit_approvals',id,appr,data);
  return data;
}
export async function importSupplierCatalogue(supplierId: string, rows: Array<{ product_id?: string; sku?: string; barcode?: string; supplier_sku?: string; price: number; moq?: number; lead_time_days?: number; availability?: string; pack_size?: number }>){
  const sb:any = await getSB();
  const orgId = await getOrgId();
  let imported=0; const errors:any[]=[];
  for(let i=0;i<rows.length;i++){
    const r=rows[i] as any;
    try{
      let productId=r.product_id;
      if(!productId && (r.sku || r.barcode)){
        const q = r.sku ? sb.from('products').select('id').eq('organization_id',orgId).eq('sku',r.sku).maybeSingle() : sb.from('products').select('id').eq('organization_id',orgId).eq('barcode',r.barcode).maybeSingle();
        const { data: prod } = await q;
        if(prod) productId=prod.id; else throw new Error('Product not found for SKU/barcode '+ (r.sku||r.barcode));
      }
      if(!productId) throw new Error('product_id or sku/barcode required');
      const existing = await sb.from('product_suppliers').select('id').eq('product_id',productId).eq('supplier_id',supplierId).maybeSingle().then((x:any)=>x.data) as any;
      const payload:any={ organization_id: orgId, product_id: productId, supplier_id: supplierId, supplier_sku: r.supplier_sku ?? null, supplier_product_code: r.supplier_sku ?? null, supplier_price: r.price, current_price: r.price, minimum_order_quantity: r.moq ?? null, lead_time_days: r.lead_time_days ?? null, pack_size: r.pack_size ?? null, availability: r.availability ?? 'Available', effective_date: new Date().toISOString().slice(0,10) };
      if(existing){
        const { error } = await sb.from('product_suppliers').update({ supplier_price: r.price, current_price: r.price, minimum_order_quantity: r.moq ?? undefined, lead_time_days: r.lead_time_days ?? undefined, availability: r.availability ?? undefined, updated_at: new Date().toISOString() }).eq('id', existing.id);
        if(error) throw new Error(error.message);
      } else {
        const { error } = await sb.from('product_suppliers').insert(payload);
        if(error) throw new Error(error.message);
      }
      // price history
      await sb.from('supplier_price_history').insert({ organization_id: orgId, supplier_id: supplierId, product_id: productId, price: r.price, effective_date: new Date().toISOString().slice(0,10) }).then(()=>{}).catch(()=>{});
      imported++;
    }catch(e:any){ errors.push({ row: i+1, error: e.message }); }
  }
  await createAuditLog('SUPPLIER_CATALOGUE_IMPORTED','suppliers',supplierId,null,{ imported, errorCount: errors.length });
  return { imported, errors };
}
export async function getPriceAlerts(thresholdPct?: number){
  const sb:any = await getSB();
  const orgId = await getOrgId();
  let threshold = thresholdPct ?? 10;
  try{ const { data } = await sb.from('organization_settings').select('value').eq('organization_id',orgId).eq('key','supplier_price_alert_pct').maybeSingle(); if(data?.value) threshold = Number(data.value); }catch{}
  // fetch recent price history and compute pct locally to avoid view dependence
  const { data } = await sb.from('supplier_price_history').select('*, products(name), suppliers(name)').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(100);
  const grouped: Record<string, any[]> = {};
  for(const h of (data??[]) as any[]){ const k=h.supplier_id+'|'+h.product_id; (grouped[k]=grouped[k]||[]).push(h); }
  const alerts:any[]=[];
  for(const k of Object.keys(grouped)){
    const arr=grouped[k].sort((a,b)=> new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());
    if(arr.length>=2){
      const cur=Number(arr[0].price), prev=Number(arr[1].price);
      if(prev>0){ const pct=Math.abs(cur-prev)/prev*100; if(pct>=threshold) alerts.push({ supplier_id: arr[0].supplier_id, supplier_name: arr[0].suppliers?.name, product_id: arr[0].product_id, product_name: arr[0].products?.name, prev, cur, pct: Number(pct.toFixed(1)), date: arr[0].effective_date }); }
    }
  }
  return alerts;
}
