"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Search, Download, RefreshCw, AlertTriangle, Clock, XCircle, ArrowUpDown, Trash2 } from "lucide-react";

type BatchRow = { id:string; product_id:string; branch_id:string; batch_number:string; quantity_available:number; purchase_price:number; selling_price:number; expiry_date:string; is_active:boolean; products:{name:string; reorder_level:number} };

export default function InventoryPage() {
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [data, setData] = React.useState<{stock:any[]; lowStock:any[]; expiring:any[]; expired:any[]; valuation:any}>({stock:[],lowStock:[],expiring:[],expired:[],valuation:[]});
  const [error, setError] = React.useState<string|null>(null);

  const fetchData = React.useCallback(async ()=>{
    setLoading(true); setError(null);
    try{
      const r=await fetch("/api/inventory");
      if(!r.ok) throw new Error(await r.text());
      const j=await r.json();
      // normalize: API returns {stock, lowStock, expiring, expired, inventoryValue}
      setData({stock: j.stock ?? [], lowStock: j.lowStock ?? [], expiring: j.expiring ?? [], expired: j.expired ?? [], valuation: j.inventoryValue ?? []});
    }catch(e:any){ setError(e.message); }
    setLoading(false);
  },[]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

  const tabs = [
    { id: "overview", label: "Stock Overview", icon: ArrowUpDown },
    { id: "low-stock", label: "Low Stock", icon: AlertTriangle, count: data.lowStock.length },
    { id: "expiring", label: "Expiring", icon: Clock, count: data.expiring.length },
    { id: "expired", label: "Expired", icon: XCircle, count: data.expired.length },
    { id: "movements", label: "Movements", icon: RefreshCw },
  ];

  const getRows = ():BatchRow[]=>{
    if(activeTab==="low-stock") return data.lowStock as BatchRow[];
    if(activeTab==="expiring") return data.expiring as BatchRow[];
    if(activeTab==="expired") return data.expired as BatchRow[];
    return data.stock as BatchRow[];
  };
  const rows = getRows().filter(r=>{
    const q=searchQuery.toLowerCase();
    return !q || r.products?.name?.toLowerCase().includes(q) || r.batch_number.toLowerCase().includes(q);
  });

  const getStatusBadge=(r:BatchRow)=>{
    const days=(new Date(r.expiry_date).getTime()-Date.now())/(1000*3600*24);
    if(new Date(r.expiry_date) <= new Date()) return <Badge variant="destructive">Expired</Badge>;
    if(days<=30) return <Badge variant="destructive">Expiring</Badge>;
    if(r.quantity_available <= (r.products?.reorder_level ?? 10)) return <Badge variant="warning">Low Stock</Badge>;
    return <Badge variant="success">In Stock</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Inventory</h1><p className="text-muted-foreground">Track and manage inventory across branches</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={()=>fetchData()}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
          <Button variant="outline" size="sm" onClick={()=>window.print()}><Download className="h-4 w-4 mr-2"/>Export</Button>
        </div>
      </div>
      {error && <Card><CardContent className="p-4 text-sm text-destructive">Failed to load: {error} <Button variant="link" onClick={fetchData}>Retry</Button></CardContent></Card>}
      <Tabs defaultValue="overview">
        <TabsList>{tabs.map(tab=>(
          <TabsTrigger key={tab.id} value={tab.id} active={activeTab===tab.id} onClick={()=>setActiveTab(tab.id)}>
            <tab.icon className="h-4 w-4 mr-2"/>{tab.label}{typeof tab.count==='number' && <Badge variant="secondary" className="ml-2">{tab.count}</Badge>}
          </TabsTrigger>
        ))}</TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card className="mb-4"><CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search products or batches..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-9"/></div>
              <Select value="all" onChange={()=>{}} className="w-full md:w-[180px]"><option value="all">All Categories</option></Select>
              <Select value="all" onChange={()=>{}} className="w-full md:w-[180px]"><option value="all">All Branches</option></Select>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-0">
            {loading ? <div className="p-6 space-y-4">{[...Array(5)].map((_,i)=><div key={i} className="flex items-center gap-4"><Skeleton className="h-12 w-12"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48"/><Skeleton className="h-3 w-32"/></div><Skeleton className="h-8 w-20"/></div>)}</div>
            : rows.length===0 ? <div className="flex flex-col items-center justify-center py-12"><p className="text-muted-foreground">No inventory items</p><p className="text-xs text-muted-foreground mt-1">Receive purchases to add stock</p></div>
            : <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Expiry</TableHead><TableHead className="hidden md:table-cell">Value (UGX)</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
              {rows.map((r:any)=>(
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.products?.name ?? r.product_id.slice(0,8)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.batch_number}</TableCell>
                  <TableCell className="text-right">{r.quantity_available}</TableCell>
                  <TableCell>{new Date(r.expiry_date).toLocaleDateString()}</TableCell>
                  <TableCell className="hidden md:table-cell">{(Number(r.quantity_available)*Number(r.purchase_price)).toLocaleString()}</TableCell>
                  <TableCell>{getStatusBadge(r)}</TableCell>
                </TableRow>
              ))}
            </TableBody></Table>}
          </CardContent></Card>
          {activeTab==="movements" && <MovementsTable />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MovementsTable(){
  const [rows,setRows]=React.useState<any[]>([]);
  const [loadingM,setLoadingM]=React.useState(true);
  React.useEffect(()=>{ fetch("/api/stock-movements").then(r=>r.json()).then(j=>{ setRows(j.data ?? []); setLoadingM(false); }).catch(()=>setLoadingM(false)); },[]);
  if(loadingM) return <Card className="mt-4"><CardContent className="p-4"><Skeleton className="h-24 w-full"/></CardContent></Card>;
  if(rows.length===0) return <Card className="mt-4"><CardContent className="p-4 text-sm text-muted-foreground">No movements yet. Every stock change creates PURCHASE/SALE/RETURN/ADJUSTMENT/TRANSFER ledger. See Audit.</CardContent></Card>;
  return <Card className="mt-4"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Ref</TableHead></TableRow></TableHeader><TableBody>{rows.slice(0,50).map((m:any)=><TableRow key={m.id}><TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell><TableCell>{m.products?.name ?? m.product_id.slice(0,6)}</TableCell><TableCell>{m.product_batches?.batch_number ?? m.batch_id?.slice(0,6) ?? "—"}</TableCell><TableCell><Badge variant="secondary">{m.movement_type}</Badge></TableCell><TableCell className="text-right">{m.quantity}</TableCell><TableCell className="font-mono text-xs">{m.reference_type ?? ""} {m.reference_id?.slice(0,6) ?? ""}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>;
}
