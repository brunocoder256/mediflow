"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ShoppingCart, Plus, Minus, Trash2, Banknote, CreditCard, Smartphone, Pause, Receipt as ReceiptIcon, WifiOff, Wifi, MapPin, RefreshCw, AlertTriangle, Clock, User, X, Eye, RotateCcw } from "lucide-react";
import { Receipt, printReceipt } from "@/components/receipt";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { db } from "@/lib/offline/db";
import { processSyncQueue, setupAutoSync, queuePosSale } from "@/lib/offline/sync";

type Product = {
  id: string;
  name: string;
  generic_name?: string | null;
  sku: string;
  barcode: string | null;
  stock: number;
  price: number;
  category_id?: string | null;
  batches?: Array<{ id:string; batch_number:string; expiry_date:string; quantity_available:number; selling_price:number; purchase_price:number }>;
  is_active?: boolean;
  fefo_batch?: { batch_number:string; expiry_date:string } | null;
  expiry_status?: 'expired'|'near'|'ok'|'out';
  near_expiry_days?: number | null;
};

type CartItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_type?: 'fixed'|'percent';
  generic?: string | null;
  batches?: Product['batches'];
};

type CustomerOpt = { id:string; name:string; phone?:string|null; email?:string|null };

function formatUGX(n:number){ return `UGX ${n.toLocaleString('en-UG')}`; }
function daysUntil(dateStr:string){ const diff = new Date(dateStr).getTime() - Date.now(); return Math.ceil(diff/86400000); }
function expiryLabel(expiry:string, warningDays:number){
  const d=daysUntil(expiry);
  if(d<0) return { label:'NOT FOR SALE — expired', variant:'destructive' as const, text:'Expired' };
  if(d<=7) return { label:`⚠ Expires in ${d} days`, variant:'destructive' as const, text:`Expires in ${d}d` };
  if(d<=30) return { label:`⚠ Expires in ${d} days`, variant:'warning' as const, text:`Expires in ${d}d` };
  if(d<=warningDays) return { label:`⚠ Expires in ${d} days`, variant:'warning' as const, text:`Expires in ${d}d` };
  return null;
}
function NewCustomerInline({ onCreated, preserveCartNote }:{ onCreated:(c:any)=>void; preserveCartNote?:string }){
  const [name,setName]=React.useState(""); const [phone,setPhone]=React.useState(""); const [email,setEmail]=React.useState(""); const [dup,setDup]=React.useState<any[]>([]); const [busy,setBusy]=React.useState(false);
  const checkDup=React.useCallback(async()=>{
    if(!phone && !email && !name) { setDup([]); return; }
    const p=new URLSearchParams(); if(phone) p.set("phone",phone); if(email) p.set("email",email); if(name) p.set("name",name);
    try{ const r=await fetch(`/api/customers?check=1&${p.toString()}`); const j=await r.json(); if(Array.isArray(j)) setDup(j); }catch{}
  },[phone,email,name]);
  React.useEffect(()=>{ const t=setTimeout(checkDup,400); return()=>clearTimeout(t); },[checkDup]);
  const save=async(force=false)=>{
    if(!name.trim()) return alert("Name required");
    setBusy(true);
    try{
      if(!force && dup.length>0){ alert("A similar customer already exists — choose View Existing or Continue Anyway"); setBusy(false); return; }
      const payload:any={ display_name: name.trim(), name: name.trim(), phone: phone||null, email: email||null, customer_type:"INDIVIDUAL", continue_anyway: force };
      const r=await fetch("/api/customers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const j=await r.json();
      if(r.status===409 && j.duplicate_detected){ setDup(j.duplicates ?? []); setBusy(false); return; }
      if(!r.ok) throw new Error(j.error);
      setName(""); setPhone(""); setEmail(""); setDup([]); onCreated(j);
    }catch(e:any){ alert(e.message); }
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      {dup.length>0 && <div className="border border-amber-300 bg-amber-50 rounded p-2 text-xs"><p className="font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> A similar customer already exists.</p>{dup.map((d:any)=><div key={d.id} className="flex justify-between bg-white border rounded p-1 mt-1"><span>{d.display_name ?? d.name} • {d.phone}</span><button onClick={()=>onCreated(d)} className="text-primary underline">View Existing</button></div>)}</div>}
      <Input placeholder="Name *" value={name} onChange={e=>setName(e.target.value)} />
      <div className="flex gap-2"><Input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} className="flex-1"/><Input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="flex-1"/></div>
      <div className="flex gap-2">
        <Button size="sm" onClick={()=>save(false)} disabled={!name.trim()||busy} className="flex-1">{busy?"Saving...":"Save"}</Button>
        {dup.length>0 && <Button size="sm" variant="outline" onClick={()=>save(true)} disabled={busy} className="flex-1">Continue Anyway</Button>}
      </div>
      {preserveCartNote && <p className="text-xs text-muted-foreground">{preserveCartNote}</p>}
    </div>
  );
}

export default function PosPage(){
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod]=React.useState<'CASH'|'MOBILE_MONEY'|'CARD'|'BANK'|'OTHER'>('CASH');
  const [amountReceived, setAmountReceived]=React.useState<string>("");
  const [paymentRef, setPaymentRef]=React.useState("");
  const [branches,setBranches]=React.useState<any[]>([]);
  const [branchId,setBranchId]=React.useState("");
  const [receiptData, setReceiptData]=React.useState<any>(null);
  const [busy,setBusy]=React.useState(false);
  const [held,setHeld]=React.useState<any[]>([]);
  const [pendingCount,setPendingCount]=React.useState(0);
  const [syncing,setSyncing]=React.useState(false);
  const [syncError,setSyncError]=React.useState<string|null>(null);
  const [cashSession,setCashSession]=React.useState<any>(null);
  const [orgSettings,setOrgSettings]=React.useState<any>(null);
  const [customers,setCustomers]=React.useState<CustomerOpt[]>([]);
  const [selectedCustomer,setSelectedCustomer]=React.useState<CustomerOpt|null>(null);
  const [customerSearch,setCustomerSearch]=React.useState("");
  const [expiryWarningDays,setExpiryWarningDays]=React.useState(90);
  const [showPay,setShowPay]=React.useState(false);
  const [showHeld,setShowHeld]=React.useState(false);
  const [showCustomer,setShowCustomer]=React.useState(false);
  const [showClear,setShowClear]=React.useState(false);
  const [showBatch,setShowBatch]=React.useState<CartItem|null>(null);
  const [saleDiscount,setSaleDiscount]=React.useState<number>(0);
  const [splitMode,setSplitMode]=React.useState(false);
  const [splitPayments,setSplitPayments]=React.useState<Array<{id:string; method:'CASH'|'MOBILE_MONEY'|'CARD'|'BANK'|'OTHER'; amount:string; reference:string}>>([]);
  const [categoryFilter,setCategoryFilter]=React.useState<string>("all");
  const [categories,setCategories]=React.useState<any[]>([]);
  const {isOnline}=useOnlineStatus();
  const searchRef=React.useRef<HTMLInputElement>(null);

  const fetchProducts = React.useCallback(async (bId:string)=>{
    if(!bId) return;
    setLoading(true);
    try{
      const [prodRes, invRes] = await Promise.all([fetch("/api/products").then(r=>r.json()), fetch("/api/inventory").then(r=>r.json())]);
      const list:Array<any> = Array.isArray(prodRes) ? prodRes : prodRes.data ?? prodRes ?? [];
      // stock map per product for branch
      const stockRows: any[] = invRes.stock ?? [];
      const branchStock = stockRows.filter((b:any)=> b.branch_id===bId || !b.branch_id || b.branch_id==null);
      // group by product
      const map: Record<string,{ qty:number; price:number; batches:any[]}> = {};
      for(const b of branchStock){
        const pid=b.product_id;
        if(!map[pid]) map[pid]={qty:0, price:Number(b.selling_price??0), batches:[]};
        map[pid].qty += Number(b.quantity_available);
        map[pid].batches.push(b);
        if(!map[pid].price) map[pid].price = Number(b.selling_price ?? 0);
      }
      // also include orgSettings expiry days
      const mapped: Product[] = list.filter((p:any)=>p.is_active!==false).map((p:any)=>{
        const s=map[p.id];
        const batches: Product['batches'] = (s?.batches ?? []).sort((a:any,b:any)=> new Date(a.expiry_date).getTime()-new Date(b.expiry_date).getTime());
        const now=new Date();
        // expired vs near
        let expiry_status: Product['expiry_status']='ok';
        let near_days:number|null=null;
        let fefo:any=null;
        if(batches.length){
          const valid=batches.filter(b=> new Date(b.expiry_date)>now && Number(b.quantity_available)>0);
          if(valid.length===0){
            expiry_status = s && s.qty>0 ? 'expired' : 'out';
            if((s?.qty ?? 0)===0) expiry_status='out';
          } else {
            fefo={batch_number: valid[0].batch_number, expiry_date: valid[0].expiry_date};
            const d=daysUntil(valid[0].expiry_date);
            if(d<=expiryWarningDays) { expiry_status='near'; near_days=d; }
          }
        } else {
          if((s?.qty ?? 0)===0) expiry_status='out';
        }
        return {
          id:p.id,
          name:p.name,
          generic_name:p.generic_name ?? null,
          sku:p.sku ?? '',
          barcode:p.barcode ?? null,
          stock: s?.qty ?? 0,
          price: batches.find(b=>Number(b.quantity_available)>0 && new Date(b.expiry_date)>now)?.selling_price ?? s?.price ?? 0,
          category_id:p.category_id ?? null,
          batches,
          fefo_batch: fefo,
          expiry_status,
          near_expiry_days: near_days
        };
      });
      setProducts(mapped);
    }catch{ setProducts([]); }
    setLoading(false);
  },[expiryWarningDays]);

  // initial load: branches + org + categories
  React.useEffect(()=>{
    fetch("/api/settings").then(r=>r.json()).then(j=>{
      if(j.branches?.length){ setBranches(j.branches); if(!branchId) setBranchId(j.branches[0].id); }
      if(j.organization_settings){ setOrgSettings(j.organization_settings); setExpiryWarningDays(j.organization_settings.expiry_warning_days ?? 90); }
    }).catch(()=>{});
    fetch("/api/categories").then(r=>r.json()).then(j=>{ if(Array.isArray(j)) setCategories(j); }).catch(()=>{});
  },[]);

  // when branch changes refresh products + cash session + held sales
  React.useEffect(()=>{
    if(branchId){ fetchProducts(branchId); }
    if(branchId){
      fetch(`/api/cash/sessions?current=true&branch_id=${branchId}`).then(r=>r.json()).then(j=> setCashSession(j)).catch(()=>setCashSession(null));
      // held sales
      fetch(`/api/sales?branch_id=${branchId}&status=HELD`).then(r=>r.json()).then(j=>{
        const data = Array.isArray(j.data) ? j.data : Array.isArray(j) ? j : [];
        setHeld(data);
      }).catch(()=>{});
    }
  },[branchId, fetchProducts]);

  // pending sync count polling + auto sync
  const [failedCount,setFailedCount]=React.useState(0);
  React.useEffect(()=>{
    const update=async()=>{
      const c=await db.syncQueue.where("status").equals("pending").count();
      setPendingCount(c);
      const f=await db.syncQueue.where("status").equals("failed").count();
      setFailedCount(f);
      if(f>0){
        const failed=await db.syncQueue.where("status").equals("failed").toArray();
        // show most recent failure
        failed.sort((a:any,b:any)=> new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
        setSyncError(failed[0]?.error ?? "Sync failed");
      } else setSyncError(null);
    };
    update();
    const id=setInterval(update, 2000);
    const cleanup=setupAutoSync(update);
    return ()=>{ clearInterval(id); cleanup(); };
  },[]);

  // keyboard shortcuts
  React.useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); searchRef.current?.focus(); }
      if(e.key==='Escape'){ setShowPay(false); setShowHeld(false); setShowCustomer(false); setShowClear(false); setShowBatch(null); }
    };
    window.addEventListener('keydown', handler);
    return ()=> window.removeEventListener('keydown',handler);
  },[]);

  // customers fetch
  React.useEffect(()=>{
    const q=customerSearch.trim();
    fetch(`/api/customers?search=${encodeURIComponent(q)}`).then(r=>r.json()).then(j=> setCustomers(Array.isArray(j)?j:[])).catch(()=>{});
  },[customerSearch]);

  const filtered = React.useMemo(()=>{
    const q=searchQuery.toLowerCase().trim();
    return products.filter(p=>{
      if(categoryFilter!=="all" && p.category_id!==categoryFilter) return false;
      if(!q) return true;
      if(p.barcode && p.barcode.toLowerCase()===q) return true;
      return p.name.toLowerCase().includes(q) || (p.generic_name??'').toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode??'').toLowerCase().includes(q);
    });
  },[products, searchQuery, categoryFilter]);

  // barcode exact auto-add (no dialog)
  React.useEffect(()=>{
    const q=searchQuery.trim();
    if(!q || q.length<4) return;
    const exact=products.find(p=>p.barcode && p.barcode.toLowerCase()===q.toLowerCase());
    if(exact){ addToCart(exact); setSearchQuery(""); }
  },[searchQuery, products]);

  const addToCart=(p:Product)=>{
    if(p.expiry_status==='expired') { alert('NOT FOR SALE — all batches expired'); return; }
    if(p.stock===0) { alert('OUT OF STOCK'); return; }
    setCart(prev=>{
      const ex=prev.find(x=>x.product_id===p.id);
      if(ex){
        if(ex.quantity >= p.stock) { alert('Insufficient stock (available '+p.stock+')'); return prev; }
        return prev.map(x=> x.product_id===p.id ? {...x, quantity:x.quantity+1}:x);
      }
      return [...prev, { product_id:p.id, name:p.name, quantity:1, unit_price:p.price, discount:0, generic:p.generic_name, batches:p.batches }];
    });
  };
  const updateQty=(id:string, delta:number)=> setCart(c=> {
    const next=c.map(x=> x.product_id===id ? {...x, quantity: Math.max(0, x.quantity+delta)}:x).filter(x=>x.quantity>0);
    // validate against stock
    const p=products.find(pp=>pp.id===id);
    if(p && next.find(x=>x.product_id===id && x.quantity>p.stock)){
      alert('Insufficient stock');
      return c;
    }
    return next;
  });
  const updateQtyDirect=(id:string, val:string)=>{
    const n=Number(val);
    if(!Number.isFinite(n) || n<0) return;
    const p=products.find(pp=>pp.id===id);
    if(p && n>p.stock){ alert('Insufficient stock'); return; }
    if(n===0) setCart(c=>c.filter(x=>x.product_id!==id));
    else setCart(c=>c.map(x=> x.product_id===id ? {...x, quantity:Math.floor(n)}:x));
  };
  const updateLineDiscount=(id:string, val:string, type:'fixed'|'percent'=(cart.find(c=>c.product_id===id)?.discount_type ?? 'fixed'))=>{
    const n=Number(val);
    if(!Number.isFinite(n) || n<0) return;
    setCart(c=> c.map(x=> x.product_id===id ? {...x, discount: n, discount_type:type}:x));
  };
  const removeItem=(id:string)=> setCart(c=>c.filter(x=>x.product_id!==id));
  const clearCart=()=>{ setCart([]); setSaleDiscount(0); setShowClear(false); setSplitPayments([]); setSplitMode(false); };

  const subtotal = React.useMemo(()=> cart.reduce((s,x)=>{
    const disc = x.discount_type==='percent' ? Math.round(x.quantity*x.unit_price*x.discount/100*100)/100 : x.discount;
    return s + x.quantity*x.unit_price - disc;
  },0),[cart]);
  const totalAfterSaleDisc = Math.max(0, Math.round((subtotal - saleDiscount)*100)/100);
  const change = (()=> {
    if(splitMode){
      const cashSum = splitPayments.filter(p=>p.method==='CASH').reduce((s,p)=> s+Number(p.amount||0),0);
      const totalPaid = splitPayments.reduce((s,p)=> s+Number(p.amount||0),0);
      if(cashSum>0 && totalPaid>=totalAfterSaleDisc) return Math.max(0, Math.round((cashSum - Math.max(0, totalAfterSaleDisc - (totalPaid - cashSum)))*100)/100);
      return 0;
    }
    return paymentMethod==='CASH' && amountReceived ? Math.max(0, Math.round((Number(amountReceived||0) - totalAfterSaleDisc)*100)/100) : 0;
  })();

  const canPay = (()=> {
    if(!cart.length) return false;
    if(busy) return false;
    if(!branchId) return false;
    if(splitMode){
      const sum = splitPayments.reduce((s,p)=> s+Number(p.amount||0),0);
      if(sum < totalAfterSaleDisc - 0.01) return false;
      if(splitPayments.some(p=> !p.amount || Number(p.amount)<=0)) return false;
      if(splitPayments.some(p=> p.method!=='CASH' && !p.reference.trim())) return false;
      if(splitPayments.some(p=> p.method==='CASH') && !cashSession) return false;
      if(splitPayments.length===0) return false;
      return true;
    }
    if(paymentMethod==='CASH'){
      const recv=Number(amountReceived||0);
      if(!amountReceived || recv < totalAfterSaleDisc - 0.01) return false;
      if(!cashSession) return false;
    }
    if(paymentMethod!=='CASH' && !paymentRef.trim()) return false;
    return true;
  })();

  const hold=async()=>{
    if(!cart.length || !branchId) return;
    try{
      const op=crypto.randomUUID();
      let itemsForHold: any;
      if(saleDiscount>0 && subtotal>0){
        let rem=saleDiscount;
        itemsForHold = cart.map((c, idx)=>{
          const lineDisc = c.discount_type==='percent' ? Math.round(c.quantity*c.unit_price*(c.discount/100)*100)/100 : c.discount;
          const lineTotal=c.quantity*c.unit_price - lineDisc;
          const share= idx===cart.length-1 ? Math.round(rem*100)/100 : Math.round((lineTotal/subtotal)*saleDiscount*100)/100;
          rem=Math.round((rem-share)*100)/100;
          return {product_id:c.product_id, quantity:c.quantity, discount: Math.round((lineDisc+share)*100)/100, discount_type:'fixed'};
        });
      } else itemsForHold = cart.map(c=>({product_id:c.product_id, quantity:c.quantity, discount:c.discount, discount_type:c.discount_type}));
      const payload={ branch_id:branchId, items: itemsForHold, payments:[{method:'CASH',amount: totalAfterSaleDisc}], held:true, operation_id: op };
      const r=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error ?? 'Hold failed');
      setHeld(h=>[...h, j.sale]);
      setCart([]); setSaleDiscount(0); setSplitPayments([]); setSplitMode(false);
    }catch(e:any){ alert(e.message); }
  };

  const resumeHeld=async(sale:any)=>{
    try{
      const r=await fetch(`/api/sales?id=${sale.id}`).then(rr=>rr.json());
      const items:any[] = r.sale_items ?? r.items ?? sale.sale_items ?? [];
      // map to cart
      setCart(items.map((it:any)=>{
        const prod=products.find(p=>p.id===it.product_id);
        return { product_id:it.product_id, name: prod?.name ?? it.products?.name ?? it.product_id.slice(0,8), quantity: it.quantity, unit_price: it.unit_price, discount: it.discount ?? 0, generic: prod?.generic_name };
      }));
      // delete held? keep until completed then cancel via API delete? For now remove from held list and call cancel
      await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:'void', sale_id: sale.id, reason:'Resume held - will re-create'})}).catch(()=>{});
      setHeld(h=>h.filter(x=>x.id!==sale.id));
      setShowHeld(false);
    }catch(e:any){ alert(e.message); }
  };
  const cancelHeld=async(id:string)=>{
    try{
      const r=await fetch(`/api/sales`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:'void', sale_id:id, reason:'Cancelled held sale'})});
      if(!r.ok){ // fallback delete via held endpoint not exist; try direct via cash? remove locally
      }
      setHeld(h=>h.filter(x=>x.id!==id));
    }catch(e:any){ alert((e as any).message); }
  };

  const syncNow=async()=>{
    setSyncing(true);
    try{ await processSyncQueue(); const c=await db.syncQueue.where("status").equals("pending").count(); setPendingCount(c); } finally{ setSyncing(false); }
  };

  const checkout=async()=>{
    if(!cart.length || !branchId) return;
    setBusy(true);
    const op=crypto.randomUUID();
    // distribute sale-level discount proportionally as fixed discounts so server total matches totalAfterSaleDisc
    let itemsForPayload: Array<{product_id:string; quantity:number; discount:number; discount_type:'fixed'|'percent'}>;
    if(saleDiscount>0 && subtotal>0){
      let remaining=saleDiscount;
      itemsForPayload = cart.map((c, idx)=>{
        const lineDiscFixed = c.discount_type==='percent' ? Math.round(c.quantity*c.unit_price*(c.discount/100)*100)/100 : c.discount;
        const lineTotal = c.quantity*c.unit_price - lineDiscFixed;
        const share = idx===cart.length-1 ? Math.round(remaining*100)/100 : Math.round((lineTotal/subtotal)*saleDiscount*100)/100;
        remaining = Math.round((remaining - share)*100)/100;
        const totalDisc = Math.round((lineDiscFixed + share)*100)/100;
        return { product_id:c.product_id, quantity:c.quantity, discount: totalDisc, discount_type: 'fixed' as const };
      });
    } else {
      itemsForPayload = cart.map(c=>({product_id:c.product_id, quantity:c.quantity, discount:c.discount, discount_type:c.discount_type ?? 'fixed'}));
    }
    let paymentsForPayload: Array<{method:'CASH'|'MOBILE_MONEY'|'CARD'|'BANK'|'OTHER'; amount:number; reference?:string}>;
    if(splitMode && splitPayments.length){
      paymentsForPayload = splitPayments.map(p=>({ method:p.method, amount: Math.round(Number(p.amount||0)*100)/100, reference: p.method!=='CASH' ? p.reference || undefined : undefined }));
    } else {
      paymentsForPayload = [{method:paymentMethod, amount: Math.round(totalAfterSaleDisc*100)/100, reference: paymentMethod!=='CASH' ? paymentRef || undefined : undefined}];
    }
    const payload={
      branch_id: branchId,
      customer_id: selectedCustomer?.id || undefined,
      items: itemsForPayload,
      payments: paymentsForPayload,
      operation_id: op
    };
    // Offline queue
    if(!isOnline){
      try{
        await queuePosSale(payload as any, op);
        setPendingCount(await db.syncQueue.where("status").equals("pending").count());
        setCart([]); setSaleDiscount(0); setShowPay(false); setAmountReceived(""); setPaymentRef(""); setSplitPayments([]); setSplitMode(false);
        alert('OFFLINE — sale queued with operation_id ' + op + '. Will sync when online. Server validates stock & prevents duplicates.');
      }catch(e:any){ alert('Queue failed: '+e.message); }
      setBusy(false);
      return;
    }
    try{
      const r=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok) {
        const msg=j.error ?? 'Sale failed';
        if(/cash session/i.test(msg)){ alert(msg + ' — Open cash session first'); }
        else if(/insufficient|stock|expired/i.test(msg)){ alert('Unable to complete sale. '+msg+' Please review cart.'); }
        else throw new Error(msg);
        setBusy(false);
        return;
      }
      // server returns allocations in items
      const saleItems = j.items ?? cart.map(c=>({ ...c, batch_id: null }));
      const paySummary = splitMode && splitPayments.length ? splitPayments.map(p=>`${p.method}:${formatUGX(Number(p.amount))}${p.reference?`(${p.reference})`:''}`).join(' + ') : paymentMethod;
      setReceiptData({ sale: j.sale, items: saleItems, total: j.saleTotal ?? totalAfterSaleDisc, subtotal: j.saleSubtotal ?? subtotal, branchId, paymentMethod: paySummary, change, customer: selectedCustomer?.name });
      setCart([]); setSaleDiscount(0); setShowPay(false); setAmountReceived(""); setPaymentRef(""); setSplitPayments([]); setSplitMode(false);
      // refresh products (stock)
      fetchProducts(branchId);
      const c=await db.syncQueue.where("status").equals("pending").count(); setPendingCount(c);
    }catch(e:any){ alert(e.message + " — if offline, sale queued. Check Sync Center. Duplicate prevented via operation_id."); }
    setBusy(false);
  };

  const ProductCard=({product}:{product:Product})=>{
    const expInfo = product.batches?.[0] ? expiryLabel(product.batches.find(b=> Number(b.quantity_available)>0 && new Date(b.expiry_date)>new Date())?.expiry_date ?? '', expiryWarningDays) : null;
    const isExpired = product.expiry_status==='expired';
    const isOut = product.stock===0 || product.expiry_status==='out';
    return (
      <button aria-label={product.name} onClick={()=>addToCart(product)} disabled={isOut || isExpired} className="flex flex-col items-start p-3 rounded-lg border bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left w-full focus-visible:ring-2 focus-visible:ring-ring">
        <p className="font-medium text-sm line-clamp-2 leading-tight">{product.name}</p>
        {product.generic_name && <p className="text-xs text-muted-foreground">{product.generic_name}</p>}
        <p className="text-xs text-muted-foreground truncate w-full">{product.sku}{product.barcode ? ` · ${product.barcode}`:''}</p>
        <p className="text-base font-bold mt-1">{product.price ? formatUGX(product.price) : '—'}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {isOut && <Badge variant="destructive">OUT OF STOCK</Badge>}
          {isExpired && <Badge variant="destructive">NOT FOR SALE — expired</Badge>}
          {product.expiry_status==='near' && expInfo && <Badge variant="warning">⚠ Expires in {product.near_expiry_days}d</Badge>}
          {!isOut && !isExpired && product.expiry_status!=='near' && <Badge variant={product.stock<10?"destructive":"secondary"}>Stock: {product.stock}</Badge>}
          {product.fefo_batch && !isExpired && !isOut && <Badge variant="outline" className="text-[11px]">FEFO: {product.fefo_batch.batch_number}</Badge>}
        </div>
      </button>
    );
  };

  if(receiptData){
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="text-center py-2">
          <p className="text-sm font-semibold text-green-600 flex items-center justify-center gap-2">✓ Sale Completed</p>
          <p className="text-xs text-muted-foreground">Receipt #{receiptData.sale.sale_number}</p>
        </div>
        <Receipt
          organization={{name: orgSettings?.receipt_header?.split('\n')[0] ?? "MediFlow Pharmacy", address:"Kampala Road, Kampala", phone:"+256700123456", registration_number:"REG-2024-001"}}
          branch={{name: branches.find(b=>b.id===receiptData.branchId)?.name ?? "Main Branch"}}
          receipt_number={receiptData.sale.sale_number}
          sold_at={receiptData.sale.sold_at ?? new Date().toISOString()}
          cashier="Cashier"
          customer={receiptData.customer}
          items={receiptData.items.map((it:any)=>({ name: it.name ?? products.find(p=>p.id===it.product_id)?.name ?? it.product_id.slice(0,8), quantity: it.quantity ?? it.qty, unit_price: it.unit_price, discount: it.discount ?? 0, tax: it.tax ?? 0, subtotal: it.subtotal ?? Math.round((it.quantity??it.qty)*it.unit_price - (it.discount??0)) }))}
          subtotal={receiptData.subtotal}
          discount={saleDiscount}
          tax={0}
          total={receiptData.total}
          payment_method={receiptData.paymentMethod}
          footer={orgSettings?.receipt_footer ?? "Thank you! Return within 24hrs with receipt. Batch/expiry traceable."}
        />
        {/* batch/expiry traceability */}
        <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/20">
          <p className="font-medium">Traceability (FEFO):</p>
          {receiptData.items.map((it:any,i:number)=>{
            const p=products.find(pp=>pp.id===it.product_id);
            const b=it.batch_id ? p?.batches?.find(bb=>bb.id===it.batch_id) : null;
            return <p key={i}>{it.name ?? it.product_id.slice(0,8)} — Batch: {b?.batch_number ?? it.batch_id ?? 'FEFO auto'} {b?.expiry_date ? `· Exp: ${new Date(b.expiry_date).toLocaleDateString()}` : ''} — Qty {it.quantity??it.qty}</p>;
          })}
        </div>
        <div className="flex gap-2">
          <Button onClick={printReceipt} className="flex-1"><ReceiptIcon className="h-4 w-4 mr-2"/>Print (58/80mm)</Button>
          <Button variant="outline" onClick={()=>{setReceiptData(null); setSelectedCustomer(null);}} className="flex-1">New Sale</Button>
        </div>
      </div>
    );
  }

  const totalItems = cart.reduce((s,x)=>s+x.quantity,0);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* POS HEADER */}
      <div className="border-b bg-card">
        <div className="flex flex-wrap gap-2 items-center justify-between p-2 sm:p-3">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-base sm:text-lg">MediFlow POS</h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4"/>{branches.find(b=>b.id===branchId)?.name ?? 'Select branch'}</span>
            <span className="hidden md:inline text-xs text-muted-foreground">Cashier — Register 01</span>
            {cashSession ? <Badge variant="secondary">Session OPEN</Badge> : <Badge variant="destructive">No cash session</Badge>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${!isOnline ? 'bg-amber-100 text-amber-800' : syncing ? 'bg-yellow-100 text-yellow-800' : syncError ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-700'}`}>
              {!isOnline ? <><WifiOff className="h-3 w-3"/> OFFLINE</> : syncing ? <><RefreshCw className="h-3 w-3 animate-spin"/> SYNCING</> : syncError ? <>🔴 SYNC ERROR</> : <><Wifi className="h-3 w-3"/> ONLINE</>}
            </div>
            {pendingCount>0 && <Badge variant="warning">{pendingCount} pending sync</Badge>}
            {failedCount>0 && <Badge variant="destructive">{failedCount} failed</Badge>}
            {syncError ? <span className="text-xs text-destructive max-w-[180px] truncate" title={syncError}>{syncError}</span> : !isOnline && <span className="text-xs text-muted-foreground hidden sm:inline">Sales will sync when connection returns</span>}
            {failedCount>0 && <a href="/sync" className="text-xs underline text-destructive">View in Sync Center →</a>}
          </div>
        </div>
        <div className="flex gap-2 p-2 border-t bg-muted/20 items-center flex-wrap">
          <Select aria-label="Branch" value={branchId} onChange={e=>setBranchId(e.target.value)} className="w-[200px] sm:w-[220px]">
            <option value="">Select branch</option>
            {branches.map((b:any)=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
          </Select>
          <span className="text-xs text-muted-foreground hidden lg:inline">Server determines price/stock — browser preview only • FEFO auto • Expired blocked</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={syncNow} disabled={!isOnline || syncing}>{syncing ? <RefreshCw className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>} Sync Now</Button>
            <Button variant="outline" size="sm" onClick={()=>setShowHeld(true)}>Held ({held.length})</Button>
          </div>
        </div>
        {/* cash session banner */}
        {paymentMethod==='CASH' && !cashSession && branchId && (
          <div className="bg-amber-50 border-t border-amber-200 text-amber-800 text-sm px-4 py-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4"/> No active cash session for this branch — open a session before cash sales.</span>
            <Button size="sm" variant="outline" onClick={()=> window.location.href='/cash'}>Open Cash Session</Button>
          </div>
        )}
        {failedCount>0 && (
          <div className="bg-red-50 border-t border-red-200 text-red-800 text-sm px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>{failedCount} sale{failedCount>1?'s':''} failed to sync — {syncError}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={syncNow} disabled={!isOnline || syncing}>Retry Now</Button>
              <Button size="sm" variant="ghost" onClick={()=> window.location.href='/sync'}>Sync Center</Button>
            </div>
          </div>
        )}
        {!isOnline && <div className="bg-amber-500 text-white text-center text-sm py-1 flex items-center justify-center gap-2"><WifiOff className="h-4 w-4"/>OFFLINE — sales will queue locally with idempotency, will sync when online. Check Sync Center.</div>}
      </div>

      {/* MAIN LAYOUT: desktop two panes, mobile stacked */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left: search + products */}
        <div className="flex-1 flex flex-col border-r min-h-0">
          <div className="p-3 sm:p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input ref={searchRef} placeholder="Search name / generic / SKU / barcode — scan to add (Enter) — Ctrl+K" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-9 pr-20" aria-label="Search products"/>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hidden sm:inline border px-1.5 py-0.5 rounded bg-muted">Ctrl K</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button variant={categoryFilter==="all"?"default":"outline"} size="sm" onClick={()=>setCategoryFilter("all")}>All</Button>
              {categories.map((c:any)=><Button key={c.id} variant={categoryFilter===c.id?"default":"outline"} size="sm" onClick={()=>setCategoryFilter(c.id)}>{c.name}</Button>)}
              {categories.length===0 && <span className="text-xs text-muted-foreground py-1">No categories</span>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{[...Array(8)].map((_,i)=><Skeleton key={i} className="h-28 rounded-lg"/>)}</div>
            : filtered.length===0 ? <div className="py-12 text-center text-muted-foreground"><Search className="h-10 w-10 mx-auto mb-3 opacity-30"/><p>Product not found</p><p className="text-sm">Try name, generic, SKU or barcode</p></div>
            : <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{filtered.map(p=> <ProductCard key={p.id} product={p}/>)}</div>}
          </div>
        </div>

        {/* Right: cart */}
        <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col bg-card border-t md:border-t-0 min-h-0">
          <div className="p-3 sm:p-4 border-b flex items-center justify-between gap-2">
            <h2 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-5 w-5"/>Cart ({totalItems} items)</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={hold} disabled={!cart.length}> <Pause className="h-4 w-4 mr-1"/>Hold</Button>
              <Button variant="ghost" size="sm" onClick={()=> cart.length && setShowClear(true)} disabled={!cart.length}><Trash2 className="h-4 w-4"/></Button>
              {held.length>0 && <Badge>{held.length} held</Badge>}
            </div>
          </div>

          {/* customer */}
          <div className="px-3 sm:px-4 py-2 border-b flex items-center justify-between gap-2">
            <button onClick={()=>setShowCustomer(true)} className="flex items-center gap-2 text-sm hover:bg-accent rounded px-2 py-1 w-full text-left">
              <User className="h-4 w-4 text-muted-foreground"/>
              <span className="truncate">{selectedCustomer ? `${selectedCustomer.name} ${selectedCustomer.phone ? '· '+selectedCustomer.phone : ''}` : 'Walk-in Customer'}</span>
              <Badge variant="outline" className="ml-auto">Change</Badge>
            </button>
            {selectedCustomer && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>setSelectedCustomer(null)}><X className="h-4 w-4"/></Button>}
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-[200px]">
            {cart.length===0 ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8"><ShoppingCart className="h-12 w-12 mb-3 opacity-20"/><p>Cart empty</p><p className="text-sm">Scan barcode or tap product</p></div>
            : <div className="space-y-3">
                {cart.map(it=>{
                  const p=products.find(pp=>pp.id===it.product_id);
                  const lineDisc = it.discount_type==='percent' ? Math.round(it.quantity*it.unit_price*it.discount/100*100)/100 : it.discount;
                  const lineTotal = Math.round((it.quantity*it.unit_price - lineDisc)*100)/100;
                  return (
                    <div key={it.product_id} className="flex flex-col gap-2 p-2 rounded-lg border bg-background">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{it.name}</p>
                          {it.generic && <p className="text-xs text-muted-foreground truncate">{it.generic}</p>}
                          <p className="text-xs text-muted-foreground">{formatUGX(it.unit_price)} each {p?.fefo_batch ? `· FEFO ${p.fefo_batch.batch_number} · Exp ${new Date(p.fefo_batch.expiry_date).toLocaleDateString()}`:''}</p>
                          {p?.expiry_status==='near' && <p className="text-xs text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3"/> Expires in {p.near_expiry_days}d</p>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={()=>removeItem(it.product_id)} aria-label="Remove"><Trash2 className="h-4 w-4"/></Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={()=>updateQty(it.product_id,-1)} aria-label="Decrease"><Minus className="h-4 w-4"/></Button>
                        <Input value={it.quantity} onChange={e=>updateQtyDirect(it.product_id, e.target.value)} className="w-14 text-center h-8" aria-label="Quantity"/>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={()=>updateQty(it.product_id,1)} aria-label="Increase"><Plus className="h-4 w-4"/></Button>
                        <div className="ml-auto text-right">
                          <p className="font-medium text-sm">{formatUGX(lineTotal)}</p>
                          {lineDisc>0 && <p className="text-xs text-green-600">-{formatUGX(lineDisc)} discount</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Input placeholder="Discount" type="number" value={it.discount===0?'':String(it.discount)} onChange={e=>updateLineDiscount(it.product_id, e.target.value, it.discount_type)} className="h-8 text-xs flex-1" aria-label="Line discount"/>
                        <Select value={it.discount_type??'fixed'} onChange={e=>updateLineDiscount(it.product_id, String(it.discount), e.target.value as any)} className="w-24 h-8 text-xs">
                          <option value="fixed">UGX</option>
                          <option value="percent">%</option>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={()=>setShowBatch(it)} className="h-8 text-xs"><Eye className="h-3 w-3 mr-1"/>Batch</Button>
                      </div>
                    </div>
                  );
                })}
              </div>}
          </div>

          {/* totals */}
          <div className="border-t p-3 sm:p-4 space-y-3 bg-muted/10">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatUGX(subtotal)}</span></div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Sale discount</span>
                <Input type="number" value={saleDiscount===0?'':String(saleDiscount)} onChange={e=>setSaleDiscount(Number(e.target.value)||0)} placeholder="0" className="w-24 h-8 text-right"/>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>TOTAL</span><span>{formatUGX(totalAfterSaleDisc)}</span></div>
              {paymentMethod==='CASH' && amountReceived && <div className="flex justify-between text-sm"><span>Change</span><span className="font-medium text-green-600">{formatUGX(change)}</span></div>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={paymentMethod==='CASH'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('CASH')}><Banknote className="h-4 w-4 mr-1"/>Cash</Button>
              <Button variant={paymentMethod==='MOBILE_MONEY'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('MOBILE_MONEY')}><Smartphone className="h-4 w-4 mr-1"/>Mobile</Button>
              <Button variant={paymentMethod==='CARD'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('CARD')}><CreditCard className="h-4 w-4 mr-1"/>Card</Button>
            </div>
            {/* inline payment fields for desktop */}
            {paymentMethod==='CASH' ? (
              <Input placeholder="Amount received (UGX)" type="number" value={amountReceived} onChange={e=>setAmountReceived(e.target.value)} className="h-10" aria-label="Amount received"/>
            ) : (
              <Input placeholder="Transaction reference" value={paymentRef} onChange={e=>setPaymentRef(e.target.value)} className="h-10" aria-label="Reference"/>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" size="lg" disabled={!canPay} onClick={()=>setShowPay(true)}>{busy?"Processing...":`Pay ${formatUGX(totalAfterSaleDisc)}`}</Button>
              <Button variant="outline" size="lg" onClick={()=>setShowPay(true)} disabled={!cart.length}>View</Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Enter validates • Esc closes dialogs • FEFO auto • Server price authoritative</p>
          </div>
        </div>
      </div>

      {/* Mobile cart sheet trigger - fixed bottom */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t p-3 flex items-center gap-3">
        <div className="flex-1"><p className="text-sm font-medium">{totalItems} items</p><p className="font-bold">{formatUGX(totalAfterSaleDisc)}</p></div>
        <Sheet open={showPay} onOpenChange={setShowPay}><Button className="flex-1" size="lg" disabled={!cart.length} onClick={()=>setShowPay(true)}><ShoppingCart className="h-5 w-5 mr-2"/>Pay {formatUGX(totalAfterSaleDisc)}</Button>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader><SheetTitle>Complete Sale — {formatUGX(totalAfterSaleDisc)}</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="flex gap-2">
                <Button variant={paymentMethod==='CASH'?"default":"outline"} className="flex-1" onClick={()=>setPaymentMethod('CASH')}><Banknote className="h-4 w-4 mr-1"/>Cash</Button>
                <Button variant={paymentMethod==='MOBILE_MONEY'?"default":"outline"} className="flex-1" onClick={()=>setPaymentMethod('MOBILE_MONEY')}><Smartphone className="h-4 w-4 mr-1"/>Mobile</Button>
                <Button variant={paymentMethod==='CARD'?"default":"outline"} className="flex-1" onClick={()=>setPaymentMethod('CARD')}><CreditCard className="h-4 w-4 mr-1"/>Card</Button>
              </div>
              {paymentMethod==='CASH' ? (
                <div className="space-y-2">
                  <Input placeholder="Amount received" type="number" value={amountReceived} onChange={e=>setAmountReceived(e.target.value)} autoFocus/>
                  <p className="text-sm flex justify-between"><span>Change</span><span className="font-bold text-green-600">{formatUGX(change)}</span></p>
                  {amountReceived && Number(amountReceived) < totalAfterSaleDisc && <p className="text-sm text-destructive">Received &lt; Total</p>}
                </div>
              ) : (
                <Input placeholder="Transaction reference" value={paymentRef} onChange={e=>setPaymentRef(e.target.value)} />
              )}
              <Button className="w-full" size="lg" disabled={!canPay} onClick={checkout}>{busy?"Processing...":"Complete Sale"}</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop pay dialog — supports split payments (Cash + Mobile etc.) */}
      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Complete Sale — {formatUGX(totalAfterSaleDisc)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded border p-3 bg-muted/10 text-sm space-y-1">
              <div className="flex justify-between"><span>Items</span><span>{totalItems}</span></div>
              <div className="flex justify-between"><span>Subtotal</span><span>{formatUGX(subtotal)}</span></div>
              {saleDiscount>0 && <div className="flex justify-between text-green-600"><span>Sale discount</span><span>-{formatUGX(saleDiscount)}</span></div>}
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatUGX(totalAfterSaleDisc)}</span></div>
              {splitMode && <div className="flex justify-between text-xs"><span>Paid (split)</span><span>{formatUGX(splitPayments.reduce((s,p)=>s+Number(p.amount||0),0))} / {formatUGX(totalAfterSaleDisc)}</span></div>}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={splitMode} onChange={e=>{ setSplitMode(e.target.checked); if(e.target.checked && splitPayments.length===0){ setSplitPayments([{id:crypto.randomUUID(), method:'CASH', amount:String(totalAfterSaleDisc), reference:''},{id:crypto.randomUUID(), method:'MOBILE_MONEY', amount:'', reference:''}]); } }}/> Split payment (e.g. Cash 20k + Mobile 30k)</label>
            </div>

            {splitMode ? (
              <div className="space-y-3">
                {splitPayments.map((sp, idx)=>(
                  <div key={sp.id} className="border rounded p-2 space-y-2">
                    <div className="flex gap-2">
                      <Select value={sp.method} onChange={e=> setSplitPayments(a=> a.map(x=> x.id===sp.id ? {...x, method:e.target.value as any}:x))} className="w-[140px]"><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="CARD">Card</option><option value="BANK">Bank</option><option value="OTHER">Other</option></Select>
                      <Input placeholder="Amount" type="number" value={sp.amount} onChange={e=> setSplitPayments(a=> a.map(x=> x.id===sp.id ? {...x, amount:e.target.value}:x))} className="flex-1"/>
                      <Button variant="ghost" size="icon" onClick={()=> setSplitPayments(a=> a.filter(x=>x.id!==sp.id))} disabled={splitPayments.length<=1}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                    {sp.method!=='CASH' && <Input placeholder="Reference (required)" value={sp.reference} onChange={e=> setSplitPayments(a=> a.map(x=> x.id===sp.id ? {...x, reference:e.target.value}:x))}/>}
                    {sp.method==='CASH' && !cashSession && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> No cash session</p>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={()=> setSplitPayments(a=> [...a, {id:crypto.randomUUID(), method:'MOBILE_MONEY', amount:'', reference:''}])}><Plus className="h-4 w-4 mr-1"/>Add payment</Button>
                {splitPayments.reduce((s,p)=>s+Number(p.amount||0),0) < totalAfterSaleDisc -0.01 && <p className="text-xs text-destructive">Sum {formatUGX(splitPayments.reduce((s,p)=>s+Number(p.amount||0),0))} &lt; Total {formatUGX(totalAfterSaleDisc)}</p>}
                {splitPayments.reduce((s,p)=>s+Number(p.amount||0),0) > totalAfterSaleDisc +0.01 && <p className="text-xs text-amber-600">Overpay {formatUGX(splitPayments.reduce((s,p)=>s+Number(p.amount||0),0)-totalAfterSaleDisc)} change {formatUGX(change)}</p>}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant={paymentMethod==='CASH'?"default":"outline"} onClick={()=>setPaymentMethod('CASH')}><Banknote className="h-4 w-4 mr-1"/>Cash</Button>
                  <Button variant={paymentMethod==='MOBILE_MONEY'?"default":"outline"} onClick={()=>setPaymentMethod('MOBILE_MONEY')}><Smartphone className="h-4 w-4 mr-1"/>Mobile Money</Button>
                  <Button variant={paymentMethod==='CARD'?"default":"outline"} onClick={()=>setPaymentMethod('CARD')}><CreditCard className="h-4 w-4 mr-1"/>Card</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={paymentMethod==='BANK'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('BANK')}>Bank</Button>
                  <Button variant={paymentMethod==='OTHER'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('OTHER')}>Other / Credit</Button>
                </div>
                {paymentMethod==='CASH' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount Received</label>
                    <Input type="number" value={amountReceived} onChange={e=>setAmountReceived(e.target.value)} placeholder="UGX" autoFocus/>
                    <div className="flex justify-between text-sm"><span>Change</span><span className="font-bold text-green-600">{formatUGX(change)}</span></div>
                    {!cashSession && <p className="text-sm text-amber-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4"/> No open cash session</p>}
                    {amountReceived && Number(amountReceived) < totalAfterSaleDisc && <p className="text-sm text-destructive">Received must be ≥ Total</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Transaction Reference {paymentMethod==='OTHER' ? '(optional for credit)' : ''}</label>
                    <Input value={paymentRef} onChange={e=>setPaymentRef(e.target.value)} placeholder="e.g. MTN 123... or credit note"/>
                    <p className="text-xs text-muted-foreground">If OTHER/Credit, validates customer exists. External verification if provider configured; otherwise UNRECONCILED.</p>
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={()=>setShowPay(false)}>Cancel (Esc)</Button>
              <Button className="flex-1" disabled={!canPay} onClick={checkout}>{busy?"Completing... — Validating stock & FEFO":"Complete Sale — Enter"}</Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Enter validates • Esc closes • FEFO auto • Server price authoritative • Idempotent via operation_id</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Held sales */}
      <Dialog open={showHeld} onOpenChange={setShowHeld}>
        <DialogContent>
          <DialogHeader><DialogTitle>Held Sales — {held.length}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {held.length===0 ? <p className="text-sm text-muted-foreground py-8 text-center">No held sales</p>
            : held.map((h:any)=>(
              <div key={h.id} className="border rounded p-3 flex items-center justify-between gap-2">
                <div className="text-sm">
                  <p className="font-medium font-mono">{h.sale_number}</p>
                  <p className="text-muted-foreground">{new Date(h.sold_at).toLocaleString()} · {formatUGX(Number(h.total))}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={()=>resumeHeld(h)}><RotateCcw className="h-4 w-4 mr-1"/>Resume</Button>
                  <Button size="sm" variant="outline" onClick={()=>cancelHeld(h.id)}>Cancel</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer picker — POS fast create without losing cart */}
      <Dialog open={showCustomer} onOpenChange={setShowCustomer}>
        <DialogContent>
          <DialogHeader><DialogTitle>Select Customer — optional</DialogTitle></DialogHeader>
          <Input placeholder="Search name/phone/email" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} autoFocus/>
          <div className="space-y-2 max-h-[32vh] overflow-y-auto">
            <button onClick={()=>{setSelectedCustomer(null); setShowCustomer(false);}} className="w-full text-left border rounded p-3 hover:bg-accent flex items-center justify-between">
              <span>Walk-in Customer</span><Badge variant="secondary">Default</Badge>
            </button>
            {customers.map(c=>(
              <button key={c.id} onClick={()=>{setSelectedCustomer(c); setShowCustomer(false);}} className="w-full text-left border rounded p-3 hover:bg-accent">
                <p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone ?? ''} {c.email ? `· ${c.email}`:''}</p>
              </button>
            ))}
            {customers.length===0 && customerSearch.trim() && <p className="text-xs text-muted-foreground text-center py-2">No match — create new customer below</p>}
          </div>
          {/* Inline new customer — preserves cart */}
          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">+ New Customer (fast, returns to cart)</p>
            <NewCustomerInline onCreated={(c:any)=>{ setSelectedCustomer(c); setCustomers(prev=>[...prev, c]); setShowCustomer(false); }} preserveCartNote="Cart preserved — sale continues" />
          </div>
          <Button variant="outline" onClick={()=>setShowCustomer(false)}>Close</Button>
        </DialogContent>
      </Dialog>

      {/* Clear cart confirm */}
      <Dialog open={showClear} onOpenChange={setShowClear}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clear current sale?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove all {totalItems} items.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={()=>setShowClear(false)}>Cancel</Button>
            <Button variant="destructive" onClick={clearCart}>Clear</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch details */}
      <Dialog open={!!showBatch} onOpenChange={(o)=>!o && setShowBatch(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Batch Details — {showBatch?.name}</DialogTitle></DialogHeader>
          {showBatch && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">FEFO automatic — earliest expiry first. Cashier normally not required to choose batches.</p>
              <div className="border rounded divide-y">
                {(products.find(p=>p.id===showBatch.product_id)?.batches ?? []).map((b:any)=>(
                  <div key={b.id} className="p-2 flex justify-between text-sm">
                    <div>
                      <p className="font-mono font-medium">{b.batch_number}</p>
                      <p className="text-xs text-muted-foreground">Exp: {new Date(b.expiry_date).toLocaleDateString()} · {daysUntil(b.expiry_date)<0 ? 'EXPIRED' : `in ${daysUntil(b.expiry_date)}d`}</p>
                    </div>
                    <div className="text-right">
                      <p>Qty {b.quantity_available}</p>
                      <p className="text-xs">{formatUGX(Number(b.selling_price))}</p>
                    </div>
                  </div>
                ))}
                {(products.find(p=>p.id===showBatch.product_id)?.batches?.length ?? 0)===0 && <p className="p-4 text-sm text-muted-foreground text-center">No batch data</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
