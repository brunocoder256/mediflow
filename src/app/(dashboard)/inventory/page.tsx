"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Search, Download, RefreshCw, AlertTriangle, Clock, XCircle, ArrowUpDown, Package, TrendingUp, Layers, Scan, Truck, ClipboardList, History, WifiOff, Wifi, Eye, Plus, Trash2, Check, Flame } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cachedFetch } from "@/lib/offline/cached-fetch";
import { usePendingStock, usePendingDisposals, useMediflowSynced } from "@/lib/offline/pending-overlay";
import { rankProducts, type PosSearchable } from "@/lib/pos-search";

type BatchRow = { id:string; product_id:string; branch_id:string; batch_number:string; quantity_available:number; quantity_received:number; purchase_price:number; selling_price:number; expiry_date:string; is_active:boolean; products:{name:string; generic_name?:string; sku?:string; barcode?:string; category_id?:string; reorder_level:number}; branches:{name:string}|null; suppliers?:{name:string}|null };

const DISPOSAL_TYPES = ["EXPIRED","DAMAGED","OTHER"];
const DISPOSAL_METHODS: Record<string,string> = {
  INCINERATION:"Incineration",
  CHEMICAL_DESTRUCTION:"Chemical destruction",
  RETURN_TO_SUPPLIER:"Return to supplier",
  LANDFILL_DISPOSAL:"Landfill disposal",
  SCRAP:"Scrap / salvage",
  OTHER:"Other",
};

export default function InventoryPage() {
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [branchFilter, setBranchFilter] = React.useState("all");
  const [stockStatus, setStockStatus] = React.useState("all");
  const [expiryFilter, setExpiryFilter] = React.useState("all");
  const [expiryThreshold, setExpiryThreshold] = React.useState(30);
  const [data, setData] = React.useState<{stock:any[]; lowStock:any[]; expiring:any[]; expired:any[]; valuation:any[]; buckets:any; kpi:any}>({stock:[],lowStock:[],expiring:[],expired:[],valuation:[], buckets:{}, kpi:{}});
  const [branches, setBranches] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = React.useState<any|null>(null);
  const [showBatch, setShowBatch] = React.useState(false);
  const [showAdjustment, setShowAdjustment] = React.useState(false);
  const [adjustForm, setAdjustForm] = React.useState<{batch_id:string; quantity:string; reason:string; type:string}>({batch_id:"", quantity:"", reason:"", type:"ADJUSTMENT_IN"});
  const [showMovementDetail, setShowMovementDetail] = React.useState<any|null>(null);
  const [error, setError] = React.useState<string|null>(null);
  const [analyticsTab, setAnalyticsTab] = React.useState("slow");
  const [slowDays, setSlowDays] = React.useState(30);
  const [deadDays, setDeadDays] = React.useState(90);
  const [stockCounts, setStockCounts] = React.useState<any[]>([]);
  const [transfers, setTransfers] = React.useState<any[]>([]);
  const [disposals, setDisposals] = React.useState<any[]>([]);
  const [agingData, setAgingData] = React.useState<{label:string; qty:number; value:number}[]>([]);
  const [analyticsMovements, setAnalyticsMovements] = React.useState<any[]>([]);
  const { isOnline } = useOnlineStatus();
  const pendingStockRows = usePendingStock();
  const pendingDisposals = usePendingDisposals();
  const [showDisposal, setShowDisposal] = React.useState(false);
  const [disposalForm, setDisposalForm] = React.useState<{branch_id:string; product_id:string; batch_id:string; type:string; quantity:string; unit_cost:string; reason:string}>({branch_id:"", product_id:"", batch_id:"", type:"EXPIRED", quantity:"", unit_cost:"", reason:""});
  const [disposeTarget, setDisposeTarget] = React.useState<any|null>(null);
  const [disposeMethod, setDisposeMethod] = React.useState("INCINERATION");
  const [pendingDisposalCount, setPendingDisposalCount] = React.useState(0);
  // Merge queued (offline) batches — product opening stock + pending purchase receipts — on top of cached server stock.
  const stockMerge = React.useMemo(()=>{
    const pend = pendingStockRows.filter(r=>!(data.stock as any[]).some(s=>s.id===r.id));
    return [...pend, ...(data.stock ?? [])];
  },[pendingStockRows, data.stock]);

  // Disposals: pending (offline) rows overlay server rows; values auto-calculated.
  const disposalsMerged = React.useMemo(()=>{
    const serverIds = new Set((disposals as any[]).map((d:any)=>d.id));
    return [...pendingDisposals.filter(d=>!serverIds.has(d.id)), ...(disposals ?? [])];
  },[pendingDisposals, disposals]);
  const disposalKpis = React.useMemo(()=>{
    let disposed=0, awaiting=0, units=0;
    for(const d of disposalsMerged as any[]){
      const v = Number(d.value ?? (Number(d.quantity)*Number(d.unit_cost)));
      if(d.status==="DISPOSED") disposed += v; else awaiting += v;
      units += Number(d.quantity ?? 0);
    }
    return { disposed, awaiting, units };
  },[disposalsMerged]);
  const productOptions = React.useMemo(()=>{
    const map = new Map<string,{product_id:string; name:string}>();
    for(const b of stockMerge as any[]){
      if(!map.has(b.product_id)) map.set(b.product_id, { product_id:b.product_id, name: b.products?.name || b.product_id.slice(0,8) });
    }
    return Array.from(map.values());
  },[stockMerge]);
  const batchOptionsForProduct = React.useMemo(()=>
    disposalForm.product_id
      ? (stockMerge as any[]).filter((b:any)=>b.product_id===disposalForm.product_id && Number(b.quantity_available)>0).sort((a:any,b:any)=> new Date(a.expiry_date).getTime()-new Date(b.expiry_date).getTime())
      : [],
    [stockMerge, disposalForm.product_id]);

  // debounce
  React.useEffect(()=>{ const id=setTimeout(()=>setDebounced(searchQuery),300); return ()=>clearTimeout(id); },[searchQuery]);

  const fetchData = React.useCallback(async ()=>{
    setLoading(true); setError(null);
    try{
      const params = new URLSearchParams();
      if(branchFilter!=="all") params.set("branch_id", branchFilter);
      params.set("days", String(expiryThreshold));
      const j:any = await cachedFetch(`/api/inventory?${params.toString()}`);
      setData({stock: j.stock ?? [], lowStock: j.lowStock ?? [], expiring: j.expiring ?? [], expired: j.expired ?? [], valuation: j.inventoryValue ?? [], buckets: j.buckets ?? {}, kpi: j.kpi ?? {}});
    }catch(e:any){ setError(e.message); }
    setLoading(false);
  },[branchFilter, expiryThreshold]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

  // branches & categories for filters
  React.useEffect(()=>{
    cachedFetch("/api/settings").then((j:any)=>{ if(j.branches) setBranches(j.branches); }).catch(()=>{});
    cachedFetch("/api/categories").then((j:any)=>{ if(Array.isArray(j)) setCategories(j); }).catch(()=>{});
  },[]);
// stock counts, transfers, disposals for KPI + analytics
  const loadDisposals = React.useCallback(async ()=>{
    try { const j:any = await cachedFetch("/api/disposals"); setDisposals(Array.isArray(j)? j : (j?.data ?? [])); } catch { /* offline no cache yet */ }
  },[]);
  React.useEffect(()=>{
    cachedFetch("/api/stock-counts").then((j:any)=> setStockCounts(j.data ?? j ?? [])).catch(()=>{});
    cachedFetch("/api/transfers").then((j:any)=> setTransfers(Array.isArray(j)? j : j.data ?? [])).catch(()=>{});
    loadDisposals();
  },[loadDisposals]);
  // pending disposals count (offline queued) + auto-refresh after a sync flush
  React.useEffect(()=>{
    const load=async()=>{ try{ const { getDisposalPendingCount } = await import("@/lib/offline/sync"); setPendingDisposalCount(await getDisposalPendingCount()); }catch{} };
    void load();
    const id=window.setInterval(load,3000);
    return ()=>window.clearInterval(id);
  },[]);
  useMediflowSynced(()=>{ fetchData(); loadDisposals(); });
  // aging computed from stock batches received_at
  React.useEffect(()=>{
    if(!stockMerge.length){ setAgingData([]); return; }
    const now=Date.now();
    const buckets=[
      {label:"0–30d", min:0, max:30, qty:0, value:0},
      {label:"31–60d", min:31, max:60, qty:0, value:0},
      {label:"61–90d", min:61, max:90, qty:0, value:0},
      {label:"91–180d", min:91, max:180, qty:0, value:0},
      {label:"180+ d", min:181, max:9999, qty:0, value:0},
    ];
    for(const b of stockMerge as any[]){
      const recv=b.received_at ? new Date(b.received_at).getTime() : new Date(b.created_at||Date.now()).getTime();
      const age=Math.floor((now-recv)/(1000*3600*24));
      const bucket=buckets.find(x=> age>=x.min && age<=x.max);
      if(bucket){ bucket.qty+=Number(b.quantity_available); bucket.value+=Number(b.quantity_available)*Number(b.purchase_price); }
    }
    setAgingData(buckets);
  },[stockMerge]);
  // movements for slow/dead stock (last sale per product)
  React.useEffect(()=>{
    cachedFetch("/api/stock-movements?perPage=200").then((j:any)=> setAnalyticsMovements(j.data ?? [])).catch(()=>{});
  },[]);

  const tabs = [
    { id: "overview", label: "Stock Overview", icon: Package },
    { id: "low-stock", label: "Low Stock", icon: AlertTriangle, count: data.lowStock.length },
    { id: "expiring", label: "Expiring", icon: Clock, count: data.expiring.length },
    { id: "expired", label: "Expired", icon: XCircle, count: data.expired.length },
    { id: "movements", label: "Movements", icon: History },
  ];

  // KPIs
  const totalUnits = React.useMemo(()=> stockMerge.reduce((s:any,r:any)=> s+Number(r.quantity_available),0),[stockMerge]);
  const totalValue = React.useMemo(()=> stockMerge.reduce((s:any,r:any)=> s+Number(r.quantity_available)*Number(r.purchase_price),0),[stockMerge]);
  const outOfStock = React.useMemo(()=> {
    const ids=new Set(stockMerge.filter((r:any)=>Number(r.quantity_available)>0).map((r:any)=>r.product_id));
    // approximate: products with no batch? Use lowStock logic; for now count products with zero total
    const byProduct:Record<string,number>={};
    for(const r of stockMerge) byProduct[r.product_id]=(byProduct[r.product_id]??0)+Number(r.quantity_available);
    return Object.values(byProduct).filter(v=>v===0).length;
  },[stockMerge]);
  const expiringQty = React.useMemo(()=> data.expiring.reduce((s:any,r:any)=> s+Number(r.quantity_available),0),[data.expiring]);
  const expiredQty = React.useMemo(()=> data.expired.reduce((s:any,r:any)=> s+Number(r.quantity_available),0),[data.expired]);
  const expiringValue = React.useMemo(()=> data.expiring.reduce((s:any,r:any)=> s+Number(r.quantity_available)*Number(r.purchase_price),0),[data.expiring]);

  const getRows = ():BatchRow[]=>{
    if(activeTab==="low-stock") return data.lowStock as BatchRow[];
    if(activeTab==="expiring") return data.expiring as BatchRow[];
    if(activeTab==="expired") return data.expired as BatchRow[];
    return stockMerge as BatchRow[];
  };
  // search across product name, generic, sku, barcode, batch, supplier, category, branch
  const rows = React.useMemo(()=>{
    const base=getRows();
    let filtered=base;
    // Ranked relevance search (same engine as POS) — works fully offline against
    // the cached stock/batch rows. Exact barcode/SKU/batch and name prefixes rank
    // before plain substrings.
    const q=debounced.trim();
    if(q){
      const searchable:(PosSearchable & {__row?:any})[] = filtered.map((r:any)=>({
        name: r.products?.name ?? "",
        generic_name: r.products?.generic_name ?? null,
        brand_name: null,
        manufacturer: null,
        dosage_form: null,
        strength: null,
        sku: r.products?.sku ?? null,
        barcode: r.products?.barcode ?? null,
        category_name: null,
        batch_number: r.batch_number ?? null,
        supplier_name: r.suppliers?.name ?? null,
        location_name: r.branches?.name ?? null,
        __row: r,
      } as any));
      filtered = rankProducts(searchable, q).map((s:any)=>s.__row);
    }
    // stock status filter
    if(stockStatus!=="all"){
      filtered=filtered.filter(r=>{
        const expired=new Date(r.expiry_date) <= new Date();
        const days=(new Date(r.expiry_date).getTime()-Date.now())/(1000*3600*24);
        const low=Number(r.quantity_available) <= Number(r.products?.reorder_level ?? 10);
        if(stockStatus==="in_stock") return !expired && !low && Number(r.quantity_available)>0;
        if(stockStatus==="low") return low && !expired;
        if(stockStatus==="out") return Number(r.quantity_available)===0;
        if(stockStatus==="expiring") return !expired && days<=expiryThreshold;
        if(stockStatus==="expired") return expired;
        return true;
      });
    }
    if(expiryFilter!=="all"){
      const now=Date.now();
      filtered=filtered.filter(r=>{
        const days=(new Date(r.expiry_date).getTime()-now)/(1000*3600*24);
        if(expiryFilter==="expired") return new Date(r.expiry_date) <= new Date();
        if(expiryFilter==="7") return days>0 && days<=7;
        if(expiryFilter==="30") return days>0 && days<=30;
        if(expiryFilter==="60") return days>0 && days<=60;
        if(expiryFilter==="90") return days>0 && days<=90;
        return true;
      });
    }
    return filtered;
  },[stockMerge, data.lowStock, data.expiring, data.expired, debounced, stockStatus, expiryFilter, expiryThreshold, activeTab]);

  const getStatusBadge=(r:BatchRow)=>{
    const days=(new Date(r.expiry_date).getTime()-Date.now())/(1000*3600*24);
    if(new Date(r.expiry_date) <= new Date()) return <Badge variant="destructive">Expired</Badge>;
    if(days<=7) return <Badge variant="destructive">Expires in {Math.ceil(days)}d</Badge>;
    if(days<=30) return <Badge variant="warning">Expiring</Badge>;
    if(Number(r.quantity_available) <= Number(r.products?.reorder_level ?? 10)) return <Badge variant="warning">Low Stock</Badge>;
    if(Number(r.quantity_available)===0) return <Badge variant="destructive">Out</Badge>;
    return <Badge variant="success">In Stock</Badge>;
  };
  // Analytics: slow-moving / dead stock derived from stock_movements last SALE
  const lastSaleByProduct = React.useMemo(()=>{
    const map:Record<string,number>={};
    for(const m of analyticsMovements){
      if(m.movement_type==="SALE"){
        const t=new Date(m.created_at).getTime();
        if(!map[m.product_id] || t>map[m.product_id]) map[m.product_id]=t;
      }
    }
    return map;
  },[analyticsMovements]);
  const slowMovingRows = React.useMemo(()=>{
    const now=Date.now();
    const threshold=slowDays*24*3600*1000;
    const byProduct:Record<string,{name:string; qty:number; value:number; last:number}>={};
    for(const b of stockMerge as any[]){
      const pid=b.product_id; const last=lastSaleByProduct[pid] ?? 0;
      const age = last ? now-last : Infinity;
      if(age>threshold || last===0){
        if(!byProduct[pid]) byProduct[pid]={name:b.products?.name||pid.slice(0,8), qty:0, value:0, last};
        byProduct[pid].qty+=Number(b.quantity_available);
        byProduct[pid].value+=Number(b.quantity_available)*Number(b.purchase_price);
      }
    }
    return Object.entries(byProduct).map(([id,v])=>({product_id:id, ...v})).sort((a,b)=> b.value - a.value).slice(0,20);
  },[stockMerge, lastSaleByProduct, slowDays]);
  const deadStockRows = React.useMemo(()=>{
    const now=Date.now();
    const threshold=deadDays*24*3600*1000;
    return slowMovingRows.filter(r=> (r.last===0 || now - r.last > threshold));
  },[slowMovingRows, deadDays]);
  const quarantineRows = React.useMemo(()=> stockMerge.filter((r:any)=> !r.is_active || new Date(r.expiry_date) <= new Date()).slice(0,20),[stockMerge]);
  const valuationByBranch = React.useMemo(()=>{
    const map:Record<string,{name:string; value:number; qty:number}>={};
    for(const b of stockMerge as any[]){
      const key=b.branch_id; const name=b.branches?.name||key.slice(0,6);
      if(!map[key]) map[key]={name, value:0, qty:0};
      map[key].value+=Number(b.quantity_available)*Number(b.purchase_price);
      map[key].qty+=Number(b.quantity_available);
    }
    return Object.values(map);
  },[stockMerge]);

  const handleExport=()=>{
    const header=["Product","Generic","SKU","Batch","Branch","Qty","Purchase","Expiry","Status","Value"].join(",");
    const lines=rows.map(r=>[
      `"${(r.products?.name||"").replace(/"/g,'""')}"`,
      `"${((r as any).products?.generic_name||"").replace(/"/g,'""')}"`,
      r.products?.sku||"",
      r.batch_number,
      r.branches?.name||r.branch_id.slice(0,8),
      r.quantity_available,
      r.purchase_price,
      r.expiry_date,
      (new Date(r.expiry_date) <= new Date() ? "Expired" : "Available"),
      (Number(r.quantity_available)*Number(r.purchase_price)).toFixed(2)
    ].join(","));
    const csv=[header,...lines].join("\n");
    const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`inventory_${activeTab}_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const [pendingAdjustments, setPendingAdjustments] = React.useState(0);
  React.useEffect(()=>{
    (async()=>{
      const { db } = await import("@/lib/offline/db");
      const c=await db.syncQueue.where("status").equals("pending").count().catch(()=>0);
      setPendingAdjustments(c);
    })();
    const id=setInterval(async()=>{
      const { db } = await import("@/lib/offline/db");
      const c=await db.syncQueue.where("status").equals("pending").count().catch(()=>0);
      setPendingAdjustments(c);
    },3000);
    return ()=>clearInterval(id);
  },[]);
  const handleAdjustment=async()=>{
    if(!adjustForm.batch_id || !adjustForm.quantity || !adjustForm.reason) return alert("Batch, quantity and reason required");
    const qty=Number(adjustForm.quantity);
    if(isNaN(qty) || qty===0) return alert("Quantity must be non-zero (+5 or -5)");
    // Offline queue: same sync engine as POS (db.syncQueue)
    if(!isOnline){
      try{
        const { db } = await import("@/lib/offline/db");
        const operation_id = crypto.randomUUID();
        await db.syncQueue.add({
          id: crypto.randomUUID(),
          operation_id,
          table_name: "stock_movements",
          operation: "create",
          payload: { batch_id: adjustForm.batch_id, quantity: qty, reason: adjustForm.reason, type: qty>0?"ADJUSTMENT_IN":"ADJUSTMENT_OUT" } as any,
          status: "pending",
          created_at: new Date().toISOString(),
          retries: 0,
        });
        alert(`Offline — adjustment queued (${qty>0?"+":""}${qty}) for batch ${adjustForm.batch_id.slice(0,8)}. Will sync when online. Server remains authoritative.`);
        setShowAdjustment(false); setAdjustForm({batch_id:"", quantity:"", reason:"", type:"ADJUSTMENT_IN"});
        setPendingAdjustments(c=>c+1);
        return;
      }catch(e:any){ alert(e.message); return; }
    }
    try{
      const { createBrowserClient } = await import("@/lib/supabase/client");
      const sb=createBrowserClient();
      const { data: batch } = await (sb.from("product_batches") as any).select("*, products(name)").eq("id", adjustForm.batch_id).single();
      if(!batch) throw new Error("Batch not found");
      const newQty = Number((batch as any).quantity_available) + qty;
      if(newQty <0) throw new Error("Result would be negative stock — not allowed");
      const { error } = await (sb.from("product_batches") as any).update({ quantity_available: newQty, updated_at: new Date().toISOString() }).eq("id", (batch as any).id);
      if(error) throw new Error(error.message);
      await (sb.from("stock_movements") as any).insert({
        organization_id: (batch as any).organization_id,
        branch_id: (batch as any).branch_id,
        product_id: (batch as any).product_id,
        batch_id: (batch as any).id,
        movement_type: qty>0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantity: qty,
        reference_type: "ADJUSTMENT",
        reference_id: null,
        unit_cost: (batch as any).purchase_price,
        notes: adjustForm.reason,
        created_by: (await sb.auth.getUser()).data.user?.id ?? null,
      });
      alert(`Adjusted ${(batch as any).products?.name||(batch as any).product_id.slice(0,8)} batch ${(batch as any).batch_number}: ${qty>0?"+":""}${qty} → ${newQty}`);
      setShowAdjustment(false); setAdjustForm({batch_id:"", quantity:"", reason:"", type:"ADJUSTMENT_IN"});
      fetchData();
    }catch(e:any){ alert(e.message); }
  };

  const openDisposalDialog = () => {
    setDisposalForm({
      branch_id: branchFilter!=="all" ? branchFilter : (branches[0]?.id ?? ""),
      product_id:"", batch_id:"", type:"EXPIRED", quantity:"", unit_cost:"", reason:"Expired stock",
    });
    setShowDisposal(true);
  };

  const setLocalDisposalStatus = async (id:string, status:string)=>{
    try{ const { db } = await import("@/lib/offline/db"); await db.cachedDisposals.update(id, { status }); }catch{}
  };

  const submitDisposal = async ()=>{
    if(!disposalForm.branch_id) return alert("Select a branch");
    if(!disposalForm.product_id) return alert("Select a product");
    const qty = Number(disposalForm.quantity);
    if(isNaN(qty) || qty<=0) return alert("Quantity must be > 0");
    const product = productOptions.find((p:any)=>p.product_id===disposalForm.product_id);
    const batch = (stockMerge as any[]).find((b:any)=>b.id===disposalForm.batch_id);
    // money auto-calculated: quantity × unit cost stored, valuation/movement/server derive everything else
    const payload: Record<string, unknown> = {
      branch_id: disposalForm.branch_id,
      type: disposalForm.type,
      product_id: disposalForm.product_id,
      batch_id: disposalForm.batch_id || null,
      quantity: qty,
      unit_cost: Number(disposalForm.unit_cost) || Number(batch?.purchase_price ?? 0) || 0,
      reason: disposalForm.reason || (disposalForm.type==="EXPIRED" ? "Expired stock" : disposalForm.type==="DAMAGED" ? "Damaged stock" : "Disposal"),
      product_name: product?.name ?? null,
      batch_number: batch?.batch_number ?? null,
    };
    if(!isOnline){
      try{
        const { queueDisposalCreate } = await import("@/lib/offline/sync");
        await queueDisposalCreate(payload);
        alert(`OFFLINE — disposal queued: ${qty} u of ${product?.name ?? "product"} (${disposalForm.type}). Batch reduced automatically after sync.`);
        setShowDisposal(false);
        fetchData();
        return;
      }catch(e:any){ alert(e.message); return; }
    }
    try{
      const r = await fetch("/api/disposals", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ action:"create", ...payload }) });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error ?? "Failed to create disposal");
      alert(`Disposal created (${j.status ?? "PENDING"}) — ${qty} u of ${product?.name ?? "product"}. Approve then Dispose to reduce stock & value automatically.`);
      setShowDisposal(false);
      fetchData(); loadDisposals();
    }catch(e:any){ alert(e.message); }
  };

  const approveDisposalAction = async (row:any)=>{
    if(row.pendingSync){
      try{
        const { queueDisposalUpdate } = await import("@/lib/offline/sync");
        await queueDisposalUpdate(row.id, "approve");
        await setLocalDisposalStatus(row.id, "APPROVED");
        if(!isOnline) alert("OFFLINE — approval queued. Will sync when online.");
        return;
      }catch(e:any){ alert(e.message); return; }
    }
    try{
      const r = await fetch("/api/disposals", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ action:"approve", id: row.id }) });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error ?? "Approval failed");
      alert("Disposal approved");
      loadDisposals();
    }catch(e:any){ alert(e.message); }
  };

  const disposeDisposal = async (row:any, method:string)=>{
    // local/pending rows: queue and let the sync engine create → approve → dispose in order
    if(row.pendingSync){
      try{
        const { queueDisposalUpdate } = await import("@/lib/offline/sync");
        if(row.status!=="APPROVED") await queueDisposalUpdate(row.id, "approve");
        await queueDisposalUpdate(row.id, "dispose", { method });
        await setLocalDisposalStatus(row.id, "DISPOSED");
        if(!isOnline) alert("OFFLINE — disposal queued. Batch will be reduced automatically after sync.");
        return;
      }catch(e:any){ alert(e.message); return; }
    }
    try{
      // auto-approve first (reduces manual steps), then dispose → batch reduced + movement + audit
      if(row.status!=="APPROVED"){
        const r1 = await fetch("/api/disposals", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ action:"approve", id: row.id }) });
        const j1 = await r1.json().catch(()=>({}));
        if(!r1.ok) throw new Error(j1.error ?? "Approval failed");
      }
      const r = await fetch("/api/disposals", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ action:"dispose", id: row.id, method }) });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error ?? "Disposal failed");
      alert(`Disposed — ${row.quantity} u removed. Inventory value, expired count & reports updated automatically.`);
      loadDisposals(); fetchData();
    }catch(e:any){ alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={Layers} title="Inventory" description="Perpetual inventory — PRODUCT → BATCH → LOCATION → QUANTITY. Single source: product_batches + stock_movements">
        <Badge variant={isOnline ? "success":"warning"} className="gap-1">{isOnline ? <Wifi className="h-3 w-3"/> : <WifiOff className="h-3 w-3"/>}{isOnline ? "Online" : "Offline — cached"}</Badge>
        {pendingAdjustments>0 && <Badge variant="warning">{pendingAdjustments} pending sync</Badge>}
        <Button variant="outline" size="sm" onClick={()=>{ fetchData(); loadDisposals(); }}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2"/>Export CSV</Button>
        <Button size="sm" onClick={()=>setShowAdjustment(true)}><Plus className="h-4 w-4 mr-2"/>Adjustment</Button>
      </PageHeader>

      {error && <Card><CardContent className="p-4 text-sm text-destructive">Failed to load: {error} <Button variant="link" onClick={fetchData}>Retry</Button></CardContent></Card>}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} title="Total Value" value={`UGX ${totalValue.toLocaleString()}`} description={`${totalUnits.toLocaleString()} units • ${stockMerge.length} batches • FEFO cost preserved`}/>
        <StatCard icon={AlertTriangle} accent="text-amber-600" title="Low Stock" value={<span className="text-amber-600">{data.lowStock.length}</span>} description={<>≤ reorder level • {data.kpi?.pendingReceipts ?? 0} pending receipts{" "}<Button variant="link" size="sm" className="p-0 h-auto" onClick={()=>setActiveTab("low-stock")}>View</Button></>} />
        <StatCard icon={Clock} accent="text-amber-600" title="Expiring" value={`${data.expiring.length} (${expiringQty} units)`} description={`≤${expiryThreshold}d • Value UGX ${expiringValue.toLocaleString()}`} />
        <StatCard icon={XCircle} accent="text-destructive" title="Expired / Transfers" value={<span className="text-destructive">{data.expired.length} <span className="text-base">({expiredQty} units blocked)</span></span>} description={`Not sellable (POS excluded) • Pending transfers: ${data.kpi?.pendingTransfers ?? 0}`}/>
      </div>

      {/* Extra KPIs row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4 flex justify-between items-center"><div><p className="text-sm font-medium">Out of Stock</p><p className="text-xs text-muted-foreground">Need reorder</p></div><Badge variant="destructive">{outOfStock} products</Badge></CardContent></Card>
        <Card><CardContent className="p-4 flex justify-between items-center"><div><p className="text-sm font-medium">Movements (50) • Valuation</p><p className="text-xs text-muted-foreground">PURCHASE/SALE/TRANSFER/ADJUSTMENT</p></div><Button variant="outline" size="sm" onClick={()=>setActiveTab("movements")}>Ledger</Button></CardContent></Card>
        <Card><CardContent className="p-4 flex justify-between items-center"><div><p className="text-sm font-medium">Offline</p><p className="text-xs text-muted-foreground">{isOnline ? "Synced • Server authoritative" : "Viewing cached • Will sync"}</p></div><Badge variant={isOnline?"success":"warning"}>{isOnline?"Online":"Offline"}</Badge></CardContent></Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="overflow-x-auto flex-wrap h-auto">{tabs.map(tab=>(
          <TabsTrigger key={tab.id} value={tab.id} active={activeTab===tab.id} onClick={()=>setActiveTab(tab.id)}>
            <tab.icon className="h-4 w-4 mr-2"/>{tab.label}{typeof tab.count==='number' && <Badge variant="secondary" className="ml-2">{tab.count}</Badge>}
          </TabsTrigger>
        ))}</TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card className="mb-4"><CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search product, generic, SKU, barcode, batch, supplier, category, branch (scan)..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-9"/></div>
                <Button variant="outline" onClick={()=>{ setSearchQuery(""); setBranchFilter("all"); setStockStatus("all"); setExpiryFilter("all"); }}><XCircle className="h-4 w-4 mr-1"/>Clear</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={branchFilter} onChange={e=>setBranchFilter(e.target.value)} className="w-[160px]"><option value="all">All Branches</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</Select>
                <Select value={stockStatus} onChange={e=>setStockStatus(e.target.value)} className="w-[160px]"><option value="all">All Stock Status</option><option value="in_stock">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option><option value="expiring">Expiring</option><option value="expired">Expired</option></Select>
                <Select value={expiryFilter} onChange={e=>setExpiryFilter(e.target.value)} className="w-[160px]"><option value="all">Expiry: All</option><option value="expired">Expired</option><option value="7">≤7d</option><option value="30">≤30d</option><option value="60">≤60d</option><option value="90">≤90d</option></Select>
                <Select value={String(expiryThreshold)} onChange={e=>setExpiryThreshold(Number(e.target.value))} className="w-[140px]"><option value="7">Threshold 7d</option><option value="30">30d</option><option value="60">60d</option><option value="90">90d</option></Select>
                <Button variant="outline" size="sm" onClick={()=>window.location.href="/products"}><Package className="h-4 w-4 mr-1"/>Products</Button>
                <Button variant="outline" size="sm" onClick={()=>window.location.href="/purchases"}><Truck className="h-4 w-4 mr-1"/>Purchases</Button>
                <Button variant="outline" size="sm" onClick={()=>window.location.href="/transfers"}><ArrowUpDown className="h-4 w-4 mr-1"/>Transfers</Button>
                <Button variant="outline" size="sm" onClick={()=>window.location.href="/pos"}><Scan className="h-4 w-4 mr-1"/>POS FEFO</Button>
              </div>
              {!isOnline && <p className="text-xs text-amber-600">Offline — showing cached batches. Counts/expiry from last sync. Barcode scan works against cached.</p>}
              {pendingAdjustments>0 && <p className="text-xs text-amber-600">{pendingAdjustments} transaction{pendingAdjustments>1?"s":""} pending sync — will sync when connection returns. <a href="/sync" className="underline">Sync Center</a></p>}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-0">
            {loading ? <div className="p-6 space-y-4">{[...Array(5)].map((_,i)=><div key={i} className="flex items-center gap-4"><Skeleton className="h-12 w-12"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48"/><Skeleton className="h-3 w-32"/></div><Skeleton className="h-8 w-20"/></div>)}</div>
            : rows.length===0 ? <div className="flex flex-col items-center justify-center py-12 px-4 text-center"><Package className="h-10 w-10 text-muted-foreground mb-2"/><p className="font-medium">No inventory items</p><p className="text-sm text-muted-foreground">Try different filters or receive purchases to add stock (PURCHASE→RECEIPT→BATCH→STOCK)</p></div>
            : <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-auto">
                <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Generic / SKU</TableHead><TableHead>Batch</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Avail</TableHead><TableHead>FEFO</TableHead><TableHead>Expiry</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>
                  {rows.map((r:any)=>(
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell className="font-medium max-w-[180px] truncate">{r.products?.name ?? r.product_id.slice(0,8)}{r.pendingSync && <Badge variant="warning" className="ml-1 text-[10px]">Pending</Badge>}<div className="text-xs text-muted-foreground truncate">{r.products?.sku||""} {r.products?.barcode ? `• ${r.products.barcode}`:""}</div></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{(r as any).products?.generic_name||"—"}<div className="text-xs">{(r as any).products?.sku||""}</div></TableCell>
                      <TableCell className="font-mono text-xs">{r.batch_number}<div className="text-xs text-muted-foreground">Recv {r.quantity_received}</div></TableCell>
                      <TableCell><Badge variant="outline">{r.branches?.name ?? r.branch_id.slice(0,6)}</Badge></TableCell>
                      <TableCell className="text-right font-bold">{r.quantity_available}</TableCell>
                      <TableCell className="text-xs">{/* FEFO indicator: earliest expiry for this product */} {(() => { const sameProduct=stockMerge.filter((x:any)=>x.product_id===r.product_id && x.branch_id===r.branch_id).sort((a:any,b:any)=> new Date(a.expiry_date).getTime()-new Date(b.expiry_date).getTime())[0]; return sameProduct?.id===r.id ? <Badge variant="success">FEFO 1st</Badge> : <span className="text-muted-foreground">—</span>; })()}</TableCell>
                      <TableCell className="text-xs">{new Date(r.expiry_date).toLocaleDateString()}<div className="text-xs text-muted-foreground">{Math.ceil((new Date(r.expiry_date).getTime()-Date.now())/86400000)}d</div></TableCell>
                      <TableCell className="text-right text-xs">UGX {(Number(r.quantity_available)*Number(r.purchase_price)).toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(r)}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={()=>{ setSelectedBatch(r); setShowBatch(true); }}><Eye className="h-4 w-4"/></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden p-4 grid gap-3">
                {rows.map((r:any)=>(
                  <Card key={r.id} className="border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-sm truncate">{r.products?.name}{r.pendingSync && <Badge variant="warning" className="ml-1 text-[10px]">Pending</Badge>}</p><p className="text-xs text-muted-foreground truncate">{r.batch_number} • {r.branches?.name}</p></div>{getStatusBadge(r)}</div>
                      <div className="flex justify-between text-sm"><span>Stock: <strong>{r.quantity_available}</strong> @ UGX {Number(r.purchase_price).toLocaleString()}</span><span className="font-mono text-xs">Exp {new Date(r.expiry_date).toLocaleDateString()}</span></div>
                      <div className="flex gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={()=>{ setSelectedBatch(r); setShowBatch(true); }}>View</Button><Button size="sm" variant="outline" onClick={()=>{ setAdjustForm({batch_id:r.id, quantity:"", reason:"", type:"ADJUSTMENT_IN"}); setShowAdjustment(true); }}><Plus className="h-4 w-4"/></Button></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>}
          </CardContent></Card>
          {activeTab==="movements" && <MovementsTable onSelect={setShowMovementDetail} />}
        </TabsContent>
      </Tabs>

      {/* Pharmacy Analytics — Remaining Inventory Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5"/>Pharmacy Analytics</CardTitle>
          <CardDescription>Slow-moving • Dead stock • Aging • Valuation by location • Quarantine — configurable, no hard-coded 90d</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={analyticsTab==="slow"?"default":"outline"} size="sm" onClick={()=>setAnalyticsTab("slow")}>{`Slow Moving (>${slowDays}d)`}</Button>
            <Button variant={analyticsTab==="dead"?"default":"outline"} size="sm" onClick={()=>setAnalyticsTab("dead")}>{`Dead Stock (>${deadDays}d)`}</Button>
            <Button variant={analyticsTab==="aging"?"default":"outline"} size="sm" onClick={()=>setAnalyticsTab("aging")}>Aging</Button>
            <Button variant={analyticsTab==="valuation"?"default":"outline"} size="sm" onClick={()=>setAnalyticsTab("valuation")}>Valuation by Branch</Button>
            <Button variant={analyticsTab==="quarantine"?"default":"outline"} size="sm" onClick={()=>setAnalyticsTab("quarantine")}>Quarantine/Hold</Button>
            <Select value={String(slowDays)} onChange={e=>setSlowDays(Number(e.target.value))} className="w-[110px]"><option value="30">30d</option><option value="60">60d</option><option value="90">90d</option><option value="180">180d</option></Select>
            <Select value={String(deadDays)} onChange={e=>setDeadDays(Number(e.target.value))} className="w-[110px]"><option value="30">30d</option><option value="60">60d</option><option value="90">90d</option><option value="180">180d</option></Select>
          </div>

          {analyticsTab==="slow" && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">{`No SALE movement for >${slowDays}d • Value trapped in slow inventory • Link to purchase planning`}</p>
              {slowMovingRows.length===0 ? <p className="text-sm text-muted-foreground">{`No slow-moving stock (all moved within ${slowDays}d)`}</p> :
                <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Value</TableHead><TableHead>Last Sale</TableHead><TableHead>Expiry</TableHead></TableRow></TableHeader><TableBody>
                  {slowMovingRows.map(r=>(
                    <TableRow key={r.product_id}><TableCell className="font-medium">{r.name}</TableCell><TableCell>{r.qty}</TableCell><TableCell>UGX {r.value.toLocaleString()}</TableCell><TableCell className="text-xs">{r.last ? new Date(r.last).toLocaleDateString() : "Never"}</TableCell><TableCell className="text-xs">{(() => { const b=(stockMerge as any[]).find(x=>x.product_id===r.product_id); return b ? new Date(b.expiry_date).toLocaleDateString() : "—"; })()}</TableCell></TableRow>
                  ))}
                </TableBody></Table>
              }
            </div>
          )}
          {analyticsTab==="dead" && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">{`Dead stock: no sale for >${deadDays}d • Capital tied up • Consider disposal/transfer`}</p>
              {deadStockRows.length===0 ? <p className="text-sm text-muted-foreground">No dead stock</p> :
                <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Value</TableHead><TableHead>Last Sale</TableHead></TableRow></TableHeader><TableBody>
                  {deadStockRows.map(r=>(
                    <TableRow key={r.product_id}><TableCell>{r.name}</TableCell><TableCell>{r.qty}</TableCell><TableCell>UGX {r.value.toLocaleString()}</TableCell><TableCell className="text-xs">{r.last ? new Date(r.last).toLocaleDateString() : "Never"}</TableCell></TableRow>
                  ))}
                </TableBody></Table>
              }
            </div>
          )}
          {analyticsTab==="aging" && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Stock age (received_at) ≠ expiry age • Identifies old capital</p>
              <Table><TableHeader><TableRow><TableHead>Age</TableHead><TableHead>Qty</TableHead><TableHead>Value</TableHead></TableRow></TableHeader><TableBody>
                {agingData.map(b=>(
                  <TableRow key={b.label}><TableCell><Badge variant="outline">{b.label}</Badge></TableCell><TableCell>{b.qty}</TableCell><TableCell>UGX {b.value.toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody></Table>
            </div>
          )}
          {analyticsTab==="valuation" && (
            <div>
              <Table><TableHeader><TableRow><TableHead>Branch</TableHead><TableHead>Qty</TableHead><TableHead>Value</TableHead></TableRow></TableHeader><TableBody>
                {valuationByBranch.map(b=>(
                  <TableRow key={b.name}><TableCell>{b.name}</TableCell><TableCell>{b.qty}</TableCell><TableCell>UGX {b.value.toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody></Table>
              <p className="text-xs text-muted-foreground mt-2">Batch cost preserved per purchase — historical COGS unaffected.</p>
            </div>
          )}
          {analyticsTab==="quarantine" && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">AVAILABLE / HOLD / QUARANTINED / EXPIRED / DAMAGED • Quarantined not available for POS (FEFO excluded)</p>
              {quarantineRows.length===0 ? <p className="text-sm text-muted-foreground">No quarantined/expired batches</p> :
                <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead>Qty</TableHead></TableRow></TableHeader><TableBody>
                  {quarantineRows.map((r:any)=>(
                    <TableRow key={r.id}><TableCell>{r.products?.name}</TableCell><TableCell className="font-mono">{r.batch_number}</TableCell><TableCell>{new Date(r.expiry_date).toLocaleDateString()}</TableCell><TableCell>{!r.is_active ? <Badge variant="warning">Quarantined</Badge> : <Badge variant="destructive">Expired</Badge>}</TableCell><TableCell>{r.quantity_available}</TableCell></TableRow>
                  ))}
                </TableBody></Table>
              }
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stocktaking / Transfers / Disposals — real-world workflows */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4"/>Stock Counts</CardTitle><CardDescription>Cycle counting • System vs Physical → Variance → Approve → Adjustment</CardDescription></CardHeader>
          <CardContent>
            {stockCounts.length===0 ? <p className="text-sm text-muted-foreground">No counts • Start via Stock Counts page</p> :
              <div className="space-y-2">{stockCounts.slice(0,5).map((c:any)=><div key={c.id} className="flex justify-between text-sm border rounded p-2"><span>{c.status} • {c.scope_type}</span><Badge variant="outline">{new Date(c.created_at).toLocaleDateString()}</Badge></div>)}</div>
            }
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={()=>window.location.href="/stock-counts"}>Open Counts</Button>
              <Button size="sm" variant="outline" onClick={()=>window.location.href="/stock-counts?new=1"}><Scan className="h-4 w-4 mr-1"/>Scan Count</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Supports selected products/categories/high-value/random/expiry-risk/location. Variance requires approval before posting.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowUpDown className="h-4 w-4"/>Transfers</CardTitle><CardDescription>Source → Request → Approve → In Transit → Received (batch identity preserved)</CardDescription></CardHeader>
          <CardContent>
            {transfers.length===0 ? <p className="text-sm text-muted-foreground">No pending transfers</p> :
              <div className="space-y-2">{transfers.slice(0,5).map((t:any)=><div key={t.id} className="flex justify-between text-sm border rounded p-2"><span className="font-mono">{t.transfer_number}</span><Badge>{t.status}</Badge></div>)}</div>
            }
            <Button size="sm" variant="outline" className="mt-3" onClick={()=>window.location.href="/transfers"}>Manage Transfers</Button>
            <p className="text-xs text-muted-foreground mt-2">Source decr on dispatch, dest incr on receive. Batch number preserved for traceability.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Trash2 className="h-4 w-4"/>Disposals / Damage</CardTitle><CardDescription>Expired/Damaged/Lost → PENDING → APPROVE → DISPOSE. Batch reduced + EXPIRED/DAMAGED movement + audit created automatically</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Disposed value</p><p className="font-bold">UGX {disposalKpis.disposed.toLocaleString()}</p></div>
              <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Awaiting disposal</p><p className="font-bold text-amber-600">UGX {disposalKpis.awaiting.toLocaleString()}</p></div>
            </div>
            {pendingDisposalCount>0 && <Badge variant="warning">{pendingDisposalCount} pending sync</Badge>}
            {!isOnline && <p className="text-xs text-amber-600">Disposals below show last-synced + locally queued. Actions queue offline and dispose automatically on sync.</p>}
            {disposalsMerged.length===0 ? <p className="text-sm text-muted-foreground">No disposals • Expired stock → New Disposal below</p> :
              <div className="space-y-2 max-h-56 overflow-auto">
                {disposalsMerged.slice(0,20).map((d:any)=>(
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border rounded p-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant={d.type==="EXPIRED"?"destructive":d.type==="DAMAGED"?"warning":"secondary"}>{d.type}</Badge>
                        {d.pendingSync && <Badge variant="warning" className="text-[10px]">Pending</Badge>}
                        <span className="truncate font-medium">{d.products?.name ?? d.product_name ?? d.product_id.slice(0,8)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{d.batch_number ?? d.product_batches?.batch_number ?? "—"} • {d.quantity} u @ UGX {Number(d.unit_cost).toLocaleString()} = <span className="font-semibold text-foreground">UGX {Number(d.value ?? Number(d.quantity)*Number(d.unit_cost)).toLocaleString()}</span>{d.method ? ` • ${DISPOSAL_METHODS[d.method] ?? d.method}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {d.status==="DISPOSED" ? <Badge variant="secondary">Disposed {d.disposed_at ? new Date(d.disposed_at).toLocaleDateString() : (d.disposal_method ? "✓" : "")}</Badge>
                        : d.status==="APPROVED" ? <Badge variant="outline">Approved</Badge>
                        : d.status==="CANCELLED" ? <Badge variant="destructive">Cancelled</Badge>
                        : <Badge variant="warning">{d.status==="PENDING" ? "Pending" : d.status}</Badge>}
                      {d.status!=="DISPOSED" && d.status!=="CANCELLED" && <>
                        {(d.status==="PENDING" || d.status==="PENDING_SYNC") && <Button size="sm" variant="outline" onClick={()=>approveDisposalAction(d)}><Check className="h-3 w-3 mr-1"/>Approve</Button>}
                        <Button size="sm" onClick={()=>{ setDisposeTarget(d); setDisposeMethod(d.method ?? "INCINERATION"); }}><Trash2 className="h-3 w-3 mr-1"/>Dispose</Button>
                      </>}
                    </div>
                  </div>
                ))}
              </div>
            }
            <Button size="sm" className="mt-1" onClick={openDisposalDialog}><Plus className="h-4 w-4 mr-2"/>New Disposal</Button>
            <p className="text-xs text-muted-foreground mt-1">Removal is automatic: batch qty ↓, EXPIRED/DAMAGED movement (unit cost) recorded, inventory value / expired count / reports update with no manual entry.</p>
          </CardContent>
        </Card>
      </div>

      {/* New Disposal */}
      <Dialog open={showDisposal} onOpenChange={setShowDisposal}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Disposal</DialogTitle><DialogDescription>Expired / Damaged / Lost stock → PENDING → Approve → Dispose. Counts and money are auto-calculated from quantity × unit cost.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Branch</Label><Select value={disposalForm.branch_id} onChange={e=>setDisposalForm({...disposalForm, branch_id:e.target.value})}><option value="">Select branch</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
            <div><Label>Product</Label><Select value={disposalForm.product_id} onChange={e=>{ const pid=e.target.value; const first=(stockMerge as any[]).find((b:any)=>b.product_id===pid && Number(b.quantity_available)>0); setDisposalForm({...disposalForm, product_id:pid, batch_id: first?.id ?? "", unit_cost: first ? String(first.purchase_price) : "", quantity:""}); }}><option value="">Select product</option>{productOptions.map((p:any)=><option key={p.product_id} value={p.product_id}>{p.name}</option>)}</Select></div>
            <div><Label>Batch (FEFO — earliest first)</Label><Select value={disposalForm.batch_id} onChange={e=>{ const bid=e.target.value; const b=(stockMerge as any[]).find((x:any)=>x.id===bid); setDisposalForm({...disposalForm, batch_id:bid, unit_cost: b ? String(b.purchase_price) : disposalForm.unit_cost}); }} disabled={!disposalForm.product_id}><option value="">Select batch</option>{batchOptionsForProduct.map((b:any)=><option key={b.id} value={b.id}>{b.batch_number} — {b.quantity_available}u · exp {new Date(b.expiry_date).toLocaleDateString()}{new Date(b.expiry_date) <= new Date() ? " (EXPIRED)" : ""}</option>)}</Select></div>
            <div><Label>Type</Label><Select value={disposalForm.type} onChange={e=>setDisposalForm({...disposalForm, type:e.target.value, reason: e.target.value==="EXPIRED" ? "Expired stock" : e.target.value==="DAMAGED" ? "Damaged stock" : ""})}>{DISPOSAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</Select></div>
            <div className="flex gap-2 items-end">
              <div className="flex-1"><Label>Quantity (u)</Label><Input type="number" value={disposalForm.quantity} onChange={e=>setDisposalForm({...disposalForm, quantity:e.target.value})} placeholder="0"/></div>
              {(()=>{ const b=(stockMerge as any[]).find((x:any)=>x.id===disposalForm.batch_id); return b ? <Button variant="outline" size="sm" onClick={()=>setDisposalForm({...disposalForm, quantity:String(b.quantity_available)})}>Max {b.quantity_available}</Button> : null; })()}
            </div>
            <div className="flex gap-2">
              <div className="flex-1"><Label>Unit cost (UGX)</Label><Input type="number" value={disposalForm.unit_cost} onChange={e=>setDisposalForm({...disposalForm, unit_cost:e.target.value})} placeholder="0"/></div>
            </div>
            <div><Label>Reason</Label><Input value={disposalForm.reason} onChange={e=>setDisposalForm({...disposalForm, reason:e.target.value})} placeholder="e.g. expired medicine, damaged packaging "/></div>
            {(()=>{ const q=Number(disposalForm.quantity); const c=Number(disposalForm.unit_cost); if(q>0) return <div className="text-sm border rounded p-2 bg-muted/40">Removal value (auto-calculated): <strong>UGX {(q*c).toLocaleString()}</strong>{disposalForm.batch_id ? " — batch stock drops by "+q+" u" : ""}</div>; return null; })()}
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={()=>setShowDisposal(false)}>Cancel</Button><Button onClick={submitDisposal} disabled={!disposalForm.branch_id || !disposalForm.product_id || !disposalForm.quantity}>Create {isOnline?"":"& Queue Offline"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispose confirm → auto-approve if needed, then reduce stock */}
      <Dialog open={!!disposeTarget} onOpenChange={(o)=>!o && setDisposeTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle><Flame className="h-4 w-4 inline mr-1"/>Dispose Stock</DialogTitle><DialogDescription>Removes {disposeTarget?.quantity ?? 0} u of {disposeTarget?.products?.name ?? disposeTarget?.product_name ?? "product"} — batch quantity reduced, EXPIRED/DAMAGED movement + audit auto-created, value & counts update automatically.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {disposeTarget && disposeTarget.status!=="APPROVED" && disposeTarget.status!=="DISPOSED" && <p className="text-xs text-amber-600">Not yet approved — will be approved automatically, then disposed.</p>}
            <div><Label>Method</Label><Select value={disposeMethod} onChange={e=>setDisposeMethod(e.target.value)}>{Object.entries(DISPOSAL_METHODS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={()=>setDisposeTarget(null)}>Cancel</Button><Button variant="destructive" onClick={()=>{ const d=disposeTarget; setDisposeTarget(null); if(d) disposeDisposal(d, disposeMethod); }}>Confirm Disposal</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier traceability */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4"/>Traceability</CardTitle><CardDescription>Supplier → Purchase → Batch → Branch → Sale. Where did B001 come from / go?</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={()=>window.location.href="/suppliers"}>Suppliers</Button>
          <Button variant="outline" size="sm" onClick={()=>window.location.href="/purchases"}>Purchase Orders</Button>
          <Button variant="outline" size="sm" onClick={()=>window.location.href="/reports"}>Reports</Button>
          <Button variant="outline" size="sm" onClick={()=>setActiveTab("movements")}>Movement Ledger</Button>
        </CardContent>
      </Card>

      {/* Batch Detail */}
      <Dialog open={showBatch} onOpenChange={setShowBatch}>
        <DialogContent className="max-w-2xl bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Batch {selectedBatch?.batch_number} — Traceability</DialogTitle><DialogDescription>PRODUCT → SUPPLIER → PURCHASE → BATCH → STOCK → POS/COGS. FEFO: earliest expiry first.</DialogDescription></DialogHeader>
          {selectedBatch && (
            <div className="space-y-4 text-sm">
              <div className="grid md:grid-cols-2 gap-3 border rounded p-3">
                <div><span className="text-muted-foreground">Product:</span> <strong>{selectedBatch.products?.name}</strong> ({selectedBatch.products?.sku})</div>
                <div><span className="text-muted-foreground">Branch:</span> <Badge variant="outline">{selectedBatch.branches?.name}</Badge></div>
                <div><span className="text-muted-foreground">Batch:</span> <span className="font-mono">{selectedBatch.batch_number}</span></div>
                <div><span className="text-muted-foreground">Expiry:</span> {new Date(selectedBatch.expiry_date).toLocaleDateString()} ({Math.ceil((new Date(selectedBatch.expiry_date).getTime()-Date.now())/86400000)}d) {new Date(selectedBatch.expiry_date) <= new Date() && <Badge variant="destructive">Expired — not sellable</Badge>}</div>
                <div><span className="text-muted-foreground">Qty Avail/Recv:</span> {selectedBatch.quantity_available} / {selectedBatch.quantity_received} {Number(selectedBatch.quantity_available) < Number(selectedBatch.quantity_received) && <span className="text-muted-foreground">• Sold/adjusted {Number(selectedBatch.quantity_received)-Number(selectedBatch.quantity_available)}</span>}</div>
                <div><span className="text-muted-foreground">Cost/Sell:</span> UGX {Number(selectedBatch.purchase_price).toLocaleString()} / UGX {Number(selectedBatch.selling_price).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Supplier:</span> {(selectedBatch as any).suppliers?.name || "—"} • Recv {selectedBatch.received_at ? new Date(selectedBatch.received_at).toLocaleDateString() : "—"}</div>
                <div><span className="text-muted-foreground">Value:</span> UGX {(Number(selectedBatch.quantity_available)*Number(selectedBatch.purchase_price)).toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={()=>window.location.href=`/products`}>Product Master</Button>
                <Button size="sm" variant="outline" onClick={()=>{ setAdjustForm({batch_id:selectedBatch.id, quantity:"", reason:"", type:"ADJUSTMENT_IN"}); setShowAdjustment(true); }}>Adjust (+/-)</Button>
                <Button size="sm" variant="outline" onClick={async()=>{
                  const { createBrowserClient } = await import("@/lib/supabase/client");
                  const sb=createBrowserClient();
                  const {data:mov}=await sb.from("stock_movements").select("*").eq("batch_id", selectedBatch.id).order("created_at",{ascending:false}).limit(20);
                  alert(`Last 20 movements:\n`+(mov??[]).map((m:any)=>`${new Date(m.created_at).toLocaleDateString()} ${m.movement_type} ${m.quantity} ${m.notes||""}`).join("\n") || "No movements");
                }}>Trace Movements</Button>
              </div>
              <p className="text-xs text-muted-foreground">Where did this batch go? Query stock_movements by batch_id for recall/discrepancy. FEFO allocates lowest expiry first; expired never allocated.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjustment */}
      <Dialog open={showAdjustment} onOpenChange={setShowAdjustment}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Controlled Adjustment</DialogTitle><DialogDescription>Current → +/- Quantity → New. Creates ADJUSTMENT_IN/OUT movement + audit. Require reason.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Batch</Label><Select value={adjustForm.batch_id} onChange={e=>setAdjustForm({...adjustForm, batch_id:e.target.value})}><option value="">Select batch</option>{stockMerge.slice(0,100).map((b:any)=><option key={b.id} value={b.id}>{b.products?.name} — {b.batch_number} ({b.quantity_available} avail){b.pendingSync?" • Pending":""}</option>)}</Select></div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Quantity (+5 / -3)</Label><Input type="number" value={adjustForm.quantity} onChange={e=>setAdjustForm({...adjustForm, quantity:e.target.value})} placeholder="+5 or -5"/></div>
              <div><Label>Reason</Label><Select value={adjustForm.reason} onChange={e=>setAdjustForm({...adjustForm, reason:e.target.value})}><option value="">Select reason</option><option value="Physical count correction">Physical count correction</option><option value="Damaged">Damaged</option><option value="Expired">Expired</option><option value="Lost">Lost</option><option value="Found">Found</option><option value="Opening balance correction">Opening balance correction</option><option value="Data correction">Data correction</option></Select></div>
            </div>
            {adjustForm.batch_id && adjustForm.quantity && (
              <Card><CardContent className="p-3 text-sm">
                {(() => {
                  const b=stockMerge.find((x:any)=>x.id===adjustForm.batch_id);
                  if(!b) return "Select batch";
                  const cur=Number(b.quantity_available); const n=cur+Number(adjustForm.quantity||0);
                  return <><div>Current: <strong>{cur}</strong> → Result: <strong className={n<0?"text-destructive":""}>{n}</strong> {n<0 && <Badge variant="destructive">Would be negative — blocked</Badge>}</div><div className="text-xs text-muted-foreground">Product {b.products?.name} • Batch {b.batch_number} • Branch {b.branches?.name}</div></>;
                })()}
              </CardContent></Card>
            )}
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={()=>setShowAdjustment(false)}>Cancel</Button><Button onClick={handleAdjustment} disabled={!adjustForm.batch_id || !adjustForm.quantity || !adjustForm.reason}>Confirm Adjustment</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movement Detail */}
      <Dialog open={!!showMovementDetail} onOpenChange={(o)=>!o && setShowMovementDetail(null)}>
        <DialogContent className="bg-card max-w-lg">
          <DialogHeader><DialogTitle>Movement Detail — Audit Trail</DialogTitle></DialogHeader>
          {showMovementDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 border rounded p-3">
                <div><span className="text-muted-foreground">Product:</span> {(showMovementDetail as any).products?.name || showMovementDetail.product_id.slice(0,8)}</div>
                <div><span className="text-muted-foreground">Batch:</span> {(showMovementDetail as any).product_batches?.batch_number || showMovementDetail.batch_id?.slice(0,8) || "—"}</div>
                <div><span className="text-muted-foreground">Qty:</span> <strong className={Number(showMovementDetail.quantity)>0?"text-success":"text-destructive"}>{Number(showMovementDetail.quantity)>0?"+":""}{showMovementDetail.quantity}</strong></div>
                <div><span className="text-muted-foreground">Type:</span> <Badge>{showMovementDetail.movement_type}</Badge></div>
                <div><span className="text-muted-foreground">Branch:</span> {showMovementDetail.branch_id?.slice(0,8)}</div>
                <div><span className="text-muted-foreground">Date:</span> {new Date(showMovementDetail.created_at).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Ref:</span> {showMovementDetail.reference_type || "—"} {showMovementDetail.reference_id?.slice(0,8)||""}</div>
                <div><span className="text-muted-foreground">Cost:</span> UGX {Number(showMovementDetail.unit_cost||0).toLocaleString()}</div>
              </div>
              <p className="text-xs text-muted-foreground">Every stock change has reason + user + timestamp. Use stock_movements ledger to reconstruct `WHY 147 units?`</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MovementsTable({onSelect}:{onSelect:(m:any)=>void}){
  const [rows,setRows]=React.useState<any[]>([]);
  const [loadingM,setLoadingM]=React.useState(true);
  const [branch,setBranch]=React.useState("all");
  const [type,setType]=React.useState("all");
  React.useEffect(()=>{ cachedFetch("/api/stock-movements").then((j:any)=>{ setRows(j.data ?? []); setLoadingM(false); }).catch(()=>setLoadingM(false)); },[]);
  const filtered=rows.filter(m=>{
    if(branch!=="all" && m.branch_id!==branch) return false;
    if(type!=="all" && m.movement_type!==type) return false;
    return true;
  });
  if(loadingM) return <Card className="mt-4"><CardContent className="p-4"><Skeleton className="h-24 w-full"/></CardContent></Card>;
  if(rows.length===0) return <Card className="mt-4"><CardContent className="p-4 text-sm text-muted-foreground">No movements yet. Perpetual: OPENING + PURCHASE + TRANSFER_IN + RETURNS + ADJUSTMENT_IN − SALES − TRANSFER_OUT − RETURNS − DISPOSED = CURRENT</CardContent></Card>;
  return <Card className="mt-4"><CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4"/>Movement Ledger</CardTitle><CardDescription>50 latest • Click row for before/after audit. Types: PURCHASE, SALE, TRANSFER, ADJUSTMENT, EXPIRED, DAMAGED</CardDescription></CardHeader>
    <CardContent className="p-0">
      <div className="flex flex-wrap gap-2 p-3 border-b">
        <Select value={type} onChange={e=>setType(e.target.value)} className="w-[180px]"><option value="all">All Types</option><option value="PURCHASE">PURCHASE</option><option value="SALE">SALE</option><option value="TRANSFER_IN">TRANSFER_IN</option><option value="TRANSFER_OUT">TRANSFER_OUT</option><option value="ADJUSTMENT_IN">ADJUSTMENT_IN</option><option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT</option><option value="EXPIRED">EXPIRED</option><option value="DAMAGED">DAMAGED</option></Select>
      </div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Ref</TableHead><TableHead>User</TableHead></TableRow></TableHeader><TableBody>{filtered.slice(0,50).map((m:any)=><TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={()=>onSelect(m)}><TableCell className="text-xs">{new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</TableCell><TableCell className="text-sm">{m.products?.name ?? m.product_id.slice(0,6)}</TableCell><TableCell className="font-mono text-xs">{m.product_batches?.batch_number ?? m.batch_id?.slice(0,6) ?? "—"}</TableCell><TableCell><Badge variant="secondary" className="text-xs">{m.movement_type}</Badge></TableCell><TableCell className={`text-right font-medium ${Number(m.quantity)>0?"text-green-600":"text-destructive"}`}>{Number(m.quantity)>0?"+":""}{m.quantity}</TableCell><TableCell className="font-mono text-xs">{m.reference_type ?? ""} {m.reference_id?.slice(0,6) ?? ""}</TableCell><TableCell className="text-xs">{m.created_by?.slice(0,6) ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>
    </CardContent></Card>;
}
