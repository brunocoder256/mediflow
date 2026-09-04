/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB, getProfileId, createAuditLog } from './supabase';
import { roundToCents } from '../calculations';

type PosItemRequest = { product_id: string; quantity: number; discount?: number; discount_type?: 'fixed'|'percent' };
type PosPayment = { method: 'CASH'|'MOBILE_MONEY'|'CARD'|'BANK'|'OTHER'; amount: number; reference?: string; provider?: string };

async function getOrgId(){ const sb:any=await getSB(); const pid=await getProfileId(); const {data}=await sb.from('profiles').select('organization_id').eq('id',pid).single(); return data?.organization_id; }
async function getUserBranches(): Promise<string[]> {
  const sb:any=await getSB(); const {data}=await sb.rpc('get_user_branch_ids'); return (data ?? []) as string[];
}
async function hasPermission(code:string): Promise<boolean> {
  const sb:any=await getSB();
  const {data}=await sb.rpc('has_permission', { p_code: code });
  return !!data;
}
async function getMaxDiscount(): Promise<number> {
  const sb:any=await getSB();
  const {data}=await sb.rpc('max_discount_percent');
  if(data!==null && data!==undefined) return Number(data);
  return 0;
}

export async function searchProducts(branchId: string, query: string, limit=20){
  const sb:any=await getSB();
  // server-side search across name/generic/brand/sku/barcode, branch stock aware
  let q = sb.from('products').select('id, name, generic_name, brand_name, sku, barcode, is_active, category_id, unit_id, products:product_batches!inner(quantity_available, selling_price, expiry_date)').eq('products.is_active', true);
  // Actually simpler: search products, then filter via stock? We'll do ilike product fields
  q = sb.from('products').select('id, name, generic_name, brand_name, sku, barcode, is_active').eq('is_active', true).or(`name.ilike.%${query}%,generic_name.ilike.%${query}%,brand_name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`).limit(limit);
  const {data, error}=await q;
  if(error) throw new Error(error.message);
  // enrich with available stock per branch FEFO
  const enriched = await Promise.all((data??[]).map(async (p:any)=>{
    const {data: batches}=await sb.from('product_batches').select('quantity_available, selling_price, expiry_date').eq('product_id',p.id).eq('branch_id',branchId).eq('is_active',true).gt('expiry_date', new Date().toISOString()).order('expiry_date');
    const stock = (batches??[]).reduce((s:any,b:any)=>s+Number(b.quantity_available),0);
    const price = batches?.[0]?.selling_price ?? null;
    return {...p, stock, price, batches};
  }));
  return enriched.filter((p:any)=>p.stock>0 || query.length===0);
}

export async function resolveBatches(branchId:string, productId:string, quantity:number){
  const sb:any=await getSB();
  const {data: batches, error}=await sb.from('product_batches').select('id, batch_number, expiry_date, quantity_available, purchase_price, selling_price').eq('product_id',productId).eq('branch_id',branchId).eq('is_active',true).gt('expiry_date', new Date().toISOString()).gt('quantity_available',0).order('expiry_date',{ascending:true});
  if(error) throw new Error(error.message);
  let remaining=quantity; const alloc: Array<{batch_id:string, qty:number, unit_price:number, purchase_price:number}> = [];
  for(const b of (batches??[])){
    if(remaining<=0) break;
    const take=Math.min(remaining, Number(b.quantity_available));
    alloc.push({batch_id:b.id, qty:take, unit_price:Number(b.selling_price), purchase_price:Number(b.purchase_price)});
    remaining-=take;
  }
  if(remaining>0) throw new Error(`Insufficient stock for product ${productId}: need ${quantity}, available ${quantity-remaining}`);
  return alloc;
}

export async function createSaleTransaction(input:{
  branch_id:string;
  customer_id?: string;
  items: PosItemRequest[];
  payments: PosPayment[];
  operation_id?: string;
  held?: boolean;
  discount_override?: number;
  notes?: string;
}){
  const sb:any=await getSB();
  const pid=await getProfileId();
  const orgId=await getOrgId();
  const allowed=await getUserBranches();
  if(!allowed.includes(input.branch_id)) throw new Error('Unauthorized branch');

  // idempotency (also handled inside RPC)
  if(input.operation_id){
    const {data: existing}=await sb.from('sales').select('id, sale_number, status').eq('operation_id', input.operation_id).maybeSingle();
    if(existing) return { sale: existing, duplicate:true };
  }

  // Attempt atomic RPC path first (true PostgreSQL transaction)
  try {
    const { data: rpcData, error: rpcError } = await sb.rpc('create_pos_sale', {
      p_branch_id: input.branch_id,
      p_customer_id: input.customer_id ?? null,
      p_items: JSON.parse(JSON.stringify(input.items)),
      p_payments: JSON.parse(JSON.stringify(input.payments)),
      p_operation_id: input.operation_id ?? null,
      p_held: !!input.held
    });
    if (!rpcError && rpcData) {
      const res:any = rpcData;
      if (res.duplicate) {
        const { data: existing } = await sb.from('sales').select('id, sale_number, status').eq('operation_id', input.operation_id!).maybeSingle();
        return { sale: existing ?? { id: res.sale_id, sale_number: res.sale_number, status: res.status }, duplicate: true };
      }
      // Fetch full sale record + items for receipt
      const { data: sale } = await sb.from('sales').select('*').eq('id', res.sale_id).single();
      const { data: items } = await sb.from('sale_items').select('*').eq('sale_id', res.sale_id);
      return { sale, items: items ?? [], saleTotal: res.total, saleSubtotal: res.subtotal, duplicate: false };
    }
    // If RPC missing (function not deployed), fall through to legacy JS transaction
    if (rpcError && !String(rpcError.message).includes('create_pos_sale')) throw new Error(rpcError.message);
  } catch (e:any) {
    // Only fallback if function does not exist; otherwise rethrow (discount/stock errors)
    if (e.message && String(e.message).includes('Could not find the function')) {
      // fallback
    } else if (e.message && /(Unauthorized|Discount|Insufficient|stock|expired|Product inactive|Payment total|No open cash session|Concurrent)/i.test(e.message)) {
      throw e;
    } else if (String(e.message).includes('create_pos_sale')) {
      // ignore, fallback
    } else {
      // For other RPC errors, propagate
      if (e.message && !String(e.message).toLowerCase().includes('not found')) throw e;
    }
  }

  // HELD sale: no stock decrement, no COGS
  if(input.held){
    const saleNumber=`HLD-${Date.now().toString(36).toUpperCase()}`;
    // server-side discount permission enforcement (fallback path)
    const maxDiscHeld = await getMaxDiscount().catch(()=>0);
    for(const req of input.items){
      const d = req.discount ?? 0;
      if(d>0 && maxDiscHeld===0) throw new Error('Discount not permitted for your role (max 0%)');
      if(req.discount_type==='percent' && d>maxDiscHeld) throw new Error(`Discount % exceeds your limit (max ${maxDiscHeld}%)`);
    }
    // still need to allocate prices for receipt preview but not decrement
    const allocations: any[]=[]; let total=0; let subtotal=0;
    for(const req of input.items){
      const slices=await resolveBatches(input.branch_id, req.product_id, req.quantity);
      for(const s of slices){
        const disc=req.discount ?? 0;
        // discount_type percent vs fixed
        const lineDisc = req.discount_type==='percent' ? roundToCents(s.qty * s.unit_price * (disc/100)) : disc;
        const lineTotal=roundToCents(s.qty * s.unit_price - lineDisc);
        subtotal+=lineTotal; total+=lineTotal;
        allocations.push({product_id:req.product_id, batch_id:s.batch_id, quantity:s.qty, unit_price:s.unit_price, discount:lineDisc, purchase_price:s.purchase_price});
      }
    }
    const {data: sale, error}=await sb.from('sales').insert({
      organization_id: orgId, branch_id: input.branch_id, sale_number: saleNumber, customer_id: input.customer_id ?? null,
      status:'HELD', subtotal: roundToCents(subtotal), discount:0, tax:0, total: roundToCents(total), cashier_id: pid, operation_id: input.operation_id ?? null, sold_at: new Date().toISOString()
    }).select().single();
    if(error) throw new Error(error.message);
    // sale_items for HELD
    const itemsToInsert=allocations.map(a=>({ sale_id:sale.id, product_id:a.product_id, batch_id:a.batch_id, quantity:a.qty, unit_price:a.unit_price, discount:a.discount, tax:0, subtotal: roundToCents(a.qty*a.unit_price - a.discount) }));
    if(itemsToInsert.length) await sb.from('sale_items').insert(itemsToInsert);
    await createAuditLog('SALE_HELD','sales',sale.id,null,sale);
    return { sale, items: itemsToInsert, duplicate:false };
  }

  // Regular sale: FEFO + server pricing + atomic decrement
  // Step 1: resolve all allocations first (fail fast on stock)
  const maxDisc = await getMaxDiscount().catch(()=>0);
  const allAllocations: Array<{product_id:string, batch_id:string, qty:number, unit_price:number, purchase_price:number, discount:number, tax:number}> = [];
  let saleSubtotal=0;
  for(const req of input.items){
    if(req.quantity<=0) throw new Error('Quantity must be >0');
    // verify product active
    const {data: prod}=await sb.from('products').select('is_active').eq('id', req.product_id).single();
    if(!prod?.is_active) throw new Error('Product inactive or not found');
    // discount permission
    const rawDiscCheck = req.discount ?? 0;
    if(rawDiscCheck>0 && maxDisc===0) throw new Error('Discount not permitted for your role (max 0%)');
    if(req.discount_type==='percent' && rawDiscCheck>maxDisc) throw new Error(`Discount % exceeds your limit (max ${maxDisc}%)`);
    const slices=await resolveBatches(input.branch_id, req.product_id, req.quantity);
    for(const s of slices){
      const rawDisc=req.discount ?? 0;
      if(rawDisc<0) throw new Error('Discount cannot be negative');
      const lineDisc = req.discount_type==='percent' ? (()=>{ if(rawDisc>100) throw new Error('Discount percent >100'); return roundToCents(s.qty*s.unit_price*rawDisc/100); })() : rawDisc;
      if(lineDisc > s.qty*s.unit_price) throw new Error('Discount exceeds line total');
      const lineSubtotal=roundToCents(s.qty*s.unit_price - lineDisc);
      allAllocations.push({product_id:req.product_id, batch_id:s.batch_id, qty:s.qty, unit_price:s.unit_price, purchase_price:s.purchase_price, discount:lineDisc, tax:0});
      saleSubtotal+=lineSubtotal;
    }
  }
  const saleTotal=roundToCents(saleSubtotal); // tax 0 for now, branch setting could add later
  const paymentTotal = (input.payments??[]).reduce((s:any,p:any)=>s+Number(p.amount),0);
  if(paymentTotal < saleTotal - 0.01) throw new Error(`Payment total ${paymentTotal} < sale total ${saleTotal}`);

  // Check cash session if any CASH payment
  const hasCash = (input.payments??[]).some((p:any)=>p.method==='CASH');
  let cashSessionId: string | null = null;
  if(hasCash){
    const {data: sess}=await sb.from('cash_sessions').select('id').eq('branch_id', input.branch_id).eq('status','OPEN').limit(1).maybeSingle();
    if(!sess) throw new Error('No open cash session for this branch - open a session first');
    cashSessionId=sess.id;
  }

  // Atomic decrement: for each allocation, update with quantity_available >= qty guard
  for(const alloc of allAllocations){
    // Do atomic via: update where id and quantity_available >= qty
    const {data: batchBefore}=await sb.from('product_batches').select('quantity_available').eq('id',alloc.batch_id).single();
    if(!batchBefore || Number(batchBefore.quantity_available) < alloc.qty) throw new Error('Concurrent stock conflict - insufficient quantity');
    const newQty = Number(batchBefore.quantity_available) - alloc.qty;
    const {error: decErr}=await sb.from('product_batches').update({ quantity_available: newQty }).eq('id', alloc.batch_id).eq('quantity_available', batchBefore.quantity_available);
    if(decErr) throw new Error(`Failed to decrement batch ${alloc.batch_id}: ${decErr.message}`);
    // verify update succeeded (concurrency check)
    const {data: check}=await sb.from('product_batches').select('quantity_available').eq('id',alloc.batch_id).single();
    if(Number(check.quantity_available) !== newQty) throw new Error('Concurrent modification detected - please retry');
  }

  // Now create sale atomically (if any decrement fails, we already decremented some - in real prod use RPC transaction; for now best effort with rollback attempt)
  // Create sale
  const saleNumber=`SALE-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const {data: sale, error: saleErr}=await sb.from('sales').insert({
    organization_id: orgId, branch_id: input.branch_id, sale_number: saleNumber, customer_id: input.customer_id ?? null,
    status:'COMPLETED', subtotal: saleSubtotal, discount:0, tax:0, total: saleTotal, cashier_id: pid, operation_id: input.operation_id ?? null, sold_at: new Date().toISOString()
  }).select().single();
  if(saleErr){
    // rollback decrements
    for(const alloc of allAllocations){
      const {data: b}=await sb.from('product_batches').select('quantity_available').eq('id',alloc.batch_id).single();
      await sb.from('product_batches').update({ quantity_available: Number(b.quantity_available)+alloc.qty }).eq('id',alloc.batch_id);
    }
    throw new Error(saleErr.message);
  }

  // sale_items with historical COGS (purchase_price retained via join not stored but we insert unit_price; COGS derived from batch)
  const itemsToInsert=allAllocations.map(a=>({ sale_id:sale.id, product_id:a.product_id, batch_id:a.batch_id, quantity:a.qty, unit_price:a.unit_price, discount:a.discount, tax:a.tax, subtotal: roundToCents(a.qty*a.unit_price - a.discount) }));
  const {error: itemsErr}=await sb.from('sale_items').insert(itemsToInsert);
  if(itemsErr){
    // rollback
    await sb.from('sales').delete().eq('id',sale.id);
    for(const alloc of allAllocations){
      const {data: b}=await sb.from('product_batches').select('quantity_available').eq('id',alloc.batch_id).single();
      await sb.from('product_batches').update({ quantity_available: Number(b.quantity_available)+alloc.qty }).eq('id',alloc.batch_id);
    }
    throw new Error(itemsErr.message);
  }

  // payments
  for(const p of (input.payments??[])){
    const {error: payErr}=await sb.from('payments').insert({
      organization_id: orgId, branch_id: input.branch_id, sale_id: sale.id, payment_method:p.method, amount: roundToCents(p.amount), reference: p.reference ?? null, provider: p.provider ?? null, reconciliation_status:'UNRECONCILED', session_id: p.method==='CASH'? cashSessionId : null, payer_reference: p.reference ?? null, status:'completed', operation_id: input.operation_id ? `${input.operation_id}-${p.method}` : null
    });
    if(payErr) throw new Error(payErr.message);
    if(p.method==='CASH' && cashSessionId){
      await sb.from('cash_movements').insert({
        organization_id: orgId, branch_id: input.branch_id, session_id: cashSessionId, type:'SALE', amount: roundToCents(p.amount), direction:'IN', reference_type:'SALE', reference_id: sale.id, created_by: pid
      });
    }
  }

  // stock movements per allocation
  for(const alloc of allAllocations){
    await sb.from('stock_movements').insert({
      organization_id: orgId, branch_id: input.branch_id, product_id: alloc.product_id, batch_id: alloc.batch_id, movement_type:'SALE', quantity: -alloc.qty, reference_type:'SALE', reference_id: sale.id, unit_cost: alloc.purchase_price, operation_id: input.operation_id ? `${input.operation_id}-${alloc.batch_id}` : null, created_by: pid
    });
  }

  await createAuditLog('SALE_COMPLETED','sales',sale.id,null,{...sale, items: itemsToInsert});

  return { sale, items: itemsToInsert, saleTotal, saleSubtotal, duplicate:false };
}

export async function getHeldSales(branchId:string){
  const sb:any=await getSB();
  const {data}=await sb.from('sales').select('id, sale_number, customer_id, total, sold_at, sale_items(product_id, quantity, unit_price, products(name))').eq('branch_id',branchId).eq('status','HELD').order('sold_at',{ascending:false});
  return data ?? [];
}
export async function resumeHeldSale(saleId:string){
  const sb:any=await getSB();
  const {data}=await sb.from('sales').select('*, sale_items(*)').eq('id',saleId).eq('status','HELD').single();
  return data;
}
export async function cancelHeldSale(saleId:string){
  const sb:any=await getSB();
  const {error}=await sb.from('sales').delete().eq('id',saleId).eq('status','HELD');
  if(error) throw new Error(error.message);
  await createAuditLog('SALE_HELD_CANCELLED','sales',saleId,null,null);
  return true;
}
