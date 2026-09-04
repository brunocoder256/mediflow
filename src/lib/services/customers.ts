/* eslint-disable */
// @ts-nocheck
import { getSB, getOrgId, getProfileId, createAuditLog } from './supabase';

/** Helper to generate customer code CUS-YYYYMMDD-XXXX */
function genCustomerCode(): string {
  return `CUS-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

export type CustomerFilters = {
  search?: string;
  customer_type?: string;
  status?: string;
  branch_id?: string;
  credit_status?: 'with_credit'|'overdue'|'no_credit';
  date_from?: string;
  date_to?: string;
  last_purchase_from?: string;
  last_purchase_to?: string;
  has_balance?: boolean;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: 'asc'|'desc';
};

export async function listCustomers(filters: CustomerFilters = {}){
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 20;
  const from = (page-1)*perPage;
  // base query - gracefully fallback if new columns missing
  const baseColumns = 'id, organization_id, name, phone, email, notes, is_active, created_at, updated_at, customer_code, customer_type, display_name, company_name, alternate_phone, address, city, branch_id, status, external_reference, tax_id, credit_limit, payment_terms, loyalty_points, preferred_contact, company_name, contact_person, merged_into_id';
  // try to select with extended columns, fallback to minimal if error
  let query:any;
  try{
    query = sb.from('customers').select(baseColumns, { count:'exact' }).eq('organization_id', orgId).is('merged_into_id', null);
  }catch{
    query = sb.from('customers').select('id, organization_id, name, phone, email, notes, is_active, created_at, updated_at', {count:'exact'}).eq('organization_id', orgId);
  }
  if(filters.branch_id && filters.branch_id!=='all') query = query.eq('branch_id', filters.branch_id);
  if(filters.customer_type && filters.customer_type!=='all') query = query.eq('customer_type', filters.customer_type);
  if(filters.status && filters.status!=='all') query = query.eq('status', filters.status);
  else if(filters.status==='all') {/* no filter */}
  // is_active legacy mapping
  if(filters.status==='ACTIVE') query = query.eq('is_active', true);
  if(filters.status==='INACTIVE') query = query.eq('is_active', false);
  if(filters.date_from) query = query.gte('created_at', filters.date_from);
  if(filters.date_to) query = query.lte('created_at', filters.date_to);

  if(filters.search && filters.search.trim()){
    const s = filters.search.trim().replace(/%/g,'');
    // server side ilike across multiple fields
    // Use or filter; fallback if columns missing
    try{
      query = query.or(`name.ilike.%${s}%,display_name.ilike.%${s}%,phone.ilike.%${s}%,alternate_phone.ilike.%${s}%,email.ilike.%${s}%,customer_code.ilike.%${s}%,company_name.ilike.%${s}%,external_reference.ilike.%${s}%`);
    }catch{
      query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
    }
  }
  query = query.order('created_at', { ascending: false }).range(from, from+perPage-1);
  const { data, error, count } = await query;
  if(error){
    // fallback minimal query
    const { data: d2, error: e2 } = await sb.from('customers').select('id, name, phone, email, is_active, created_at', {count:'exact'}).eq('organization_id', orgId).range(from, from+perPage-1);
    if(e2) throw new Error(e2.message);
    // enrich minimal rows to look like full rows
    const enriched = (d2??[]).map((r:any)=>({...r, customer_code: null, customer_type: 'INDIVIDUAL', display_name: r.name, company_name: null, alternate_phone: null, address: null, city: null, branch_id: null, status: r.is_active?'ACTIVE':'INACTIVE', credit_limit:0, loyalty_points:0}));
    // need to filter search client-side if needed
    let list = enriched;
    if(filters.search){
      const s=filters.search.toLowerCase();
      list = list.filter((c:any)=> c.name?.toLowerCase().includes(s) || c.phone?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s));
    }
    // compute derived metrics (total purchases, outstanding, last purchase) for these
    const result = await enrichCustomers(list);
    return { data: result, count: count ?? list.length };
  }
  const list = (data ?? []) as any[];
  // client-side credit filtering after enrich if needed
  let enriched = await enrichCustomers(list);
  if(filters.credit_status && filters.credit_status!=='all'){
    if(filters.credit_status==='with_credit') enriched = enriched.filter((c:any)=> Number(c.outstanding_balance)>0);
    if(filters.credit_status==='no_credit') enriched = enriched.filter((c:any)=> Number(c.outstanding_balance)===0);
    if(filters.credit_status==='overdue') enriched = enriched.filter((c:any)=> Number(c.overdue_amount)>0);
  }
  if(filters.has_balance) enriched = enriched.filter((c:any)=> Number(c.outstanding_balance)>0);
  // last purchase date filter
  if(filters.last_purchase_from) enriched = enriched.filter((c:any)=> c.last_purchase && c.last_purchase >= filters.last_purchase_from);
  if(filters.last_purchase_to) enriched = enriched.filter((c:any)=> c.last_purchase && c.last_purchase <= filters.last_purchase_to);
  return { data: enriched, count: count ?? enriched.length };
}

async function enrichCustomers(customers:any[]){
  const sb:any = await getSB();
  if(customers.length===0) return customers;
  const ids = customers.map(c=>c.id);
  // fetch sales aggregates per customer
  try{
    const { data: sales } = await sb.from('sales').select('customer_id, total, sold_at, status, branch_id').in('customer_id', ids);
    const map:Record<string,{total:number, count:number, last:string|null, outstanding:number, branchTotals:Record<string,number>}>={};
    for(const c of customers) map[c.id]={total:0, count:0, last:null, outstanding:0, branchTotals:{}};
    for(const s of (sales??[]) as any[]){
      const mid=map[s.customer_id];
      if(!mid) continue;
      if(s.status==='COMPLETED'){
        mid.total+=Number(s.total);
        mid.count+=1;
        if(!mid.last || s.sold_at>mid.last) mid.last=s.sold_at;
        // branch totals
        mid.branchTotals[s.branch_id]=(mid.branchTotals[s.branch_id]??0)+Number(s.total);
      }
    }
    // outstanding via payments: for each customer, sum completed sales minus sum payments
    // fetch payments for these customer sales
    if((sales??[]).length){
      const _saleIds = (sales as any[]).filter(s=>s.status==='COMPLETED').map(s=> s.customer_id ? s.customer_id : null);
    }
    // second attempt: fetch sales with id
    const { data: salesFull } = await sb.from('sales').select('id, customer_id, total, status').in('customer_id', ids).eq('status','COMPLETED');
    const saleIdsFull=(salesFull??[]).map((s:any)=>s.id);
    const paymentMap:Record<string,number>={};
    if(saleIdsFull.length){
      const { data: pays } = await sb.from('payments').select('sale_id, amount').in('sale_id', saleIdsFull);
      for(const p of (pays??[]) as any[]) {
        const sale = (salesFull as any[]).find(s=>s.id===p.sale_id);
        if(sale) paymentMap[sale.customer_id]=(paymentMap[sale.customer_id]??0)+Number(p.amount);
      }
    }
    // also handle returns/refunds that reduce balance? For simplicity outstanding = total - paid
    // overdue = outstanding where oldest sale >30 days and not paid (simplified)
    return customers.map(c=>{
      const m=map[c.id];
      const paid=paymentMap[c.id]??0;
      const outstanding = Math.max(0, Number((m.total - paid).toFixed(2)));
      const overdue = outstanding>0 && m.last && (Date.now() - new Date(m.last).getTime()) > 30*86400000 ? outstanding : 0;
      // last branch
      const branchEntries=Object.entries(m.branchTotals);
      const lastBranch = branchEntries.length ? branchEntries.sort((a,b)=>b[1]-a[1])[0][0] : c.branch_id;
      return {
        ...c,
        display_name: c.display_name ?? c.company_name ?? c.name,
        total_purchases: m.total,
        transaction_count: m.count,
        last_purchase: m.last,
        outstanding_balance: outstanding,
        overdue_amount: overdue,
        available_credit: Math.max(0, Number(c.credit_limit ?? 0) - outstanding),
        total_paid: paid,
        branch_totals: m.branchTotals,
        last_branch: lastBranch,
      };
    });
  }catch(e){
    return customers.map(c=>({...c, display_name: c.display_name ?? c.name, total_purchases:0, transaction_count:0, last_purchase:null, outstanding_balance:0, overdue_amount:0, available_credit: Number(c.credit_limit??0)}));
  }
}

export async function getCustomerById(id:string){
  const sb:any = await getSB();
  try{
    const { data, error } = await sb.from('customers').select('*').eq('id', id).single();
    if(error) throw error;
    // enrich with metrics + related counts
    const enriched = (await enrichCustomers([data]))[0] ?? data;
    // fetch branches for name
    if(enriched.branch_id){
      const { data: br } = await sb.from('branches').select('name, code').eq('id', enriched.branch_id).maybeSingle();
      enriched.branch_name = br?.name ?? null;
    }
    return enriched;
  }catch(e:any){
    const { data } = await sb.from('customers').select('id, name, phone, email, is_active, created_at, notes').eq('id', id).single();
    return data;
  }
}

export async function getCustomerKPIs(branch_id?:string){
  const sb:any = await getSB();
  const orgId=await getOrgId();
  let q=sb.from('customers').select('id, created_at, is_active, status, branch_id, credit_limit').eq('organization_id', orgId).is('merged_into_id', null);
  if(branch_id && branch_id!=='all') q=q.eq('branch_id', branch_id);
  const { data } = await q;
  const list=(data??[]) as any[];
  const total=list.length;
  const active=list.filter(r=> (r.status==='ACTIVE') || r.is_active).length;
  const now=new Date();
  const monthStart=new Date(now.getFullYear(), now.getMonth(),1).toISOString();
  const newThisMonth=list.filter(r=> r.created_at >= monthStart).length;
  // with credit / outstanding need enrich
  const enriched=await enrichCustomers(list.map(l=>({id:l.id, credit_limit:l.credit_limit, status:l.status, is_active:l.is_active})) as any);
  const withCredit=enriched.filter((c:any)=> Number(c.outstanding_balance)>0).length;
  const outstandingTotal=enriched.reduce((a:any,c:any)=>a+Number(c.outstanding_balance??0),0);
  const overdueTotal=enriched.reduce((a:any,c:any)=>a+Number(c.overdue_amount??0),0);
  const inactive=list.filter(r=> r.status==='INACTIVE' || !r.is_active).length;
  const blocked=list.filter(r=> r.status==='BLOCKED').length;
  return { total, active, inactive, blocked, newThisMonth, withCredit, outstandingTotal, overdueTotal };
}

export async function checkDuplicates(input:{phone?:string, alternate_phone?:string, email?:string, name?:string, customer_code?:string, company_name?:string}){
  const sb:any=await getSB();
  const orgId=await getOrgId();
  const orClauses:string[]=[];
  if(input.phone) orClauses.push(`phone.eq.${input.phone}`);
  if(input.alternate_phone) orClauses.push(`alternate_phone.eq.${input.alternate_phone}`);
  if(input.email) orClauses.push(`email.eq.${input.email}`);
  if(input.customer_code) orClauses.push(`customer_code.eq.${input.customer_code}`);
  if(input.company_name) orClauses.push(`company_name.eq.${input.company_name}`);
  if(orClauses.length===0 && input.name){
    // name+phone combo handled separately
    const { data } = await sb.from('customers').select('id, name, phone, email, customer_code, display_name').eq('organization_id', orgId).ilike('name', `%${input.name}%`).limit(5);
    return data ?? [];
  }
  if(orClauses.length===0) return [];
  const { data } = await sb.from('customers').select('id, name, phone, alternate_phone, email, customer_code, display_name, company_name').eq('organization_id', orgId).or(orClauses.join(',')).limit(10);
  // also check name+phone combination if provided
  let extra:any[]=[];
  if(input.name && input.phone){
    const { data: d2 } = await sb.from('customers').select('id, name, phone, email, customer_code, display_name').eq('organization_id', orgId).eq('phone', input.phone).ilike('name', `%${input.name}%`).limit(5);
    extra=d2??[];
  }
  const merged=[...(data??[]),...extra];
  const unique=new Map(merged.map((m:any)=>[m.id,m]));
  return Array.from(unique.values());
}

export async function createCustomer(input:any){
  const sb:any=await getSB();
  const orgId=await getOrgId();
  const pid=await getProfileId();
  // validation
  if(!input.name && !input.display_name && !input.company_name) throw new Error('Name or company name required');
  const name = input.name ?? input.display_name ?? input.company_name;
  // duplicate check
  const dups = await checkDuplicates({phone: input.phone, alternate_phone: input.alternate_phone, email: input.email, customer_code: input.customer_code, company_name: input.company_name});
  // return dups to caller; but don't block automatically - caller decides continue
  // insert with extended columns, fallback to legacy if error
  const payload:any={
    organization_id: orgId,
    name,
    phone: input.phone ?? null,
    alternate_phone: input.alternate_phone ?? null,
    email: input.email ?? null,
    notes: input.notes ?? null,
    is_active: true,
    customer_code: input.customer_code ?? genCustomerCode(),
    customer_type: input.customer_type ?? 'INDIVIDUAL',
    first_name: input.first_name ?? null,
    middle_name: input.middle_name ?? null,
    last_name: input.last_name ?? null,
    display_name: input.display_name ?? name,
    company_name: input.company_name ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    branch_id: input.branch_id ?? null,
    status: 'ACTIVE',
    external_reference: input.external_reference ?? null,
    tax_id: input.tax_id ?? null,
    credit_limit: Number(input.credit_limit ?? 0),
    payment_terms: input.payment_terms ?? null,
    preferred_contact: input.preferred_contact ?? 'PHONE',
    sms_opt_in: !!input.sms_opt_in,
    email_opt_in: !!input.email_opt_in,
    marketing_opt_in: !!input.marketing_opt_in,
    contact_person: input.contact_person ?? null,
    created_by: pid,
    updated_by: pid,
  };
  try{
    const { data, error } = await sb.from('customers').insert(payload).select().single();
    if(error) throw error;
    await createAuditLog('CUSTOMER_CREATED','customers', data.id, null, data);
    return { customer: data, duplicates: dups };
  }catch(e:any){
    if(/column.*does not exist/i.test(e.message)){
      const legacy={ organization_id: orgId, name, phone: input.phone ?? null, email: input.email ?? null, notes: input.notes ?? null, is_active:true };
      const { data, error } = await sb.from('customers').insert(legacy).select().single();
      if(error) throw error;
      await createAuditLog('CUSTOMER_CREATED','customers', data.id, null, data);
      return { customer: data, duplicates: dups };
    }
    throw new Error(e.message);
  }
}

export async function updateCustomer(id:string, patch:any){
  const sb:any=await getSB();
  const pid=await getProfileId();
  // fetch old for audit
  const { data: old } = await sb.from('customers').select('*').eq('id', id).single();
  if(!old) throw new Error('Customer not found');
  if(old.merged_into_id) throw new Error('Cannot edit merged customer');
  const payload:any={ ...patch, updated_by: pid, updated_at: new Date().toISOString() };
  // map is_active <-> status
  if(patch.status){
    payload.is_active = patch.status==='ACTIVE';
    payload.status = patch.status;
  }
  if(patch.is_active!==undefined){
    payload.is_active = patch.is_active;
    payload.status = patch.is_active ? 'ACTIVE':'INACTIVE';
  }
  // display_name sync
  if(patch.name && !patch.display_name) payload.display_name = patch.name;
  if(patch.company_name && !patch.display_name) payload.display_name = patch.company_name;
  try{
    const { data, error } = await sb.from('customers').update(payload).eq('id', id).select().single();
    if(error) throw error;
    await createAuditLog('CUSTOMER_UPDATED','customers', id, old, data);
    return data;
  }catch(e:any){
    if(/column.*does not exist/i.test(e.message)){
      const legacy:any={};
      if(patch.name) legacy.name=patch.name;
      if(patch.phone) legacy.phone=patch.phone;
      if(patch.email) legacy.email=patch.email;
      if(patch.notes) legacy.notes=patch.notes;
      if(patch.is_active!==undefined) legacy.is_active=patch.is_active;
      const { data, error } = await sb.from('customers').update(legacy).eq('id', id).select().single();
      if(error) throw error;
      await createAuditLog('CUSTOMER_UPDATED','customers', id, old, data);
      return data;
    }
    throw e;
  }
}

export async function deactivateCustomer(id:string, reason?:string){
  const sb:any=await getSB();
  // prevent deleting customer with financial history
  const { data: sales } = await sb.from('sales').select('id').eq('customer_id', id).limit(1);
  const hasHistory = (sales??[]).length>0;
  // in any case we allow deactivation (INACTIVE) but not hard delete
  const { data: old } = await sb.from('customers').select('*').eq('id', id).single();
  const { data, error } = await sb.from('customers').update({ status:'INACTIVE', is_active:false, updated_at: new Date().toISOString(), updated_by: await getProfileId() }).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('CUSTOMER_DEACTIVATED','customers', id, old, {...data, reason});
  return data;
}
export async function reactivateCustomer(id:string){
  const { data: old } = await (await getSB()).from('customers').select('*').eq('id', id).single();
  const sb:any=await getSB();
  const { data, error } = await sb.from('customers').update({ status:'ACTIVE', is_active:true, updated_at: new Date().toISOString(), updated_by: await getProfileId() }).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('CUSTOMER_REACTIVATED','customers', id, old, data);
  return data;
}
export async function blockCustomer(id:string, reason?:string){
  const sb:any=await getSB();
  const { data: old } = await sb.from('customers').select('*').eq('id', id).single();
  const { data, error } = await sb.from('customers').update({ status:'BLOCKED', is_active:false, updated_at: new Date().toISOString(), updated_by: await getProfileId() }).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('CUSTOMER_BLOCKED','customers', id, old, {...data, reason});
  return data;
}
export async function deleteCustomerHard(id:string){
  const sb:any=await getSB();
  // check references
  const { data: sales } = await sb.from('sales').select('id').eq('customer_id', id).limit(1);
  if((sales??[]).length>0) throw new Error('Cannot delete customer with historical transactions — use Deactivate');
  const { data: old } = await sb.from('customers').select('*').eq('id', id).single();
  const { error } = await sb.from('customers').delete().eq('id', id);
  if(error) throw new Error(error.message);
  await createAuditLog('CUSTOMER_DELETED','customers', id, old, null);
  return true;
}

export async function mergeCustomers(masterId:string, duplicateId:string, reason?:string){
  const sb:any=await getSB();
  const orgId=await getOrgId();
  const pid=await getProfileId();
  if(masterId===duplicateId) throw new Error('Cannot merge same customer');
  // permission check would be server-side, but client role check omitted
  const { data: master } = await sb.from('customers').select('*').eq('id', masterId).single();
  const { data: dup } = await sb.from('customers').select('*').eq('id', duplicateId).single();
  if(!master || !dup) throw new Error('Customer not found');
  if(master.organization_id!==dup.organization_id) throw new Error('Organization mismatch');
  if(dup.merged_into_id) throw new Error('Duplicate already merged');
  if(master.merged_into_id) throw new Error('Master already merged');
  // move sales/payments/returns
  let salesMoved=0; const paymentsMoved=0; let returnsMoved=0;
  // sales
  const { data: s1, error: e1 } = await sb.from('sales').update({ customer_id: masterId }).eq('customer_id', duplicateId).select();
  if(!e1) salesMoved=(s1??[]).length;
  // returns
  const { data: r1, error: e2 } = await sb.from('returns').update({ customer_id: masterId }).eq('customer_id', duplicateId).select();
  if(!e2) returnsMoved=(r1??[]).length;
  // loyalty ledger
  try{
    await sb.from('customer_loyalty_ledger').update({ customer_id: masterId }).eq('customer_id', duplicateId);
  }catch{}
  // notes move
  try{
    await sb.from('customer_notes').update({ customer_id: masterId }).eq('customer_id', duplicateId);
  }catch{}
  // mark dup as merged
  await sb.from('customers').update({ merged_into_id: masterId, is_active:false, status:'INACTIVE', updated_at: new Date().toISOString() }).eq('id', duplicateId);
  // merge record
  try{
    await sb.from('customer_merges').insert({ organization_id: orgId, master_customer_id: masterId, merged_customer_id: duplicateId, merged_customer_snapshot: dup, merged_by: pid, reason: reason ?? null, sales_moved: salesMoved, payments_moved: paymentsMoved, returns_moved: returnsMoved });
  }catch{}
  await createAuditLog('CUSTOMER_MERGED','customers', masterId, dup, { masterId, duplicateId, salesMoved, returnsMoved, reason });
  return { masterId, duplicateId, salesMoved, returnsMoved };
}

export async function getCustomerStatement(customerId:string, from?:string, to?:string){
  const sb:any=await getSB();
  // fetch sales, payments, returns/refunds for customer
  let salesQ=sb.from('sales').select('id, sale_number, total, subtotal, discount, tax, status, sold_at, branch_id').eq('customer_id', customerId).eq('status','COMPLETED').order('sold_at',{ascending:true});
  if(from) salesQ=salesQ.gte('sold_at', from);
  if(to) salesQ=salesQ.lte('sold_at', to+'T23:59:59');
  const { data: sales } = await salesQ;
  const saleIds=(sales??[]).map((s:any)=>s.id);
  let payments:any[]=[];
  if(saleIds.length){
    const { data: pays } = await sb.from('payments').select('id, sale_id, amount, payment_method, reference, paid_at, status, branch_id').in('sale_id', saleIds);
    payments=pays??[];
  }
  // returns where customer or sale in list
  let returns:any[]=[];
  try{
    const { data: rets } = await sb.from('returns').select('id, return_number, sale_id, total, status, created_at, branch_id').eq('customer_id', customerId).order('created_at',{ascending:true});
    returns=rets??[];
  }catch{}
  // build ledger chronologically
  const entries:any[]=[];
  let opening=0;
  // opening balance = balance before from date
  if(from){
    const { data: priorSales } = await sb.from('sales').select('total').eq('customer_id', customerId).eq('status','COMPLETED').lt('sold_at', from);
    const priorTotal=(priorSales??[]).reduce((a:any,s:any)=>a+Number(s.total),0);
    let priorPaid=0;
    if(priorTotal){
      const { data: priorSaleIds } = await sb.from('sales').select('id').eq('customer_id', customerId).eq('status','COMPLETED').lt('sold_at', from);
      const ids=(priorSaleIds??[]).map((s:any)=>s.id);
      if(ids.length){
        const { data: pp } = await sb.from('payments').select('amount').in('sale_id', ids);
        priorPaid=(pp??[]).reduce((a:any,p:any)=>a+Number(p.amount),0);
      }
    }
    opening=Math.max(0, priorTotal - priorPaid);
  }
  let running=opening;
  for(const s of (sales??[]) as any[]){
    running+=Number(s.total);
    entries.push({ date: s.sold_at, type:'SALE', ref: s.sale_number, amount: Number(s.total), balance: running, id:s.id, branch_id:s.branch_id });
  }
  for(const p of payments as any[]){
    running-=Number(p.amount);
    entries.push({ date: p.paid_at, type:'PAYMENT', ref: p.reference ?? p.payment_method, amount: -Number(p.amount), balance: running, id:p.id, branch_id:p.branch_id });
  }
  for(const r of returns as any[]){
    // return reduces AR (refund)
    const sale = (sales??[]).find((s:any)=>s.id===r.sale_id);
    entries.push({ date: r.created_at, type:'RETURN', ref: r.return_number, amount: -Number(r.total), balance: running - Number(r.total), id:r.id, branch_id:r.branch_id });
    running-=Number(r.total);
  }
  entries.sort((a,b)=> new Date(a.date).getTime()-new Date(b.date).getTime());
  // recompute running correctly chronological
  running=opening;
  for(const e of entries){
    if(e.type==='SALE') running+=Number(e.amount);
    else running+=Number(e.amount);
    e.balance=running;
  }
  const closing=running;
  const totalSales=(sales??[]).reduce((a:any,s:any)=>a+Number(s.total),0);
  const totalPaid=payments.reduce((a:any,p:any)=>a+Number(p.amount),0);
  const totalReturns=returns.reduce((a:any,r:any)=>a+Number(r.total),0);
  return { opening, closing, totalSales, totalPaid, totalReturns, entries };
}

export async function getCustomerSales(customerId:string, page=1, perPage=20){
  const sb:any=await getSB();
  const { data, error, count } = await sb.from('sales').select('id, sale_number, total, subtotal, discount, tax, status, sold_at, branch_id, sale_items(product_id, quantity, products(name))', {count:'exact'}).eq('customer_id', customerId).order('sold_at',{ascending:false}).range((page-1)*perPage, page*perPage-1);
  if(error) throw new Error(error.message);
  return { data, count };
}
export async function getCustomerPayments(customerId:string, page=1, perPage=20){
  const sb:any=await getSB();
  const { data: sales } = await sb.from('sales').select('id').eq('customer_id', customerId);
  const ids=(sales??[]).map((s:any)=>s.id);
  if(ids.length===0) return { data:[], count:0 };
  const { data, error, count } = await sb.from('payments').select('id, sale_id, amount, payment_method, reference, paid_at, status, branch_id, sales(sale_number)', {count:'exact'}).in('sale_id', ids).order('paid_at',{ascending:false}).range((page-1)*perPage, page*perPage-1);
  if(error) throw new Error(error.message);
  return { data, count };
}
export async function getCustomerReturns(customerId:string, page=1, perPage=20){
  const sb:any=await getSB();
  try{
    const { data, error, count } = await sb.from('returns').select('id, return_number, sale_id, total, status, reason, created_at, branch_id, sales(sale_number)', {count:'exact'}).eq('customer_id', customerId).order('created_at',{ascending:false}).range((page-1)*perPage, page*perPage-1);
    if(error) throw new Error(error.message);
    return { data, count };
  }catch{
    return { data:[], count:0 };
  }
}
export async function getCustomerNotes(customerId:string){
  const sb:any=await getSB();
  try{
    const { data } = await sb.from('customer_notes').select('*, profiles!customer_notes_author_id_fkey(full_name)').eq('customer_id', customerId).order('created_at',{ascending:false}).limit(50);
    return data ?? [];
  }catch{
    return [];
  }
}
export async function addCustomerNote(customerId:string, content:string, visibility='INTERNAL'){
  const sb:any=await getSB();
  const orgId=await getOrgId();
  const pid=await getProfileId();
  try{
    const { data, error } = await sb.from('customer_notes').insert({ organization_id: orgId, customer_id: customerId, content, author_id: pid, visibility }).select().single();
    if(error) throw error;
    await createAuditLog('CUSTOMER_NOTE_ADDED','customer_notes', data.id, null, data);
    return data;
  }catch(e:any){
    throw new Error(e.message);
  }
}
export async function getCustomerAudit(customerId:string){
  const sb:any=await getSB();
  const { data } = await sb.from('audit_logs').select('id, action, entity_type, entity_id, old_values, new_values, created_at, profiles!audit_logs_user_id_fkey(full_name)').eq('entity_type','customers').eq('entity_id', customerId).order('created_at',{ascending:false}).limit(100);
  // also merges
  let merges:any[]=[];
  try{
    const { data: m } = await sb.from('customer_merges').select('*').or(`master_customer_id.eq.${customerId},merged_customer_id.eq.${customerId}`).order('created_at',{ascending:false});
    merges=m??[];
  }catch{}
  return { logs: data ?? [], merges };
}
export async function getCustomerLoyalty(customerId:string){
  const sb:any=await getSB();
  try{
    const { data } = await sb.from('customer_loyalty_ledger').select('*').eq('customer_id', customerId).order('created_at',{ascending:false}).limit(50);
    const total=(data??[]).reduce((a:any,r:any)=>{
      if(r.type==='EARNED' || r.type==='ADJUSTMENT') return a+Number(r.points);
      if(r.type==='REDEEMED' || r.type==='EXPIRED') return a-Number(r.points);
      return a;
    },0);
    return { ledger: data ?? [], total };
  }catch{
    return { ledger:[], total:0 };
  }
}
export async function adjustLoyalty(customerId:string, points:number, reason?:string){
  const sb:any=await getSB();
  const orgId=await getOrgId();
  const pid=await getProfileId();
  const type = points>=0 ? 'ADJUSTMENT' : 'REDEEMED';
  const { data, error } = await sb.from('customer_loyalty_ledger').insert({ organization_id: orgId, customer_id: customerId, points: Math.abs(points), type, reference: reason ?? null, created_by: pid }).select().single();
  if(error) throw new Error(error.message);
  // update customers loyalty_points (denormalized but not authoritative)
  try{
    const { data: cur } = await sb.from('customers').select('loyalty_points').eq('id', customerId).single();
    const newVal = Math.max(0, Number(cur.loyalty_points ?? 0) + Number(points));
    await sb.from('customers').update({ loyalty_points: newVal }).eq('id', customerId);
  }catch{}
  await createAuditLog('LOYALTY_ADJUSTMENT','customers', customerId, null, { points, reason });
  return data;
}
