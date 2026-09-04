"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Plus, Eye, Truck, Trash2, Wifi, WifiOff, RefreshCw, Download, CreditCard, Undo2, Layers, TrendingUp, Package, Building2, Users, FileText, History } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { queuePurchaseCreate, queuePurchaseReceive, getPurchasePendingCount } from "@/lib/offline/sync";

type Purchase = { id:string; purchase_number:string; supplier_id:string; branch_id:string; status:string; total:number; subtotal?:number; discount?:number; tax?:number; created_at:string; ordered_at?:string; received_at?:string; suppliers?:{name:string}; branches?:{name:string}; purchase_items?:any[] };
type Line = { product_id:string; product_name?:string; quantity_ordered:number; unit_cost:number; discount:number; tax:number };

export default function PurchasesPage(){
  const { isOnline } = useOnlineStatus();
  const [loading,setLoading]=React.useState(true);
  const [tab,setTab]=React.useState("all");
  const [q,setQ]=React.useState("");
  const [debouncedQ,setDebouncedQ]=React.useState("");
  const [supplierFilter,setSupplierFilter]=React.useState("all");
  const [branchFilter,setBranchFilter]=React.useState("all");
  const [dateFrom,setDateFrom]=React.useState("");
  const [dateTo,setDateTo]=React.useState("");
  const [page,setPage]=React.useState(1);
  const [data,setData]=React.useState<Purchase[]>([]);
  const [count,setCount]=React.useState(0);
  const [kpi,setKpi]=React.useState<any>(null);
  const [suppliers,setSuppliers]=React.useState<any[]>([]);
  const [products,setProducts]=React.useState<any[]>([]);
  const [branches,setBranches]=React.useState<any[]>([]);
  const [showCreate,setShowCreate]=React.useState(false);
  const [showDetail,setShowDetail]=React.useState<Purchase|null>(null);
  const [detailData,setDetailData]=React.useState<any>(null);
  const [detailTab,setDetailTab]=React.useState("overview");
  const [showReceive,setShowReceive]=React.useState<Purchase|null>(null);
  const [receiveDetail,setReceiveDetail]=React.useState<any>(null);
  const [form,setForm]=React.useState<{supplier_id:string; branch_id:string; expected_delivery_date:string; currency:string; payment_terms:string; notes:string; lines:Line[]}>({supplier_id:"", branch_id:"", expected_delivery_date:"", currency:"UGX", payment_terms:"", notes:"", lines:[{product_id:"", quantity_ordered:1, unit_cost:0, discount:0, tax:0}]});
  const [receiveGroups,setReceiveGroups]=React.useState<any[]>([]);
  const [pendingCount,setPendingCount]=React.useState(0);
  const [paymentForm,setPaymentForm]=React.useState({amount:"", method:"CASH", reference:""});
  const [returnForm,setReturnForm]=React.useState<{items:any[]; reason:string}>({items:[], reason:""});
  const [attachForm,setAttachForm]=React.useState({document_type:"SUPPLIER_INVOICE", file_name:"", file_url:""});
  const perPage=20;

  React.useEffect(()=>{ const id=setTimeout(()=>setDebouncedQ(q),300); return ()=>clearTimeout(id); },[q]);
  React.useEffect(()=>{
    getPurchasePendingCount().then(c=>setPendingCount(c)).catch(()=>{});
    const id=setInterval(()=> getPurchasePendingCount().then(c=>setPendingCount(c)).catch(()=>{}), 5000);
    return ()=>clearInterval(id);
  },[]);

  const fetchAll=React.useCallback(async()=>{
    setLoading(true);
    const params=new URLSearchParams();
    if(tab!=="all") params.set("status", tab.toUpperCase());
    if(supplierFilter!=="all") params.set("supplier_id", supplierFilter);
    if(branchFilter!=="all") params.set("branch_id", branchFilter);
    if(debouncedQ) params.set("search", debouncedQ);
    if(dateFrom) params.set("date_from", dateFrom);
    if(dateTo) params.set("date_to", dateTo);
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    const [pr, sr, prd, br, kpiRes]=await Promise.all([
      fetch(`/api/purchases?${params.toString()}`).then(r=>r.json()).catch(()=>({data:[], count:0})),
      fetch("/api/suppliers").then(r=>r.json()).catch(()=>[]),
      fetch("/api/products").then(r=>r.json()).catch(()=>[]),
      fetch("/api/settings").then(r=>r.json()).catch(()=>({branches:[]})),
      fetch(`/api/purchases?kpi=1${branchFilter!=="all"?`&branch_id=${branchFilter}`:""}`).then(r=>r.json()).catch(()=>null),
    ]);
    setData(pr.data ?? pr ?? []);
    setCount(pr.count ?? (pr.data?.length ?? 0));
    setSuppliers(Array.isArray(sr)?sr:[]);
    const prodList = Array.isArray(prd)?prd: (prd.data ?? []);
    setProducts(prodList);
    setBranches(br.branches ?? []);
    if(kpiRes) setKpi(kpiRes);
    if(!form.branch_id && br.branches?.[0]) setForm(f=>({...f, branch_id: br.branches[0].id}));
    if(!form.supplier_id && sr[0]) setForm(f=>({...f, supplier_id: sr[0].id}));
    setLoading(false);
  },[tab, supplierFilter, branchFilter, debouncedQ, dateFrom, dateTo, page]);
  React.useEffect(()=>{ fetchAll(); },[fetchAll]);

  const addLine=()=> setForm({...form, lines:[...form.lines, {product_id:"", quantity_ordered:1, unit_cost:0, discount:0, tax:0}]});
  const updateLine=(i:number, patch:Partial<Line>)=> setForm({...form, lines: form.lines.map((l,idx)=> idx===i ? {...l, ...patch}: l)});
  const removeLine=(i:number)=> setForm({...form, lines: form.lines.filter((_,idx)=>idx!==i)});

  const submitCreate=async()=>{
    if(!form.supplier_id || !form.branch_id) return alert("Select supplier & branch");
    if(form.lines.some(l=>!l.product_id || l.quantity_ordered<=0)) return alert("Fill product & quantity for each line");
    const payload = {branch_id: form.branch_id, supplier_id: form.supplier_id, items: form.lines, expected_delivery_date: form.expected_delivery_date || undefined, currency: form.currency, payment_terms: form.payment_terms || undefined, notes: form.notes || undefined };
    if(!isOnline){
      await queuePurchaseCreate(payload as any);
      alert("Offline — purchase queued locally. Will sync when online. Status: Pending Sync");
      setShowCreate(false);
      setForm({supplier_id: suppliers[0]?.id ?? "", branch_id: branches[0]?.id ?? form.branch_id, expected_delivery_date:"", currency:"UGX", payment_terms:"", notes:"", lines:[{product_id:"", quantity_ordered:1, unit_cost:0, discount:0, tax:0}]});
      setPendingCount(c=>c+1);
      return;
    }
    const r=await fetch("/api/purchases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setShowCreate(false); setForm({supplier_id: suppliers[0]?.id ?? "", branch_id: branches[0]?.id ?? form.branch_id, expected_delivery_date:"", currency:"UGX", payment_terms:"", notes:"", lines:[{product_id:"", quantity_ordered:1, unit_cost:0, discount:0, tax:0}]}); fetchAll(); }
  };

  const openDetail=async(p:Purchase)=>{
    setShowDetail(p);
    setDetailTab("overview");
    const r=await fetch(`/api/purchases?id=${p.id}`);
    const j=await r.json();
    setDetailData(j);
  };
  const openReceive=async(p:Purchase)=>{
    setShowReceive(p);
    const r=await fetch(`/api/purchases?id=${p.id}`);
    const j=await r.json();
    setReceiveDetail(j);
    const items=j.purchase_items ?? j.items ?? [];
    setReceiveGroups(items.map((it:any)=>({
      purchase_item_id: it.id, product_id: it.product_id, product_name: it.products?.name ?? products.find(pr=>pr.id===it.product_id)?.name ?? it.product_id.slice(0,8),
      quantity_ordered: it.quantity_ordered, quantity_received: it.quantity_received ?? 0, remaining: it.quantity_ordered - (it.quantity_received ?? 0),
      batches: [{ batch_number:"", expiry_date:"", quantity_received: Math.max(0, it.quantity_ordered - (it.quantity_received ?? 0)), unit_cost: it.unit_cost, selling_price: Math.round(it.unit_cost*1.5*100)/100 }]
    })));
  };

  const submitReceive=async()=>{
    if(!showReceive) return;
    // flatten batches that have qty>0
    const flat:any[]=[];
    for(const g of receiveGroups){
      for(const b of g.batches){
        if(!b.quantity_received || Number(b.quantity_received)<=0) continue;
        const qty = Number(b.quantity_received);
        if(qty > g.remaining + g.quantity_received){
          // over-receiving warning but allow
        }
        if(!b.batch_number || !b.expiry_date) return alert(`Batch number & expiry required for ${g.product_name}`);
        // expiry validation client side
        const exp=new Date(b.expiry_date); const today=new Date(); today.setHours(0,0,0,0);
        if(isNaN(exp.getTime())) return alert(`Invalid expiry for ${g.product_name} batch ${b.batch_number}`);
        if(exp <= today) return alert(`Batch ${b.batch_number} already expired`);
        flat.push({
          purchase_item_id: g.purchase_item_id, product_id: g.product_id, quantity_received: qty, unit_cost: Number(b.unit_cost), batch_number: b.batch_number.trim(), expiry_date: b.expiry_date, supplier_id: showReceive.supplier_id, selling_price: Number(b.selling_price)
        });
      }
    }
    if(flat.length===0) return alert("Enter quantity for at least one batch");
    if(!isOnline){
      await queuePurchaseReceive({ purchase_order_id: showReceive.id, received_items: flat } as any);
      alert("Offline — receipt queued. Inventory will update when online. Idempotent via operation_id.");
      setShowReceive(null);
      setPendingCount(c=>c+1);
      return;
    }
    const r=await fetch("/api/purchases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"receive", purchase_order_id: showReceive.id, received_items: flat})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else {
      if(j.variances?.length) alert(`Received with ${j.variances.length} variance(s): `+ JSON.stringify(j.variances.slice(0,2)));
      setShowReceive(null); fetchAll();
      if(showDetail) openDetail(showReceive);
    }
  };

  const handleStatus=async(p:Purchase, status:string)=>{
    if(!confirm(`Change ${p.purchase_number} to ${status}?`)) return;
    const r=await fetch("/api/purchases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status", purchase_order_id:p.id, status})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else fetchAll();
  };
  const handleCancel=async(p:Purchase)=>{
    if(!confirm(`Cancel ${p.purchase_number}? This is irreversible if no stock received.`)) return;
    const r=await fetch("/api/purchases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"cancel", purchase_order_id:p.id})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else fetchAll();
  };

  const submitPayment=async()=>{
    if(!showDetail) return;
    const amt=Number(paymentForm.amount);
    if(!amt || amt<=0) return alert("Amount required");
    const r=await fetch("/api/supplier-payments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({supplier_id: showDetail.supplier_id, branch_id: showDetail.branch_id, purchase_order_id: showDetail.id, amount: amt, payment_method: paymentForm.method, reference: paymentForm.reference})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { alert("Payment recorded"); setPaymentForm({amount:"", method:"CASH", reference:""}); openDetail(showDetail); fetchAll(); }
  };
  const submitReturn=async()=>{
    if(!showDetail || !detailData) return;
    if(!returnForm.reason) return alert("Reason required");
    if(returnForm.items.length===0) return alert("Select items");
    const payload={purchase_order_id: showDetail.id, supplier_id: showDetail.supplier_id, branch_id: showDetail.branch_id, reason: returnForm.reason, items: returnForm.items };
    const r=await fetch("/api/purchase-returns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { alert("Return created pending approval"); setReturnForm({items:[], reason:""}); openDetail(showDetail); }
  };
  const submitAttachment=async()=>{
    if(!showDetail) return;
    if(!attachForm.file_name || !attachForm.file_url) return alert("File name and URL/file required");
    const r=await fetch("/api/purchase-attachments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({purchase_order_id: showDetail.id, file_name: attachForm.file_name, file_url: attachForm.file_url, document_type: attachForm.document_type})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { alert("Document attached"); setAttachForm({document_type:"SUPPLIER_INVOICE", file_name:"", file_url:""}); openDetail(showDetail); }
  };

  const badge=(s:string)=>{
    if(s==="DRAFT") return <Badge variant="secondary">Draft</Badge>;
    if(s==="PENDING_APPROVAL") return <Badge variant="warning">Pending Approval</Badge>;
    if(s==="APPROVED") return <Badge variant="warning">Approved</Badge>;
    if(s==="SENT") return <Badge variant="warning">Sent</Badge>;
    if(s==="ORDERED") return <Badge variant="warning">Ordered</Badge>;
    if(s==="PARTIALLY_RECEIVED") return <Badge className="bg-amber-500 text-white">Partial</Badge>;
    if(s==="RECEIVED") return <Badge variant="success">Received</Badge>;
    if(s==="CLOSED") return <Badge variant="success">Closed</Badge>;
    if(s==="CANCELLED") return <Badge variant="destructive">Cancelled</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  const totalPages=Math.max(1, Math.ceil(count/perPage));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6"/>Purchases</h1><p className="text-muted-foreground text-sm">SUPPLIER → PO → Approval → Delivery → GRN → Batch+Expiry → Inventory → Payable → Payment. PO ≠ Stock • GRN = Stock • Bill = Owed • Payment = Paid</p></div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={isOnline?"success":"warning"} className="gap-1">{isOnline ? <Wifi className="h-3 w-3"/> : <WifiOff className="h-3 w-3"/>}{isOnline?"Online":"Offline — Saved locally"}</Badge>
          {pendingCount>0 && <Badge variant="warning">{pendingCount} pending sync</Badge>}
          <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
          <Button onClick={()=>setShowCreate(true)}><Plus className="h-4 w-4 mr-2"/>New Purchase Order</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4"/>Purchases This Period</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">UGX {(kpi?.totalThisPeriod ?? 0).toLocaleString()}</div><p className="text-xs text-muted-foreground">{kpi?.totalCount ?? 0} orders • {new Date().toLocaleDateString(undefined,{month:'long'})}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4"/>Pending POs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{kpi?.pendingPOs ?? 0}</div><p className="text-xs text-muted-foreground">Draft + Ordered awaiting delivery</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4"/>Pending Receipts / Partial</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{kpi?.pendingReceipts ?? 0} <span className="text-sm font-normal text-muted-foreground">({kpi?.partially ?? 0} partial)</span></div><p className="text-xs text-muted-foreground">Outstanding quantities</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4"/>Unpaid / Returns</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">UGX {(kpi?.unpaidTotal ?? 0).toLocaleString()}</div><p className="text-xs text-muted-foreground">{kpi?.returnsCount ?? 0} returns this period • Supplier payable</p></CardContent></Card>
      </div>

      <Card className="mb-1"><CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search PO#, GRN batch, supplier, product, SKU, invoice..." value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div>
          <Button variant="outline" onClick={()=>{setQ(""); setSupplierFilter("all"); setBranchFilter("all"); setDateFrom(""); setDateTo(""); setTab("all"); setPage(1);}}>Clear Filters</Button>
          <Button variant="outline" size="sm" onClick={()=>{
            const header=["PO","Supplier","Branch","Date","Status","Total","Items"].join(",");
            const lines=data.map(p=>[p.purchase_number, p.suppliers?.name ?? "", p.branch_id.slice(0,6), new Date(p.created_at).toLocaleDateString(), p.status, p.total, (p.purchase_items?.length ?? "")].join(","));
            const csv=[header,...lines].join("\n"); const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`purchases_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
          }}><Download className="h-4 w-4 mr-1"/>Export</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={supplierFilter} onChange={e=>{setSupplierFilter(e.target.value); setPage(1);}} className="w-[180px]"><option value="all">All Suppliers</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name} {s.balance?` (UGX ${Number(s.balance).toLocaleString()})`:""}</option>)}</Select>
          <Select value={branchFilter} onChange={e=>{setBranchFilter(e.target.value); setPage(1);}} className="w-[160px]"><option value="all">All Branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value); setPage(1);}} className="w-[150px]" placeholder="From"/>
          <Input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value); setPage(1);}} className="w-[150px]" placeholder="To"/>
          <Badge variant="outline" className="flex items-center gap-1"><Building2 className="h-3 w-3"/>{count} orders</Badge>
        </div>
      </CardContent></Card>

      <Tabs defaultValue="all">
        <TabsList className="flex flex-wrap h-auto">{["all","DRAFT","PENDING_APPROVAL","APPROVED","SENT","ORDERED","PARTIALLY_RECEIVED","RECEIVED","CLOSED","CANCELLED"].map(id=>(
          <TabsTrigger key={id} value={id.toLowerCase()} active={tab===id.toLowerCase()} onClick={()=>{setTab(id.toLowerCase()); setPage(1);}}>{id.replace("_"," ")}</TabsTrigger>
        ))}</TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card><CardContent className="p-0">
            {loading ? <div className="p-6 space-y-3">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
            : data.length===0 ? <div className="py-12 text-center text-muted-foreground">No purchase orders — create PO then Receive to add stock</div>
            : <>
              <div className="hidden md:block overflow-x-auto"><Table><TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Branch</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Ordered</TableHead><TableHead className="text-right">Received</TableHead><TableHead>Pay Status*</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
                {data.map(p=>{
                  const itemsCount=(p as any).purchase_items?.length ?? "-";
                  const ordered=p.total;
                  // Approx received value from detail? fallback to status
                  const receivedHint = p.status==="RECEIVED" ? ordered : p.status==="PARTIALLY_RECEIVED" ? Math.round(ordered*0.6) : 0;
                  return (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs cursor-pointer underline" onClick={()=>openDetail(p)}>{p.purchase_number}</TableCell>
                    <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}<div className="text-[10px] text-muted-foreground">{p.ordered_at?`Ord ${new Date(p.ordered_at).toLocaleDateString()}`:""}</div></TableCell>
                    <TableCell className="text-sm">{(p as any).suppliers?.name ?? p.supplier_id.slice(0,8)}</TableCell>
                    <TableCell className="text-xs">{(p as any).branches?.name ?? p.branch_id.slice(0,6)}</TableCell>
                    <TableCell className="text-sm">{itemsCount}</TableCell>
                    <TableCell className="text-right text-sm">UGX {Number(ordered).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">{p.status==="RECEIVED"||p.status==="PARTIALLY_RECEIVED" ? `UGX ${receivedHint.toLocaleString()}`: "—"}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline">Billed</Badge><span className="text-[10px] text-muted-foreground block">Pay → Suppliers</span></TableCell>
                    <TableCell>{badge(p.status)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={()=>openDetail(p)} title="View detail"><Eye className="h-4 w-4"/></Button>
                      {(p.status==="DRAFT") && <Button variant="ghost" size="icon" onClick={()=>handleStatus(p,"ORDERED")} title="Mark Ordered"><FileText className="h-4 w-4"/></Button>}
                      {(p.status==="DRAFT" || p.status==="ORDERED" || p.status==="PARTIALLY_RECEIVED") && <Button variant="ghost" size="icon" onClick={()=>openReceive(p)} title="Receive goods"><Truck className="h-4 w-4"/></Button>}
                      {(p.status==="DRAFT"||p.status==="ORDERED") && <Button variant="ghost" size="icon" onClick={()=>handleCancel(p)} title="Cancel"><Trash2 className="h-4 w-4"/></Button>}
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody></Table></div>
              <div className="md:hidden p-3 grid gap-3">
                {data.map(p=>(
                  <Card key={p.id} className="border cursor-pointer" onClick={()=>openDetail(p)}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between"><span className="font-mono text-xs">{p.purchase_number}</span>{badge(p.status)}</div>
                      <div className="text-sm">{(p as any).suppliers?.name} • {(p as any).branches?.name ?? p.branch_id.slice(0,6)}</div>
                      <div className="flex justify-between text-xs"><span>{new Date(p.created_at).toLocaleDateString()}</span><span className="font-bold">UGX {Number(p.total).toLocaleString()}</span></div>
                      <div className="flex gap-2" onClick={e=>e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="flex-1" onClick={()=>openDetail(p)}><Eye className="h-4 w-4 mr-1"/>View</Button>
                        {(p.status==="DRAFT"||p.status==="ORDERED"||p.status==="PARTIALLY_RECEIVED") && <Button size="sm" variant="outline" onClick={()=>openReceive(p)}><Truck className="h-4 w-4"/></Button>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages} • {count} total</span>
                <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</Button><Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
              </div>
            </>}
          </CardContent></Card>
          <p className="text-xs text-muted-foreground mt-2">* Payment status is independent from receiving — use Suppliers → Balance / Payments to record PAY against PO. Receiving ≠ Paid.</p>
        </TabsContent>
      </Tabs>

      {/* CREATE PO */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle><DialogDescription>Step 1 Supplier → Step 2 Branch → Step 3 Products → Step 4 Costs → Step 5 Terms → Review. Stock NOT added until Goods Receipt.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Supplier *</Label><Select value={form.supplier_id} onChange={e=>setForm({...form, supplier_id:e.target.value})}><option value="">Select supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name} — {s.phone ?? ""}</option>)}</Select>{form.supplier_id && <p className="text-xs text-muted-foreground mt-1">Balance via Suppliers page</p>}</div>
              <div><Label>Branch / Destination *</Label><Select value={form.branch_id} onChange={e=>setForm({...form, branch_id:e.target.value})}><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div><Label>Expected Delivery</Label><Input type="date" value={form.expected_delivery_date} onChange={e=>setForm({...form, expected_delivery_date:e.target.value})}/></div>
              <div><Label>Currency</Label><Select value={form.currency} onChange={e=>setForm({...form, currency:e.target.value})}><option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option></Select></div>
              <div><Label>Payment Terms</Label><Select value={form.payment_terms} onChange={e=>setForm({...form, payment_terms:e.target.value})}><option value="">Select</option><option value="CASH">Cash</option><option value="IMMEDIATE">Immediate</option><option value="7 days">7 days</option><option value="14 days">14 days</option><option value="30 days">30 days</option><option value="Custom">Custom</option></Select></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} placeholder="Delivery instructions, reference..."/></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h4 className="font-medium flex items-center gap-2"><Package className="h-4 w-4"/>Products</h4><Button variant="outline" size="sm" onClick={addLine}>Add Line</Button></div>
              {!isOnline && <p className="text-xs text-amber-600">Offline — using cached products/suppliers. PO will queue.</p>}
              {form.lines.map((l,i)=>(
                <div key={i} className="grid gap-2 md:grid-cols-12 items-end border rounded p-3">
                  <div className="md:col-span-5"><Label className="text-xs">Product *</Label><Select value={l.product_id} onChange={e=>{
                    const pid=e.target.value;
                    const prod=products.find((p:any)=>p.id===pid);
                    updateLine(i,{product_id:pid, product_name: prod?.name, unit_cost: prod?.default_purchase_cost ?? prod?.cost_price ?? l.unit_cost });
                  }}><option value="">Search product (name/SKU/barcode)...</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.name} {p.sku?`(${p.sku})`:""} {p.generic_name?`- ${p.generic_name}`:""} • Stock: {p.reorder_level ?? "?"}</option>)}</Select>
                  {l.product_id && <p className="text-[10px] text-muted-foreground">Pack: {products.find((p:any)=>p.id===l.product_id)?.pack_size ?? 1} • {products.find((p:any)=>p.id===l.product_id)?.units_per_pack ?? 1} units/pack • Last cost UGX {Number(products.find((p:any)=>p.id===l.product_id)?.default_purchase_cost ?? 0).toLocaleString()}</p>}
                  </div>
                  <div><Label className="text-xs">Qty</Label><Input type="number" min={1} value={l.quantity_ordered} onChange={e=>updateLine(i,{quantity_ordered: Number(e.target.value)})}/></div>
                  <div><Label className="text-xs">Unit Cost</Label><Input type="number" value={l.unit_cost} onChange={e=>updateLine(i,{unit_cost: Number(e.target.value)})}/></div>
                  <div><Label className="text-xs">Discount</Label><Input type="number" value={l.discount} onChange={e=>updateLine(i,{discount: Number(e.target.value)})}/></div>
                  <div><Label className="text-xs">Tax</Label><Input type="number" value={l.tax} onChange={e=>updateLine(i,{tax: Number(e.target.value)})}/></div>
                  <div><Button variant="ghost" size="icon" onClick={()=>removeLine(i)}><Trash2 className="h-4 w-4"/></Button></div>
                  <div className="md:col-span-12 text-xs text-muted-foreground flex justify-between"><span>Subtotal: UGX {(l.quantity_ordered * l.unit_cost - l.discount + l.tax).toLocaleString()} </span><span className="text-[10px]">Server will recalc — historical cost preserved</span></div>
                </div>
              ))}
            </div>
            <div className="border rounded p-3 space-y-1 bg-muted/20">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>UGX {form.lines.reduce((s,l)=>s+l.quantity_ordered*l.unit_cost,0).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span>Discount</span><span>-UGX {form.lines.reduce((s,l)=>s+l.discount,0).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span>Tax</span><span>+UGX {form.lines.reduce((s,l)=>s+l.tax,0).toLocaleString()}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>UGX {form.lines.reduce((s,l)=> s + l.quantity_ordered*l.unit_cost - l.discount + l.tax, 0).toLocaleString()}</span></div>
            </div>
            <Button onClick={submitCreate} className="w-full">Create DRAFT Order {isOnline?"(online)":"(offline queue)"}</Button>
            <p className="text-xs text-muted-foreground text-center">DRAFT → ORDERED → Partially Received → Received. Only Receive creates Batches + Stock Movements + Inventory.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* DETAIL */}
      <Dialog open={!!showDetail} onOpenChange={(o)=>!o && setShowDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>Purchase {showDetail?.purchase_number} — Detail</DialogTitle><DialogDescription>{showDetail && `${new Date(showDetail.created_at).toLocaleDateString()} • ${showDetail.suppliers?.name ?? ""} • ${showDetail.status}`}</DialogDescription></DialogHeader>
          {detailData ? (
            <div className="space-y-4">
              <Tabs defaultValue="overview">
                <TabsList className="flex flex-wrap h-auto">
                  {[
                    {id:"overview", label:"Overview", icon:FileText},
                    {id:"items", label:"Items", icon:Package},
                    {id:"receiving", label:"Receiving", icon:Truck},
                    {id:"batches", label:"Batches", icon:Layers},
                    {id:"payments", label:"Payments", icon:CreditCard},
                    {id:"returns", label:"Returns", icon:Undo2},
                    {id:"documents", label:"Documents", icon:FileText},
                    {id:"supplier", label:"Supplier", icon:Users},
                    {id:"audit", label:"Activity", icon:History},
                  ].map(t=>(
                    <TabsTrigger key={t.id} value={t.id} active={detailTab===t.id} onClick={()=>setDetailTab(t.id)}><t.icon className="h-3 w-3 mr-1"/>{t.label}</TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value={detailTab} className="mt-4 space-y-3">
                  {detailTab==="overview" && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                        <div className="flex justify-between"><span>Supplier</span><strong>{detailData.suppliers?.name}</strong></div>
                        <div className="flex justify-between"><span>Status</span>{badge(detailData.status)}</div>
                        <div className="flex justify-between"><span>Order Date</span><span>{new Date(detailData.created_at).toLocaleDateString()}</span></div>
                        <div className="flex justify-between"><span>Expected</span><span>{detailData.expected_delivery_date ? new Date(detailData.expected_delivery_date).toLocaleDateString() : "—"}</span></div>
                        <div className="flex justify-between"><span>Branch</span><span>{detailData.branches?.name}</span></div>
                        <div className="flex justify-between"><span>Currency</span><span>{detailData.currency ?? "UGX"}</span></div>
                        <div className="flex justify-between"><span>Payment Terms</span><span>{detailData.payment_terms ?? "—"}</span></div>
                      </CardContent></Card>
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Financial</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                        <div className="flex justify-between"><span>Subtotal</span><span>UGX {Number(detailData.subtotal).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Discount</span><span>-UGX {Number(detailData.discount).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Tax</span><span>+UGX {Number(detailData.tax).toLocaleString()}</span></div>
                        <div className="flex justify-between font-bold border-t pt-1"><span>Total (Ordered)</span><span>UGX {Number(detailData.total).toLocaleString()}</span></div>
                        <div className="flex justify-between text-xs text-muted-foreground"><span>Paid</span><span>UGX {(detailData.supplier_payments ?? []).reduce((s:any,p:any)=>s+Number(p.amount),0).toLocaleString()} (separate)</span></div>
                        <div className="flex justify-between text-xs"><span>Outstanding</span><span className="font-bold">UGX {Math.max(0, Number(detailData.total) - (detailData.supplier_payments ?? []).reduce((s:any,p:any)=>s+Number(p.amount),0)).toLocaleString()}</span></div>
                        <p className="text-[10px] text-muted-foreground">Payment status ≠ Receiving status. Receive adds stock; Pay reduces payable.</p>
                      </CardContent></Card>
                      <Card className="md:col-span-2"><CardContent className="p-3 text-xs">Notes: {detailData.notes ?? "—"} • PO: {detailData.purchase_number} • GRN: {(detailData.goods_receipts ?? []).map((g:any)=>g.grn_number).join(", ") || "—"} • ID: {detailData.id.slice(0,8)} • Approved: {detailData.approved_at ? new Date(detailData.approved_at).toLocaleDateString() : "—"} • Sent: {detailData.sent_at ? new Date(detailData.sent_at).toLocaleDateString() : "—"}</CardContent></Card>
                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        {(detailData.status==="DRAFT") && <><Button size="sm" onClick={()=>handleStatus(detailData,"PENDING_APPROVAL")}>Submit for Approval</Button><Button size="sm" variant="outline" onClick={()=>handleStatus(detailData,"ORDERED")}>Mark Ordered</Button></>}
                        {(detailData.status==="PENDING_APPROVAL") && <><Button size="sm" onClick={()=>handleStatus(detailData,"APPROVED")}>Approve</Button><Button size="sm" variant="outline" onClick={()=>handleStatus(detailData,"DRAFT")}>Back to Draft</Button></>}
                        {(detailData.status==="APPROVED") && <><Button size="sm" onClick={()=>handleStatus(detailData,"SENT")}>Send to Supplier</Button><Button size="sm" variant="outline" onClick={()=>handleStatus(detailData,"ORDERED")}>Mark Ordered</Button></>}
                        {(detailData.status==="SENT") && <Button size="sm" onClick={()=>handleStatus(detailData,"ORDERED")}>Confirm Ordered</Button>}
                        {(detailData.status==="RECEIVED") && <Button size="sm" onClick={()=>handleStatus(detailData,"CLOSED")}>Close PO</Button>}
                        {(detailData.status==="DRAFT"||detailData.status==="APPROVED"||detailData.status==="SENT"||detailData.status==="ORDERED"||detailData.status==="PARTIALLY_RECEIVED") && <Button size="sm" variant="outline" onClick={()=>{ setShowDetail(null); openReceive(detailData); }}>Receive Goods (GRN)</Button>}
                        {(["DRAFT","PENDING_APPROVAL","APPROVED","SENT","ORDERED"].includes(detailData.status)) && <Button size="sm" variant="destructive" onClick={()=>handleCancel(detailData)}>Cancel</Button>}
                      </div>
                    </div>
                  )}
                  {detailTab==="items" && (
                    <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Ordered</TableHead><TableHead>Received</TableHead><TableHead>Outstanding</TableHead><TableHead>Unit Cost</TableHead><TableHead>Subtotal</TableHead></TableRow></TableHeader><TableBody>
                      {(detailData.purchase_items ?? []).map((it:any)=>(
                        <TableRow key={it.id}><TableCell>{it.products?.name ?? it.product_id.slice(0,8)}<div className="text-xs text-muted-foreground">{it.products?.sku ?? ""}</div></TableCell><TableCell>{it.quantity_ordered}</TableCell><TableCell className="font-bold">{it.quantity_received} {Number(it.quantity_received)<Number(it.quantity_ordered) && <Badge variant="warning" className="ml-1">{Number(it.quantity_ordered)-Number(it.quantity_received)} left</Badge>}</TableCell><TableCell>{Number(it.quantity_ordered)-Number(it.quantity_received)}</TableCell><TableCell>UGX {Number(it.unit_cost).toLocaleString()}</TableCell><TableCell>UGX {Number(it.subtotal).toLocaleString()}</TableCell></TableRow>
                      ))}
                    </TableBody></Table>
                  )}
                  {detailTab==="receiving" && (
                    <div className="space-y-3">
                      {(detailData.goods_receipts ?? []).length>0 && (
                        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Goods Received Notes (GRN)</CardTitle><CardDescription>Server-authoritative GRN numbers: GRN-YYYYMMDD-XXXXXX</CardDescription></CardHeader><CardContent className="p-0">
                          <Table><TableHeader><TableRow><TableHead>GRN</TableHead><TableHead>Date</TableHead><TableHead>Qty</TableHead><TableHead>Value</TableHead><TableHead>By</TableHead></TableRow></TableHeader><TableBody>
                            {(detailData.goods_receipts ?? []).map((g:any)=><TableRow key={g.id}><TableCell className="font-mono text-xs">{g.grn_number}</TableCell><TableCell className="text-xs">{new Date(g.received_at).toLocaleDateString()}</TableCell><TableCell>{g.total_quantity}</TableCell><TableCell>UGX {Number(g.total_value).toLocaleString()}</TableCell><TableCell className="text-xs">{g.received_by?.slice(0,8) ?? "—"}</TableCell></TableRow>)}
                          </TableBody></Table>
                        </CardContent></Card>
                      )}
                      {(detailData.stock_movements ?? []).length===0 ? <p className="text-sm text-muted-foreground">No receipts yet — status {detailData.status}</p> :
                        <Table><TableHeader><TableRow><TableHead>GRN/Batch</TableHead><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Cost</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.stock_movements ?? []).map((m:any)=>{
                            const grn = (detailData.goods_receipts ?? []).find((g:any)=> g.received_at?.slice(0,10)===m.created_at?.slice(0,10));
                            return <TableRow key={m.id}><TableCell className="font-mono text-xs">{grn?.grn_number ?? m.batch_id?.slice(0,8)}</TableCell><TableCell>{m.product_id.slice(0,8)}</TableCell><TableCell>+{m.quantity}</TableCell><TableCell>UGX {Number(m.unit_cost).toLocaleString()}</TableCell><TableCell className="text-xs">{new Date(m.created_at).toLocaleDateString()}</TableCell></TableRow>
                          })}
                        </TableBody></Table>
                      }
                      <p className="text-xs text-muted-foreground">GRN document: supplier delivery verified, variances logged (ordered vs received vs invoiced). TRG generates GRN number daily sequence.</p>
                      <Button size="sm" onClick={()=>{ setShowDetail(null); openReceive(detailData); }}>Open Receive Screen (creates GRN)</Button>
                    </div>
                  )}
                  {detailTab==="batches" && (
                    <div className="space-y-2">
                      {(detailData.batches ?? []).length===0 ? <p className="text-sm text-muted-foreground">Batches created on Receive — FEFO uses expiry. No batches yet.</p> :
                        <Table><TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead>Qty Avail/Recv</TableHead><TableHead>Cost/Sell</TableHead><TableHead>Supplier</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.batches ?? []).map((b:any)=>{
                            const days=Math.ceil((new Date(b.expiry_date).getTime()-Date.now())/86400000);
                            return <TableRow key={b.id}><TableCell className="font-mono">{b.batch_number}</TableCell><TableCell>{new Date(b.expiry_date).toLocaleDateString()}<div className="text-xs">{days<90 && days>0 ? <Badge variant="warning">{days}d — short-dated</Badge> : days<=0 ? <Badge variant="destructive">Expired</Badge> : `${days}d`}</div></TableCell><TableCell>{b.quantity_available} / {b.quantity_received}</TableCell><TableCell>UGX {Number(b.purchase_price).toLocaleString()} / UGX {Number(b.selling_price).toLocaleString()}</TableCell><TableCell className="text-xs">{b.supplier_id?.slice(0,6)}</TableCell></TableRow>
                          })}
                        </TableBody></Table>
                      }
                    </div>
                  )}
                  {detailTab==="payments" && (
                    <div className="space-y-3">
                      {(detailData.supplier_payments ?? []).length===0 ? <p className="text-sm text-muted-foreground">No payments recorded — UGX {Number(detailData.total).toLocaleString()} outstanding. Receiving ≠ Paid.</p> :
                        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.supplier_payments ?? []).map((p:any)=><TableRow key={p.id}><TableCell className="text-xs">{new Date(p.payment_date).toLocaleDateString()}</TableCell><TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell><TableCell className="text-xs">{p.reference ?? "—"}</TableCell><TableCell className="text-right">UGX {Number(p.amount).toLocaleString()}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <Card><CardContent className="p-3 space-y-2">
                        <h4 className="font-medium text-sm">Record Payment</h4>
                        <div className="grid md:grid-cols-3 gap-2">
                          <div><Label>Amount</Label><Input type="number" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm, amount:e.target.value})} placeholder="UGX"/></div>
                          <div><Label>Method</Label><Select value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm, method:e.target.value})}><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK">Bank</option><option value="CARD">Card</option><option value="OTHER">Other</option></Select></div>
                          <div><Label>Reference</Label><Input value={paymentForm.reference} onChange={e=>setPaymentForm({...paymentForm, reference:e.target.value})} placeholder="Txn ref"/></div>
                        </div>
                        <Button size="sm" onClick={submitPayment}>Record Payment</Button>
                        <p className="text-xs text-muted-foreground">Updates supplier payable via supplier_payments. View balance on Suppliers page.</p>
                      </CardContent></Card>
                    </div>
                  )}
                  {detailTab==="returns" && (
                    <div className="space-y-3">
                      {(detailData.purchase_returns ?? []).length===0 ? <p className="text-sm text-muted-foreground">No returns — if delivery damaged/incorrect/expired, create return.</p> :
                        <Table><TableHeader><TableRow><TableHead>Return #</TableHead><TableHead>Reason</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.purchase_returns ?? []).map((r:any)=><TableRow key={r.id}><TableCell className="font-mono">{r.return_number}</TableCell><TableCell className="text-xs">{r.reason}</TableCell><TableCell>UGX {Number(r.total).toLocaleString()}</TableCell><TableCell><Badge variant={r.status==="completed"?"success":"warning"}>{r.status}</Badge></TableCell><TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <Card><CardContent className="p-3 space-y-2">
                        <h4 className="font-medium text-sm">Create Return (select items)</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {(detailData.purchase_items ?? []).map((it:any)=>{
                            const checked=returnForm.items.some(x=>x.purchase_item_id===it.id);
                            return <label key={it.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                              <input type="checkbox" checked={checked} onChange={e=>{
                                if(e.target.checked){
                                  setReturnForm(f=>({...f, items:[...f.items, {purchase_item_id:it.id, product_id:it.product_id, quantity:1, unit_cost:it.unit_cost, batch_id: (detailData.batches ?? []).find((b:any)=>b.purchase_item_id===it.id)?.id ?? null}]}));
                                } else {
                                  setReturnForm(f=>({...f, items: f.items.filter(x=>x.purchase_item_id!==it.id)}));
                                }
                              }}/>
                              <span className="flex-1">{it.products?.name} — Ordered {it.quantity_ordered}, Received {it.quantity_received}</span>
                              {checked && <Input type="number" className="w-20" min={1} max={it.quantity_received} value={returnForm.items.find(x=>x.purchase_item_id===it.id)?.quantity ?? 1} onChange={e=>{
                                const v=Number(e.target.value);
                                setReturnForm(f=>({...f, items: f.items.map(x=> x.purchase_item_id===it.id ? {...x, quantity:v}:x)}));
                              }}/>}
                            </label>
                          })}
                        </div>
                        <Input placeholder="Reason: Damaged / Expired / Incorrect / Quality / Recall..." value={returnForm.reason} onChange={e=>setReturnForm({...returnForm, reason:e.target.value})}/>
                        <Button size="sm" onClick={submitReturn}>Submit Return (Pending → Approved → Stock reversal)</Button>
                        <p className="text-xs text-muted-foreground">Return reduces inventory via PURCHASE_RETURN movement and creates credit. Original PO intact.</p>
                      </CardContent></Card>
                    </div>
                  )}
                  {detailTab==="documents" && (
                    <div className="space-y-3">
                      {(detailData.purchase_attachments ?? []).length===0 ? <p className="text-sm text-muted-foreground">No documents — attach supplier invoice, delivery note, credit note.</p> :
                        <Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Type</TableHead><TableHead>Uploaded</TableHead><TableHead>Link</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.purchase_attachments ?? []).map((a:any)=><TableRow key={a.id}><TableCell className="text-xs">{a.file_name}</TableCell><TableCell><Badge variant="outline">{a.document_type}</Badge></TableCell><TableCell className="text-xs">{new Date(a.created_at).toLocaleDateString()}</TableCell><TableCell><a href={a.file_url} target="_blank" rel="noreferrer" className="text-xs underline">Open</a></TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <Card><CardContent className="p-3 space-y-2">
                        <h4 className="font-medium text-sm">Attach Document</h4>
                        <div className="grid md:grid-cols-2 gap-2">
                          <div><Label>Type</Label><Select value={attachForm.document_type} onChange={e=>setAttachForm({...attachForm, document_type:e.target.value})}><option value="SUPPLIER_INVOICE">Supplier Invoice</option><option value="DELIVERY_NOTE">Delivery Note</option><option value="PURCHASE_ORDER">Purchase Order</option><option value="CREDIT_NOTE">Credit Note</option><option value="OTHER">Other</option></Select></div>
                          <div><Label>File Name</Label><Input value={attachForm.file_name} onChange={e=>setAttachForm({...attachForm, file_name:e.target.value})} placeholder="invoice_ABC123.pdf"/></div>
                        </div>
                        <div><Label>File URL / Data</Label><Input value={attachForm.file_url} onChange={e=>setAttachForm({...attachForm, file_url:e.target.value})} placeholder="https://... or paste link"/></div>
                        <div className="flex items-center gap-2">
                          <Input type="file" onChange={async e=>{
                            const f=e.target.files?.[0];
                            if(!f) return;
                            const reader=new FileReader();
                            reader.onload=()=>{ setAttachForm(a=>({...a, file_name: f.name, file_url: String(reader.result) })); };
                            reader.readAsDataURL(f);
                          }}/>
                          <span className="text-xs text-muted-foreground">or enter URL above — demo stores data URI / link (reuse existing storage if bucket configured)</span>
                        </div>
                        <Button size="sm" onClick={submitAttachment}>Attach</Button>
                        <p className="text-xs text-muted-foreground">If Supabase storage bucket exists, replace file_url with storage public URL. Table keeps metadata, not duplicate storage.</p>
                      </CardContent></Card>
                      {(detailData.goods_receipts ?? []).length>0 && <p className="text-xs">GRN docs: {(detailData.goods_receipts ?? []).map((g:any)=>`${g.grn_number} (UGX ${Number(g.total_value).toLocaleString()})`).join(" • ")}</p>}
                    </div>
                  )}
                  {detailTab==="supplier" && (
                    <div className="space-y-2 text-sm">
                      <p><strong>{detailData.suppliers?.name}</strong> — {detailData.suppliers?.phone ?? ""} {detailData.suppliers?.email ?? ""}</p>
                      <p className="text-xs text-muted-foreground">{detailData.suppliers?.address ?? ""}</p>
                      <Button size="sm" variant="outline" onClick={()=>window.location.href="/suppliers"}>Open Suppliers</Button>
                      <p className="text-xs">Product price history: compare last costs across suppliers (based on actual purchases).</p>
                    </div>
                  )}
                  {detailTab==="audit" && (
                    <div className="space-y-2 text-xs">
                      <p>Created: {new Date(detailData.created_at).toLocaleString()} • Status: {detailData.status} • Received: {detailData.received_at ? new Date(detailData.received_at).toLocaleString() : "—"}</p>
                      <p className="text-muted-foreground">Full audit in Audit logs — PURCHASE_CREATED, PURCHASE_RECEIVED, PURCHASE_STATUS_CHANGED, SUPPLIER_PAYMENT.</p>
                      <Button size="sm" variant="outline" onClick={()=>window.location.href="/audit"}>Open Audit</Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : <Skeleton className="h-48 w-full"/>}
        </DialogContent>
      </Dialog>

      {/* RECEIVE */}
      <Dialog open={!!showReceive} onOpenChange={(o)=>!o && setShowReceive(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>Receive — {showReceive?.purchase_number}</DialogTitle><DialogDescription>PRODUCT → Ordered → Previously Received → This Delivery → Remaining. Batch+Expiry required. Multiple batches per product supported. Discrepancies highlighted.</DialogDescription></DialogHeader>
          {receiveDetail ? (
            <div className="space-y-4">
              {!isOnline && <Card><CardContent className="p-3 text-xs text-amber-700 bg-amber-50">Offline — receipt will queue. Capture actual quantities, batches, expiry. Sync applies as transaction (+qty), not overwrite.</CardContent></Card>}
              {receiveGroups.map((g:any, idx:number)=>(
                <Card key={idx} className="border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4"/>{g.product_name} — Ordered {g.quantity_ordered}, Received {g.quantity_received}, Remaining {g.remaining} {g.remaining>0 && <Badge variant="warning">{g.remaining} outstanding</Badge>}</CardTitle><CardDescription className="text-xs">Unit cost UGX {Number(products.find(p=>p.id===g.product_id)?.default_purchase_cost ?? g.batches[0]?.unit_cost ?? 0).toLocaleString()} • If delivered ≠ ordered, variance shown. Over-receiving flagged, not silently corrected.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {g.batches.map((b:any,bIdx:number)=>(
                      <div key={bIdx} className="border rounded p-3 space-y-2 bg-muted/10">
                        <div className="flex justify-between items-center"><span className="text-xs font-medium">Batch {bIdx+1} {g.batches.length>1 && `(Multiple batches)`}</span>{g.batches.length>1 && <Button variant="ghost" size="sm" onClick={()=>{
                          const copy=[...receiveGroups]; copy[idx].batches = copy[idx].batches.filter((_:any,i:number)=>i!==bIdx); setReceiveGroups(copy);
                        }}><Trash2 className="h-3 w-3"/></Button>}</div>
                        <div className="grid gap-2 md:grid-cols-3">
                          <div><Label className="text-xs">Qty Received *</Label><Input type="number" min={0} value={b.quantity_received} onChange={e=>{
                            const v=Math.max(0, Number(e.target.value)); const copy=[...receiveGroups]; copy[idx].batches[bIdx].quantity_received=v; setReceiveGroups(copy);
                          }}/><p className="text-[10px] text-muted-foreground">Remaining {g.remaining} • Variance {Number(b.quantity_received)-g.remaining>0?`+${Number(b.quantity_received)-g.remaining} over` : Number(b.quantity_received)-g.remaining<0?`${Number(b.quantity_received)-g.remaining} under`:"exact"}</p></div>
                          <div><Label className="text-xs">Batch # *</Label><Input value={b.batch_number} onChange={e=>{ const copy=[...receiveGroups]; copy[idx].batches[bIdx].batch_number=e.target.value; setReceiveGroups(copy); }} placeholder="P2401-AB"/></div>
                          <div><Label className="text-xs">Expiry *</Label><Input type="date" value={b.expiry_date} onChange={e=>{ const copy=[...receiveGroups]; copy[idx].batches[bIdx].expiry_date=e.target.value; setReceiveGroups(copy); }}/>{b.expiry_date && (()=>{ const d=new Date(b.expiry_date); const days=Math.ceil((d.getTime()-Date.now())/86400000); if(isNaN(days)) return null; if(days<=0) return <span className="text-[10px] text-destructive">Expired — blocked</span>; if(days<90) return <span className="text-[10px] text-amber-600">Short-dated: {days}d</span>; return <span className="text-[10px] text-muted-foreground">{days}d to expiry</span>; })()}</div>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div><Label className="text-xs">Purchase Cost</Label><Input type="number" value={b.unit_cost} onChange={e=>{ const copy=[...receiveGroups]; copy[idx].batches[bIdx].unit_cost=Number(e.target.value); setReceiveGroups(copy); }}/>{Number(b.unit_cost)!==Number(products.find(p=>p.id===g.product_id)?.default_purchase_cost ?? 0) && <span className="text-[10px] text-amber-600">Price variance vs last cost</span>}</div>
                          <div><Label className="text-xs">Selling Price</Label><Input type="number" value={b.selling_price} onChange={e=>{ const copy=[...receiveGroups]; copy[idx].batches[bIdx].selling_price=Number(e.target.value); setReceiveGroups(copy); }}/></div>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={()=>{
                      const copy=[...receiveGroups]; copy[idx].batches.push({batch_number:"", expiry_date:"", quantity_received:0, unit_cost: copy[idx].batches[0]?.unit_cost ?? 0, selling_price: copy[idx].batches[0]?.selling_price ?? 0}); setReceiveGroups(copy);
                    }}>+ Add Batch (same product, different expiry)</Button>
                  </CardContent>
                </Card>
              ))}
              <Button onClick={submitReceive} className="w-full"><Truck className="h-4 w-4 mr-2"/>Confirm Receipt — Create Batches & Stock Movements {isOnline?"(online)":"(queue offline)"}</Button>
              <p className="text-xs text-muted-foreground text-center">Partial → PARTIALLY_RECEIVED • Full → RECEIVED. Each batch → product_batches (qty_available) + stock_movements PURCHASE • Historical cost preserved • FEFO-ready.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={()=>{
                  // quick fill demo: fill first batch with remaining
                  const copy=receiveGroups.map((g:any)=>({...g, batches: g.batches.map((b:any,i:number)=> i===0 ? {...b, quantity_received: g.remaining, batch_number: b.batch_number || `B${Date.now().toString().slice(-4)}`, expiry_date: b.expiry_date || new Date(Date.now()+ 365*24*3600*1000).toISOString().slice(0,10)} : b)}));
                  setReceiveGroups(copy);
                }}>Auto-fill Remaining</Button>
                <Button variant="outline" size="sm" onClick={()=>setShowReceive(null)}>Cancel</Button>
              </div>
            </div>
          ) : <Skeleton className="h-64 w-full"/>}
        </DialogContent>
      </Dialog>

      <Card><CardContent className="p-3 flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="gap-1"><Layers className="h-3 w-3"/>Workflow: PO (ordered) ≠ Inventory • GRN (received) = +Stock • Payable = Owed • Payment = Paid</Badge>
        <Badge variant="outline">Offline: PO draft & Receive queued • Sync transaction +qty • Idempotent • No overwrite</Badge>
        <Badge variant="outline">Mobile: Cards on phones • Touch targets • Receive workflow optimized</Badge>
        <Button variant="link" size="sm" onClick={()=>window.location.href="/suppliers"}>Suppliers</Button>
        <Button variant="link" size="sm" onClick={()=>window.location.href="/inventory"}>Inventory/Batches</Button>
        <Button variant="link" size="sm" onClick={()=>window.location.href="/reports"}>Reports</Button>
      </CardContent></Card>
    </div>
  );
}
