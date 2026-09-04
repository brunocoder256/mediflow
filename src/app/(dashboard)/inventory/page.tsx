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
import { Search, Download, RefreshCw, AlertTriangle, Clock, XCircle, ArrowUpDown, Package, TrendingUp, Layers, Scan, Truck, ClipboardList, History, WifiOff, Wifi, Eye, Plus, Minus, Trash2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

type BatchRow = { id:string; product_id:string; branch_id:string; batch_number:string; quantity_available:number; quantity_received:number; purchase_price:number; selling_price:number; expiry_date:string; is_active:boolean; products:{name:string; generic_name?:string; sku?:string; barcode?:string; category_id?:string; reorder_level:number}; branches:{name:string}|null; suppliers?:{name:string}|null };

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

  // debounce
  React.useEffect(()=>{ const id=setTimeout(()=>setDebounced(searchQuery),300); return ()=>clearTimeout(id); },[searchQuery]);

  const fetchData = React.useCallback(async ()=>{
    setLoading(true); setError(null);
    try{
      const params = new URLSearchParams();
      if(branchFilter!=="all") params.set("branch_id", branchFilter);
      params.set("days", String(expiryThreshold));
      const r=await fetch(`/api/inventory?${params.toString()}`);
      if(!r.ok) throw new Error(await r.text());
      const j=await r.json();
      setData({stock: j.stock ?? [], lowStock: j.lowStock ?? [], expiring: j.expiring ?? [], expired: j.expired ?? [], valuation: j.inventoryValue ?? [], buckets: j.buckets ?? {}, kpi: j.kpi ?? {}});
    }catch(e:any){ setError(e.message); }
    setLoading(false);
  },[branchFilter, expiryThreshold]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

  // branches & categories for filters
  React.useEffect(()=>{
    fetch("/api/settings").then(r=>r.json()).then(j=>{ if(j.branches) setBranches(j.branches); }).catch(()=>{});
    fetch("/api/categories").then(r=>r.json()).then(j=>{ if(Array.isArray(j)) setCategories(j); }).catch(()=>{});
  },[]);
  // stock counts, transfers, disposals for KPI + analytics
  React.useEffect(()=>{
    fetch("/api/stock-counts").then(r=>r.json()).then(j=> setStockCounts(j.data ?? j ?? [])).catch(()=>{});
    fetch("/api/transfers").then(r=>r.json()).then(j=> setTransfers(Array.isArray(j)? j : j.data ?? [])).catch(()=>{});
    (async()=>{
      try{ const {createBrowserClient}=await import("@/lib/supabase/client"); const sb=createBrowserClient();
        const {data}=await (sb.from("disposals") as any).select("*, products(name), product_batches(batch_number)").order("created_at",{ascending:false}).limit(20);
        if(data) setDisposals(data);
      }catch{}
    })();
  },[]);
  // aging computed from stock batches received_at
  React.useEffect(()=>{
    if(!data.stock.length){ setAgingData([]); return; }
    const now=Date.now();
    const buckets=[
      {label:"0–30d", min:0, max:30, qty:0, value:0},
      {label:"31–60d", min:31, max:60, qty:0, value:0},
      {label:"61–90d", min:61, max:90, qty:0, value:0},
      {label:"91–180d", min:91, max:180, qty:0, value:0},
      {label:"180+ d", min:181, max:9999, qty:0, value:0},
    ];
    for(const b of data.stock as any[]){
      const recv=b.received_at ? new Date(b.received_at).getTime() : new Date(b.created_at||Date.now()).getTime();
      const age=Math.floor((now-recv)/(1000*3600*24));
      const bucket=buckets.find(x=> age>=x.min && age<=x.max);
      if(bucket){ bucket.qty+=Number(b.quantity_available); bucket.value+=Number(b.quantity_available)*Number(b.purchase_price); }
    }
    setAgingData(buckets);
  },[data.stock]);
  // movements for slow/dead stock (last sale per product)
  React.useEffect(()=>{
    fetch("/api/stock-movements?perPage=200").then(r=>r.json()).then(j=> setAnalyticsMovements(j.data ?? [])).catch(()=>{});
  },[]);

  const tabs = [
    { id: "overview", label: "Stock Overview", icon: Package },
    { id: "low-stock", label: "Low Stock", icon: AlertTriangle, count: data.lowStock.length },
    { id: "expiring", label: "Expiring", icon: Clock, count: data.expiring.length },
    { id: "expired", label: "Expired", icon: XCircle, count: data.expired.length },
    { id: "movements", label: "Movements", icon: History },
  ];

  // KPIs
  const totalUnits = React.useMemo(()=> data.stock.reduce((s:any,r:any)=> s+Number(r.quantity_available),0),[data.stock]);
  const totalValue = React.useMemo(()=> data.stock.reduce((s:any,r:any)=> s+Number(r.quantity_available)*Number(r.purchase_price),0),[data.stock]);
  const outOfStock = React.useMemo(()=> {
    const ids=new Set(data.stock.filter((r:any)=>Number(r.quantity_available)>0).map((r:any)=>r.product_id));
    // approximate: products with no batch? Use lowStock logic; for now count products with zero total
    const byProduct:Record<string,number>={};
    for(const r of data.stock) byProduct[r.product_id]=(byProduct[r.product_id]??0)+Number(r.quantity_available);
    return Object.values(byProduct).filter(v=>v===0).length;
  },[data.stock]);
  const expiringQty = React.useMemo(()=> data.expiring.reduce((s:any,r:any)=> s+Number(r.quantity_available),0),[data.expiring]);
  const expiredQty = React.useMemo(()=> data.expired.reduce((s:any,r:any)=> s+Number(r.quantity_available),0),[data.expired]);
  const expiringValue = React.useMemo(()=> data.expiring.reduce((s:any,r:any)=> s+Number(r.quantity_available)*Number(r.purchase_price),0),[data.expiring]);

  const getRows = ():BatchRow[]=>{
    if(activeTab==="low-stock") return data.lowStock as BatchRow[];
    if(activeTab==="expiring") return data.expiring as BatchRow[];
    if(activeTab==="expired") return data.expired as BatchRow[];
    return data.stock as BatchRow[];
  };
  // search across product name, generic, sku, barcode, batch, supplier, category, branch
  const rows = React.useMemo(()=>{
    const base=getRows();
    let filtered=base.filter(r=>{
      const q=debounced.toLowerCase();
      if(!q) return true;
      const hay=[r.products?.name, (r as any).products?.generic_name, (r as any).products?.sku, (r as any).products?.barcode, r.batch_number, (r as any).suppliers?.name, r.branches?.name].join(" ").toLowerCase();
      return hay.includes(q);
    });
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
  },[data.stock, data.lowStock, data.expiring, data.expired, debounced, stockStatus, expiryFilter, expiryThreshold, activeTab]);

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
    for(const b of data.stock as any[]){
      const pid=b.product_id; const last=lastSaleByProduct[pid] ?? 0;
      const age = last ? now-last : Infinity;
      if(age>threshold || last===0){
        if(!byProduct[pid]) byProduct[pid]={name:b.products?.name||pid.slice(0,8), qty:0, value:0, last};
        byProduct[pid].qty+=Number(b.quantity_available);
        byProduct[pid].value+=Number(b.quantity_available)*Number(b.purchase_price);
      }
    }
    return Object.entries(byProduct).map(([id,v])=>({product_id:id, ...v})).sort((a,b)=> b.value - a.value).slice(0,20);
  },[data.stock, lastSaleByProduct, slowDays]);
  const deadStockRows = React.useMemo(()=>{
    const now=Date.now();
    const threshold=deadDays*24*3600*1000;
    return slowMovingRows.filter(r=> (r.last===0 || now - r.last > threshold));
  },[slowMovingRows, deadDays]);
  const quarantineRows = React.useMemo(()=> data.stock.filter((r:any)=> !r.is_active || new Date(r.expiry_date) <= new Date()).slice(0,20),[data.stock]);
  const valuationByBranch = React.useMemo(()=>{
    const map:Record<string,{name:string; value:number; qty:number}>={};
    for(const b of data.stock as any[]){
      const key=b.branch_id; const name=b.branches?.name||key.slice(0,6);
      if(!map[key]) map[key]={name, value:0, qty:0};
      map[key].value+=Number(b.quantity_available)*Number(b.purchase_price);
      map[key].qty+=Number(b.quantity_available);
    }
    return Object.values(map);
  },[data.stock]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="h-6 w-6"/>Inventory</h1><p className="text-muted-foreground">Perpetual inventory — PRODUCT → BATCH → LOCATION → QUANTITY. Single source: product_batches + stock_movements</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isOnline ? "success":"warning"} className="gap-1">{isOnline ? <Wifi className="h-3 w-3"/> : <WifiOff className="h-3 w-3"/>}{isOnline ? "Online" : "Offline — cached"}</Badge>
          {pendingAdjustments>0 && <Badge variant="warning">{pendingAdjustments} pending sync</Badge>}
          <Button variant="outline" size="sm" onClick={()=>fetchData()}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2"/>Export CSV</Button>
          <Button size="sm" onClick={()=>setShowAdjustment(true)}><Plus className="h-4 w-4 mr-2"/>Adjustment</Button>
        </div>
      </div>

      {error && <Card><CardContent className="p-4 text-sm text-destructive">Failed to load: {error} <Button variant="link" onClick={fetchData}>Retry</Button></CardContent></Card>}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4"/>Total Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">UGX {totalValue.toLocaleString()}</div><p className="text-xs text-muted-foreground">{totalUnits.toLocaleString()} units • {data.stock.length} batches • FEFO cost preserved</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>Low Stock</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{data.lowStock.length}</div><p className="text-xs text-muted-foreground">≤ reorder level • {data.kpi?.pendingReceipts ?? 0} pending receipts</p><Button variant="link" size="sm" className="p-0 h-auto" onClick={()=>setActiveTab("low-stock")}>View</Button></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4"/>Expiring</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{data.expiring.length} <span className="text-sm font-normal">({expiringQty} units)</span></div><p className="text-xs text-muted-foreground">≤{expiryThreshold}d • Value UGX {expiringValue.toLocaleString()}</p>
          <div className="flex gap-1 mt-1 text-xs"><Badge variant="outline">7d: {data.buckets?.exp7?.length ?? 0}</Badge><Badge variant="outline">30d: {data.buckets?.exp30?.length ?? 0}</Badge><Badge variant="outline">60d: {data.buckets?.exp60?.length ?? 0}</Badge><Badge variant="outline">90d: {data.buckets?.exp90?.length ?? 0}</Badge></div>
        </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><XCircle className="h-4 w-4"/>Expired / Transfers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{data.expired.length} <span className="text-sm font-normal">({expiredQty} units blocked)</span></div><p className="text-xs text-muted-foreground">Not sellable (POS excluded) • Pending transfers: {data.kpi?.pendingTransfers ?? 0}</p></CardContent></Card>
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
                      <TableCell className="font-medium max-w-[180px] truncate">{r.products?.name ?? r.product_id.slice(0,8)}<div className="text-xs text-muted-foreground truncate">{r.products?.sku||""} {r.products?.barcode ? `• ${r.products.barcode}`:""}</div></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{(r as any).products?.generic_name||"—"}<div className="text-xs">{(r as any).products?.sku||""}</div></TableCell>
                      <TableCell className="font-mono text-xs">{r.batch_number}<div className="text-xs text-muted-foreground">Recv {r.quantity_received}</div></TableCell>
                      <TableCell><Badge variant="outline">{r.branches?.name ?? r.branch_id.slice(0,6)}</Badge></TableCell>
                      <TableCell className="text-right font-bold">{r.quantity_available}</TableCell>
                      <TableCell className="text-xs">{/* FEFO indicator: earliest expiry for this product */} {(() => { const sameProduct=data.stock.filter((x:any)=>x.product_id===r.product_id && x.branch_id===r.branch_id).sort((a:any,b:any)=> new Date(a.expiry_date).getTime()-new Date(b.expiry_date).getTime())[0]; return sameProduct?.id===r.id ? <Badge variant="success">FEFO 1st</Badge> : <span className="text-muted-foreground">—</span>; })()}</TableCell>
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
                      <div className="flex justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-sm truncate">{r.products?.name}</p><p className="text-xs text-muted-foreground truncate">{r.batch_number} • {r.branches?.name}</p></div>{getStatusBadge(r)}</div>
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
                    <TableRow key={r.product_id}><TableCell className="font-medium">{r.name}</TableCell><TableCell>{r.qty}</TableCell><TableCell>UGX {r.value.toLocaleString()}</TableCell><TableCell className="text-xs">{r.last ? new Date(r.last).toLocaleDateString() : "Never"}</TableCell><TableCell className="text-xs">{(() => { const b=(data.stock as any[]).find(x=>x.product_id===r.product_id); return b ? new Date(b.expiry_date).toLocaleDateString() : "—"; })()}</TableCell></TableRow>
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
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trash2 className="h-4 w-4"/>Disposals / Damage</CardTitle><CardDescription>Controlled removal: Damaged / Expired / Lost — audit, not delete</CardDescription></CardHeader>
          <CardContent>
            {disposals.length===0 ? <p className="text-sm text-muted-foreground">No disposals • Expired stock handled via disposal workflow</p> :
              <div className="space-y-2">{disposals.slice(0,5).map((d:any)=><div key={d.id} className="flex justify-between text-sm border rounded p-2"><span>{d.type} • {d.products?.name} • {d.quantity}</span><Badge variant={d.status==="PENDING"?"warning":"secondary"}>{d.status}</Badge></div>)}</div>
            }
            <Button size="sm" variant="outline" className="mt-3" onClick={async()=>{
              const pid=prompt("Product ID to dispose? (use batch detail Adjust with Damaged reason for now)");
              if(pid) window.location.href="/inventory";
            }}>New Disposal</Button>
            <p className="text-xs text-muted-foreground mt-2">Customer returns: inspect → restock or quarantine. Supplier returns reduce stock.</p>
          </CardContent>
        </Card>
      </div>

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
            <div><Label>Batch</Label><Select value={adjustForm.batch_id} onChange={e=>setAdjustForm({...adjustForm, batch_id:e.target.value})}><option value="">Select batch</option>{data.stock.slice(0,100).map((b:any)=><option key={b.id} value={b.id}>{b.products?.name} — {b.batch_number} ({b.quantity_available} avail)</option>)}</Select></div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Quantity (+5 / -3)</Label><Input type="number" value={adjustForm.quantity} onChange={e=>setAdjustForm({...adjustForm, quantity:e.target.value})} placeholder="+5 or -5"/></div>
              <div><Label>Reason</Label><Select value={adjustForm.reason} onChange={e=>setAdjustForm({...adjustForm, reason:e.target.value})}><option value="">Select reason</option><option value="Physical count correction">Physical count correction</option><option value="Damaged">Damaged</option><option value="Expired">Expired</option><option value="Lost">Lost</option><option value="Found">Found</option><option value="Opening balance correction">Opening balance correction</option><option value="Data correction">Data correction</option></Select></div>
            </div>
            {adjustForm.batch_id && adjustForm.quantity && (
              <Card><CardContent className="p-3 text-sm">
                {(() => {
                  const b=data.stock.find((x:any)=>x.id===adjustForm.batch_id);
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
  React.useEffect(()=>{ fetch("/api/stock-movements").then(r=>r.json()).then(j=>{ setRows(j.data ?? []); setLoadingM(false); }).catch(()=>setLoadingM(false)); },[]);
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
