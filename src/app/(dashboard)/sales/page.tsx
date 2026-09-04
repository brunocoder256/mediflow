"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Eye, Printer, RotateCcw, Download, FileText, RefreshCw, ShoppingCart, CreditCard, TrendingUp, Calendar, User, MapPin, Package, DollarSign, Receipt, AlertTriangle, ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Receipt as ReceiptComp, printReceipt } from "@/components/receipt";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useOnlineStatus } from "@/hooks/use-online-status";

type Sale = { id:string; sale_number:string; sold_at:string; cashier_id:string; customer_id:string|null; total:number; subtotal:number; discount:number; tax:number; status:string; branch_id:string; profiles?:{full_name:string}; customers?:{name:string; phone:string}; sale_items?: any[] };

function formatUGX(n:number){ return `UGX ${Number(n).toLocaleString('en-UG')}`; }

function statusBadge(s:string){
  const v=s?.toUpperCase();
  if(v==='COMPLETED') return <Badge variant="success">Completed</Badge>;
  if(v==='HELD') return <Badge variant="warning">Held</Badge>;
  if(v==='VOIDED') return <Badge variant="destructive">Voided</Badge>;
  if(v==='REFUNDED') return <Badge variant="destructive">Refunded</Badge>;
  if(v==='PARTIALLY_REFUNDED') return <Badge variant="warning">Partially Refunded</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

export default function SalesPage(){
  const { isOnline } = useOnlineStatus();
  const [loading,setLoading]=React.useState(true);
  const [sales,setSales]=React.useState<Sale[]>([]);
  const [count,setCount]=React.useState(0);
  const [q,setQ]=React.useState("");
  const [debouncedQ,setDebouncedQ]=React.useState("");
  const [status,setStatus]=React.useState("all");
  const [branchFilter,setBranchFilter]=React.useState("all");
  const [paymentMethod,setPaymentMethod]=React.useState("all");
  const [customerSearch,setCustomerSearch]=React.useState("");
  const [dateFrom,setDateFrom]=React.useState("");
  const [dateTo,setDateTo]=React.useState("");
  const [productFilter,setProductFilter]=React.useState("");
  const [amountMin,setAmountMin]=React.useState("");
  const [amountMax,setAmountMax]=React.useState("");
  const [page,setPage]=React.useState(1);
  const perPage=14;
  const [branches,setBranches]=React.useState<any[]>([]);
  const [categories,setCategories]=React.useState<any[]>([]);
  const [kpi,setKpi]=React.useState<any>(null);
  const [detail,setDetail]=React.useState<any>(null);
  const [detailTab,setDetailTab]=React.useState("overview");
  const [err,setErr]=React.useState<string|null>(null);

  React.useEffect(()=>{ const t=setTimeout(()=>setDebouncedQ(q),300); return ()=>clearTimeout(t); },[q]);

  const setPreset=(p:string)=>{
    const now=new Date();
    const iso=(d:Date)=> d.toISOString().slice(0,10);
    if(p==="today"){ setDateFrom(iso(now)); setDateTo(iso(now)); }
    else if(p==="yesterday"){ const y=new Date(); y.setDate(y.getDate()-1); setDateFrom(iso(y)); setDateTo(iso(y)); }
    else if(p==="week"){ const s=new Date(); s.setDate(now.getDate()-now.getDay()); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if(p==="month"){ const s=new Date(now.getFullYear(), now.getMonth(),1); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if(p==="clear"){ setDateFrom(""); setDateTo(""); }
    setPage(1);
  };

  const fetchKpi=React.useCallback(async()=>{
    try{
      const params=new URLSearchParams();
      if(branchFilter!=='all') params.set('branch_id', branchFilter);
      params.set('kpi','1');
      const r=await fetch(`/api/sales?${params.toString()}`);
      const j=await r.json();
      if(r.ok) setKpi(j);
    }catch{}
  },[branchFilter]);

  const fetchData=React.useCallback(async()=>{
    setLoading(true); setErr(null);
    try{
      const params=new URLSearchParams();
      if(status!=="all") params.set("status",status.toUpperCase());
      if(paymentMethod!=="all") params.set("payment_method",paymentMethod);
      if(branchFilter!=="all") params.set("branch_id",branchFilter);
      if(dateFrom) params.set("date_from",dateFrom);
      if(dateTo) params.set("date_to",dateTo);
      if(debouncedQ) params.set("search", debouncedQ);
      if(customerSearch) params.set("customer_id", customerSearch);
      if(productFilter) params.set("product_id", productFilter);
      if(amountMin) params.set("amount_min", amountMin);
      if(amountMax) params.set("amount_max", amountMax);
      params.set("page", String(page));
      params.set("perPage", String(perPage));
      const r=await fetch(`/api/sales?${params.toString()}`);
      const j=await r.json();
      if(!r.ok) throw new Error(j.error ?? 'Failed to fetch');
      setSales(j.data ?? []);
      setCount(j.count ?? (j.data?.length ?? 0));
    }catch(e:any){ setErr(e.message); }
    setLoading(false);
  },[status,paymentMethod,branchFilter,dateFrom,dateTo,debouncedQ,customerSearch,productFilter,amountMin,amountMax,page]);

  React.useEffect(()=>{ fetchData(); fetchKpi(); },[fetchData, fetchKpi]);

  // load branches/categories
  React.useEffect(()=>{
    fetch("/api/settings").then(r=>r.json()).then(j=>{ if(j.branches) setBranches(j.branches); }).catch(()=>{});
    fetch("/api/categories").then(r=>r.json()).then(j=>{ if(Array.isArray(j)) setCategories(j); }).catch(()=>{});
  },[]);

  const openDetail=async(id:string)=>{
    // optimistic: find in list for header
    const found=sales.find(s=>s.id===id);
    setDetail(found ? {...found, _loading:true} : {_loading:true, id});
    setDetailTab("overview");
    try{
      const r=await fetch(`/api/sales?id=${id}`);
      const j=await r.json();
      if(r.ok) setDetail(j);
      else setDetail({...found, error:j.error});
    }catch{ setDetail(found); }
  };

  const voidSale=async(id:string)=>{
    if(!confirm("Void this sale? This creates a SALE_RETURN movement (+qty back to batch) and audit log. Irreversible.")) return;
    const reason=prompt("Reason for void") ?? "User void";
    const r=await fetch(`/api/sales`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"void", sale_id:id, reason})});
    const j=await r.json();
    if(!r.ok) alert(j.error);
    else { alert("Sale voided — stock restored via movement"); fetchData(); setDetail(null); }
  };

  const exportSales=(fmt:'csv'|'print')=>{
    const rows=sales as any[];
    if(fmt==='print'){
      const html=`<html><head><title>Sales</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;font-size:11px}th{background:#f3f4f6}</style></head><body><h2>MediFlow Sales — ${new Date().toLocaleDateString()}</h2><p>Total ${rows.length} • Branch ${branchFilter}</p><table><thead><tr><th>Sale #</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>${rows.map((r:any)=>`<tr><td>${r.sale_number}</td><td>${new Date(r.sold_at).toLocaleString()}</td><td>${r.customers?.name ?? 'Walk-in'}</td><td>${(r.sale_items??[]).length || '-'}</td><td>UGX ${Number(r.total).toLocaleString()}</td><td>${r.status}</td></tr>`).join('')}</tbody></table></body></html>`;
      const w=window.open('','_blank'); if(w){ w.document.write(html); w.document.close(); w.print(); } return;
    }
    const header=["Sale #","Date","Customer","Cashier","Branch","Items","Total","Status"].join(",");
    const lines=rows.map((r:any)=>[r.sale_number, new Date(r.sold_at).toLocaleString(), r.customers?.name??'Walk-in', r.profiles?.full_name?? r.cashier_id?.slice(0,8), r.branch_id?.slice(0,6), (r.sale_items??[]).length, r.total, r.status].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(","));
    const csv=[header,...lines].join("\n"); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`sales_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const totalPages=Math.max(1, Math.ceil(count/perPage));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6"/>Sales History</h1>
          <p className="text-sm text-muted-foreground">Server-authoritative transactions • FEFO & batch traceable • Audit-logged • Offline-safe via operation_id</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant={isOnline?"success":"warning"}>{isOnline?"Online":"Offline"}</Badge>
          <Button variant="outline" size="sm" onClick={()=>{fetchData(); fetchKpi();}}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
          <Button variant="outline" size="sm" onClick={()=>exportSales('csv')}><Download className="h-4 w-4 mr-1"/>CSV</Button>
          <Button variant="outline" size="sm" onClick={()=>exportSales('print')}><Printer className="h-4 w-4 mr-1"/>Print</Button>
          <Button size="sm" onClick={()=>window.location.href='/pos'}><Plus className="h-4 w-4 mr-1"/>New Sale (POS)</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3"/>Today Sales</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(kpi?.today?.total ?? 0)}</div><div className="text-xs text-muted-foreground">{kpi?.today?.count ?? 0} txns • Avg {formatUGX(Math.round(kpi?.today?.avg ?? 0))}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Receipt className="h-3 w-3"/>Transactions</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{kpi?.total?.completed ?? 0}</div><div className="text-xs text-muted-foreground">Completed • Held {kpi?.total?.held ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><DollarSign className="h-3 w-3"/>Gross</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(kpi?.gross ?? 0)}</div><div className="text-xs text-muted-foreground">Discount {formatUGX(kpi?.today?.discount ?? 0)} • Tax {formatUGX(kpi?.today?.tax ?? 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><TrendingUp className="h-3 w-3"/>Paid</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(kpi?.paid ?? 0)}</div><div className="text-xs text-muted-foreground">Via payments table</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Voided</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{kpi?.total?.voided ?? 0}</div><div className="text-xs text-muted-foreground">Refunded {kpi?.total?.refunded ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3"/>Branch</CardTitle></CardHeader><CardContent><div className="text-sm font-bold truncate">{branches.find(b=>b.id===branchFilter)?.name ?? 'All Branches'}</div><div className="text-xs text-muted-foreground">{count} records (page {page}/{totalPages})</div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search sale #, customer, phone, product, SKU, barcode, batch, cashier, payment ref..." value={q} onChange={e=>{setQ(e.target.value); setPage(1);}} className="pl-9"/></div>
          <Button variant="outline" onClick={()=>{setQ(""); setStatus("all"); setPaymentMethod("all"); setBranchFilter("all"); setDateFrom(""); setDateTo(""); setProductFilter(""); setAmountMin(""); setAmountMax(""); setPage(1);}}>Reset</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={branchFilter} onChange={e=>{setBranchFilter(e.target.value); setPage(1);}} className="w-[160px]" aria-label="Branch"><option value="all">All Branches</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select>
          <Select value={status} onChange={e=>{setStatus(e.target.value); setPage(1);}} className="w-[160px]"><option value="all">All Status</option><option value="COMPLETED">Completed</option><option value="HELD">Held</option><option value="VOIDED">Voided</option><option value="REFUNDED">Refunded</option></Select>
          <Select value={paymentMethod} onChange={e=>{setPaymentMethod(e.target.value); setPage(1);}} className="w-[160px]"><option value="all">All Payments</option><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="CARD">Card</option><option value="BANK">Bank</option><option value="OTHER">Other</option></Select>
          <Input placeholder="Product ID (filter)" value={productFilter} onChange={e=>{setProductFilter(e.target.value); setPage(1);}} className="w-[160px]"/>
          <Input placeholder="Min UGX" type="number" value={amountMin} onChange={e=>{setAmountMin(e.target.value); setPage(1);}} className="w-[120px]"/>
          <Input placeholder="Max UGX" type="number" value={amountMax} onChange={e=>{setAmountMax(e.target.value); setPage(1);}} className="w-[120px]"/>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={()=>setPreset("today")}>Today</Button>
          <Button variant="outline" size="sm" onClick={()=>setPreset("yesterday")}>Yesterday</Button>
          <Button variant="outline" size="sm" onClick={()=>setPreset("week")}>This Week</Button>
          <Button variant="outline" size="sm" onClick={()=>setPreset("month")}>This Month</Button>
          <Button variant="outline" size="sm" onClick={()=>setPreset("clear")}>Clear Dates</Button>
          <div className="flex gap-2 ml-auto">
            <Input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value); setPage(1);}} className="w-[150px]"/>
            <Input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value); setPage(1);}} className="w-[150px]"/>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Search is server-side (sale/customer/product/SKU/barcode/batch/payment ref). Use branch/date/payment filters for large datasets — pagination {count} total.</p>
      </CardContent></Card>

      {err && <Card><CardContent className="p-4 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>{err}</CardContent></Card>}

      {/* List */}
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-4">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : sales.length===0 ? <div className="py-12 text-center space-y-2"><p className="text-muted-foreground">No sales found</p><p className="text-xs text-muted-foreground">Try adjusting search or date range. POS sales appear here after completion.</p><Button variant="outline" size="sm" onClick={()=>window.location.href='/pos'}>Go to POS</Button></div>
        : <>
          <div className="hidden lg:block overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>Sale #</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Items</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead>Cashier</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {sales.map(s=>(
                <TableRow key={s.id} className="hover:bg-muted/40 cursor-pointer" onClick={()=>openDetail(s.id)}>
                  <TableCell className="font-mono text-xs font-medium">{s.sale_number}<div className="text-[10px] text-muted-foreground">{s.id.slice(0,6)}</div></TableCell>
                  <TableCell className="text-xs">{new Date(s.sold_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{s.customers?.name ?? 'Walk-in'}<div className="text-[10px] text-muted-foreground">{s.customers?.phone ?? ''}</div></TableCell>
                  <TableCell className="text-center text-xs">{(s as any).sale_items?.length ?? '-'}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatUGX(Number(s.total))}<div className="text-[10px] text-muted-foreground">Sub {formatUGX(Number(s.subtotal))}</div></TableCell>
                  <TableCell className="text-xs"><Badge variant="outline">{(s as any).payments?.[0]?.payment_method ?? '—'}</Badge></TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell className="text-xs">{(s as any).profiles?.full_name ?? s.cashier_id.slice(0,8)}</TableCell>
                  <TableCell className="text-xs">{branches.find(b=>b.id===s.branch_id)?.code ?? s.branch_id.slice(0,6)}</TableCell>
                  <TableCell className="text-right" onClick={e=>e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={()=>openDetail(s.id)} title="View"><Eye className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={()=>openDetail(s.id)} title="Print"><Printer className="h-4 w-4"/></Button>
                      {s.status==='COMPLETED' && <Button variant="ghost" size="icon" onClick={()=>voidSale(s.id)} title="Void"><RotateCcw className="h-4 w-4"/></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden p-3 grid gap-3">
            {sales.map(s=>(
              <Card key={s.id} className="cursor-pointer" onClick={()=>openDetail(s.id)}><CardContent className="p-3 space-y-2">
                <div className="flex justify-between"><span className="font-mono text-xs">{s.sale_number}</span>{statusBadge(s.status)}</div>
                <div className="flex justify-between text-xs"><span>{new Date(s.sold_at).toLocaleDateString()} • {s.customers?.name ?? 'Walk-in'}</span><span className="font-bold">{formatUGX(Number(s.total))}</span></div>
                <div className="text-xs text-muted-foreground">{(s as any).sale_items?.length ?? 0} items • {(s as any).profiles?.full_name ?? s.cashier_id.slice(0,8)} • {branches.find(b=>b.id===s.branch_id)?.code ?? ''}</div>
                <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="flex-1" onClick={()=>openDetail(s.id)}><Eye className="h-4 w-4 mr-1"/>View</Button>
                  {s.status==='COMPLETED' && <Button size="sm" variant="outline" onClick={()=>voidSale(s.id)}><RotateCcw className="h-4 w-4"/></Button>}
                </div>
              </CardContent></Card>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} • {count} total</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ArrowLeft className="h-4 w-4 mr-1"/>Prev</Button><Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next<ArrowRight className="h-4 w-4 ml-1"/></Button></div>
          </div>
        </>}
      </CardContent></Card>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o)=>!o && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{detail?.sale_number ?? detail?.id ?? 'Sale'} {detail && statusBadge(detail.status)}</DialogTitle>
            <DialogDescription>Sale trace: product → batch/FEFO → movement → payment → receipt → audit. Branch-scoped, operation_id idempotent.</DialogDescription>
          </DialogHeader>
          {!detail ? <Skeleton className="h-64 w-full"/> : detail._loading ? <div className="space-y-3"><Skeleton className="h-24"/><Skeleton className="h-64"/></div> : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={()=>printReceipt()}><Printer className="h-4 w-4 mr-1"/>Print</Button>
                <Button size="sm" variant="outline" onClick={()=>window.open(`/customers?id=${detail.customer_id}`,'_blank')} disabled={!detail.customer_id}><User className="h-4 w-4 mr-1"/>View Customer</Button>
                <Button size="sm" variant="outline" onClick={()=>window.location.href=`/returns?sale_id=${detail.id}`}>Create Return</Button>
                {detail.status==='COMPLETED' && <Button size="sm" variant="destructive" onClick={()=>voidSale(detail.id)}><RotateCcw className="h-4 w-4 mr-1"/>Void Sale</Button>}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Sale #</span><span className="font-mono">{detail.sale_number}</span></div>
                  <div className="flex justify-between"><span>Date</span><span>{new Date(detail.sold_at).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Cashier</span><span>{detail.profiles?.full_name ?? detail.cashier_id?.slice(0,8)}</span></div>
                  <div className="flex justify-between"><span>Branch</span><span>{branches.find(b=>b.id===detail.branch_id)?.name ?? detail.branch_id?.slice(0,8)}</span></div>
                  <div className="flex justify-between"><span>Customer</span><span>{detail.customers?.name ?? detail.customer_id?.slice(0,8) ?? 'Walk-in'}</span></div>
                  <div className="flex justify-between"><span>Status</span>{statusBadge(detail.status)}</div>
                  <div className="flex justify-between"><span>Operation ID</span><span className="font-mono text-xs truncate max-w-[150px]">{detail.operation_id ?? '—'}</span></div>
                </CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Totals & Financial</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>{formatUGX(Number(detail.subtotal))}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>{formatUGX(Number(detail.discount))}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span>{formatUGX(Number(detail.tax))}</span></div>
                  <div className="flex justify-between font-bold"><span>Total</span><span>{formatUGX(Number(detail.total))}</span></div>
                  <div className="flex justify-between"><span>Paid</span><span>{formatUGX((detail.payments??[]).reduce((a:any,p:any)=>a+Number(p.amount),0))}</span></div>
                  <div className="flex justify-between"><span>COGS (batch cost)</span><span className="text-xs">{(detail.stock_movements??[]).length ? formatUGX((detail.stock_movements??[]).reduce((a:any,m:any)=>a+Math.abs(Number(m.quantity))*Number(m.unit_cost ?? 0),0)) : '—'}</span></div>
                </CardContent></Card>
              </div>

              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="flex flex-wrap h-auto">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="items">Items & Batches</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory</TabsTrigger>
                  <TabsTrigger value="returns">Returns</TabsTrigger>
                  <TabsTrigger value="audit">Audit</TabsTrigger>
                  <TabsTrigger value="receipt">Receipt</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                  <Card><CardContent className="p-4 text-sm space-y-1">
                    <p><span className="text-muted-foreground">Sale completed via:</span> POS • FEFO earliest-expiry → batch decrement • Atomic PostgreSQL transaction `create_pos_sale` • Idempotent `operation_id`</p>
                    <p><span className="text-muted-foreground">Financial:</span> Revenue {formatUGX(Number(detail.total))} • COGS from batch purchase_price preserved at sale time • Gross profit historical not recalculated on price change</p>
                    <p className="text-xs text-muted-foreground">Integration: Sale ↔ Inventory Movement ↔ Payment ↔ Receipt ↔ Customer ↔ Return ↔ Accounting ↔ Audit ↔ Reports</p>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="items" className="mt-4">
                  <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Discount</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead>Returnable</TableHead></TableRow></TableHeader><TableBody>
                    {(detail.sale_items ?? []).map((it:any)=>{
                      const retQty=(detail.returns??[]).reduce((a:any,r:any)=>a,0); // placeholder, returns per sale item not per line tracked; use total returned
                      return (
                        <TableRow key={it.id}>
                          <TableCell className="text-sm">{it.products?.name ?? it.product_id.slice(0,8)}<div className="text-xs text-muted-foreground">{it.products?.sku ?? ''} {it.products?.barcode ? `• ${it.products.barcode}`:''}</div></TableCell>
                          <TableCell className="font-mono text-xs">{it.batch_id?.slice(0,8)}<div className="text-[10px]">{it.product_batches?.batch_number ?? ''}</div></TableCell>
                          <TableCell className="text-xs">{it.product_batches?.expiry_date ? new Date(it.product_batches.expiry_date).toLocaleDateString() : '—'}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right">{formatUGX(Number(it.unit_price))}</TableCell>
                          <TableCell className="text-right">{formatUGX(Number(it.discount))}</TableCell>
                          <TableCell className="text-right font-medium">{formatUGX(Number(it.subtotal))}</TableCell>
                          <TableCell className="text-xs">{it.quantity} sold • View via Returns</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody></Table>
                  <p className="text-xs text-muted-foreground mt-2">Every line preserves batch+expiry at sale time — answers “Which batch was sold to this customer?” • Cost basis from batch purchase_price • FEFO allocation stored per line; split-batch (e.g., 12 = 8 from Batch A + 4 from Batch B) creates two lines.</p>
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  {(detail.payments??[]).length===0 ? <p className="text-sm text-muted-foreground">No payments recorded</p> :
                    <Table><TableHeader><TableRow><TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead>Reconciliation</TableHead></TableRow></TableHeader><TableBody>
                      {(detail.payments??[]).map((p:any)=><TableRow key={p.id}><TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell><TableCell>{formatUGX(Number(p.amount))}</TableCell><TableCell className="font-mono text-xs">{p.reference ?? p.payer_reference ?? '—'}</TableCell><TableCell>{statusBadge(p.status)}</TableCell><TableCell className="text-xs">{p.reconciliation_status ?? 'UNRECONCILED'}</TableCell></TableRow>)}
                    </TableBody></Table>
                  }
                  <p className="text-xs text-muted-foreground mt-2">Sale and payment separate: Completed sale may be Paid / Partially Paid / Credit per payments. Split payments sum to total. Mobile Money reference required for non-cash.</p>
                </TabsContent>

                <TabsContent value="inventory" className="mt-4">
                  {(detail.stock_movements??[]).length===0 ? <p className="text-sm text-muted-foreground">No stock movements yet — sale creates movement type SALE (-qty) per batch. No direct `stock = stock - qty`.</p> :
                    <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader><TableBody>
                      {(detail.stock_movements??[]).map((m:any)=><TableRow key={m.id}><TableCell className="text-xs">{new Date(m.created_at).toLocaleString()}</TableCell><TableCell className="text-xs">{m.product_id?.slice(0,8)}</TableCell><TableCell className="font-mono text-xs">{m.batch_id?.slice(0,8)}</TableCell><TableCell><Badge variant="outline">{m.movement_type}</Badge></TableCell><TableCell className="text-right">{m.quantity}</TableCell><TableCell className="text-xs">{m.unit_cost ? formatUGX(Number(m.unit_cost)) : '—'}</TableCell></TableRow>)}
                    </TableBody></Table>
                  }
                  <p className="text-xs text-muted-foreground mt-2">From Sale → <a href="/inventory" className="underline">View Stock Movement</a> • From Inventory → View Sale linked via reference_id. Branch validated (Branch A sale never deducts Branch B).</p>
                </TabsContent>

                <TabsContent value="returns" className="mt-4">
                  {(detail.returns??[]).length===0 ? <div className="text-sm text-muted-foreground space-y-2"><p>No returns for this sale.</p><Button size="sm" variant="outline" onClick={()=>window.location.href=`/returns?sale_id=${detail.id}`}>Create Return — preserves original price/batch</Button></div> :
                    <Table><TableHeader><TableRow><TableHead>Return #</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
                      {(detail.returns??[]).map((r:any)=><TableRow key={r.id}><TableCell className="font-mono text-xs">{r.return_number}</TableCell><TableCell>{statusBadge(r.status)}</TableCell><TableCell className="text-right">{formatUGX(Number(r.total))}</TableCell><TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell></TableRow>)}
                    </TableBody></Table>
                  }
                </TabsContent>

                <TabsContent value="audit" className="mt-4">
                  {(detail.audit_logs??[]).length===0 ? <p className="text-sm text-muted-foreground">Audit: SALE_COMPLETED / SALE_VOIDED with user & timestamp. No silent edits.</p> :
                    <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Change</TableHead></TableRow></TableHeader><TableBody>
                      {(detail.audit_logs??[]).map((a:any)=><TableRow key={a.id}><TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell><TableCell className="font-mono text-xs">{a.action}</TableCell><TableCell className="text-xs">{String(a.created_by??'').slice(0,8)}</TableCell><TableCell className="text-xs truncate max-w-[200px]">{JSON.stringify(a.new_values??'').slice(0,100)}</TableCell></TableRow>)}
                    </TableBody></Table>
                  }
                </TabsContent>

                <TabsContent value="receipt" className="mt-4">
                  <ReceiptComp organization={{name:"MediFlow Pharmacy", address:"Kampala", phone:"+256700123456", registration_number:"REG-2024-001"}} branch={{name: branches.find(b=>b.id===detail.branch_id)?.name ?? "Branch"}} receipt_number={detail.sale_number} sold_at={detail.sold_at} cashier={detail.profiles?.full_name ?? detail.cashier_id} customer={detail.customers?.name} items={(detail.sale_items??[]).map((it:any)=>({name: it.products?.name ?? it.product_id.slice(0,8), quantity: it.quantity, unit_price: Number(it.unit_price), discount: Number(it.discount ?? 0), tax: Number(it.tax ?? 0), subtotal: Number(it.subtotal)}))} subtotal={Number(detail.subtotal)} discount={Number(detail.discount)} tax={Number(detail.tax)} total={Number(detail.total)} payment_method={detail.payments?.[0]?.payment_method ?? "CASH"} payment_reference={detail.payments?.[0]?.reference}/>
                  <Button onClick={printReceipt} className="w-full mt-3"><Printer className="h-4 w-4 mr-2"/>Print (58/80mm) — EFRIS QR placeholder</Button>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground text-center">Sales orchestrate Product → Batch/FEFO → Cart → Price/Discount/Tax → Customer → Payment → Sale → Inventory Movement → Receipt → Accounting → Audit → Reports. No duplicate system: sales reuses inventory/payments/customers/audit.</p>
    </div>
  );
}
