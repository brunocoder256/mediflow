"use client";
export const dynamic = "force-dynamic";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Eye, RotateCcw, Truck, ScanLine, Wifi, WifiOff, RefreshCw, Download, Printer, FileText, AlertTriangle, CheckCircle, XCircle, Clock, Package, Building2, Users, History, DollarSign, Layers, CreditCard, Undo2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { queueReturnCreate, getReturnsPendingCount } from "@/lib/offline/sync";
import { db } from "@/lib/offline/db";

type ReturnType = 'SALES' | 'PURCHASE';
const reasons = ["Damaged","Expired","Near Expiry","Wrong Product","Wrong Quantity","Wrong Batch","Quality Issue","Customer Return","Supplier Error","Recall","Duplicate Sale","Pricing Error","Packaging Issue","Delivery Discrepancy","Other"];
const refundMethods = ["CASH","MOBILE_MONEY","CARD","BANK","ORIGINAL","STORE_CREDIT","OTHER"];

function rBadge(s:string){
  const v=s?.toLowerCase();
  if(v==='completed') return <Badge variant="success">Completed</Badge>;
  if(['approved','processing'].includes(v)) return <Badge variant="warning">{s}</Badge>;
  if(['pending','submitted','pending_approval','draft'].includes(v)) return <Badge variant="secondary">{s}</Badge>;
  if(v==='rejected') return <Badge variant="destructive">Rejected</Badge>;
  if(v==='cancelled') return <Badge variant="outline">Cancelled</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}
function refundBadge(s:string){
  if(!s) return <Badge variant="outline">—</Badge>;
  const v=s.toLowerCase();
  if(v==='completed') return <Badge variant="success">Refunded</Badge>;
  if(v==='pending') return <Badge variant="warning">Pending</Badge>;
  if(v==='partial') return <Badge variant="warning">Partial</Badge>;
  if(v==='rejected') return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

export default function ReturnsPage(){
  const { isOnline } = useOnlineStatus();
  const [loading,setLoading]=React.useState(true);
  const [unified,setUnified]=React.useState<any[]>([]);
  const [kpi,setKpi]=React.useState<any>(null);
  const [branches,setBranches]=React.useState<any[]>([]);
  const [products,setProducts]=React.useState<any[]>([]);
  const [q,setQ]=React.useState("");
  const [debouncedQ,setDebouncedQ]=React.useState("");
  const [typeFilter,setTypeFilter]=React.useState("all");
  const [statusFilter,setStatusFilter]=React.useState("all");
  const [reasonFilter,setReasonFilter]=React.useState("all");
  const [refundFilter,setRefundFilter]=React.useState("all");
  const [branchFilter,setBranchFilter]=React.useState("all");
  const [dateFrom,setDateFrom]=React.useState("");
  const [dateTo,setDateTo]=React.useState("");
  const [page,setPage]=React.useState(1);
  const [count,setCount]=React.useState(0);
  const [pendingCount,setPendingCount]=React.useState(0);
  const [err,setErr]=React.useState<string|null>(null);

  // create wizards
  const [showNew,setShowNew]=React.useState(false);
  const [newType,setNewType]=React.useState<ReturnType>('SALES');
  // sales
  const [saleId,setSaleId]=React.useState("");
  const [saleDetail,setSaleDetail]=React.useState<any>(null);
  const [saleQty,setSaleQty]=React.useState<Record<string, number>>({});
  const [saleCond,setSaleCond]=React.useState<Record<string, string>>({});
  const [saleDest,setSaleDest]=React.useState<Record<string, string>>({});
  const [saleReason,setSaleReason]=React.useState<Record<string, string>>({});
  // purchase
  const [poId,setPoId]=React.useState("");
  const [poDetail,setPoDetail]=React.useState<any>(null);
  const [prQty,setPrQty]=React.useState<Record<string, number>>({});
  const [prBatch,setPrBatch]=React.useState<Record<string, string>>({});
  const [prReason,setPrReason]=React.useState<Record<string, string>>({});

  const [commonReason,setCommonReason]=React.useState("Customer Return");
  const [refundMethod,setRefundMethod]=React.useState("CASH");
  const [submitting,setSubmitting]=React.useState(false);
  const [showDetail,setShowDetail]=React.useState<any|null>(null);
  const [detailData,setDetailData]=React.useState<any>(null);
  const [detailTab,setDetailTab]=React.useState("overview");
  const [showBarcode,setShowBarcode]=React.useState(false);

  const perPage=14;
  React.useEffect(()=>{ const id=setTimeout(()=>setDebouncedQ(q),300); return ()=>clearTimeout(id); },[q]);
  React.useEffect(()=>{ getReturnsPendingCount().then(c=>setPendingCount(c)).catch(()=>{}); const id=setInterval(()=> getReturnsPendingCount().then(c=>setPendingCount(c)).catch(()=>{}),5000); return ()=>clearInterval(id); },[]);

  const fetchAll=React.useCallback(async()=>{
    setLoading(true); setErr(null);
    try{
      const params=new URLSearchParams();
      if(debouncedQ) params.set("search", debouncedQ);
      if(statusFilter!=='all') params.set("status", statusFilter);
      if(reasonFilter!=='all') params.set("reason", reasonFilter);
      if(refundFilter!=='all') params.set("refund_status", refundFilter);
      if(branchFilter!=='all') params.set("branch_id", branchFilter);
      if(dateFrom) params.set("date_from", dateFrom);
      if(dateTo) params.set("date_to", dateTo);
      params.set("page", String(page)); params.set("perPage", String(perPage));
      const [salesRes, purchRes, bRes, prodRes, kpiRes]=await Promise.all([
        fetch(`/api/returns?${params.toString()}`).then(r=>r.json()).catch(()=>({data:[]})),
        fetch(`/api/purchase-returns?${params.toString()}`).then(r=>r.json()).catch(()=>({data:[]})),
        fetch("/api/settings").then(r=>r.json()).catch(()=>({branches:[]})),
        fetch("/api/products?perPage=200").then(r=>r.json()).catch(()=>({data:[]})),
        fetch(`/api/returns?kpi=1${branchFilter!=='all'?`&branch_id=${branchFilter}`:""}`).then(r=>r.json()).catch(()=>null),
      ]);
      let salesList = (Array.isArray(salesRes?.data) ? salesRes.data : Array.isArray(salesRes) ? salesRes : []) as any[];
      salesList = salesList.filter(Boolean).map((r:any)=>({...r, _type:'SALES' as const, _orig: r?.sale_id ?? null, _counterparty: r?.sales?.customers?.name ?? r?.customer_id ?? "Walk-in"}));
      let purchList = (Array.isArray(purchRes?.data) ? purchRes.data : Array.isArray(purchRes) ? purchRes : []) as any[];
      purchList = purchList.filter(Boolean).map((r:any)=>({...r, _type:'PURCHASE' as const, _orig: r?.purchase_order_id ?? null, _counterparty: r?.suppliers?.name ?? r?.supplier_id?.slice(0,6) ?? "—"}));
      let merged = [...salesList, ...purchList];
      // client filters for type
      if(typeFilter!=='all'){
        const want = typeFilter==='sales' ? 'SALES' : 'PURCHASE';
        merged = merged.filter((r:any)=> r?._type===want);
      }
      // search fallback across merged (server already did but ensure)
      if(debouncedQ){
        const s=debouncedQ.toLowerCase();
        merged = merged.filter((r:any)=>
          r?.return_number?.toLowerCase().includes(s) ||
          r?._orig?.toLowerCase().includes(s) ||
          r?._counterparty?.toLowerCase().includes(s) ||
          r?.reason?.toLowerCase().includes(s) ||
          (r.return_items??[]).some((it:any)=> it.batch_id?.toLowerCase().includes(s)) ||
          (r.purchase_return_items??[]).some((it:any)=> it.batch_id?.toLowerCase().includes(s))
        );
      }
      merged.sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const totalCount = (salesRes.count ?? salesList.length) + (purchRes.count ?? purchList.length);
      setUnified(merged);
      setCount(merged.length);
      setBranches(bRes.branches ?? []);
      setProducts(Array.isArray(prodRes)? prodRes : (prodRes.data ?? []));
      if(kpiRes) setKpi(kpiRes);
      try{
        for(const r of merged.slice(0,20)){
          await db.cachedReturns.put({ id:r.id, return_number:r?.return_number, return_type:r?._type, sale_id:r.sale_id ?? null, purchase_order_id:r.purchase_order_id ?? null, supplier_id:r.supplier_id ?? null, branch_id:r?.branch_id, status:r?.status, total:Number(r.total), payload:r, sync_status:"synced" as any, created_at:r.created_at } as any).catch(()=>{});
        }
      }catch{}
    }catch(e:any){ setErr(e.message); }
    setLoading(false);
  },[debouncedQ, statusFilter, reasonFilter, refundFilter, branchFilter, dateFrom, dateTo, page, typeFilter]);
  React.useEffect(()=>{ fetchAll(); },[fetchAll]);

  const openDetail=async(row:any)=>{
    setShowDetail(row);
    setDetailTab("overview");
    setDetailData(null);
    try{
      if(row._type==='SALES'){
        const r=await fetch(`/api/returns?id=${row.id}`); const j=await r.json(); if(r.ok) setDetailData({ ...j, _type:'SALES' });
      } else {
        const r=await fetch(`/api/purchase-returns?id=${row.id}`); const j=await r.json(); if(r.ok) setDetailData({ ...j, _type:'PURCHASE' });
      }
    }catch{}
  };

  const fetchSale=async()=>{
    if(!saleId.trim()) return alert("Enter sale number / ID");
    const r=await fetch(`/api/sales?id=${saleId.trim()}`);
    const j=await r.json();
    if(j.error || !j.id) {
      // try sale_number search
      const s2=await fetch(`/api/sales?search=${encodeURIComponent(saleId.trim())}`).then(x=>x.json()).catch(()=>null);
      const cand = s2?.data?.[0] ?? s2?.[0];
      if(cand){ const d=await fetch(`/api/sales?id=${cand.id}`).then(x=>x.json()); if(d.id) { setSaleDetail(d); return; } }
      return alert(j.error || "Sale not found");
    }
    setSaleDetail(j);
    // reset qty maps
    setSaleQty({}); setSaleCond({}); setSaleDest({});
  };
  const fetchPO=async()=>{
    if(!poId.trim()) return alert("Enter PO/GRN number or ID");
    // try direct id
    let j:any=null;
    try{ const r=await fetch(`/api/purchases?id=${poId.trim()}`); j=await r.json(); if(j?.id) { setPoDetail(j); return; } }catch{}
    // search
    const s2=await fetch(`/api/purchases?search=${encodeURIComponent(poId.trim())}&perPage=5`).then(x=>x.json()).catch(()=>null);
    const cand=s2?.data?.[0] ?? s2?.[0];
    if(cand){
      const d=await fetch(`/api/purchases?id=${cand.id}`).then(x=>x.json());
      if(d?.id) setPoDetail(d);
      else alert("Purchase not found");
    } else alert("Purchase/GRN not found");
  };

  const submitSalesReturn=async()=>{
    if(!saleDetail) return;
    if(submitting) return;
    const items=(saleDetail.sale_items ?? []).filter((it:any)=> (saleQty[it.id] ?? 0) >0).map((it:any)=>({
      sale_item_id: it.id, product_id: it.product_id, batch_id: it.batch_id,
      quantity: Math.min(Number(saleQty[it.id]), Number(it.quantity)),
      reason: saleReason[it.id] ?? commonReason,
      reason_category: saleReason[it.id] ?? commonReason,
      return_condition: saleCond[it.id] ?? "SELLABLE",
      condition: saleCond[it.id] ?? "SELLABLE",
      inventory_destination: saleDest[it.id] ?? (saleCond[it.id]==='SELLABLE' ? 'SALEABLE' : 'QUARANTINE')
    }));
    if(!items.length) return alert("Select quantity for at least one item");
    setSubmitting(true);
    const payload:any={ sale_id: saleDetail.id, branch_id: saleDetail.branch_id, reason: commonReason, reason_category: commonReason, resolution: "REFUND", refund_method: refundMethod, items, operation_id: crypto.randomUUID() };
    // validate remaining returnable client-side quick
    try{
      if(!isOnline){
        await queueReturnCreate(payload, "SALES");
        alert("Offline — sales return queued Pending Sync. Inventory + refund will apply once online (idempotent).");
        setShowNew(false); setSaleDetail(null); setPendingCount(c=>c+1); fetchAll();
        setSubmitting(false); return;
      }
      const r=await fetch("/api/returns",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok) alert(j.error || "Failed");
      else { alert(`Return ${j.return_number ?? j.id} created — status pending / refund pending`); setShowNew(false); setSaleDetail(null); fetchAll(); }
    } finally { setSubmitting(false); }
  };

  const submitPurchaseReturn=async()=>{
    if(!poDetail) return;
    if(submitting) return;
    const items=(poDetail.purchase_items ?? poDetail.items ?? []).filter((it:any)=> (prQty[it.id] ?? 0)>0).map((it:any)=>{
      // need batch_id — pick first batch if not specified or use product_batches
      const batchId = prBatch[it.id] ?? (poDetail.batches?.find((b:any)=> b.product_id===it.product_id)?.id ?? null);
      return {
        purchase_item_id: it.id, product_id: it.product_id, batch_id: batchId,
        quantity: Math.min(Number(prQty[it.id]), Number(it.quantity_ordered ?? it.quantity ?? 9999)),
        unit_cost: Number(it.unit_cost ?? 0),
        reason: prReason[it.id] ?? commonReason,
        reason_category: prReason[it.id] ?? commonReason,
      };
    });
    if(!items.length) return alert("Select quantity");
    if(items.some((it:any)=> !it.batch_id)) return alert("Batch required for each item — capture Batch + Expiry per inventory traceability");
    setSubmitting(true);
    const payload:any={ purchase_order_id: poDetail.id, supplier_id: poDetail.supplier_id, branch_id: poDetail.branch_id, reason: commonReason, reason_category: commonReason, operation_id: crypto.randomUUID(), items, grn_id: poDetail.goods_receipts?.[0]?.id ?? null };
    try{
      if(!isOnline){
        await queueReturnCreate(payload, "PURCHASE");
        alert("Offline — purchase return queued Pending Sync. Server will revalidate batch stock before posting.");
        setShowNew(false); setPoDetail(null); setPendingCount(c=>c+1); fetchAll();
        setSubmitting(false); return;
      }
      const r=await fetch("/api/purchase-returns",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok) alert(j.error);
      else { alert(`Purchase return ${j.return_number ?? j.id} created — pending approval`); setShowNew(false); setPoDetail(null); fetchAll(); }
    } finally { setSubmitting(false); }
  };

  const handleStatus=async(row:any, action:string)=>{
    if(submitting) return;
    setSubmitting(true);
    try{
      let url="", body:any={};
      if(row._type==='SALES'){
        url="/api/returns"; body={ action, id: row.id, return_id: row.id, status: action };
        // map action to status name expected by service
        if(action==='approve') body={ action:'approve', id: row.id };
        else if(action==='reject') body={ action:'reject', id: row.id, reason: prompt("Rejection reason") ?? "" };
        else if(action==='complete') body={ action:'complete', id: row.id };
        else if(action==='cancel') body={ action:'cancel', id: row.id };
        else body={ action:'status', id: row.id, status: action };
      } else {
        url="/api/purchase-returns"; body={ action, return_id: row.id, id: row.id };
        if(action==='approve') body={ action:'approve', return_id: row.id };
        else if(action==='complete') body={ action:'complete', return_id: row.id };
      }
      const r=await fetch(url,{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
      const j=await r.json();
      if(!r.ok) alert(j.error);
      else { fetchAll(); if(showDetail?.id===row.id) openDetail(row); }
    } finally { setSubmitting(false); }
  };

  const exportReturns=(fmt:'csv'|'excel'|'print'='csv')=>{
    const rows=unified as any[];
    if(fmt==='print'){
      const html=`<html><head><title>Returns</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;font-size:11px}th{background:#f3f4f6}</style></head><body><h2>MediFlow Returns — ${new Date().toLocaleDateString()}</h2><p>Total ${rows.length} • Sales ${rows.filter((r:any)=>r?._type==='SALES').length} • Purchase ${rows.filter((r:any)=>r?._type==='PURCHASE').length}</p><table><thead><tr><th>Return #</th><th>Type</th><th>Original</th><th>Counterparty</th><th>Qty</th><th>Value</th><th>Reason</th><th>Status</th><th>Branch</th></tr></thead><tbody>${rows.map((r:any)=>`<tr><td>${r?.return_number}</td><td>${r?._type}</td><td>${r?._orig?.slice(0,8) ?? ''}</td><td>${r?._counterparty}</td><td>${(r.return_items??r.purchase_return_items??[]).reduce((a:any,it:any)=>a+Number(it.quantity),0)}</td><td>UGX ${Number(r.total).toLocaleString()}</td><td>${r?.reason ?? ''}</td><td>${r?.status}</td><td>${r?.branch_id?.slice(0,6)}</td></tr>`).join('')}</tbody></table></body></html>`;
      const w=window.open('','_blank'); if(w){ w.document.write(html); w.document.close(); w.print(); } return;
    }
    if(fmt==='excel'){
      const header=["Return #","Type","Original","Counterparty","Qty","Value","Reason","Status","Refund/Credit","Branch","Date"];
      const lines=rows.map((r:any)=>[r?.return_number, r?._type, r?._orig?.slice(0,8), r?._counterparty, (r.return_items??r.purchase_return_items??[]).reduce((a:any,it:any)=>a+Number(it.quantity),0), r.total, r?.reason??"", r?.status, r?.refund_status ?? r?.credit_status ?? "", r?.branch_id?.slice(0,6), new Date(r.created_at).toLocaleDateString()]);
      const table=`<table><thead><tr>${header.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${lines.map(r=>`<tr>${r.map(c=>`<td>${String(c).replace(/</g,'&lt;')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>${table}</body></html>`;
      const blob=new Blob([html],{type:'application/vnd.ms-excel'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`returns_${new Date().toISOString().slice(0,10)}.xls`; a.click(); return;
    }
    const header=["Return #","Type","Original","Counterparty","Qty","Value","Reason","Status","Branch","Date"].join(",");
    const lines=rows.map((r:any)=>[r?.return_number, r?._type, r?._orig, r?._counterparty, (r.return_items??r.purchase_return_items??[]).reduce((a:any,it:any)=>a+Number(it.quantity),0), r.total, r?.reason??"", r?.status, r?.branch_id?.slice(0,6), new Date(r.created_at).toLocaleDateString()].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(","));
    const csv=[header,...lines].join("\n"); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`returns_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const totalPages=Math.max(1, Math.ceil(count/perPage));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Undo2 className="h-6 w-6"/>Returns</h1><p className="text-sm text-muted-foreground">Business transaction — never DELETE sale. Validates max returnable = sold − already returned • Batch-aware • Inventory movement • Refund/Credit separate</p></div>
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant={isOnline?"success":"warning"} className="gap-1">{isOnline? <Wifi className="h-3 w-3"/>:<WifiOff className="h-3 w-3"/>}{isOnline?"Online":"Offline"}</Badge>
          {pendingCount>0 && <Badge variant="warning">{pendingCount} pending sync</Badge>}
          <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
          <div className="flex gap-1"><Button variant="outline" size="sm" onClick={()=>exportReturns('csv')}><Download className="h-4 w-4 mr-1"/>CSV</Button><Button variant="outline" size="sm" onClick={()=>exportReturns('excel')}><FileText className="h-4 w-4 mr-1"/>Excel</Button><Button variant="outline" size="sm" onClick={()=>exportReturns('print')}><Printer className="h-4 w-4 mr-1"/>Print</Button></div>
          <Button onClick={()=>setShowNew(true)}><Plus className="h-4 w-4 mr-2"/>New Return</Button>
        </div>
      </div>

      {/* Dashboard KPIs */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Clock className="h-3 w-3"/>Returns Today</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{kpi?.sales?.returnsToday ?? kpi?.returnsToday ?? 0}</div><div className="text-xs text-muted-foreground">Sales + Purchase</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Users className="h-3 w-3"/>Sales Returns</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{unified.filter((r:any)=>r?._type==='SALES').length}</div><div className="text-xs text-muted-foreground">{kpi?.sales?.total ?? 0} sale returns total</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Truck className="h-3 w-3"/>Purchase Returns</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{unified.filter((r:any)=>r?._type==='PURCHASE').length}</div><div className="text-xs text-muted-foreground">{kpi?.purchase?.total ?? 0} supplier</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Pending Approval</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{(kpi?.sales?.pendingApproval ?? 0)+(kpi?.purchase?.pendingApproval ?? 0)}</div><div className="text-xs text-muted-foreground">Require manager</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><DollarSign className="h-3 w-3"/>Pending Refund/Credit</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{(kpi?.sales?.pendingRefund ?? 0)+(kpi?.purchase?.pendingCredit ?? 0)}</div><div className="text-xs text-muted-foreground">Finance queue</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Layers className="h-3 w-3"/>Returned Value</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">UGX {Number(((kpi?.sales?.returnedValue ?? 0)+(kpi?.purchase?.totalValue ?? 0)).toFixed(0)).toLocaleString()}</div><div className="text-xs text-muted-foreground">This period</div></CardContent></Card>
      </div>
      {kpi?.sales?.byReason && <Card><CardContent className="p-3 flex flex-wrap gap-2 text-xs">{Object.entries(kpi.sales.byReason as any).slice(0,6).map(([k,v]:any)=><Badge key={k} variant="outline">{k}: {(v as any).count} (UGX {Number((v as any).value).toLocaleString()})</Badge>)}<span className="text-muted-foreground">— Damaged/Expired/Wrong Product/Quality help ops</span></CardContent></Card>}

      {/* Filters */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search return #, sale/PO/GRN, customer/supplier, product, SKU, barcode, batch..." value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div>
          <Button variant="outline" onClick={()=>{setQ(""); setTypeFilter("all"); setStatusFilter("all"); setReasonFilter("all"); setRefundFilter("all"); setBranchFilter("all"); setDateFrom(""); setDateTo(""); setPage(1);}}>Reset</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value); setPage(1);}} className="w-[140px]"><option value="all">All Types</option><option value="sales">Sales Returns</option><option value="purchase">Purchase Returns</option></Select>
          <Select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value); setPage(1);}} className="w-[160px]"><option value="all">All Status</option><option value="pending">Draft/Pending</option><option value="approved">Approved</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></Select>
          <Select value={reasonFilter} onChange={e=>{setReasonFilter(e.target.value); setPage(1);}} className="w-[150px]"><option value="all">All Reasons</option>{reasons.map(r=> <option key={r} value={r}>{r}</option>)}</Select>
          <Select value={refundFilter} onChange={e=>{setRefundFilter(e.target.value); setPage(1);}} className="w-[150px]"><option value="all">Refund/Credit All</option><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option><option value="PARTIAL">Partial</option></Select>
          <Select value={branchFilter} onChange={e=>{setBranchFilter(e.target.value); setPage(1);}} className="w-[150px]"><option value="all">All Branches</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value); setPage(1);}} className="w-[140px]"/>
          <Input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value); setPage(1);}} className="w-[140px]"/>
        </div>
      </CardContent></Card>

      {/* List */}
      <Card><CardContent className="p-0">
        {err && <div className="p-3 text-sm text-destructive">{err}</div>}
        {loading ? <div className="p-6 space-y-2">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : unified.length===0 ? <div className="py-12 text-center space-y-1"><p className="text-muted-foreground">No returns yet. Sales and supplier returns will appear here.</p><p className="text-xs text-muted-foreground">Try changing search or date range.</p></div>
        : <>
          <div className="hidden lg:block overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Return #</TableHead><TableHead>Type</TableHead><TableHead>Original</TableHead><TableHead>Counterparty</TableHead><TableHead>Date</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Refund/Credit</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {unified.filter(Boolean).slice((page-1)*perPage, page*perPage).map((r:any)=>{
              const qty=(r.return_items?? r.purchase_return_items??[]).reduce((a:any,it:any)=>a+Number(it.quantity),0);
              const itemsCount=(r.return_items?? r.purchase_return_items??[]).length;
              return (
                <TableRow key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={()=>openDetail(r)}>
                  <TableCell className="font-mono text-xs">{r?.return_number}</TableCell>
                  <TableCell>{r?._type==='SALES'? <Badge variant="secondary">Sales</Badge> : <Badge variant="outline">Purchase</Badge>}</TableCell>
                  <TableCell className="font-mono text-xs">{r?._orig?.slice(0,8)}<div className="text-[10px]">{r.sale_number ?? r.grn_number ?? ''}</div></TableCell>
                  <TableCell className="text-xs">{r?._counterparty}</TableCell>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs">{itemsCount}</TableCell>
                  <TableCell className="text-right">{qty}</TableCell>
                  <TableCell className="text-right font-mono">UGX {Number(r.total).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{r?.reason_category ?? r?.reason ?? '—'}</TableCell>
                  <TableCell>{rBadge(r?.status)}</TableCell>
                  <TableCell>{refundBadge(r?.refund_status ?? r?.credit_status)}</TableCell>
                  <TableCell className="text-xs">{r?.branch_id?.slice(0,6)}</TableCell>
                  <TableCell className="text-right" onClick={e=>e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={()=>openDetail(r)}><Eye className="h-4 w-4"/></Button>
                    {r?.status==='pending' && <Button variant="ghost" size="icon" onClick={()=>handleStatus(r,'approve')} title="Approve"><CheckCircle className="h-4 w-4"/></Button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody></Table></div>

          <div className="lg:hidden p-3 grid gap-3">
            {unified.filter(Boolean).slice((page-1)*perPage, page*perPage).map((r:any)=>{
              const qty=(r.return_items?? r.purchase_return_items??[]).reduce((a:any,it:any)=>a+Number(it.quantity),0);
              return (
                <Card key={r.id} className="cursor-pointer" onClick={()=>openDetail(r)}><CardContent className="p-3 space-y-2">
                  <div className="flex justify-between"><span className="font-mono text-xs">{r?.return_number}</span>{rBadge(r?.status)}</div>
                  <div className="flex justify-between text-xs"><span>{r?._type==='SALES'?'Sales':'Purchase'} → {r?._counterparty}</span><span>UGX {Number(r.total).toLocaleString()}</span></div>
                  <div className="text-xs">{r?.reason ?? ''} • {qty} units • {r?.refund_status ?? r?.credit_status ?? ''}</div>
                  <div className="flex gap-2" onClick={e=>e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="flex-1" onClick={()=>openDetail(r)}><Eye className="h-4 w-4 mr-1"/>View</Button>
                    {r?._type==='SALES' && <Button size="sm" variant="outline" onClick={()=>handleStatus(r,'approve')}><CheckCircle className="h-4 w-4"/></Button>}
                  </div>
                </CardContent></Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} • {count} total • Pending Sync {pendingCount}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</Button><Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
          </div>
        </>}
      </CardContent></Card>

      {/* Create Return */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>New Return</DialogTitle><DialogDescription>Choose Sales (customer→ refund) or Purchase (supplier→ credit). Validates max returnable, batch, inventory destination.</DialogDescription></DialogHeader>
          <Tabs defaultValue="SALES">
            <TabsList className="w-full grid grid-cols-2"><TabsTrigger value="SALES" active={newType==='SALES'} onClick={()=>setNewType('SALES')}>Sales Return</TabsTrigger><TabsTrigger value="PURCHASE" active={newType==='PURCHASE'} onClick={()=>setNewType('PURCHASE')}>Purchase Return</TabsTrigger></TabsList>
            <TabsContent value={newType} className="mt-4 space-y-4">
              {newType==='SALES' ? (
                <>
                  <div className="flex gap-2"><Input placeholder="Sale ID / sale_number / receipt" value={saleId} onChange={e=>setSaleId(e.target.value)}/><Button onClick={fetchSale}>Load Sale</Button><Button variant="outline" onClick={()=>setShowBarcode(true)}><ScanLine className="h-4 w-4 mr-1"/>Scan</Button></div>
                  {saleDetail && (
                    <div className="space-y-3">
                      <Card><CardContent className="p-3 text-sm space-y-1"><div>Sale {saleDetail.sale_number} — {new Date(saleDetail.sold_at).toLocaleString()} — UGX {Number(saleDetail.total).toLocaleString()} — {saleDetail.customers?.name ?? 'Walk-in'}</div><div className="text-xs text-muted-foreground">Branch {saleDetail.branch_id?.slice(0,6)} • Items {saleDetail.sale_items?.length} • Outstanding returnable enforced server-side</div></CardContent></Card>
                      <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Sold</TableHead><TableHead>Qty</TableHead><TableHead>Reason</TableHead><TableHead>Condition</TableHead><TableHead>Dest</TableHead></TableRow></TableHeader><TableBody>
                        {(saleDetail.sale_items ?? []).map((it:any)=>{
                          const max=Number(it.quantity);
                          return (
                            <TableRow key={it.id}>
                              <TableCell className="text-sm">{it.products?.name ?? it.product_id.slice(0,8)}<div className="text-xs text-muted-foreground">{it.products?.sku ?? ''} • UGX {Number(it.unit_price).toLocaleString()}</div></TableCell>
                              <TableCell className="font-mono text-xs">{it.batch_id?.slice(0,8)}</TableCell>
                              <TableCell className="text-right">{max}</TableCell>
                              <TableCell><Input type="number" min={0} max={max} value={saleQty[it.id] ?? 0} onChange={e=>setSaleQty(s=>({...s, [it.id]: Math.min(max, Math.max(0, Number(e.target.value)))}))} className="w-20"/></TableCell>
                              <TableCell><Select value={saleReason[it.id] ?? commonReason} onChange={e=>setSaleReason(s=>({...s, [it.id]: e.target.value}))} className="w-[140px]"><option>Customer Return</option>{reasons.map(r=> <option key={r} value={r}>{r}</option>)}</Select></TableCell>
                              <TableCell><Select value={saleCond[it.id] ?? "SELLABLE"} onChange={e=>{ const v=e.target.value; setSaleCond(s=>({...s, [it.id]: v})); setSaleDest(d=>({...d, [it.id]: v==='SELLABLE'?'SALEABLE':'QUARANTINE'})); }} className="w-[130px]"><option value="SELLABLE">Sealed/Resalable</option><option value="DAMAGED">Damaged</option><option value="EXPIRED">Expired</option><option value="NEAR_EXPIRY">Near Expiry</option><option value="QUALITY_ISSUE">Quality</option></Select></TableCell>
                              <TableCell><Badge variant={(saleDest[it.id]??'SALEABLE')==='SALEABLE'?'success':'warning'}>{saleDest[it.id] ?? 'SALEABLE'}</Badge><div className="text-[10px]">{(saleDest[it.id]??'SALEABLE')==='SALEABLE'?'→ batch +3 saleable':'→ quarantine, not saleable'}</div></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody></Table>
                      <div className="grid md:grid-cols-2 gap-2"><div><Label>Overall Reason</Label><Select value={commonReason} onChange={e=>setCommonReason(e.target.value)}><option>Customer Return</option>{reasons.map(r=> <option key={r} value={r}>{r}</option>)}</Select></div><div><Label>Refund Method</Label><Select value={refundMethod} onChange={e=>setRefundMethod(e.target.value)}>{refundMethods.map(m=> <option key={m} value={m}>{m}</option>)}</Select></div></div>
                      <p className="text-xs text-muted-foreground">Historical price used: {saleDetail.sale_items?.[0]?.subtotal ? `UGX ${(Number(saleDetail.sale_items[0].subtotal)/Number(saleDetail.sale_items[0].quantity)).toFixed(0)}/unit` : ''} • SELLABLE → SALE_RETURN + batch, else → QUARANTINE/DAMAGED per pharmacy safety</p>
                      <Button onClick={submitSalesReturn} disabled={submitting} className="w-full">{submitting? 'Submitting...': <><RotateCcw className="h-4 w-4 mr-2"/>Submit Sales Return</>}</Button>
                      {!isOnline && <p className="text-xs text-amber-600 text-center">Offline — queued Pending Sync, idempotent by operation_id</p>}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex gap-2"><Input placeholder="Purchase Order ID / PO number / GRN" value={poId} onChange={e=>setPoId(e.target.value)}/><Button onClick={fetchPO}>Load Purchase</Button><Button variant="outline" onClick={()=>setShowBarcode(true)}><ScanLine className="h-4 w-4 mr-1"/>Scan</Button></div>
                  {poDetail && (
                    <div className="space-y-3">
                      <Card><CardContent className="p-3 text-sm"><div>PO {poDetail.purchase_number} — Supplier {poDetail.suppliers?.name ?? poDetail.supplier_id?.slice(0,8)} — UGX {Number(poDetail.total).toLocaleString()}</div><div className="text-xs text-muted-foreground">Branch {poDetail.branch_id?.slice(0,6)} • Received quantities determine returnable</div></CardContent></Card>
                      <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Ordered/Recv</TableHead><TableHead>Qty Return</TableHead><TableHead>Batch ID</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader><TableBody>
                        {(poDetail.purchase_items ?? []).map((it:any)=>{
                          const ord=Number(it.quantity_ordered ?? it.quantity ?? 0); const recv=Number(it.quantity_received ?? ord);
                          return (
                            <TableRow key={it.id}>
                              <TableCell className="text-sm">{it.products?.name ?? it.product_id.slice(0,8)}<div className="text-xs">Cost UGX {Number(it.unit_cost).toLocaleString()}</div></TableCell>
                              <TableCell className="text-xs">{(poDetail.batches??[]).find((b:any)=>b.product_id===it.product_id)?.batch_number ?? '—'}</TableCell>
                              <TableCell className="text-right text-xs">{ord}/{recv}</TableCell>
                              <TableCell><Input type="number" min={0} max={recv} value={prQty[it.id] ?? 0} onChange={e=>setPrQty(s=>({...s, [it.id]: Math.min(recv, Math.max(0, Number(e.target.value)))}))} className="w-20"/></TableCell>
                              <TableCell><Input placeholder="batch uuid" value={prBatch[it.id] ?? ""} onChange={e=>setPrBatch(s=>({...s, [it.id]: e.target.value}))} className="w-[140px]"/></TableCell>
                              <TableCell><Select value={prReason[it.id] ?? commonReason} onChange={e=>setPrReason(s=>({...s, [it.id]: e.target.value}))} className="w-[130px]"><option>Damaged</option>{reasons.map(r=> <option key={r} value={r}>{r}</option>)}</Select></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody></Table>
                      <div><Label>Overall Reason</Label><Select value={commonReason} onChange={e=>setCommonReason(e.target.value)}><option>Damaged</option>{reasons.map(r=> <option key={r} value={r}>{r}</option>)}</Select></div>
                      <p className="text-xs text-muted-foreground">Batch validation: received 100, returned 20 → remaining 80 max. Supplier credit = qty × historical unit_cost (never current). Near-expiry batches: stockroom mobile scan flow.</p>
                      <Button onClick={submitPurchaseReturn} disabled={submitting} className="w-full">{submitting? 'Submitting...': <><Truck className="h-4 w-4 mr-2"/>Submit Purchase Return</>}</Button>
                      {!isOnline && <p className="text-xs text-amber-600 text-center">Offline — queued, server revalidates stale batch stock</p>}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={!!showDetail} onOpenChange={(o)=>!o && setShowDetail(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{showDetail?.return_number} <span className="text-sm font-normal">{showDetail?._type==='SALES'?'Sales Return':'Purchase Return'}</span> {showDetail && rBadge(showDetail.status)}</DialogTitle>
            <DialogDescription>Original {showDetail?._type==='SALES' ? `Sale ${showDetail?._orig?.slice(0,8) ?? ''} → customer ${showDetail?._counterparty ?? ''}` : `Purchase ${showDetail?._orig?.slice(0,8) ?? ''} → supplier ${showDetail?._counterparty ?? ''}`} • Branch {showDetail?.branch_id?.slice(0,6)} • {showDetail?.refund_status ?? showDetail?.credit_status ? `Refund/Credit ${showDetail?.refund_status ?? showDetail?.credit_status}` : ''}</DialogDescription>
          </DialogHeader>
          {!detailData ? <div className="space-y-3"><Skeleton className="h-24 w-full"/><Skeleton className="h-64 w-full"/></div> : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(detailData.status==='pending' || detailData.status==='draft') && <><Button size="sm" onClick={()=>handleStatus(showDetail,'approve')} disabled={submitting}>Approve</Button><Button size="sm" variant="outline" onClick={()=>handleStatus(showDetail,'reject')} disabled={submitting}>Reject</Button><Button size="sm" variant="ghost" onClick={()=>handleStatus(showDetail,'cancel')} disabled={submitting}>Cancel</Button></>}
                {detailData.status==='approved' && <Button size="sm" onClick={()=>handleStatus(showDetail,'completed')} disabled={submitting}>Post / Complete</Button>}
                {detailData.status==='completed' && <><Button size="sm" variant="outline" onClick={()=>window.print()}><Printer className="h-4 w-4 mr-1"/>Print</Button><Button size="sm" variant="outline" onClick={()=>exportReturns('print')}><FileText className="h-4 w-4 mr-1"/>Export</Button></>}
                <Button size="sm" variant="outline" onClick={()=>{window.open(detailData._type==='SALES'? `/sales?id=${detailData.sale_id}` : `/purchases?id=${detailData.purchase_order_id}`,'_blank')}}>View Original {detailData._type==='SALES'?'Sale':'Purchase'}</Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Return #</span><span className="font-mono">{detailData.return_number}</span></div>
                  <div className="flex justify-between"><span>Status</span>{rBadge(detailData.status)}</div>
                  <div className="flex justify-between"><span>Refund/Credit</span>{refundBadge(detailData.refund_status ?? detailData.credit_status)}</div>
                  <div className="flex justify-between"><span>Reason</span><span>{detailData.reason_category ?? detailData.reason}</span></div>
                  <div className="flex justify-between"><span>Total</span><span className="font-bold">UGX {Number(detailData.total).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Created</span><span>{new Date(detailData.created_at).toLocaleString()} by {String(detailData.created_by??'').slice(0,6)}</span></div>
                  {detailData.approved_by && <div className="flex justify-between"><span>Approved</span><span>{String(detailData.approved_by).slice(0,6)} {detailData.approved_at? new Date(detailData.approved_at).toLocaleDateString():''}</span></div>}
                </CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Financial & Inventory</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Value</span><span>UGX {Number(detailData.total).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Inventory</span><span>{(detailData.return_items?? detailData.purchase_return_items??[]).reduce((a:any,it:any)=>a+Number(it.quantity),0)} units → {(detailData.return_items?.[0]?.inventory_destination ?? detailData.inventory_destination ?? 'QUARANTINE')}</span></div>
                  <div className="flex justify-between"><span>Movement</span><span className="font-mono text-xs">{(detailData.stock_movements??[])[0]?.id?.slice(0,8) ?? '—'} {detailData.stock_movements?.length? `(${detailData.stock_movements.length} moves)`:''}</span></div>
                  {detailData._type==='PURCHASE' && <div className="flex justify-between"><span>Supplier Credit</span><span>{detailData.credit_status==='COMPLETED'? 'Received': detailData.credit_status ?? 'PENDING'}</span></div>}
                  {detailData._type==='SALES' && <div className="flex justify-between"><span>Refund</span><span>{detailData.refund_status}</span></div>}
                </CardContent></Card>
              </div>

              <Tabs defaultValue="items">
                <TabsList className="flex flex-wrap h-auto">
                  <TabsTrigger value="items" active={detailTab==='items'} onClick={()=>setDetailTab('items')}>Items</TabsTrigger>
                  <TabsTrigger value="inventory" active={detailTab==='inventory'} onClick={()=>setDetailTab('inventory')}>Inventory</TabsTrigger>
                  <TabsTrigger value="financial" active={detailTab==='financial'} onClick={()=>setDetailTab('financial')}>Financial</TabsTrigger>
                  <TabsTrigger value="timeline" active={detailTab==='timeline'} onClick={()=>setDetailTab('timeline')}>Timeline</TabsTrigger>
                  <TabsTrigger value="audit" active={detailTab==='audit'} onClick={()=>setDetailTab('audit')}>Audit</TabsTrigger>
                </TabsList>
                <TabsContent value={detailTab} className="mt-4">
                  {detailTab==='items' && (
                    <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit</TableHead><TableHead>Reason</TableHead><TableHead>Condition/Dest</TableHead></TableRow></TableHeader><TableBody>
                      {(detailData.return_items ?? detailData.purchase_return_items ?? []).map((it:any)=>(
                        <TableRow key={it.id}><TableCell className="text-sm">{it.products?.name ?? it.product_id?.slice(0,8)}<div className="text-xs text-muted-foreground">{it.products?.sku ?? ''}</div></TableCell><TableCell className="font-mono text-xs">{it.batch_id?.slice(0,8)}<div className="text-[10px]">{it.batch_number ?? ''}</div></TableCell><TableCell className="text-xs">{it.expiry_date ?? it.batches?.expiry_date ?? '—'}</TableCell><TableCell className="text-right">{it.quantity}</TableCell><TableCell className="text-right">UGX {Number(it.amount ? Number(it.amount)/Number(it.quantity) : it.unit_cost ?? 0).toLocaleString()}</TableCell><TableCell className="text-xs">{it.reason_category ?? it.reason ?? '—'}</TableCell><TableCell className="text-xs">{it.condition ?? it.inventory_destination ?? '—'}<div className="text-[10px]">{it.inventory_destination ?? ''}</div></TableCell></TableRow>
                      ))}
                    </TableBody></Table>
                  )}
                  {detailTab==='inventory' && (
                    <div className="space-y-2">
                      {(detailData.stock_movements??[]).length===0 ? <p className="text-sm text-muted-foreground">No movements yet — post return to create STOCK_MOVEMENT (never stock = stock - qty without ledger)</p> :
                        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Ref</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.stock_movements??[]).map((m:any)=><TableRow key={m.id}><TableCell className="text-xs">{new Date(m.created_at).toLocaleString()}</TableCell><TableCell className="text-xs">{m.product_id?.slice(0,8)}</TableCell><TableCell className="font-mono text-xs">{m.batch_id?.slice(0,8)}</TableCell><TableCell><Badge variant="outline">{m.movement_type}</Badge></TableCell><TableCell className="text-right">{Number(m.quantity)>0? `+${m.quantity}`: m.quantity}</TableCell><TableCell className="font-mono text-xs">{m.reference_id?.slice(0,8)}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <p className="text-xs text-muted-foreground">FEFO preserved: original batch/expiry intact — SALEABLE increments batch, otherwise quarantine.</p>
                    </div>
                  )}
                  {detailTab==='financial' && (
                    <div className="space-y-3">
                      {detailData._type==='SALES' ? (
                        <div className="space-y-2">
                          {(detailData.refunds??[]).length===0 ? <p className="text-sm text-muted-foreground">No refund yet — {detailData.refund_status} (separate from Return status)</p> :
                            <Table><TableHeader><TableRow><TableHead>Refund #</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                              {(detailData.refunds??[]).map((r:any)=><TableRow key={r.id}><TableCell className="font-mono text-xs">{r.refund_number}</TableCell><TableCell>{r.payment_method}</TableCell><TableCell className="text-right">UGX {Number(r.amount).toLocaleString()}</TableCell><TableCell>{rBadge(r?.status)}</TableCell></TableRow>)}
                            </TableBody></Table>
                          }
                          <div className="flex gap-2"><Input placeholder="Refund amount" id="refund-amt" className="w-[140px]"/><Select id="refund-method" className="w-[140px]"><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="CARD">Card</option><option value="BANK">Bank</option></Select><Button size="sm" onClick={async()=>{
                            const amt=Number((document.getElementById('refund-amt') as HTMLInputElement)?.value);
                            const method=(document.getElementById('refund-method') as HTMLSelectElement)?.value ?? 'CASH';
                            if(!amt) return alert("Amount");
                            const r=await fetch("/api/returns",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:'refund', return_id: detailData.id, sale_id: detailData.sale_id, branch_id: detailData.branch_id, amount: amt, payment_method: method, operation_id: crypto.randomUUID()})});
                            const j=await r.json(); if(!r.ok) alert(j.error); else { alert("Refund pending"); openDetail(showDetail); }
                          }}>Create Refund</Button></div>
                          <p className="text-xs text-muted-foreground">Refund uses original sale price (discount/tax preserved), not current product price.</p>
                        </div>
                      ) : (
                        <div className="space-y-2"><p className="text-sm">Purchase return value UGX {Number(detailData.total).toLocaleString()} → Supplier credit {detailData.credit_status ?? 'PENDING'} (separate: goods returned ≠ credit received). Credit may be applied to payable (AP) or refunded.</p><p className="text-xs text-muted-foreground">Inventory -qty already posted via PURCHASE_RETURN movement; replacement via future GRN.</p></div>
                      )}
                    </div>
                  )}
                  {detailTab==='timeline' && (
                    <div className="space-y-2 text-sm">
                      {[
                        {label:'Created', date: detailData.created_at, user: detailData.created_by},
                        {label:'Submitted', date: detailData.submitted_at},
                        {label:'Approved', date: detailData.approved_at, user: detailData.approved_by},
                        {label:'Completed', date: detailData.completed_at},
                        ...(detailData.stock_movements??[]).map((m:any)=>({label:`Movement ${m.movement_type}`, date:m.created_at, user:m.created_by})),
                      ].filter(x=>x.date).sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime()).map((ev:any,i:number)=>
                        <div key={i} className="flex gap-3 border-l-2 border-muted pl-3 py-1"><div className="font-medium">{ev.label}</div><div className="text-muted-foreground">{new Date(ev.date).toLocaleString()} {ev.user? `by ${String(ev.user).slice(0,6)}`:''}</div></div>
                      )}
                      {(detailData.stock_movements?.length===0) && <p className="text-xs text-muted-foreground">Stock movement appears after Post.</p>}
                    </div>
                  )}
                  {detailTab==='audit' && (
                    <div className="space-y-2">
                      {(detailData.audit_logs??[]).length===0 ? <p className="text-sm text-muted-foreground">Audit: created_by/approved_by/posted_by with timestamps — no silent edits of completed returns.</p> :
                        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Change</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.audit_logs??[]).map((a:any)=><TableRow key={a.id}><TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell><TableCell className="font-mono text-xs">{a.action}</TableCell><TableCell className="text-xs">{String(a.created_by??'').slice(0,6)}</TableCell><TableCell className="text-xs truncate max-w-[200px]">{JSON.stringify(a.new_values??'').slice(0,100)}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode dialog */}
      <Dialog open={showBarcode} onOpenChange={setShowBarcode}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5"/>Scan Barcode</DialogTitle><DialogDescription>Scan product or receipt — reuses existing product/barcode infrastructure.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <video id="barcode-video" className="w-full rounded border bg-black aspect-video" muted playsInline />
            <Input placeholder="Or type SKU/barcode" onKeyDown={e=>{ if(e.key==='Enter'){ const val=(e.target as HTMLInputElement).value.trim(); if(val){ const prod=(products as any[]).find((p:any)=> p.sku===val || p.barcode===val); if(prod) alert(`Found ${prod.name}`); setShowBarcode(false); } } }} />
            <Button variant="outline" className="w-full" onClick={()=>{ const v=document.getElementById('barcode-video') as HTMLVideoElement|null; (v?.srcObject as MediaStream)?.getTracks().forEach(t=>t.stop()); setShowBarcode(false); }}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground text-center">Returns orchestrate Inventory/Payment/Accounting/Product/Batch/Supplier/Customer — not replace them. Branch-scoped, permission-gated, idempotent by operation_id, inventory via stock_movements, financial via refunds/credits.</p>
    </div>
  );
}
