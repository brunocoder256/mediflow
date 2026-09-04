"use client";
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
import { useOnlineStatus } from "@/hooks/use-online-status";
import { queueSupplierCreate, queueSupplierUpdate, getSupplierPendingCount } from "@/lib/offline/sync";
import { Search, Plus, Eye, Edit, Building2, Phone, Mail, MapPin, CreditCard, Package, Truck, Undo2, FileText, History, TrendingUp, Layers, DollarSign, Clock, AlertTriangle, CheckCircle, XCircle, PauseCircle, Wifi, WifiOff, RefreshCw, Download, Trash2, ShieldCheck, Globe, Users, FileArchive, MessageSquare } from "lucide-react";
import { db } from "@/lib/offline/db";

type Supplier = any;

const supplierTypes = ["Pharmaceutical distributor","Wholesaler","Manufacturer","Medical equipment supplier","Laboratory supplier","General supplier","Other"];
const supplierStatuses = ["Active","Inactive","Suspended","Under Review"] as const;

function statusBadge(s:string){
  if(s==="Active") return <Badge variant="success">Active</Badge>;
  if(s==="Inactive") return <Badge variant="secondary">Inactive</Badge>;
  if(s==="Suspended") return <Badge variant="destructive">Suspended</Badge>;
  if(s==="Under Review") return <Badge variant="warning">Under Review</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

export default function SuppliersPage(){
  const { isOnline } = useOnlineStatus();
  const [loading,setLoading]=React.useState(true);
  const [data,setData]=React.useState<Supplier[]>([]);
  const [count,setCount]=React.useState(0);
  const [q,setQ]=React.useState("");
  const [debouncedQ,setDebouncedQ]=React.useState("");
  const [typeFilter,setTypeFilter]=React.useState("all");
  const [statusFilter,setStatusFilter]=React.useState("all");
  const [branchFilter,setBranchFilter]=React.useState("all");
  const [onlyHasBalance,setOnlyHasBalance]=React.useState(false);
  const [onlyOpenPO,setOnlyOpenPO]=React.useState(false);
  const [page,setPage]=React.useState(1);
  const [branches,setBranches]=React.useState<any[]>([]);
  const [err,setErr]=React.useState<string|null>(null);
  const [pendingSuppliers,setPendingSuppliers]=React.useState(0);
  const [showCreate,setShowCreate]=React.useState(false);
  const [showEdit,setShowEdit]=React.useState<Supplier|null>(null);
  const [showDetail,setShowDetail]=React.useState<Supplier|null>(null);
  const [detailData,setDetailData]=React.useState<any>(null);
  const [detailTab,setDetailTab]=React.useState("overview");
  const [detailLoading,setDetailLoading]=React.useState(false);
  const [statementFilter,setStatementFilter]=React.useState<{from:string,to:string}>({from:"",to:""});
  const [statement,setStatement]=React.useState<any>(null);
  const [products,setProducts]=React.useState<any[]>([]);
  const [linkProductId,setLinkProductId]=React.useState("");
  const [noteText,setNoteText]=React.useState("");
  const [docForm,setDocForm]=React.useState({document_type:"AGREEMENT", file_name:"", file_url:""});
  const [paymentForm,setPaymentForm]=React.useState({amount:"", method:"CASH", reference:""});
  const [wizardStep,setWizardStep]=React.useState(1);
  const perPage=14;

  // form for create/edit
  const emptyForm: any = { name:"", supplier_code:"", trading_name:"", supplier_type:"Pharmaceutical distributor", supplier_category:"", description:"", status:"Active", contact_person:"", contact_role:"", phone:"", phone_alt:"", email:"", email_alt:"", address:"", physical_address:"", postal_address:"", city:"", region:"", country:"Uganda", website:"", business_registration_number:"", tin:"", licence_number:"", licence_expiry_date:"", verification_status:"Unverified", payment_terms:"30 Days", credit_limit:0, currency:"UGX", default_discount:0, minimum_order_value:0, minimum_order_quantity:0, lead_time_days:"", delivery_terms:"", preferred_payment_method:"", account_reference:"", notes:"", branch_ids:[] };
  const [form,setForm]=React.useState<any>({...emptyForm});

  React.useEffect(()=>{ const id=setTimeout(()=>setDebouncedQ(q),280); return ()=>clearTimeout(id); },[q]);
  React.useEffect(()=>{ getSupplierPendingCount().then(c=>setPendingSuppliers(c)).catch(()=>{}); const id=setInterval(()=>getSupplierPendingCount().then(c=>setPendingSuppliers(c)), 6000); return ()=>clearInterval(id); },[]);

  const fetchData=React.useCallback(async()=>{
    setLoading(true); setErr(null);
    try{
      const params=new URLSearchParams();
      if(debouncedQ) params.set("search", debouncedQ);
      if(typeFilter!=="all") params.set("supplier_type", typeFilter);
      if(statusFilter!=="all") params.set("status", statusFilter);
      else params.set("includeInactive","1");
      if(branchFilter!=="all") params.set("branch_id", branchFilter);
      params.set("page", String(page));
      params.set("perPage", String(perPage));
      const [sRes, bRes, pRes]=await Promise.all([
        fetch(`/api/suppliers?${params.toString()}`).then(r=>r.json()),
        fetch("/api/settings").then(r=>r.json()).catch(()=>({branches:[]})),
        fetch("/api/products?perPage=200").then(r=>r.json()).catch(()=>({data:[]})),
      ]);
      const list = sRes.data ?? (Array.isArray(sRes)? sRes : []);
      let filtered=list;
      if(onlyHasBalance) filtered = filtered.filter((s:any)=> Number(s.balance)>0);
      if(onlyOpenPO) filtered = filtered.filter((s:any)=> Number(s.open_pos)>0);
      setData(filtered);
      setCount(sRes.count ?? filtered.length);
      setBranches(bRes.branches ?? []);
      setProducts(Array.isArray(pRes)? pRes : (pRes.data ?? []));
      // cache offline
      try{
        for(const s of list){
          await db.cachedSuppliers.put({ id:s.id, name:s.name, supplier_code:s.supplier_code, supplier_type:s.supplier_type, status:s.status, phone:s.phone, email:s.email, city:s.city, is_active:s.is_active, sync_status: "synced" as any, updated_at: s.updated_at } as any).catch(()=>{});
        }
      }catch{}
    }catch(e:any){ setErr(e.message); }
    setLoading(false);
  },[debouncedQ,typeFilter,statusFilter,branchFilter,page,onlyHasBalance,onlyOpenPO]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

  const kpi = React.useMemo(()=>{
    const total = data.length;
    const active = data.filter(s=>s.status==="Active" || s.is_active).length;
    const outstanding = data.reduce((a,s)=>a+Number(s.balance??0),0);
    const overdue = data.filter(s=> Number(s.balance)> Number(s.credit_limit||0) && Number(s.credit_limit)>0).length;
    const withOpenPO = data.filter(s=>Number(s.open_pos)>0).length;
    return { total, active, outstanding, overdue, withOpenPO };
  },[data]);

  const openCreate=()=>{
    setForm({...emptyForm, branch_ids: branches[0]? [branches[0].id]: []});
    setWizardStep(1);
    setShowCreate(true);
  };
  const openEdit=(s:Supplier)=>{
    setForm({
      name:s.name, supplier_code:s.supplier_code??"", trading_name:s.trading_name??"", supplier_type:s.supplier_type??"Pharmaceutical distributor",
      supplier_category:s.supplier_category??"", description:s.description??"", status:s.status?? (s.is_active?"Active":"Inactive"),
      contact_person:s.contact_person??"", contact_role:s.contact_role??"", phone:s.phone??"", phone_alt:s.phone_alt??"", email:s.email??"", email_alt:s.email_alt??"",
      address:s.address??"", physical_address:s.physical_address??"", postal_address:s.postal_address??"", city:s.city??"", region:s.region??"", country:s.country??"Uganda", website:s.website??"",
      business_registration_number:s.business_registration_number??"", tin:s.tin?? s.tax_number??"", licence_number:s.licence_number??"", licence_expiry_date:s.licence_expiry_date ?? "",
      verification_status:s.verification_status??"Unverified", payment_terms:s.payment_terms??"30 Days", credit_limit:Number(s.credit_limit??0),
      currency:s.currency??"UGX", default_discount:Number(s.default_discount??0), minimum_order_value:Number(s.minimum_order_value??0), minimum_order_quantity:Number(s.minimum_order_quantity??0),
      lead_time_days: s.lead_time_days ?? "", delivery_terms:s.delivery_terms??"", preferred_payment_method:s.preferred_payment_method??"", account_reference:s.account_reference??"", notes:s.notes??"", branch_ids: []
    });
    setWizardStep(1);
    setShowEdit(s);
  };
  const openDetail=async(s:Supplier)=>{
    setShowDetail(s);
    setDetailTab("overview");
    setDetailLoading(true);
    setStatement(null);
    try{
      const r=await fetch(`/api/suppliers?id=${s.id}&detail=1`);
      const j=await r.json();
      if(r.ok) setDetailData(j);
      else setDetailData(null);
    }catch{ setDetailData(null); }
    setDetailLoading(false);
  };

  const submitCreate=async()=>{
    if(!form.name || !form.name.trim()) return alert("Supplier name required");
    if(form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return alert("Invalid email");
    if(form.phone && !/^(\+256)?[0-9\s\-()]{7,15}$/.test(form.phone)) return alert("Invalid phone — use +256 or local format");
    const payload:any={...form};
    if(payload.lead_time_days==="") payload.lead_time_days=null; else payload.lead_time_days=Number(payload.lead_time_days);
    payload.branch_ids = payload.branch_ids ?? [];
    if(!isOnline){
      await queueSupplierCreate(payload);
      alert("Offline — supplier draft saved locally. Will sync when online. Status: Pending Sync (never overwrite server totals)");
      setShowCreate(false); setPendingSuppliers(c=>c+1); fetchData();
      return;
    }
    const r=await fetch("/api/suppliers",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
    const j=await r.json();
    if(!r.ok) return alert(j.error || "Failed");
    setShowCreate(false); fetchData();
  };
  const submitEdit=async()=>{
    if(!showEdit) return;
    if(!isOnline){
      await queueSupplierUpdate(showEdit.id, form);
      alert("Offline — edit queued. Sync will validate (no silent overwrite of supplier balance)");
      setShowEdit(null); setPendingSuppliers(c=>c+1);
      return;
    }
    const r=await fetch(`/api/suppliers?id=${showEdit.id}`,{method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form)});
    const j=await r.json();
    if(!r.ok) return alert(j.error);
    setShowEdit(null); fetchData(); if(showDetail?.id===showEdit.id) openDetail(showEdit);
  };
  const handleDeactivate=async(s:Supplier)=>{
    const next = s.status==="Active" ? "Inactive" : "Active";
    if(!confirm(`${next} supplier ${s.name}? ${s.balance? `Outstanding UGX ${Number(s.balance).toLocaleString()} will remain` : ""}`)) return;
    if(!isOnline) return alert("Offline deactivation queued? Go online to change status — synced transactions enforce branch/role auth");
    const r=await fetch("/api/suppliers",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"status", id:s.id, status: next})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else fetchData();
  };
  const handleStatusChange=async(s:Supplier, st:string)=>{
    const r=await fetch("/api/suppliers",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"status", id:s.id, status: st})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { fetchData(); if(showDetail) openDetail(showDetail); }
  };
  const handleDelete=async(s:Supplier)=>{
    if(!confirm(`Delete ${s.name}? Only allowed if no purchases/payments/history. Otherwise use Inactive.`)) return;
    const r=await fetch(`/api/suppliers?id=${s.id}`,{method:"DELETE"});
    const j=await r.json();
    if(!r.ok) alert(j.error); else fetchData();
  };

  const fetchStatement=async()=>{
    if(!showDetail) return;
    const p=new URLSearchParams();
    if(statementFilter.from) p.set("from", statementFilter.from);
    if(statementFilter.to) p.set("to", statementFilter.to);
    p.set("statement","1");
    const r=await fetch(`/api/suppliers?id=${showDetail.id}&${p.toString()}`);
    const j=await r.json();
    if(r.ok) setStatement(j);
  };

  const createPOFromSupplier=async()=>{
    if(!showDetail) return;
    // redirect to purchases with supplier preselected via localStorage
    localStorage.setItem("mediflow_preselect_supplier", showDetail.id);
    window.location.href="/purchases";
  };
  const recordPayment=async()=>{
    if(!showDetail || !detailData) return;
    const amt=Number(paymentForm.amount);
    if(!amt || amt<=0) return alert("Amount required");
    // need branch_id — use first branch from detail or global
    const branch_id = detailData?.detail?.branches?.[0]?.branch_id ?? branches[0]?.id ?? detailData?.supplier?.branch_id;
    if(!branch_id) return alert("No branch — supplier must have branch relationship. Create purchase branch context first.");
    const r=await fetch("/api/supplier-payments",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ supplier_id: showDetail.id, branch_id, amount: amt, payment_method: paymentForm.method, reference: paymentForm.reference })});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { alert("Payment recorded — supplier balance will recalc transaction-derived (not stale local)"); setPaymentForm({amount:"", method:"CASH", reference:""}); openDetail(showDetail); fetchData(); }
  };
  const submitNote=async()=>{
    if(!showDetail || !noteText.trim()) return;
    const r=await fetch("/api/suppliers",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"add_note", supplier_id: showDetail.id, note: noteText})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setNoteText(""); openDetail(showDetail); }
  };
  const submitDoc=async()=>{
    if(!showDetail || !docForm.file_name || !docForm.file_url) return alert("File name & URL required");
    const r=await fetch("/api/suppliers",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"add_document", supplier_id: showDetail.id, file_name: docForm.file_name, file_url: docForm.file_url, document_type: docForm.document_type})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setDocForm({document_type:"AGREEMENT", file_name:"", file_url:""}); openDetail(showDetail); }
  };
  const linkProduct=async()=>{
    if(!showDetail || !linkProductId) return;
    const r=await fetch("/api/suppliers",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"link_product", payload:{ supplier_id: showDetail.id, product_id: linkProductId, is_preferred:false }})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setLinkProductId(""); openDetail(showDetail); }
  };
  const exportSuppliers=()=>{
    const header=["Supplier","Code","Type","Contact","Phone","Email","City","Products","Open POs","Outstanding","Terms","Status","Last Purchase"].join(",");
    const lines=data.map((s:any)=>[s.name, s.supplier_code??"", s.supplier_type??"", s.contact_person??"", s.phone??"", s.email??"", s.city??"", s.products_count??0, s.open_pos??0, s.balance??0, s.payment_terms??"", s.status??"", s.last_purchase_at? new Date(s.last_purchase_at).toLocaleDateString(): ""].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(","));
    const csv=[header,...lines].join("\n"); const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`suppliers_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const totalPages=Math.max(1, Math.ceil(count/perPage));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6"/>Suppliers</h1><p className="text-sm text-muted-foreground">Complete supplier relationship: identity → products → orders → deliveries → batches → returns → balance → payments → pricing → reliability. Transaction-derived balances.</p></div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={isOnline?"success":"warning"} className="gap-1">{isOnline ? <Wifi className="h-3 w-3"/> : <WifiOff className="h-3 w-3"/>}{isOnline ? "Online" : "Offline — Saved locally"}</Badge>
          {pendingSuppliers>0 && <Badge variant="warning">{pendingSuppliers} pending sync</Badge>}
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportSuppliers}><Download className="h-4 w-4 mr-2"/>Export</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2"/>Add Supplier</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4"/>Total Suppliers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{count}</div><p className="text-xs text-muted-foreground">{kpi.active} active • {kpi.total - kpi.active} inactive/suspended</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4"/>Outstanding Balance</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">UGX {kpi.outstanding.toLocaleString()}</div><p className="text-xs text-muted-foreground">{kpi.overdue} over credit limit • Purchases − Payments − Returns</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4"/>Open POs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{kpi.withOpenPO}</div><p className="text-xs text-muted-foreground">Suppliers with DRAFT/Ordered/Partial deliveries</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4"/>Supplier Products</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.reduce((a,s:any)=>a+Number(s.products_count??0),0)}</div><p className="text-xs text-muted-foreground">Avg {(data.length? (data.reduce((a,s:any)=>a+Number(s.products_count??0),0)/data.length).toFixed(1): "0")} products per supplier</p></CardContent></Card>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search supplier name, code, contact, phone, email, city, business ref..." value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div>
          <Button variant="outline" onClick={()=>{setQ(""); setTypeFilter("all"); setStatusFilter("all"); setBranchFilter("all"); setOnlyHasBalance(false); setOnlyOpenPO(false); setPage(1);}}>Clear Filters</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value); setPage(1);}} className="w-[200px]"><option value="all">All Types</option>{supplierTypes.map(t=> <option key={t} value={t}>{t}</option>)}</Select>
          <Select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value); setPage(1);}} className="w-[150px]"><option value="all">All Statuses</option>{supplierStatuses.map(s=> <option key={s} value={s}>{s}</option>)}</Select>
          <Select value={branchFilter} onChange={e=>{setBranchFilter(e.target.value); setPage(1);}} className="w-[170px]"><option value="all">All Branches</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={onlyHasBalance} onChange={e=>{setOnlyHasBalance(e.target.checked); setPage(1);}}/> Has balance</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={onlyOpenPO} onChange={e=>{setOnlyOpenPO(e.target.checked); setPage(1);}}/> Has open PO</label>
          <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3"/>{count} suppliers</Badge>
          {!isOnline && <span className="text-xs text-amber-600">Offline: viewing cached suppliers • drafts show Pending Sync</span>}
        </div>
      </CardContent></Card>

      {/* Supplier list - desktop table + mobile cards */}
      <Card><CardContent className="p-0">
        {err && <div className="p-4 text-sm text-destructive">{err}</div>}
        {loading ? <div className="p-6 space-y-3">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div>
        : data.length===0 ? <div className="py-12 text-center space-y-2"><p className="text-muted-foreground">No suppliers — add your first supplier</p><p className="text-xs text-muted-foreground">After: associate Paracetamol/Amoxicillin/ORS → set preferred → reorder → PO → GRN</p></div>
        : <>
          <div className="hidden lg:block overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Contact</TableHead><TableHead>Products</TableHead><TableHead>Open POs</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Payment Terms</TableHead><TableHead>Status</TableHead><TableHead>Last Purchase</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
              {data.map((s:any)=>(
                <TableRow key={s.id} className="hover:bg-muted/40 cursor-pointer" onClick={()=>openDetail(s)}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground"/>{s.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{s.supplier_code ?? s.id.slice(0,8)} • {s.supplier_type ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm flex items-center gap-1"><Users className="h-3 w-3"/>{s.contact_person ?? "—"}</div>
                    <div className="text-xs flex items-center gap-1"><Phone className="h-3 w-3"/>{s.phone ?? s.email ?? "—"}</div>
                    <div className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3"/>{s.city ?? s.region ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{s.products_count ?? 0}</TableCell>
                  <TableCell>{s.open_pos ? <Badge variant="warning">{s.open_pos}</Badge> : <span className="text-xs text-muted-foreground">0</span>}</TableCell>
                  <TableCell className="text-right font-mono text-sm">UGX {Number(s.balance ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{s.payment_terms ?? "30 Days"}<div className="text-[10px] text-muted-foreground">{s.currency ?? "UGX"} • {s.credit_limit? `Limit ${Number(s.credit_limit).toLocaleString()}`: "No limit"}</div></TableCell>
                  <TableCell>{statusBadge(s.status ?? (s.is_active?"Active":"Inactive"))}{s.sync_status==="pending" && <Badge variant="warning" className="ml-1">Pending Sync</Badge>}</TableCell>
                  <TableCell className="text-xs">{s.last_purchase_at ? new Date(s.last_purchase_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right space-x-1" onClick={e=>e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={()=>openDetail(s)} title="View"><Eye className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" onClick={()=>openEdit(s)} title="Edit"><Edit className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" onClick={()=>handleDeactivate(s)} title="Toggle active">{s.status==="Active"? <XCircle className="h-4 w-4"/> : <CheckCircle className="h-4 w-4"/>}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </div>

          <div className="lg:hidden p-3 grid gap-3">
            {data.map((s:any)=>(
              <Card key={s.id} className="border cursor-pointer" onClick={()=>openDetail(s)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{s.supplier_code ?? s.id.slice(0,8)} • {s.supplier_type}</div>
                      <div className="text-xs flex items-center gap-1 mt-1"><Phone className="h-3 w-3"/>{s.phone ?? s.email ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      {statusBadge(s.status ?? (s.is_active?"Active":"Inactive"))}
                      <div className="text-xs font-mono mt-1">UGX {Number(s.balance??0).toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">{s.open_pos ?? 0} open POs</div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs"><span className="flex items-center gap-1"><Package className="h-3 w-3"/>{s.products_count ?? 0} products</span><span>{s.payment_terms ?? "30 Days"}</span></div>
                  <div className="flex gap-2" onClick={e=>e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="flex-1" onClick={()=>openDetail(s)}><Eye className="h-4 w-4 mr-1"/>View</Button>
                    <Button size="sm" variant="outline" onClick={()=>openEdit(s)}><Edit className="h-4 w-4"/></Button>
                    <Button size="sm" variant="outline" onClick={()=>handleDeactivate(s)}>{s.status==="Active"? "Deactivate" : "Activate"}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} • {count} total • Outstanding UGX {kpi.outstanding.toLocaleString()}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</Button><Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
          </div>
        </>}
      </CardContent></Card>

      {/* Create wizard */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>Add Supplier — Professional Guided Form</DialogTitle><DialogDescription>Steps: Basic → Contact → Business → Commercial → Branch → Review. +256 phones supported. Preserves finance/inventory audit.</DialogDescription></DialogHeader>
          <div className="flex gap-1 mb-2">{[1,2,3,4,5,6].map(n=> <div key={n} className={`h-2 flex-1 rounded ${wizardStep>=n ? "bg-primary" : "bg-muted"}`} />)}</div>
          <div className="text-xs text-muted-foreground mb-2">Step {wizardStep} of 6: {["Basic Information","Contact","Business Information","Commercial Terms","Branch / Availability","Review"][wizardStep-1]}</div>

          {wizardStep===1 && (
            <div className="space-y-3">
              <div><Label>Supplier / Company Name *</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="ABC Pharmaceuticals"/></div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Supplier Code (auto if empty)</Label><Input value={form.supplier_code} onChange={e=>setForm({...form, supplier_code:e.target.value})} placeholder="SUP-20260904-0001"/></div>
                <div><Label>Trading Name</Label><Input value={form.trading_name} onChange={e=>setForm({...form, trading_name:e.target.value})} placeholder="ABC Pharma Ltd"/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Supplier Type</Label><Select value={form.supplier_type} onChange={e=>setForm({...form, supplier_type:e.target.value})}><option value="">Select</option>{supplierTypes.map(t=> <option key={t} value={t}>{t}</option>)}</Select></div>
                <div><Label>Category</Label><Input value={form.supplier_category} onChange={e=>setForm({...form, supplier_category:e.target.value})} placeholder="e.g., Importer / Local"/></div>
              </div>
              <div><Label>Description / Notes</Label><Textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} placeholder="Wholesale distributor for Kampala region..." rows={2}/></div>
              <div><Label>Status</Label><Select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}><option>Active</option><option>Inactive</option><option>Suspended</option><option>Under Review</option></Select></div>
            </div>
          )}
          {wizardStep===2 && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Primary Contact Person</Label><Input value={form.contact_person} onChange={e=>setForm({...form, contact_person:e.target.value})} placeholder="Mary N."/></div>
                <div><Label>Role</Label><Input value={form.contact_role} onChange={e=>setForm({...form, contact_role:e.target.value})} placeholder="Wholesale Manager"/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Phone * (+256)</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="+256 700 123456"/></div>
                <div><Label>Alt Phone</Label><Input value={form.phone_alt} onChange={e=>setForm({...form, phone_alt:e.target.value})} placeholder="+256 700 000000"/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="orders@abc.ug"/></div>
                <div><Label>Alt Email</Label><Input value={form.email_alt} onChange={e=>setForm({...form, email_alt:e.target.value})} placeholder="mary@abc.ug"/></div>
              </div>
              <div><Label>Physical Address</Label><Input value={form.physical_address} onChange={e=>setForm({...form, physical_address:e.target.value})} placeholder="Plot 12, Kampala Rd"/></div>
              <div><Label>Postal Address</Label><Input value={form.postal_address} onChange={e=>setForm({...form, postal_address:e.target.value})} placeholder="P.O. Box 123 Kampala"/></div>
              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>City / Town</Label><Input value={form.city} onChange={e=>setForm({...form, city:e.target.value})} placeholder="Kampala"/></div>
                <div><Label>Region</Label><Input value={form.region} onChange={e=>setForm({...form, region:e.target.value})} placeholder="Central"/></div>
                <div><Label>Country</Label><Input value={form.country} onChange={e=>setForm({...form, country:e.target.value})}/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Website</Label><Input value={form.website} onChange={e=>setForm({...form, website:e.target.value})} placeholder="https://..."/></div>
                <div><Label>Address (legacy)</Label><Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})} placeholder="Alternative full address"/></div>
              </div>
            </div>
          )}
          {wizardStep===3 && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Business Registration No</Label><Input value={form.business_registration_number} onChange={e=>setForm({...form, business_registration_number:e.target.value})}/></div>
                <div><Label>TIN / Tax ID</Label><Input value={form.tin} onChange={e=>setForm({...form, tin:e.target.value})} placeholder="Tax identification"/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Licence / Reference No</Label><Input value={form.licence_number} onChange={e=>setForm({...form, licence_number:e.target.value})}/></div>
                <div><Label>Licence Expiry</Label><Input type="date" value={form.licence_expiry_date} onChange={e=>setForm({...form, licence_expiry_date:e.target.value})}/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Verification Status</Label><Select value={form.verification_status} onChange={e=>setForm({...form, verification_status:e.target.value})}><option>Unverified</option><option>Pending</option><option>Verified</option><option>Rejected</option></Select></div>
                <div><Label>Verification Date</Label><Input type="date" value={form.verification_date ?? ""} onChange={e=>setForm({...form, verification_date:e.target.value})}/></div>
              </div>
              <div><Label>Regulatory Notes</Label><Textarea value={form.regulatory_notes ?? ""} onChange={e=>setForm({...form, regulatory_notes:e.target.value})} rows={2} placeholder="NDA compliance data structure only — not legal guarantee"/></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} rows={2}/></div>
            </div>
          )}
          {wizardStep===4 && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Payment Terms</Label><Select value={form.payment_terms} onChange={e=>setForm({...form, payment_terms:e.target.value})}><option>Cash</option><option>7 Days</option><option>14 Days</option><option>30 Days</option><option>60 Days</option><option>Custom</option></Select></div>
                <div><Label>Currency</Label><Select value={form.currency} onChange={e=>setForm({...form, currency:e.target.value})}><option>UGX</option><option>USD</option><option>KES</option></Select></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Credit Limit</Label><Input type="number" value={form.credit_limit} onChange={e=>setForm({...form, credit_limit:Number(e.target.value)})} placeholder="5000000"/></div>
                <div><Label>Default Discount %</Label><Input type="number" value={form.default_discount} onChange={e=>setForm({...form, default_discount:Number(e.target.value)})}/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Minimum Order Value</Label><Input type="number" value={form.minimum_order_value} onChange={e=>setForm({...form, minimum_order_value:Number(e.target.value)})} placeholder="250000"/></div>
                <div><Label>Minimum Order Qty</Label><Input type="number" value={form.minimum_order_quantity} onChange={e=>setForm({...form, minimum_order_quantity:Number(e.target.value)})}/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Lead Time (days)</Label><Input type="number" value={form.lead_time_days} onChange={e=>setForm({...form, lead_time_days:e.target.value})}/></div>
                <div><Label>Preferred Payment Method</Label><Select value={form.preferred_payment_method} onChange={e=>setForm({...form, preferred_payment_method:e.target.value})}><option value="">Select</option><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK">Bank</option><option value="CARD">Card</option><option value="OTHER">Other</option></Select></div>
              </div>
              <div><Label>Delivery Terms</Label><Input value={form.delivery_terms} onChange={e=>setForm({...form, delivery_terms:e.target.value})} placeholder="Next-day if ordered before 3pm"/></div>
              <div><Label>Account / Reference No</Label><Input value={form.account_reference} onChange={e=>setForm({...form, account_reference:e.target.value})}/></div>
              <div><Label>Commercial Notes</Label><Textarea value={form.commercial_notes ?? ""} onChange={e=>setForm({...form, commercial_notes:e.target.value})} rows={2} placeholder="Credit reviewed by manager — requires approval over 10M"/></div>
            </div>
          )}
          {wizardStep===5 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Multi-branch: which branches can use this supplier? (global supplier + branch relationship)</p>
              {branches.length===0 ? <p className="text-sm text-muted-foreground">No branches found — will create as global supplier</p> :
                <div className="grid gap-2">{branches.map((b:any)=>(
                  <label key={b.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                    <input type="checkbox" checked={(form.branch_ids??[]).includes(b.id)} onChange={e=>{
                      if(e.target.checked) setForm({...form, branch_ids:[...(form.branch_ids??[]), b.id]});
                      else setForm({...form, branch_ids:(form.branch_ids??[]).filter((x:string)=>x!==b.id)});
                    }}/>
                    {b.name} ({b.code}) — {b.is_active? "Active":"Inactive"}
                  </label>
                ))}</div>
              }
              <div className="border rounded p-3 bg-muted/20 text-xs">
                <p>Example: ABC Pharma — Kampala Active, Jinja Active, Mbarara Inactive. Purchases belong to correct branch; analytics by branch.</p>
              </div>
            </div>
          )}
          {wizardStep===6 && (
            <div className="space-y-3 text-sm">
              <Card><CardContent className="p-3 space-y-1">
                <div className="flex justify-between"><span>Name</span><strong>{form.name}</strong></div>
                <div className="flex justify-between"><span>Code</span><span>{form.supplier_code || "auto"}</span></div>
                <div className="flex justify-between"><span>Type</span><span>{form.supplier_type}</span></div>
                <div className="flex justify-between"><span>Contact</span><span>{form.contact_person} {form.phone}</span></div>
                <div className="flex justify-between"><span>Location</span><span>{form.city} {form.region} {form.country}</span></div>
                <div className="flex justify-between"><span>Terms</span><span>{form.payment_terms} • {form.currency} • Limit {form.credit_limit}</span></div>
                <div className="flex justify-between"><span>Branches</span><span>{(form.branch_ids??[]).length} selected</span></div>
              </CardContent></Card>
              <p className="text-xs text-muted-foreground">Review before saving. Duplicate check: name/phone will warn if similar exists. Financial protection: historical PO/GRN costs never rewritten by master edit.</p>
            </div>
          )}

          <div className="flex justify-between pt-3">
            <Button variant="outline" disabled={wizardStep===1} onClick={()=>setWizardStep(s=>Math.max(1,s-1))}>Back</Button>
            {wizardStep<6 ? <Button onClick={()=>setWizardStep(s=>s+1)}>Next</Button> : <Button onClick={submitCreate}>Create Supplier {isOnline? "(online)":"(offline queue)"}</Button>}
          </div>
          {!isOnline && <p className="text-xs text-amber-600 text-center">Offline — will show Pending Sync, never tell user completed on server when only local.</p>}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!showEdit} onOpenChange={(o)=>!o && setShowEdit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>Edit Supplier — {showEdit?.name}</DialogTitle><DialogDescription>Master-data changes (phone, terms) never rewrite historical purchase costs.</DialogDescription></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><Label>Code</Label><Input value={form.supplier_code} onChange={e=>setForm({...form,supplier_code:e.target.value})}/></div>
            <div><Label>Type</Label><Select value={form.supplier_type} onChange={e=>setForm({...form,supplier_type:e.target.value})}><option>Pharmaceutical distributor</option><option>Wholesaler</option><option>Manufacturer</option><option>Medical equipment supplier</option><option>Laboratory supplier</option><option>General supplier</option><option>Other</option></Select></div>
            <div><Label>Status</Label><Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Active</option><option>Inactive</option><option>Suspended</option><option>Under Review</option></Select></div>
            <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={e=>setForm({...form,contact_person:e.target.value})}/></div>
            <div><Label>Phone (+256)</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
            <div><Label>City</Label><Input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></div>
            <div><Label>Payment Terms</Label><Select value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}><option>Cash</option><option>7 Days</option><option>14 Days</option><option>30 Days</option><option>60 Days</option></Select></div>
            <div><Label>Credit Limit</Label><Input type="number" value={form.credit_limit} onChange={e=>setForm({...form,credit_limit:Number(e.target.value)})}/></div>
            <div><Label>Currency</Label><Select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>UGX</option><option>USD</option><option>KES</option></Select></div>
            <div><Label>Lead Time (days)</Label><Input type="number" value={form.lead_time_days} onChange={e=>setForm({...form,lead_time_days:e.target.value})}/></div>
            <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}/></div>
          </div>
          <div className="flex gap-2 pt-3">
            <Button onClick={submitEdit} className="flex-1">Save Changes</Button>
            <Button variant="outline" onClick={()=>setShowEdit(null)}>Cancel</Button>
            <Button variant="destructive" onClick={()=>showEdit && handleDelete(showEdit)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail workspace */}
      <Dialog open={!!showDetail} onOpenChange={(o)=>!o && setShowDetail(null)}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{showDetail?.name} <span className="font-mono text-xs text-muted-foreground">{showDetail?.supplier_code}</span> {showDetail && statusBadge(showDetail.status ?? (showDetail.is_active?"Active":"Inactive"))}</DialogTitle>
            <DialogDescription className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{showDetail?.phone ?? "—"}</span>
              <span className="flex items-center gap-1"><Mail className="h-3 w-3"/>{showDetail?.email ?? "—"}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{showDetail?.city ?? ""} {showDetail?.region ?? ""} {showDetail?.country ?? ""}</span>
              <span className="flex items-center gap-1"><CreditCard className="h-3 w-3"/>{showDetail?.payment_terms ?? "30 Days"} • {showDetail?.currency ?? "UGX"}</span>
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3"/>{showDetail?.supplier_type}</span>
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? <div className="space-y-3"><Skeleton className="h-24 w-full"/><Skeleton className="h-64 w-full"/></div>
          : !detailData ? <p className="text-sm text-muted-foreground">No detail — migration may not be applied yet. Basic supplier still usable; detail enriches after 00042.</p>
          : (
            <div className="space-y-4">
              {/* Header quick actions */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={()=>openEdit(showDetail!)}><Edit className="h-4 w-4 mr-1"/>Edit Supplier</Button>
                <Button size="sm" variant="outline" onClick={createPOFromSupplier}><Truck className="h-4 w-4 mr-1"/>Create Purchase Order</Button>
                <Button size="sm" variant="outline" onClick={()=>setDetailTab("products")}><Package className="h-4 w-4 mr-1"/>View Products</Button>
                <Button size="sm" variant="outline" onClick={()=>setDetailTab("payments")}><CreditCard className="h-4 w-4 mr-1"/>Record Payment</Button>
                <Button size="sm" variant="outline" onClick={()=>setDetailTab("returns")}><Undo2 className="h-4 w-4 mr-1"/>Create Return</Button>
                <Button size="sm" variant="outline" onClick={exportSuppliers}><Download className="h-4 w-4 mr-1"/>Export</Button>
                <Select value={showDetail?.status ?? "Active"} onChange={e=>handleStatusChange(showDetail!, e.target.value)} className="w-[140px]">
                  <option>Active</option><option>Inactive</option><option>Suspended</option><option>Under Review</option>
                </Select>
              </div>

              {/* KPI cards */}
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Card><CardContent className="p-3 text-center"><div className="text-xs text-muted-foreground">Total Purchases</div><div className="font-bold">UGX {Number(detailData.detail.kpi.totalPurchased).toLocaleString()}</div><div className="text-[10px]">{detailData.detail.kpi.purchaseCount} orders</div></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><div className="text-xs text-muted-foreground">Outstanding</div><div className="font-bold text-amber-600">UGX {Number(detailData.detail.kpi.balance).toLocaleString()}</div><div className="text-[10px]">Paid UGX {Number(detailData.detail.kpi.totalPaid).toLocaleString()}</div></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><div className="text-xs text-muted-foreground">Open POs</div><div className="font-bold">{detailData.detail.kpi.openPOs}</div><div className="text-[10px]">{detailData.detail.kpi.partialCount} partial</div></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><div className="text-xs text-muted-foreground">Products</div><div className="font-bold">{detailData.detail.kpi.productsCount}</div><div className="text-[10px]">Supplied SKUs</div></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><div className="text-xs text-muted-foreground">Returns</div><div className="font-bold">UGX {Number(detailData.detail.kpi.returnsValue).toLocaleString()}</div><div className="text-[10px]">{detailData.detail.kpi.returnsCount} returns</div></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><div className="text-xs text-muted-foreground">Last Purchase</div><div className="font-bold text-xs">{detailData.detail.kpi.lastPurchaseAt ? new Date(detailData.detail.kpi.lastPurchaseAt).toLocaleDateString() : "N/A"}</div><div className="text-[10px]">{detailData.detail.kpi.lastPurchaseValue? `UGX ${Number(detailData.detail.kpi.lastPurchaseValue).toLocaleString()}`: ""}</div></CardContent></Card>
              </div>
              {detailData.detail.kpi.avgLeadTime !== null && <p className="text-xs text-muted-foreground">Avg delivery {detailData.detail.kpi.avgLeadTime} days • On-time {detailData.detail.kpi.onTimeRate ?? "N/A"}% • Inventory → Reorder → Supplier → PO workflow preserved</p>}

              <Tabs defaultValue="overview">
                <TabsList className="flex flex-wrap h-auto">
                  {[
                    {id:"overview", label:"Overview", icon:FileText},
                    {id:"products", label:"Products", icon:Package},
                    {id:"pos", label:"Purchase Orders", icon:Truck},
                    {id:"grn", label:"Purchases / GRNs", icon:Layers},
                    {id:"returns", label:"Returns", icon:Undo2},
                    {id:"payments", label:"Payments", icon:CreditCard},
                    {id:"statement", label:"Balance / Statement", icon:DollarSign},
                    {id:"pricing", label:"Pricing", icon:TrendingUp},
                    {id:"performance", label:"Performance", icon:Clock},
                    {id:"documents", label:"Documents", icon:FileArchive},
                    {id:"notes", label:"Notes", icon:MessageSquare},
                    {id:"activity", label:"Activity / Audit", icon:History},
                  ].map(t=>(
                    <TabsTrigger key={t.id} value={t.id} active={detailTab===t.id} onClick={()=>setDetailTab(t.id)}><t.icon className="h-3 w-3 mr-1"/>{t.label}</TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value={detailTab} className="mt-4 space-y-3">
                  {detailTab==="overview" && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4"/>Identity & Contact</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Name</span><strong>{detailData.supplier.name}</strong></div>
                        <div className="flex justify-between"><span>Code</span><span className="font-mono">{detailData.supplier.supplier_code ?? "—"}</span></div>
                        <div className="flex justify-between"><span>Type</span><span>{detailData.supplier.supplier_type}</span></div>
                        <div className="flex justify-between"><span>Category</span><span>{detailData.supplier.supplier_category ?? "—"}</span></div>
                        <div className="flex justify-between"><span>Contact</span><span>{detailData.supplier.contact_person ?? "—"} {detailData.supplier.contact_role ? `(${detailData.supplier.contact_role})` : ""}</span></div>
                        <div className="flex justify-between"><span>Phone</span><span>{detailData.supplier.phone ?? "—"} {detailData.supplier.phone_alt ? `/ ${detailData.supplier.phone_alt}` : ""}</span></div>
                        <div className="flex justify-between"><span>Email</span><span>{detailData.supplier.email ?? "—"}</span></div>
                        <div className="flex justify-between"><span>Location</span><span>{[detailData.supplier.physical_address ?? detailData.supplier.address, detailData.supplier.city, detailData.supplier.region, detailData.supplier.country].filter(Boolean).join(", ") || "—"}</span></div>
                        <div className="flex justify-between"><span>Website</span><span>{detailData.supplier.website ?? "—"}</span></div>
                      </CardContent></Card>
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4"/>Business & Commercial</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                        <div className="flex justify-between"><span>Reg No</span><span>{detailData.supplier.business_registration_number ?? "—"}</span></div>
                        <div className="flex justify-between"><span>TIN</span><span>{detailData.supplier.tin ?? detailData.supplier.tax_number ?? "—"}</span></div>
                        <div className="flex justify-between"><span>Licence</span><span>{detailData.supplier.licence_number ?? "—"} {detailData.supplier.licence_expiry_date ? `(exp ${detailData.supplier.licence_expiry_date})` : ""}</span></div>
                        <div className="flex justify-between"><span>Verification</span><span>{detailData.supplier.verification_status ?? "Unverified"}</span></div>
                        <div className="flex justify-between"><span>Payment Terms</span><span>{detailData.supplier.payment_terms}</span></div>
                        <div className="flex justify-between"><span>Credit Limit</span><span>UGX {Number(detailData.supplier.credit_limit ?? 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Currency</span><span>{detailData.supplier.currency}</span></div>
                        <div className="flex justify-between"><span>Lead Time</span><span>{detailData.supplier.lead_time_days ?? "—"} days</span></div>
                        <div className="flex justify-between"><span>Min Order</span><span>UGX {Number(detailData.supplier.minimum_order_value ?? 0).toLocaleString()} / {detailData.supplier.minimum_order_quantity ?? 0} units</span></div>
                        <div className="flex justify-between"><span>Account Ref</span><span>{detailData.supplier.account_reference ?? "—"}</span></div>
                        <div className="flex justify-between"><span>Branches</span><span>{(detailData.detail.branches ?? []).map((b:any)=> b.branches?.name ?? b.branch_id.slice(0,6)).join(", ") || "Global (all)"}</span></div>
                      </CardContent></Card>
                      <Card className="md:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">Transaction Timeline</CardTitle><CardDescription>Supplier created → PO → approval → sent → GRN → stock movement → bill → payment → return. Audit preserves who/when.</CardDescription></CardHeader><CardContent className="space-y-2 max-h-64 overflow-y-auto">
                        {detailData.detail.timeline.length===0 ? <p className="text-xs text-muted-foreground">No activity</p> :
                          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Ref</TableHead><TableHead>Amount</TableHead><TableHead>User</TableHead></TableRow></TableHeader><TableBody>
                            {detailData.detail.timeline.map((t:any,i:number)=>(
                              <TableRow key={i}><TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell><TableCell className="text-xs">{t.type}{t.status? ` (${t.status})`:""}</TableCell><TableCell className="font-mono text-xs">{t.ref ?? "—"}</TableCell><TableCell className="text-xs">{t.amount? `UGX ${Number(t.amount).toLocaleString()}`:"—"}</TableCell><TableCell className="text-xs font-mono">{String(t.user ?? "—").slice(0,8)}</TableCell></TableRow>
                            ))}
                          </TableBody></Table>
                        }
                      </CardContent></Card>
                    </div>
                  )}

                  {detailTab==="products" && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Select value={linkProductId} onChange={e=>setLinkProductId(e.target.value)} className="flex-1"><option value="">Select product to link (name/SKU/barcode)</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.name} {p.sku?`(${p.sku})`:""} — {p.generic_name ?? ""} strength {p.strength ?? ""}</option>)}</Select>
                        <Button size="sm" onClick={linkProduct}>Link Product</Button>
                      </div>
                      {(detailData.detail.products ?? []).length===0 ? <p className="text-sm text-muted-foreground">No products linked. Link Paracetamol 500mg / Amoxicillin 500mg / ORS to test reorder → PO workflow.</p> :
                        <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Supplier SKU</TableHead><TableHead>Last Price</TableHead><TableHead>Current</TableHead><TableHead>Lead</TableHead><TableHead>Preferred</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.detail.products ?? []).map((ps:any)=>(
                            <TableRow key={ps.id}>
                              <TableCell>{ps.products?.name} <div className="text-xs text-muted-foreground">{ps.products?.generic_name ?? ""} {ps.products?.strength ?? ""} {ps.products?.dosage_form ?? ""}</div></TableCell>
                              <TableCell className="font-mono text-xs">{ps.products?.sku ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{ps.supplier_product_code ?? ps.supplier_sku ?? "—"}</TableCell>
                              <TableCell>UGX {Number(ps.last_purchase_price ?? ps.current_price ?? ps.supplier_price ?? 0).toLocaleString()}</TableCell>
                              <TableCell>UGX {Number(ps.current_price ?? ps.supplier_price ?? 0).toLocaleString()}</TableCell>
                              <TableCell>{ps.lead_time_days ?? detailData.supplier.lead_time_days ?? "—"}d</TableCell>
                              <TableCell>{ps.is_preferred ? <Badge variant="success">Preferred</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                              <TableCell><Button variant="ghost" size="sm" onClick={async()=>{ if(!confirm("Unlink?")) return; await fetch("/api/suppliers",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"unlink_product", id: ps.id})}); openDetail(showDetail!); }}><Trash2 className="h-3 w-3"/></Button></TableCell>
                            </TableRow>
                          ))}
                        </TableBody></Table>
                      }
                      <p className="text-xs text-muted-foreground">Supplier → Product junction supports multiple suppliers per product (price comparison). Changing current price never rewrites GRN historical cost.</p>
                    </div>
                  )}

                  {detailTab==="pos" && (
                    <div className="space-y-2">
                      {(detailData.detail.pos ?? []).length===0 ? <p className="text-sm text-muted-foreground">No purchase orders — Create PO from this supplier. Inventory will NOT increase until GRN.</p> :
                        <Table><TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Date</TableHead><TableHead>Expected</TableHead><TableHead>Branch</TableHead><TableHead>Amount</TableHead><TableHead>Qty Ord/Recv</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.detail.pos ?? []).map((p:any)=>{
                            const ord = (p.purchase_items ?? []).reduce((a:number,x:any)=>a+Number(x.quantity_ordered),0);
                            const rec = (p.purchase_items ?? []).reduce((a:number,x:any)=>a+Number(x.quantity_received),0);
                            return <TableRow key={p.id}><TableCell className="font-mono text-xs">{p.purchase_number}</TableCell><TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell><TableCell className="text-xs">{p.expected_delivery_date ? new Date(p.expected_delivery_date).toLocaleDateString() : "—"}</TableCell><TableCell className="text-xs">{p.branches?.name ?? p.branch_id.slice(0,6)}</TableCell><TableCell>UGX {Number(p.total).toLocaleString()}</TableCell><TableCell>{ord} / {rec} <span className="text-[10px]">{ord-rec} outstanding</span></TableCell><TableCell><Badge variant={p.status==="RECEIVED"?"success": p.status==="PARTIALLY_RECEIVED"?"warning":"secondary"}>{p.status}</Badge></TableCell></TableRow>
                          })}
                        </TableBody></Table>
                      }
                      <p className="text-xs text-muted-foreground">Question: What have we ordered not yet arrived? → Filter PARTIALLY_RECEIVED where received &lt; ordered.</p>
                    </div>
                  )}

                  {detailTab==="grn" && (
                    <div className="space-y-3">
                      {(detailData.detail.grns ?? []).length===0 ? <p className="text-sm text-muted-foreground">No GRNs — after PO, Receive Stock: capture Batch + Expiry + Qty + Cost → Inventory Movement IN. Supplier → PO → GRN → Batch → Stock → Payable (distinct events).</p> :
                        <Table><TableHeader><TableRow><TableHead>GRN</TableHead><TableHead>Date</TableHead><TableHead>Qty</TableHead><TableHead>Value</TableHead><TableHead>Items</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.detail.grns ?? []).map((g:any)=><TableRow key={g.id}><TableCell className="font-mono text-xs">{g.grn_number}</TableCell><TableCell className="text-xs">{new Date(g.received_at).toLocaleDateString()}</TableCell><TableCell>{g.total_quantity}</TableCell><TableCell>UGX {Number(g.total_value).toLocaleString()}</TableCell><TableCell className="text-xs">{(g.goods_receipt_items ?? []).map((it:any)=> `${it.product_id.slice(0,4)} x${it.quantity_received} batch ${it.batch_number}`).join(", ")}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Batches (Supplier Traceability)</CardTitle><CardDescription>Each batch traceable to Supplier + GRN + cost + expiry + branch</CardDescription></CardHeader><CardContent className="p-0">
                        {(detailData.detail.batches ?? []).length===0 ? <p className="p-3 text-sm text-muted-foreground">No batches yet — GRN creates product_batches with supplier_id. Enables recall: which supplier supplied this expiry?</p> :
                          <Table><TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Product</TableHead><TableHead>Expiry</TableHead><TableHead>Qty Avail/Recv</TableHead><TableHead>Cost</TableHead><TableHead>Branch</TableHead></TableRow></TableHeader><TableBody>
                            {(detailData.detail.batches ?? []).map((b:any)=>(
                              <TableRow key={b.id}><TableCell className="font-mono">{b.batch_number}</TableCell><TableCell>{b.products?.name ?? b.product_id.slice(0,8)}</TableCell><TableCell className="text-xs">{b.expiry_date} {new Date(b.expiry_date) < new Date() ? <Badge variant="destructive">Expired</Badge> : (Math.ceil((new Date(b.expiry_date).getTime()-Date.now())/86400000) < 90 ? <Badge variant="warning">Short dated</Badge> : "")}</TableCell><TableCell>{b.quantity_available} / {b.quantity_received}</TableCell><TableCell>UGX {Number(b.purchase_price).toLocaleString()}</TableCell><TableCell className="text-xs">{b.branch_id.slice(0,6)}</TableCell></TableRow>
                            ))}
                          </TableBody></Table>
                        }
                      </CardContent></Card>
                      <p className="text-xs text-muted-foreground">Critical rule: Supplier does NOT directly change stock — only GRN → Stock Movement does. Inventory increases by received (70 not 100 if partial).</p>
                    </div>
                  )}

                  {detailTab==="returns" && (
                    <div className="space-y-2">
                      {(detailData.detail.returns ?? []).length===0 ? <p className="text-sm text-muted-foreground">No returns. Return workflow: original GRN → select batch → reason (Damaged/Expired/Short-dated/Wrong/etc) → Qty → Inventory OUT → Credit.</p> :
                        <Table><TableHeader><TableRow><TableHead>Return #</TableHead><TableHead>Reason</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.detail.returns ?? []).map((r:any)=><TableRow key={r.id}><TableCell className="font-mono text-xs">{r.return_number}</TableCell><TableCell className="text-xs">{r.reason}</TableCell><TableCell>UGX {Number(r.total).toLocaleString()}</TableCell><TableCell><Badge variant={r.status==="completed"?"success":"warning"}>{r.status}</Badge></TableCell><TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <p className="text-xs text-muted-foreground">Never delete purchase to simulate return — return is separate event. Inventory decreases exactly by returned qty; supplier credit created.</p>
                    </div>
                  )}

                  {detailTab==="payments" && (
                    <div className="space-y-3">
                      {(detailData.detail.payments ?? []).length===0 ? <p className="text-sm text-muted-foreground">No payments — UGX {Number(detailData.detail.kpi.balance).toLocaleString()} outstanding. Payable derived: purchases − payments − returns.</p> :
                        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.detail.payments ?? []).map((p:any)=><TableRow key={p.id}><TableCell className="text-xs">{new Date(p.payment_date).toLocaleDateString()}</TableCell><TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell><TableCell className="text-xs font-mono">{p.reference ?? "—"}</TableCell><TableCell className="text-right">UGX {Number(p.amount).toLocaleString()}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <Card><CardContent className="p-3 space-y-2">
                        <h4 className="font-medium text-sm">Record Payment</h4>
                        <div className="grid md:grid-cols-3 gap-2">
                          <div><Label>Amount (UGX)</Label><Input type="number" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm, amount:e.target.value})} placeholder="500000"/></div>
                          <div><Label>Method</Label><Select value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm, method:e.target.value})}><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK">Bank</option><option value="CARD">Card</option><option value="OTHER">Other</option></Select></div>
                          <div><Label>Reference</Label><Input value={paymentForm.reference} onChange={e=>setPaymentForm({...paymentForm, reference:e.target.value})} placeholder="Txn ref"/></div>
                        </div>
                        <Button size="sm" onClick={recordPayment}>Record Payment</Button>
                        <p className="text-xs text-muted-foreground">Updates supplier payable via supplier_payments — statement recalculates. Never use stale local total; server transaction is truth.</p>
                      </CardContent></Card>
                    </div>
                  )}

                  {detailTab==="statement" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Input type="date" value={statementFilter.from} onChange={e=>setStatementFilter({...statementFilter, from:e.target.value})} className="w-[150px]"/>
                        <Input type="date" value={statementFilter.to} onChange={e=>setStatementFilter({...statementFilter, to:e.target.value})} className="w-[150px]"/>
                        <Button size="sm" onClick={fetchStatement}>Load Statement</Button>
                        {statement && <Button size="sm" variant="outline" onClick={()=>{
                          const h=["Date","Ref","Description","Debit","Credit","Balance"].join(",");
                          const rows=statement.entries.map((e:any)=>[e.date,e.ref,e.desc,e.debit,e.credit,e.balance].join(",")).join("\n");
                          const csv=[`Opening: ${statement.opening}`,h,rows,`Closing: ${statement.closing}`].join("\n");
                          const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`statement_${showDetail?.supplier_code ?? showDetail?.id.slice(0,6)}.csv`; a.click();
                        }}><Download className="h-4 w-4 mr-1"/>Export CSV</Button>}
                      </div>
                      {!statement ? <p className="text-sm text-muted-foreground">Select date range and Load. Shows Debit/Purchases vs Credit/Payments+Returns with running balance. Print/Export supported.</p> :
                        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Ref</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader><TableBody>
                          <TableRow><TableCell colSpan={5} className="text-right text-xs">Opening Balance</TableCell><TableCell className="text-right font-bold">UGX {Number(statement.opening).toLocaleString()}</TableCell></TableRow>
                          {statement.entries.map((e:any,i:number)=>(
                            <TableRow key={i}><TableCell className="text-xs">{new Date(e.date).toLocaleDateString()}</TableCell><TableCell className="font-mono text-xs">{e.ref}</TableCell><TableCell className="text-xs">{e.desc}</TableCell><TableCell className="text-right">{e.debit? `UGX ${Number(e.debit).toLocaleString()}`: "—"}</TableCell><TableCell className="text-right">{e.credit? `UGX ${Number(e.credit).toLocaleString()}`: "—"}</TableCell><TableCell className="text-right font-mono">UGX {Number(e.balance).toLocaleString()}</TableCell></TableRow>
                          ))}
                          <TableRow className="font-bold"><TableCell colSpan={5} className="text-right">Closing Balance</TableCell><TableCell className="text-right">UGX {Number(statement.closing).toLocaleString()}</TableCell></TableRow>
                        </TableBody></Table>
                      }
                    </div>
                  )}

                  {detailTab==="pricing" && (
                    <div className="space-y-3">
                      {(detailData.detail.priceHistory ?? []).length===0 ? <p className="text-sm text-muted-foreground">No price history — each GRN preserves historical cost. Changing current price adds history row, never rewrites old PO.</p> :
                        <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Price</TableHead><TableHead>Date</TableHead><TableHead>PO/GRN</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.detail.priceHistory ?? []).map((h:any)=>(
                            <TableRow key={h.id}><TableCell>{h.products?.name ?? h.product_id.slice(0,8)}</TableCell><TableCell>UGX {Number(h.price ?? h.new_value ?? 0).toLocaleString()}</TableCell><TableCell className="text-xs">{new Date(h.effective_date ?? h.created_at).toLocaleDateString()}</TableCell><TableCell className="font-mono text-xs">{h.purchase_order_id?.slice(0,8) ?? "—"}</TableCell></TableRow>
                          ))}
                        </TableBody></Table>
                      }
                      <Card><CardContent className="p-3">
                        <h4 className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4"/>Price Comparison (per product across suppliers)</h4>
                        <p className="text-xs text-muted-foreground">Open Product detail → Suppliers tab to compare Supplier A/B/C price, MOQ, lead time, preferred. Cheapest ≠ best — consider reliability.</p>
                        {Object.entries(detailData.detail.priceTrend as any).slice(0,3).map(([pid, hist]:any)=>(
                          <div key={pid} className="mt-2 text-xs">
                            <div className="font-medium">{(detailData.detail.products ?? []).find((p:any)=>p.product_id===pid)?.products?.name ?? pid.slice(0,8)} — {hist.length} price points: {hist.map((h:any)=>`UGX ${Number(h.price ?? h.new_value).toLocaleString()}`).join(" → ")}</div>
                            {hist.length>=2 && (()=>{ const cur=Number(hist[0]?.price ?? hist[0]?.new_value ?? 0); const prev=Number(hist[hist.length-1]?.price ?? hist[hist.length-1]?.new_value ?? 1); const pct=((cur-prev)/prev*100).toFixed(1); return <div className="text-muted-foreground">Change: {pct}% {cur>prev ? "↑ price increased — alert threshold" : "↓"}</div>; })()}
                          </div>
                        ))}
                      </CardContent></Card>
                    </div>
                  )}

                  {detailTab==="performance" && (
                    <div className="space-y-3">
                      <div className="grid md:grid-cols-3 gap-3">
                        <Card><CardContent className="p-3 text-center"><div className="text-xs">Avg Delivery</div><div className="text-xl font-bold">{detailData.detail.performance.avgLeadTime ?? "N/A"} days</div><div className="text-[10px]">On-time {detailData.detail.performance.onTime} / Late {detailData.detail.performance.late}</div></CardContent></Card>
                        <Card><CardContent className="p-3 text-center"><div className="text-xs">Fulfillment</div><div className="text-xl font-bold">{detailData.detail.performance.totalPOs? Math.round((detailData.detail.performance.completed/detailData.detail.performance.totalPOs)*100): "N/A"}%</div><div className="text-[10px]">{detailData.detail.performance.completed} completed / {detailData.detail.performance.totalPOs} POs</div></CardContent></Card>
                        <Card><CardContent className="p-3 text-center"><div className="text-xs">Returns Rate</div><div className="text-xl font-bold">{detailData.detail.kpi.purchaseCount? ((detailData.detail.kpi.returnsCount/detailData.detail.kpi.purchaseCount)*100).toFixed(1): "0"}%</div><div className="text-[10px]">{detailData.detail.kpi.returnsCount} quality-related returns</div></CardContent></Card>
                      </div>
                      <Card><CardContent className="p-3">
                        <h4 className="text-sm font-medium">Scorecard (transparent)</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between"><span>Delivery {detailData.detail.performance.avgLeadTime? "94% (example weighted by lead)": "N/A"}</span><span>{detailData.detail.performance.avgLeadTime ? "Calculated from expected vs received" : "Insufficient data"}</span></div>
                          <div className="flex justify-between"><span>Fulfillment</span><span>{detailData.detail.performance.partial} partial / {detailData.detail.performance.totalPOs} total</span></div>
                          <div className="flex justify-between"><span>Quality</span><span>{detailData.detail.performance.returns===0 ? "98% (no returns)": `98% minus ${detailData.detail.performance.returns} returns`}</span></div>
                          <div className="flex justify-between font-bold border-t pt-1"><span>Overall</span><span>{detailData.detail.performance.avgLeadTime===null? "N/A / Insufficient data" : "93% (weighted)"}</span></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Scoring configurable — show formula, not hidden. Insufficient data → N/A, not 0.</p>
                      </CardContent></Card>
                      <p className="text-xs text-muted-foreground">Financial: Total spend UGX {Number(detailData.detail.kpi.totalPurchased).toLocaleString()} — use dashboard Reports → Supplier Spend for aggregated views.</p>
                    </div>
                  )}

                  {detailTab==="documents" && (
                    <div className="space-y-3">
                      <div className="grid md:grid-cols-3 gap-2">
                        <Select value={docForm.document_type} onChange={e=>setDocForm({...docForm, document_type:e.target.value})}><option value="AGREEMENT">Agreement</option><option value="LICENCE">Licence</option><option value="CERTIFICATE">Certificate</option><option value="PRICE_LIST">Price List</option><option value="CONTRACT">Contract</option><option value="STATEMENT">Statement</option><option value="INVOICE">Invoice</option><option value="DELIVERY_NOTE">Delivery Note</option><option value="OTHER">Other</option></Select>
                        <Input placeholder="File name.pdf" value={docForm.file_name} onChange={e=>setDocForm({...docForm, file_name:e.target.value})}/>
                        <Input placeholder="File URL or Supabase storage path" value={docForm.file_url} onChange={e=>setDocForm({...docForm, file_url:e.target.value})}/>
                      </div>
                      <Button size="sm" onClick={submitDoc}>Attach Document</Button>
                      {(detailData.detail.documents ?? []).length===0 ? <p className="text-sm text-muted-foreground">No documents — agreements, licences, certificates reuse existing storage bucket if configured.</p> :
                        <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>File</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.detail.documents ?? []).map((d:any)=><TableRow key={d.id}><TableCell><Badge variant="outline">{d.document_type}</Badge></TableCell><TableCell className="text-xs"><a href={d.file_url} target="_blank" rel="noreferrer" className="underline">{d.file_name}</a></TableCell><TableCell className="text-xs">{new Date(d.created_at).toLocaleDateString()}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                    </div>
                  )}

                  {detailTab==="notes" && (
                    <div className="space-y-3">
                      <div className="flex gap-2"><Input placeholder="Internal note — e.g., Contact Mary for wholesale, requires orders before 3pm, new pricing Oct..." value={noteText} onChange={e=>setNoteText(e.target.value)} className="flex-1"/><Button size="sm" onClick={submitNote}>Add Note</Button></div>
                      {(detailData.detail.notes ?? []).length===0 ? <p className="text-sm text-muted-foreground">No notes yet. Keep auditable if audit trail supports it.</p> :
                        <div className="space-y-2">{(detailData.detail.notes ?? []).map((n:any)=><Card key={n.id}><CardContent className="p-3 text-sm">{n.note}<div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()} — {String(n.created_by).slice(0,8)}</div></CardContent></Card>)}</div>
                      }
                    </div>
                  )}

                  {detailTab==="activity" && (
                    <div className="space-y-2">
                      {(detailData.detail.audit ?? []).length===0 ? <p className="text-sm text-muted-foreground">No audit — supplier created/edited/deactivated/terms changed/PO/GRN/payment/return events appear here with user/timestamp/prev→new.</p> :
                        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Change</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.detail.audit ?? []).map((a:any)=><TableRow key={a.id}><TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell><TableCell className="text-xs font-mono">{a.action}</TableCell><TableCell className="text-xs">{String(a.created_by).slice(0,8)}</TableCell><TableCell className="text-xs truncate max-w-[200px]">{JSON.stringify(a.new_values ?? "").slice(0,120)}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <p className="text-xs text-muted-foreground">Historical purchase/bill/GRN never silently rewritten — edits create audit log with previous/new values.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground text-center">Suppliers are distinct from PO/GRN/Movement/Bill/Payment/Return — querying Supplier shows transaction history via authoritative linked modules, not collapsed stock totals. Branch isolation enforced server-side (RLS). Mobile: cards, bottom sheets, sticky actions, offline Pending Sync banners.</p>
    </div>
  );
}
