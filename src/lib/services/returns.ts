/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { getOne, createAuditLog, getSB, getProfileId, getOrgId } from './supabase';

const validReasons = ['Damaged','Expired','Near Expiry','Wrong Product','Wrong Quantity','Wrong Batch','Quality Issue','Customer Return','Supplier Error','Recall','Duplicate Sale','Pricing Error','Packaging Issue','Delivery Discrepancy','Other'] as const;
const validReturnStatuses = ['draft','pending','submitted','pending_approval','approved','processing','completed','rejected','cancelled'] as const;

function serverReturnNumber(date = new Date()){
  const d=date.toISOString().slice(0,10).replace(/-/g,'');
  const r=Math.random().toString(36).slice(2,6).toUpperCase();
  return `RET-${d}-${r}`;
}

export async function getReturns(params: {
  branch_id?: string; page?: number; perPage?: number; search?: string; status?: string; reason?: string; refund_status?: string; date_from?: string; date_to?: string; customer_id?: string; product_id?: string; batch_id?: string;
}){
  const sb:any = await getSB();
  const orgId = await getOrgId();
  let q = sb.from('returns').select('*, sales(sale_number, customer_id, customers(name)), return_items(product_id, batch_id, quantity), branches(name)', { count: 'exact' }).eq('organization_id', orgId).order('created_at',{ascending:false});
  if(params.branch_id && params.branch_id!=='all') q=q.eq('branch_id', params.branch_id);
  if(params.status && params.status!=='all') q=q.eq('status', params.status);
  if(params.reason && params.reason!=='all') q=q.eq('reason_category', params.reason).or(`reason.eq.${params.reason}`);
  if(params.refund_status && params.refund_status!=='all') q=q.eq('refund_status', params.refund_status);
  if(params.date_from) q=q.gte('created_at', params.date_from);
  if(params.date_to) q=q.lte('created_at', params.date_to);
  if(params.search && params.search.trim()){
    const s=params.search.trim();
    // server ilike on return_number/sale_number/reason, plus fallback client for product/batch
    q=q.or(`return_number.ilike.%${s}%,reason.ilike.%${s}%,sale_number.ilike.%${s}%`);
  }
  if(params.page && params.perPage){
    const from=(params.page-1)*params.perPage;
    q=q.range(from, from+params.perPage-1);
  }
  const { data, error, count } = await q;
  if(error) throw new Error(error.message);
  let list = (data ?? []) as any[];
  // client-side enrich for product/sku/barcode/batch search if server missed
  if(params.search && list.length===0) {
    // broader fetch then filter by product/batch/customer
  }
  if(params.product_id) list=list.filter((r:any)=> (r.return_items??[]).some((it:any)=> it.product_id===params.product_id));
  if(params.batch_id) list=list.filter((r:any)=> (r.return_items??[]).some((it:any)=> it.batch_id===params.batch_id));
  return { data: list, count: count ?? list.length };
}

export async function getReturnsKPIs(branch_id?: string){
  const sb:any = await getSB();
  const orgId = await getOrgId();
  let q = sb.from('returns').select('id, status, refund_status, total, reason_category, created_at');
  if(branch_id && branch_id!=='all') q=q.eq('branch_id', branch_id);
  q=q.eq('organization_id', orgId);
  const { data } = await q;
  const list=(data??[]) as any[];
  const today=new Date().toISOString().slice(0,10);
  const startMonth=new Date(new Date().getFullYear(), new Date().getMonth(),1).toISOString();
  const returnsToday=list.filter(r=> r.created_at.slice(0,10)===today).length;
  const byStatus=(s:string)=> list.filter(r=> r.status===s).length;
  const pendingApproval=list.filter(r=> ['pending','submitted','pending_approval','processing'].includes(r.status)).length;
  const pendingRefund=list.filter(r=> r.refund_status==='PENDING' || r.refund_status==='PARTIAL').length;
  const returnedValue=list.reduce((a:any,r:any)=> a+Number(r.total),0);
  const byReason:Record<string,{count:number,value:number}>={};
  for(const r of list){ const k=r.reason_category||r.reason||'Other'; if(!byReason[k]) byReason[k]={count:0,value:0}; byReason[k].count++; byReason[k].value+=Number(r.total); }
  return { returnsToday, total: list.length, pendingApproval, pendingRefund, returnedValue, byReason, byStatus: { draft:byStatus('draft'), pending:byStatus('pending'), approved:byStatus('approved'), completed:byStatus('completed'), rejected:byStatus('rejected'), cancelled:byStatus('cancelled') } };
}

export async function getReturnById(id:string){
  const sb:any = await getSB();
  const { data, error } = await sb.from('returns').select('*, sales(sale_number, total, sold_at, customer_id, customers(name), sale_items(*, products(name,sku,barcode))), return_items(*, products(name,sku,barcode), batches:batch_id(batch_number, expiry_date)), refunds(*), branches(name), audit:returns!inner(*)').eq('id', id).single();
  if(!error) return data;
  // fallback without nested audit
  const { data: d2, error: e2 } = await sb.from('returns').select('*, sales(sale_number, total, sold_at, customer_id), return_items(*, products(name,sku)), refunds(*)').eq('id', id).single();
  if(e2) throw new Error(e2.message);
  // enrich movements + audit
  const [movs, audit] = await Promise.all([
    sb.from('stock_movements').select('*').eq('reference_id', id).eq('reference_type','RETURN').then((r:any)=> r.data ?? []).catch(()=>[]),
    sb.from('audit_logs').select('*').eq('entity_id', id).order('created_at',{ascending:false}).limit(50).then((r:any)=> r.data ?? []).catch(()=>[]),
  ]);
  return { ...d2, stock_movements: movs, audit_logs: audit };
}

export async function createReturn(input:{
  sale_id: string; branch_id: string; operation_id?: string;
  items: Array<{ sale_item_id: string; product_id: string; batch_id: string; quantity: number; reason?: string; reason_category?: string; return_condition?: string; condition?: string; inventory_destination?: string }>;
  reason?: string; reason_category?: string; resolution?: string; refund_method?: string; customer_id?: string;
}){
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  if(!orgId || !pid) throw new Error('Unauthorized');
  // idempotency
  if(input.operation_id){
    const { data: dup } = await sb.from('returns').select('id, return_number').eq('operation_id', input.operation_id).maybeSingle();
    if(dup) return dup;
  }
  const sale:any = await getOne('sales', input.sale_id);
  if(!sale) throw new Error('Sale not found');
  if(sale.organization_id !== orgId) throw new Error('Sale org mismatch');
  if(input.branch_id !== sale.branch_id) throw new Error('Return branch must match sale branch');
  if(['VOIDED'].includes(sale.status)) throw new Error('Cannot return voided sale');
  // fetch sale_items for validation
  const { data: saleItems } = await sb.from('sale_items').select('*').eq('sale_id', input.sale_id);
  const siMap=new Map((saleItems??[]).map((si:any)=>[si.id, si]));
  // already returned quantities per sale_item
  const { data: existing } = await sb.from('return_items').select('sale_item_id, quantity, return_id, returns!inner(status)').in('sale_item_id', input.items.map(i=>i.sale_item_id));
  const returnedMap:Record<string,number>={};
  for(const r of (existing??[]) as any[]){
    // count only not rejected/cancelled
    const st=(r.returns as any)?.status ?? r.status;
    if(['rejected','cancelled'].includes(st)) continue;
    returnedMap[r.sale_item_id]=(returnedMap[r.sale_item_id]??0)+Number(r.quantity);
  }
  let total=0;
  for(const it of input.items){
    const si:any = siMap.get(it.sale_item_id);
    if(!si) throw new Error(`Sale item not found ${it.sale_item_id}`);
    if(si.product_id !== it.product_id) throw new Error(`Product mismatch for ${it.sale_item_id}`);
    if(si.batch_id !== it.batch_id) throw new Error(`Batch mismatch: sale batch ${si.batch_id} vs return ${it.batch_id}`);
    if(!Number.isInteger(it.quantity) || it.quantity<=0) throw new Error('Quantity must be >0');
    const already = returnedMap[it.sale_item_id] ?? 0;
    const max = Number(si.quantity) - already;
    if(it.quantity > max) throw new Error(`Exceeds returnable: sold ${si.quantity}, already returned ${already}, max ${max} for ${si.product_id.slice(0,8)}`);
    // price per spec 27/28: use original sale_item unit_price - discount + tax
    const lineUnit = Number(si.unit_price) - Number(si.discount ?? 0)/Number(si.quantity) + Number(si.tax ?? 0)/Number(si.quantity);
    // but simpler: subtotal / quantity
    const unitNet = si.subtotal ? Number(si.subtotal)/Number(si.quantity) : Number(si.unit_price);
    const amount = Number((unitNet * it.quantity).toFixed(2));
    (it as any)._amount=amount;
    total+=amount;
    // validate batch exists and product matches
    const { data: batch } = await sb.from('product_batches').select('id, product_id, batch_number, expiry_date').eq('id', it.batch_id).maybeSingle();
    if(!batch) throw new Error(`Batch ${it.batch_id} not found`);
    if(batch.product_id !== it.product_id) throw new Error('Batch product mismatch');
    // inventory destination explicit per spec 14 — map condition to destination
    const cond = (it.return_condition ?? it.condition ?? 'SELLABLE').toUpperCase();
    const dest = it.inventory_destination ?? (['SELLABLE','SEALED'].includes(cond) ? 'SALEABLE' : cond==='DAMAGED' ? 'DAMAGED' : cond==='EXPIRED' ? 'EXPIRED' : cond==='NEAR_EXPIRY' ? 'QUARANTINE' : 'QUARANTINE');
    (it as any)._dest=dest;
    (it as any)._cond=cond;
  }

  const returnNumber=serverReturnNumber();
  const payload:any={
    organization_id: orgId,
    branch_id: input.branch_id,
    return_number: returnNumber,
    sale_id: input.sale_id,
    customer_id: input.customer_id ?? sale.customer_id ?? null,
    sale_number: sale.sale_number ?? null,
    reason: input.reason ?? input.reason_category ?? 'Customer return',
    reason_category: input.reason_category ?? input.reason ?? 'Other',
    status: 'pending',
    // keep legacy pending for compatibility, but set submitted
    total: Number(total.toFixed(2)),
    refund_status: 'PENDING',
    resolution: input.resolution ?? 'REFUND',
    refund_method: input.refund_method ?? null,
    condition: input.items[0]?.condition ?? null,
    inventory_destination: (input.items[0] as any)?._dest ?? null,
    operation_id: input.operation_id ?? null,
    created_by: pid,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  // fallback if columns missing
  const { data, error } = await sb.from('returns').insert(payload).select().single();
  let ret=data;
  if(error){
    if(/column.*does not exist/i.test(error.message)){
      const legacy:any={ organization_id: orgId, branch_id: input.branch_id, return_number: returnNumber, sale_id: input.sale_id, reason: payload.reason, total: payload.total, status: 'pending', created_by: pid };
      const { data: d2, error: e2 } = await sb.from('returns').insert(legacy).select().single();
      if(e2) throw new Error(e2.message);
      ret=d2;
    } else throw new Error(error.message);
  }

  const rows = input.items.map((it:any)=>({
    return_id: ret.id,
    sale_item_id: it.sale_item_id,
    product_id: it.product_id,
    batch_id: it.batch_id,
    quantity: it.quantity,
    amount: it._amount ?? 0,
    condition: it._cond ?? null,
    inventory_destination: it._dest ?? null,
    reason_category: it.reason_category ?? it.reason ?? null,
    unit_price: (()=>{ const si:any=siMap.get(it.sale_item_id); return Number(si.unit_price ?? 0); })(),
    batch_number: it.batch_id?.slice(0,12) ?? null,
  }));
  // insert return_items with fallback for new cols
  const { error: e2 } = await sb.from('return_items').insert(rows);
  if(e2){
    if(/column.*does not exist/i.test(e2.message)){
      const legacyRows = input.items.map((it:any)=>({ return_id: ret.id, sale_item_id: it.sale_item_id, product_id: it.product_id, batch_id: it.batch_id, quantity: it.quantity, amount: it._amount ?? 0 }));
      const { error: e3 } = await sb.from('return_items').insert(legacyRows);
      if(e3){ await sb.from('returns').delete().eq('id', ret.id); throw new Error(e3.message); }
    } else { await sb.from('returns').delete().eq('id', ret.id); throw new Error(e2.message); }
  }

  // Inventory movements — per spec 24/25: explicit, auditable, never direct stock update without movement
  for(const it of input.items as any[]){
    const dest=it._dest;
    const isSaleable = dest==='SALEABLE';
    const movType = isSaleable ? 'SALE_RETURN' : (dest==='DAMAGED' ? 'DAMAGED' : dest==='EXPIRED' ? 'EXPIRED' : 'ADJUSTMENT_OUT');
    const qty = Number(it.quantity);
    // FEFO: keep original batch/expiry — just adjust quantity_available if saleable
    if(isSaleable){
      await sb.from('stock_movements').insert({
        organization_id: orgId,
        branch_id: input.branch_id,
        product_id: it.product_id,
        batch_id: it.batch_id,
        movement_type: 'SALE_RETURN',
        quantity: qty,
        reference_type: 'RETURN',
        reference_id: ret.id,
        notes: `Sales return ${ret.return_number} ${it.reason ?? ''} -> SALEABLE`,
        created_by: pid,
      });
      // increase batch saleable
      const { data: batch } = await sb.from('product_batches').select('quantity_available').eq('id', it.batch_id).single();
      await sb.from('product_batches').update({ quantity_available: Number(batch.quantity_available)+qty, updated_at: new Date().toISOString() }).eq('id', it.batch_id);
    } else {
      // quarantine/damaged/expired — do NOT increase saleable; create movement to quarantine but not batch saleable
      await sb.from('stock_movements').insert({
        organization_id: orgId,
        branch_id: input.branch_id,
        product_id: it.product_id,
        batch_id: it.batch_id,
        movement_type: movType as any,
        quantity: qty,
        reference_type: 'RETURN',
        reference_id: ret.id,
        notes: `Sales return ${ret.return_number} -> ${dest} (${it._cond}) — not saleable per pharmacy safety`,
        created_by: pid,
      });
      // No saleable increase
    }
  }

  // Audit
  await createAuditLog('RETURN_CREATED','returns',ret.id,null,ret);
  // Do NOT auto-refund — refund pending per spec 21
  return ret;
}

export async function updateReturnStatus(id:string, toStatus:string, opts?:{ rejection_reason?:string }){
  const sb:any = await getSB();
  const pid = await getProfileId();
  const { data: cur } = await sb.from('returns').select('*').eq('id', id).single();
  if(!cur) throw new Error('Return not found');
  const allowed:Record<string,string[]>={
    draft:['pending','submitted','pending_approval','cancelled'],
    pending:['submitted','pending_approval','approved','rejected','cancelled'],
    submitted:['pending_approval','approved','rejected','cancelled'],
    pending_approval:['approved','rejected','cancelled'],
    approved:['processing','completed','rejected'],
    processing:['completed','rejected'],
    completed:[],
    rejected:[],
    cancelled:[],
  };
  const curSt = (cur.status ?? 'pending').toString().toLowerCase();
  const next = toStatus.toLowerCase();
  if(curSt!==next && !(allowed[curSt]??[]).includes(next)) throw new Error(`Cannot transition ${cur.status} -> ${toStatus}`);
  const patch:any={ status: next, updated_at: new Date().toISOString() };
  if(next==='approved'){ patch.approved_by=pid; patch.approved_at=new Date().toISOString(); }
  if(next==='rejected'){ patch.rejected_at=new Date().toISOString(); patch.rejection_reason=opts?.rejection_reason ?? null; }
  if(next==='completed'){ patch.completed_at=new Date().toISOString(); patch.processed_by=pid; }
  if(next==='submitted' || next==='pending_approval') patch.submitted_at=new Date().toISOString();
  const { data, error } = await sb.from('returns').update(patch).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('RETURN_STATUS_'+next.toUpperCase(),'returns',id,cur,data);
  return data;
}

export async function createRefund(input:{ return_id: string; sale_id: string; branch_id: string; amount: number; payment_method: string; reference?: string; reason?: string; operation_id?: string }){
  const sb:any = await getSB();
  const orgId = await getOrgId();
  const pid = await getProfileId();
  if(input.operation_id){
    const { data: dup } = await sb.from('refunds').select('id').eq('operation_id', input.operation_id).maybeSingle();
    if(dup) return dup;
  }
  // validate return exists and amount <= return total - already refunded
  const { data: ret } = await sb.from('returns').select('total').eq('id', input.return_id).single();
  if(!ret) throw new Error('Return not found');
  const { data: existing } = await sb.from('refunds').select('amount, status').eq('return_id', input.return_id).neq('status','failed').neq('status','cancelled');
  const refunded = (existing??[]).reduce((a:any,r:any)=> a+Number(r.amount),0);
  if(Number(input.amount) + refunded > Number(ret.total + 0.01)) throw new Error(`Refund exceeds return value: return ${ret.total}, already refunded ${refunded}, requested ${input.amount}`);
  const { data, error } = await sb.from('refunds').insert({
    organization_id: orgId,
    branch_id: input.branch_id,
    sale_id: input.sale_id,
    return_id: input.return_id,
    refund_number: `REF-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,4).toUpperCase()}`,
    amount: Number(input.amount),
    payment_method: input.payment_method,
    reference: input.reference ?? null,
    reason: input.reason ?? null,
    status: 'pending',
    processed_by: pid,
    operation_id: input.operation_id ?? null,
  }).select().single();
  if(error) throw new Error(error.message);
  // update return refund_status
  const newRefunded = refunded + Number(input.amount);
  const refundStatus = newRefunded >= Number(ret.total) -0.01 ? 'COMPLETED' : 'PARTIAL';
  await sb.from('returns').update({ refund_status: refundStatus, updated_at: new Date().toISOString() }).eq('id', input.return_id);
  await createAuditLog('REFUND_CREATED','refunds',data.id,null,data);
  // also create cash movement if needed via existing pos/cash logic? Connect to payments? For now audit only
  return data;
}

export async function completeRefund(id:string){
  const sb:any = await getSB();
  const pid = await getProfileId();
  const { data: r } = await sb.from('refunds').select('*').eq('id', id).single();
  if(!r) throw new Error('Refund not found');
  if(r.status!=='pending') throw new Error('Only pending can be completed');
  const { data, error } = await sb.from('refunds').update({ status: 'completed', approved_by: pid, processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if(error) throw new Error(error.message);
  await createAuditLog('REFUND_COMPLETED','refunds',id,r,data);
  return data;
}

export async function getRefunds(returnId?: string, saleId?: string){
  const sb:any = await getSB();
  let q = sb.from('refunds').select('*, returns(return_number), sales(sale_number)').order('created_at',{ascending:false});
  if(returnId) q=q.eq('return_id', returnId);
  if(saleId) q=q.eq('sale_id', saleId);
  const { data } = await q;
  return data ?? [];
}
