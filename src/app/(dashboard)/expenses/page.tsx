"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, DollarSign, Eye, Edit, Trash2, Download, Filter, Wifi, WifiOff, RefreshCw, Receipt, Building2, Users, Calendar, CreditCard, FileText, History, Undo2, Copy, Printer, Paperclip, AlertTriangle, TrendingUp } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { queueExpenseCreate, getExpensePendingCount } from "@/lib/offline/sync";

type Expense = { id:string; expense_number?:string; expense_date:string; category:string; category_id?:string; supplier_id?:string; description:string; amount:number; tax_amount?:number; total_amount?:number; payment_method:string; payment_status:string; approval_status:string; posting_status:string; branch_id:string; reference_number?:string; notes?:string; created_by?:string; suppliers?:{name:string}; branches?:{name:string}; expense_categories?:{name:string; code:string} };

export default function ExpensesPage(){
  const {isOnline}=useOnlineStatus();
  const [loading,setLoading]=React.useState(true);
  const [q,setQ]=React.useState("");
  const [debouncedQ,setDebouncedQ]=React.useState("");
  const [branchFilter,setBranchFilter]=React.useState("all");
  const [catFilter,setCatFilter]=React.useState("all");
  const [payMethodFilter,setPayMethodFilter]=React.useState("all");
  const [approvalFilter,setApprovalFilter]=React.useState("all");
  const [paymentStatusFilter,setPaymentStatusFilter]=React.useState("all");
  const [supplierFilter,setSupplierFilter]=React.useState("all");
  const [dateFrom,setDateFrom]=React.useState("");
  const [dateTo,setDateTo]=React.useState("");
  const [amountMin,setAmountMin]=React.useState("");
  const [amountMax,setAmountMax]=React.useState("");
  const [page,setPage]=React.useState(1);
  const [data,setData]=React.useState<Expense[]>([]);
  const [count,setCount]=React.useState(0);
  const [summary,setSummary]=React.useState<any>(null);
  const [kpi,setKpi]=React.useState<any>(null);
  const [categories,setCategories]=React.useState<any[]>([]);
  const [suppliers,setSuppliers]=React.useState<any[]>([]);
  const [branches,setBranches]=React.useState<any[]>([]);
  const [cashAccounts,setCashAccounts]=React.useState<any[]>([]);
  const [showCreate,setShowCreate]=React.useState(false);
  const [showDetail,setShowDetail]=React.useState<Expense|null>(null);
  const [detailData,setDetailData]=React.useState<any>(null);
  const [detailTab,setDetailTab]=React.useState("overview");
  const [showEdit,setShowEdit]=React.useState<Expense|null>(null);
  const [pendingCount,setPendingCount]=React.useState(0);
  const [createTab,setCreateTab]=React.useState("basic");
  const perPage=20;

  // form state
  const [form,setForm]=React.useState({branch_id:"", category_id:"", supplier_id:"", description:"", reference_number:"", notes:"", amount:"", tax_amount:"0", tax_inclusive:false, currency:"UGX", exchange_rate:"1", payment_method:"CASH", payment_account_id:"", expense_date:new Date().toISOString().slice(0,10), lines: [] as any[]});
  const [editForm,setEditForm]=React.useState<any>({});
  const [attachForm,setAttachForm]=React.useState({file_name:"", file_url:"", document_type:"RECEIPT"});
  const [rejectReason,setRejectReason]=React.useState("");
  const [reverseReason,setReverseReason]=React.useState("");
  const [showReject,setShowReject]=React.useState<Expense|null>(null);
  const [showReverse,setShowReverse]=React.useState<Expense|null>(null);

  React.useEffect(()=>{ const id=setTimeout(()=>setDebouncedQ(q),300); return ()=>clearTimeout(id); },[q]);
  React.useEffect(()=>{
    getExpensePendingCount().then(c=>setPendingCount(c)).catch(()=>{});
    const id=setInterval(()=> getExpensePendingCount().then(c=>setPendingCount(c)).catch(()=>{}), 5000);
    return ()=>clearInterval(id);
  },[]);

  const fetchAll=React.useCallback(async()=>{
    setLoading(true);
    const params=new URLSearchParams();
    if(branchFilter!=="all") params.set("branch_id", branchFilter);
    if(catFilter!=="all") params.set("category_id", catFilter);
    if(supplierFilter!=="all") params.set("supplier_id", supplierFilter);
    if(payMethodFilter!=="all") params.set("payment_method", payMethodFilter);
    if(approvalFilter!=="all") params.set("approval_status", approvalFilter);
    if(paymentStatusFilter!=="all") params.set("payment_status", paymentStatusFilter);
    if(debouncedQ) params.set("search", debouncedQ);
    if(dateFrom) params.set("date_from", dateFrom);
    if(dateTo) params.set("date_to", dateTo);
    if(amountMin) params.set("amount_min", amountMin);
    if(amountMax) params.set("amount_max", amountMax);
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    const [ex, catRes, supRes, setRes, kpiRes]=await Promise.all([
      fetch(`/api/expenses?${params.toString()}`).then(r=>r.json()).catch(()=>({data:[], count:0})),
      fetch(`/api/expenses?categories=1`).then(r=>r.json()).catch(()=>[]),
      fetch(`/api/suppliers`).then(r=>r.json()).catch(()=>[]),
      fetch(`/api/settings`).then(r=>r.json()).catch(()=>({branches:[]})),
      fetch(`/api/expenses?kpi=1${branchFilter!=="all"?`&branch_id=${branchFilter}`:""}`).then(r=>r.json()).catch(()=>null),
    ]);
    const list = ex.data ?? [];
    setData(list);
    setCount(ex.count ?? list.length);
    setSummary(ex.summary ?? null);
    setKpi(kpiRes);
    const cats = Array.isArray(catRes) ? catRes : (catRes.data ?? catRes);
    setCategories(cats ?? []);
    const supList = Array.isArray(supRes) ? supRes : (supRes.data ?? []);
    setSuppliers(supList);
    const br = setRes.branches ?? [];
    setBranches(br);
    // cash accounts: registers + fallback
    try{
      const r = await fetch(`/api/cash?registers=1${branchFilter!=="all"?`&branch_id=${branchFilter}`:""}`).then(x=>x.json()).catch(()=>[]);
      setCashAccounts(Array.isArray(r)?r: r.data ?? []);
    }catch{}
    if(!form.branch_id && br[0]) setForm(f=>({...f, branch_id: br[0].id}));
    if(!form.category_id && cats?.[0]) setForm(f=>({...f, category_id: cats[0].value ?? cats[0].id}));
    setLoading(false);
  },[branchFilter, catFilter, supplierFilter, payMethodFilter, approvalFilter, paymentStatusFilter, debouncedQ, dateFrom, dateTo, amountMin, amountMax, page]);
  React.useEffect(()=>{ fetchAll(); },[fetchAll]);

  const addLine=()=> setForm({...form, lines:[...form.lines, {category_id:form.category_id ?? "", description:"", amount:0, tax_amount:0}]});
  const updateLine=(i:number, patch:any)=> setForm({...form, lines: form.lines.map((l,idx)=> idx===i ? {...l, ...patch}: l)});
  const removeLine=(i:number)=> setForm({...form, lines: form.lines.filter((_,idx)=>idx!==i)});

  const submitCreate=async()=>{
    const payload:any = {
      branch_id: form.branch_id,
      category_id: form.category_id || undefined,
      category: categories.find(c=> (c.value??c.id)===form.category_id)?.code ?? categories.find(c=> (c.value??c.id)===form.category_id)?.label ?? form.category_id,
      supplier_id: form.supplier_id || null,
      description: form.description,
      reference_number: form.reference_number || null,
      amount: Number(form.amount),
      tax_amount: Number(form.tax_amount ?? 0),
      tax_inclusive: form.tax_inclusive,
      currency: form.currency,
      exchange_rate: Number(form.exchange_rate ?? 1),
      payment_method: form.payment_method,
      payment_account_id: form.payment_account_id || null,
      expense_date: form.expense_date,
      notes: form.notes || null,
      lines: form.lines.length? form.lines.map(l=>({category_id:l.category_id, description:l.description, amount:Number(l.amount), tax_amount:Number(l.tax_amount??0)})): undefined,
    };
    if(!payload.branch_id || !payload.category_id || !payload.description || !(payload.amount>0)) return alert("Branch, Category, Description, Amount required. Amount >0");
    if(payload.lines && payload.lines.length){
      const sum = payload.lines.reduce((s:any,l:any)=> s+Number(l.amount)+Number(l.tax_amount??0),0);
      const total = Number(payload.amount)+Number(payload.tax_amount??0);
      if(Math.abs(sum-total)>0.01) return alert(`Line total ${sum} must equal expense total ${total}`);
    }
    if(!isOnline){
      await queueExpenseCreate(payload as any);
      alert("Offline — expense queued locally (Pending Sync). Will sync when online with idempotency.");
      setShowCreate(false);
      setForm({branch_id: branches[0]?.id ?? "", category_id: categories[0]?.value ?? categories[0]?.id ?? "", supplier_id:"", description:"", reference_number:"", notes:"", amount:"", tax_amount:"0", tax_inclusive:false, currency:"UGX", exchange_rate:"1", payment_method:"CASH", payment_account_id:"", expense_date:new Date().toISOString().slice(0,10), lines:[]});
      setPendingCount(c=>c+1);
      return;
    }
    const r=await fetch("/api/expenses",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
    const j=await r.json();
    if(!r.ok) alert(j.error || "Failed"); else {
      if(j.warning) alert(j.warning);
      setShowCreate(false);
      setForm({branch_id: branches[0]?.id ?? "", category_id: categories[0]?.value ?? categories[0]?.id ?? "", supplier_id:"", description:"", reference_number:"", notes:"", amount:"", tax_amount:"0", tax_inclusive:false, currency:"UGX", exchange_rate:"1", payment_method:"CASH", payment_account_id:"", expense_date:new Date().toISOString().slice(0,10), lines:[]});
      fetchAll();
    }
  };

  const openDetail=async(p:Expense)=>{
    setShowDetail(p);
    setDetailTab("overview");
    const r=await fetch(`/api/expenses?id=${p.id}`);
    const j=await r.json();
    setDetailData(j);
  };
  const handleAction=async(id:string, action:string, extra?:any)=>{
    if(action==='approve' && !confirm("Approve this expense?")) return;
    if(action==='pay' && !confirm("Mark as Paid? This will create cash movement & post to ledger.")) return;
    if(action==='cancel' && !confirm("Cancel this expense?")) return;
    const body:any={id, action, ...extra};
    const r=await fetch("/api/expenses",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { fetchAll(); if(showDetail) openDetail(showDetail); setShowReject(null); setShowReverse(null); }
  };
  const handleEdit=async()=>{
    if(!showEdit) return;
    const payload:any={...editForm};
    if(payload.amount) payload.amount=Number(payload.amount);
    if(payload.tax_amount) payload.tax_amount=Number(payload.tax_amount);
    const r=await fetch(`/api/expenses?id=${showEdit.id}`,{method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setShowEdit(null); fetchAll(); if(showDetail) openDetail(showDetail); }
  };
  const handleDuplicate=async(id:string)=>{
    if(!confirm("Duplicate this expense as new DRAFT?")) return;
    const r=await fetch("/api/expenses",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({duplicate_id:id})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { alert(`Duplicated as ${j.expense_number ?? j.id}`); fetchAll(); }
  };
  const handleAttach=async()=>{
    if(!showDetail) return;
    if(!attachForm.file_name || !attachForm.file_url) return alert("File name and URL required");
    const r=await fetch("/api/expenses",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({expense_id: showDetail.id, file_name: attachForm.file_name, file_url: attachForm.file_url, document_type: attachForm.document_type})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setAttachForm({file_name:"", file_url:"", document_type:"RECEIPT"}); openDetail(showDetail); }
  };
  const handlePrint=()=>{
    if(!detailData) return;
    const w=window.open("","_blank");
    if(!w) return;
    w.document.write(`<html><head><title>Expense ${detailData.expense_number ?? detailData.id}</title><style>body{font-family:sans-serif;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body><h1>Expense ${detailData.expense_number ?? detailData.id.slice(0,8)}</h1><p>Date: ${new Date(detailData.expense_date).toLocaleDateString()} • Branch: ${detailData.branches?.name ?? detailData.branch_id.slice(0,6)} • Category: ${detailData.category}</p><table><tr><th>Description</th><td>${detailData.description}</td></tr><tr><th>Amount</th><td>UGX ${Number(detailData.amount).toLocaleString()}</td></tr><tr><th>Tax</th><td>UGX ${Number(detailData.tax_amount??0).toLocaleString()}</td></tr><tr><th>Total</th><td><strong>UGX ${Number(detailData.total_amount??detailData.amount).toLocaleString()}</strong></td></tr><tr><th>Payment</th><td>${detailData.payment_method} • ${detailData.payment_status}</td></tr><tr><th>Approval</th><td>${detailData.approval_status}</td></tr><tr><th>Reference</th><td>${detailData.reference_number ?? "—"}</td></tr></table><p>${detailData.notes ?? ""}</p><script>window.print()</script></body></html>`);
    w.document.close();
  };
  const badgeApproval=(s:string)=>{
    if(s==="DRAFT") return <Badge variant="secondary">Draft</Badge>;
    if(s==="PENDING_APPROVAL"||s==="PENDING") return <Badge className="bg-amber-500 text-white">Pending</Badge>;
    if(s==="APPROVED") return <Badge variant="success">Approved</Badge>;
    if(s==="REJECTED") return <Badge variant="destructive">Rejected</Badge>;
    if(s==="CANCELLED") return <Badge variant="destructive">Cancelled</Badge>;
    if(s==="REVERSED") return <Badge variant="destructive">Reversed</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };
  const badgePayment=(s:string)=>{
    if(s==="PAID") return <Badge variant="success">Paid</Badge>;
    if(s==="UNPAID") return <Badge variant="warning">Unpaid</Badge>;
    if(s==="PARTIALLY_PAID") return <Badge className="bg-amber-500 text-white">Partial</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };
  const totalPages=Math.max(1, Math.ceil(count/perPage));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6"/>Expenses</h1><p className="text-muted-foreground text-sm">Operating costs → Expense Account → Payment Account → Ledger • Expense ≠ Purchase • Expense ≠ Supplier Bill • Expense ≠ Payment</p></div>
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant={isOnline?"success":"warning"} className="gap-1">{isOnline ? <Wifi className="h-3 w-3"/> : <WifiOff className="h-3 w-3"/>}{isOnline?"Online":"Offline"}</Badge>
          {pendingCount>0 && <Badge variant="warning">{pendingCount} pending sync</Badge>}
          <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
          <Button onClick={()=>setShowCreate(true)}><Plus className="h-4 w-4 mr-2"/>New Expense</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4"/>Total Expenses</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">UGX {(kpi?.total ?? summary?.total ?? 0).toLocaleString()}</div><p className="text-xs text-muted-foreground">{count} transactions • Respects branch/date</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4"/>Today / Week / Month</CardTitle></CardHeader><CardContent><div className="text-sm">Today: <strong>UGX {(kpi?.todayTotal ?? 0).toLocaleString()}</strong></div><div className="text-xs text-muted-foreground">Week: UGX {(kpi?.weekTotal ?? 0).toLocaleString()} • Month: UGX {(kpi?.monthTotal ?? 0).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>Pending / Approved Unpaid</CardTitle></CardHeader><CardContent><div className="text-sm">Pending: <strong>UGX {(kpi?.pendingApproval ?? 0).toLocaleString()}</strong></div><div className="text-xs text-muted-foreground">Approved unpaid: UGX {(kpi?.approvedUnpaid ?? 0).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4"/>Largest Category / Petty</CardTitle></CardHeader><CardContent><div className="text-sm truncate">Top: <strong>{kpi?.largestCategory ?? "—"}</strong> UGX {(kpi?.largestValue ?? 0).toLocaleString()}</div><div className="text-xs text-muted-foreground">Petty balance: {kpi?.pettyBalance!=null ? `UGX ${Number(kpi.pettyBalance).toLocaleString()}` : "—"}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search description, #, ref, notes..." value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div>
          <Button variant="outline" onClick={()=>{setQ(""); setBranchFilter("all"); setCatFilter("all"); setSupplierFilter("all"); setPayMethodFilter("all"); setApprovalFilter("all"); setPaymentStatusFilter("all"); setDateFrom(""); setDateTo(""); setAmountMin(""); setAmountMax(""); setPage(1);}}>Clear Filters</Button>
          <Button variant="outline" size="sm" onClick={()=>{
            const header=["Expense #","Date","Category","Payee","Branch","Amount","Tax","Total","Payment","Approval","Payment Status","Created By"].join(",");
            const lines=data.map(e=>[e.expense_number ?? e.id.slice(0,8), e.expense_date, e.category, (e as any).suppliers?.name ?? e.supplier_id?.slice(0,6) ?? "", (e as any).branches?.name ?? e.branch_id.slice(0,6), e.amount, (e as any).tax_amount ?? 0, (e as any).total_amount ?? e.amount, e.payment_method, e.approval_status, e.payment_status, e.created_by?.slice(0,6) ?? ""].join(","));
            const csv=[header,...lines].join("\n"); const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`expenses_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
          }}><Download className="h-4 w-4 mr-1"/>Export</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={branchFilter} onChange={e=>{setBranchFilter(e.target.value); setPage(1);}} className="w-[160px]"><option value="all">All Branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select>
          <Select value={catFilter} onChange={e=>{setCatFilter(e.target.value); setPage(1);}} className="w-[160px]"><option value="all">All Categories</option>{categories.map(c=><option key={c.value??c.id} value={c.value??c.id}>{c.label ?? c.name} ({c.code ?? ""})</option>)}</Select>
          <Select value={supplierFilter} onChange={e=>{setSupplierFilter(e.target.value); setPage(1);}} className="w-[160px]"><option value="all">All Payees</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select value={payMethodFilter} onChange={e=>{setPayMethodFilter(e.target.value); setPage(1);}} className="w-[150px]"><option value="all">All Methods</option><option value="CASH">Cash</option><option value="PETTY_CASH">Petty Cash</option><option value="BANK">Bank</option><option value="MOBILE_MONEY">Mobile Money</option><option value="CARD">Card</option><option value="OTHER">Other</option></Select>
          <Select value={approvalFilter} onChange={e=>{setApprovalFilter(e.target.value); setPage(1);}} className="w-[150px]"><option value="all">All Approval</option><option value="DRAFT">Draft</option><option value="PENDING_APPROVAL">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option><option value="REVERSED">Reversed</option></Select>
          <Select value={paymentStatusFilter} onChange={e=>{setPaymentStatusFilter(e.target.value); setPage(1);}} className="w-[140px]"><option value="all">All Pay Status</option><option value="UNPAID">Unpaid</option><option value="PAID">Paid</option><option value="PARTIALLY_PAID">Partial</option></Select>
          <Input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value); setPage(1);}} className="w-[150px]" placeholder="From"/>
          <Input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value); setPage(1);}} className="w-[150px]" placeholder="To"/>
          <Input type="number" placeholder="Min UGX" value={amountMin} onChange={e=>setAmountMin(e.target.value)} className="w-[120px]"/>
          <Input type="number" placeholder="Max UGX" value={amountMax} onChange={e=>setAmountMax(e.target.value)} className="w-[120px]"/>
          <Badge variant="outline" className="flex items-center gap-1"><Building2 className="h-3 w-3"/>{count} records</Badge>
        </div>
      </CardContent></Card>

      {/* List */}
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-3">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : data.length===0 ? <div className="py-12 text-center text-muted-foreground">No expenses — create operating expense (Rent, Utilities...) • Inventory purchases go via Purchases</div>
        : <>
          <div className="hidden lg:block overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Expense #</TableHead><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Payee</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Method</TableHead><TableHead>Approval</TableHead><TableHead>Payment</TableHead><TableHead>Created By</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {data.map(e=>(
              <TableRow key={e.id} className="hover:bg-muted/40">
                <TableCell className="font-mono text-xs cursor-pointer underline" onClick={()=>openDetail(e)}>{e.expense_number ?? e.id.slice(0,8)}</TableCell>
                <TableCell className="text-xs">{new Date(e.expense_date).toLocaleDateString()}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{(e as any).expense_categories?.name ?? e.category}</Badge></TableCell>
                <TableCell className="text-xs">{(e as any).suppliers?.name ?? (e.supplier_id ? e.supplier_id.slice(0,6): "—")}</TableCell>
                <TableCell className="text-xs">{(e as any).branches?.name ?? e.branch_id.slice(0,6)}</TableCell>
                <TableCell className="text-right text-sm">UGX {Number((e as any).total_amount ?? e.amount).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{e.payment_method}</Badge></TableCell>
                <TableCell>{badgeApproval(e.approval_status ?? "DRAFT")}</TableCell>
                <TableCell>{badgePayment(e.payment_status ?? "UNPAID")}</TableCell>
                <TableCell className="text-xs">{e.created_by?.slice(0,6) ?? "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={()=>openDetail(e)} title="View"><Eye className="h-4 w-4"/></Button>
                  {(e.approval_status==="DRAFT"||e.approval_status==="REJECTED") && <Button variant="ghost" size="icon" onClick={()=>{ setShowEdit(e); setEditForm({description:e.description, amount:String(e.amount), tax_amount:String((e as any).tax_amount??0), notes:(e as any).notes ?? "", reference_number:(e as any).reference_number ?? ""}); }} title="Edit"><Edit className="h-4 w-4"/></Button>}
                  <Button variant="ghost" size="icon" onClick={()=>handleDuplicate(e.id)} title="Duplicate"><Copy className="h-4 w-4"/></Button>
                  {(e.approval_status==="DRAFT") && <Button variant="ghost" size="icon" onClick={()=>handleAction(e.id,'submit')} title="Submit"><FileText className="h-4 w-4"/></Button>}
                  {(e.approval_status==="PENDING_APPROVAL") && <Button variant="ghost" size="icon" onClick={()=>handleAction(e.id,'approve')} title="Approve"><Receipt className="h-4 w-4"/></Button>}
                  {(e.approval_status==="APPROVED" && e.payment_status==="UNPAID") && <Button variant="ghost" size="icon" onClick={()=>handleAction(e.id,'pay', {payment_account_id: cashAccounts[0]?.id})} title="Mark Paid"><CreditCard className="h-4 w-4"/></Button>}
                  {(e.posting_status==="POSTED" && e.approval_status!=="REVERSED") && <Button variant="ghost" size="icon" onClick={()=>setShowReverse(e)} title="Reverse"><Undo2 className="h-4 w-4"/></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody></Table></div>
          <div className="lg:hidden p-3 grid gap-3">
            {data.map(e=>(
              <Card key={e.id} className="border cursor-pointer" onClick={()=>openDetail(e)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between items-start"><span className="font-mono text-xs">{e.expense_number ?? e.id.slice(0,8)} • {new Date(e.expense_date).toLocaleDateString()}</span>{badgeApproval(e.approval_status ?? "DRAFT")}</div>
                  <div className="text-sm font-medium truncate">{e.description}</div>
                  <div className="flex justify-between text-xs"><Badge variant="secondary">{(e as any).expense_categories?.name ?? e.category}</Badge><span className="font-bold">UGX {Number((e as any).total_amount ?? e.amount).toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{(e as any).suppliers?.name ?? "—"} • {(e as any).branches?.name ?? e.branch_id.slice(0,6)}</span>{badgePayment(e.payment_status ?? "UNPAID")}</div>
                  <div className="flex gap-2" onClick={ev=>ev.stopPropagation()}>
                    <Button size="sm" variant="outline" className="flex-1" onClick={()=>openDetail(e)}><Eye className="h-4 w-4 mr-1"/>View</Button>
                    {(e.approval_status==="DRAFT") && <Button size="sm" variant="outline" onClick={()=>handleAction(e.id,'submit')}>Submit</Button>}
                    {(e.approval_status==="PENDING_APPROVAL") && <Button size="sm" onClick={()=>handleAction(e.id,'approve')}>Approve</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} • {count} total • Operating Expenses feed P&L: Net = Gross - Expenses</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</Button><Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
          </div>
        </>}
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">* Petty cash: FUND → EXPENSE → Cash count → Variance → Audit. Inventory purchases → Purchasing/GRN/Inventory/Supplier Payable — not Expenses.</p>

      {/* CREATE */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>New Expense — Guided Workflow</DialogTitle><DialogDescription>Step 1 Basic → Step 2 Financial (Tax lines) → Step 3 Payment → Step 4 Evidence • Server-generated EXP- number • Idempotent • Branch-scoped</DialogDescription></DialogHeader>
          <Tabs value={createTab} onValueChange={setCreateTab}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="payment">Payment</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="mt-4 space-y-4">
                <div className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Branch *</Label><Select value={form.branch_id} onChange={e=>setForm({...form, branch_id:e.target.value})}><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select></div>
                    <div><Label>Category *</Label><Select value={form.category_id} onChange={e=>setForm({...form, category_id:e.target.value})}><option value="">Select category</option>{categories.map(c=><option key={c.value??c.id} value={c.value??c.id}>{c.label ?? c.name} — {c.code}</option>)}</Select></div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Payee / Vendor</Label><Select value={form.supplier_id} onChange={e=>setForm({...form, supplier_id:e.target.value})}><option value="">No payee / Walk-in</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name} — {s.phone ?? ""}</option>)}</Select><p className="text-[10px] text-muted-foreground">Reuses Suppliers module — <a href="/suppliers" className="underline">View Payee</a> navigates to supplier profile</p></div>
                    <div><Label>Expense Date *</Label><Input type="date" value={form.expense_date} onChange={e=>setForm({...form, expense_date:e.target.value})}/></div>
                  </div>
                  <div><Label>Description *</Label><Input value={form.description} onChange={e=>setForm({...form, description:e.target.value})} placeholder="What was this expense for?"/><p className="text-[10px] text-muted-foreground">If description looks like inventory purchase, system will warn: Use Purchasing instead.</p></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Reference #</Label><Input value={form.reference_number} onChange={e=>setForm({...form, reference_number:e.target.value})} placeholder="Invoice/receipt ref (unique)"/></div>
                    <div><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} placeholder="Additional notes"/></div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={()=>setCreateTab("financial")}>Next: Financial →</Button>
                </div>
            </TabsContent>
            <TabsContent value="financial" className="mt-4 space-y-4">
                <div className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div><Label>Amount * (UGX)</Label><Input type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} placeholder="0.00"/></div>
                    <div><Label>Tax (UGX)</Label><Input type="number" value={form.tax_amount} onChange={e=>setForm({...form, tax_amount:e.target.value})}/></div>
                    <div className="flex flex-col justify-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.tax_inclusive} onChange={e=>setForm({...form, tax_inclusive:e.target.checked})}/> Tax inclusive</label></div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div><Label>Currency</Label><Select value={form.currency} onChange={e=>setForm({...form, currency:e.target.value})}><option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option></Select></div>
                    <div><Label>Exchange Rate</Label><Input type="number" value={form.exchange_rate} onChange={e=>setForm({...form, exchange_rate:e.target.value})}/></div>
                    <div className="border rounded p-2 bg-muted/20 text-center"><div className="text-xs">Total</div><div className="font-bold">UGX {(Number(form.amount||0)+Number(form.tax_amount||0)).toLocaleString()}</div></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><h4 className="font-medium">Multi-line (optional)</h4><Button variant="outline" size="sm" onClick={addLine}>Add Line</Button></div>
                    {form.lines.map((l:any,i:number)=>(
                      <div key={i} className="grid gap-2 md:grid-cols-12 items-end border rounded p-2">
                        <div className="md:col-span-4"><Label className="text-xs">Category</Label><Select value={l.category_id} onChange={e=>updateLine(i,{category_id:e.target.value})}><option value="">Same as header</option>{categories.map(c=><option key={c.value??c.id} value={c.value??c.id}>{c.label ?? c.name}</option>)}</Select></div>
                        <div className="md:col-span-3"><Label className="text-xs">Desc</Label><Input value={l.description} onChange={e=>updateLine(i,{description:e.target.value})} placeholder="Cleaning etc"/></div>
                        <div><Label className="text-xs">Amount</Label><Input type="number" value={l.amount} onChange={e=>updateLine(i,{amount:Number(e.target.value)})}/></div>
                        <div><Label className="text-xs">Tax</Label><Input type="number" value={l.tax_amount} onChange={e=>updateLine(i,{tax_amount:Number(e.target.value)})}/></div>
                        <div><Button variant="ghost" size="icon" onClick={()=>removeLine(i)}><Trash2 className="h-4 w-4"/></Button></div>
                      </div>
                    ))}
                    {form.lines.length>0 && <p className="text-xs">Sum lines = {form.lines.reduce((s:any,l:any)=>s+Number(l.amount)+Number(l.tax_amount??0),0).toLocaleString()} — must equal total {(Number(form.amount||0)+Number(form.tax_amount||0)).toLocaleString()}</p>}
                  </div>
                  <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>setCreateTab("basic")}>Back</Button><Button className="flex-1" onClick={()=>setCreateTab("payment")}>Next: Payment →</Button></div>
                </div>
            </TabsContent>
            <TabsContent value="payment" className="mt-4 space-y-4">
                <div className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Payment Method *</Label><Select value={form.payment_method} onChange={e=>setForm({...form, payment_method:e.target.value})}><option value="CASH">Cash</option><option value="PETTY_CASH">Petty Cash</option><option value="BANK">Bank</option><option value="MOBILE_MONEY">Mobile Money</option><option value="CARD">Card</option><option value="OTHER">Other</option></Select></div>
                    <div><Label>Payment Account</Label><Select value={form.payment_account_id} onChange={e=>setForm({...form, payment_account_id:e.target.value})}><option value="">Select account / cash session</option>{cashAccounts.map(a=><option key={a.id} value={a.id}>{a.name ?? a.code ?? a.id.slice(0,8)}</option>)}</Select></div>
                  </div>
                  <p className="text-xs text-muted-foreground">When Paid: creates cash movement, updates account balance, creates ledger entry, records paying user & date. Idempotent — retry safe.</p>
                  <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>setCreateTab("financial")}>Back</Button><Button className="flex-1" onClick={()=>setCreateTab("evidence")}>Next: Evidence →</Button></div>
                </div>
            </TabsContent>
            <TabsContent value="evidence" className="mt-4 space-y-4">
                <div className="space-y-3">
                  <p className="text-sm">Attach receipt after creation via Detail → Attachments. You can also paste URL now and it will be attached after save.</p>
                  <div className="border rounded p-3 bg-amber-50 dark:bg-amber-950/20 text-xs"><AlertTriangle className="h-4 w-4 inline mr-1"/>Operating expense vs Inventory purchase — Electricity → Expense path; Medicines for resale → Purchase Order → GRN → Inventory → Supplier Payable</div>
                  <Button onClick={submitCreate} className="w-full">Save DRAFT (EXP- server generated) {isOnline?"":"(offline queued)"}</Button>
                  <p className="text-xs text-center text-muted-foreground">DRAFT → Submit → Pending → Approve → Pay → Posted → Ledger/P&L/CashFlow</p>
                </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* DETAIL */}
      <Dialog open={!!showDetail} onOpenChange={(o)=>!o && setShowDetail(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>{detailData?.expense_number ?? showDetail?.id.slice(0,8)} — Detail</DialogTitle><DialogDescription>{detailData ? `${new Date(detailData.expense_date).toLocaleDateString()} • ${detailData.category} • ${detailData.branches?.name ?? ""} • ${detailData.approval_status}/${detailData.payment_status}` : ""}</DialogDescription></DialogHeader>
          {detailData ? (
            <div className="space-y-4">
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="flex flex-wrap h-auto">
                  {[
                    {id:"overview", label:"Overview", icon:FileText},
                    {id:"lines", label:"Lines", icon:DollarSign},
                    {id:"payment", label:"Payment", icon:CreditCard},
                    {id:"attachments", label:"Receipts", icon:Paperclip},
                    {id:"audit", label:"Audit", icon:History},
                  ].map(t=>(
                    <TabsTrigger key={t.id} value={t.id}><t.icon className="h-3 w-3 mr-1"/>{t.label}</TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="overview" className="mt-4 space-y-3">
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                        <div className="flex justify-between"><span>#</span><strong>{detailData.expense_number}</strong></div>
                        <div className="flex justify-between"><span>Date</span><span>{new Date(detailData.expense_date).toLocaleDateString()}</span></div>
                        <div className="flex justify-between"><span>Branch</span><span>{detailData.branches?.name} ({detailData.branches?.code})</span></div>
                        <div className="flex justify-between"><span>Category</span><Badge variant="secondary">{detailData.category}</Badge></div>
                        <div className="flex justify-between"><span>Payee</span>{detailData.suppliers ? <a href={`/suppliers?id=${detailData.supplier_id}`} className="underline">{detailData.suppliers.name}</a> : <span>{detailData.supplier_id?.slice(0,6) ?? "—"}</span>}</div>
                        <div className="flex justify-between"><span>Reference</span><span>{detailData.reference_number ?? "—"}</span></div>
                        <div className="flex justify-between"><span>Description</span><span className="truncate max-w-[150px]">{detailData.description}</span></div>
                        <div className="flex justify-between"><span>Notes</span><span className="truncate max-w-[150px]">{detailData.notes ?? "—"}</span></div>
                      </CardContent></Card>
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Financial</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                        <div className="flex justify-between"><span>Amount</span><span>UGX {Number(detailData.amount).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Tax</span><span>UGX {Number(detailData.tax_amount??0).toLocaleString()} {detailData.tax_inclusive?"(incl)":""}</span></div>
                        <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>UGX {Number(detailData.total_amount??detailData.amount).toLocaleString()} {detailData.currency}</span></div>
                        <div className="flex justify-between"><span>Approval</span>{badgeApproval(detailData.approval_status)}</div>
                        <div className="flex justify-between"><span>Payment</span>{badgePayment(detailData.payment_status)}</div>
                        <div className="flex justify-between"><span>Posting</span><Badge variant="outline">{detailData.posting_status}</Badge></div>
                        <p className="text-[10px] text-muted-foreground">Ledger: Debit {detailData.category} Expense / Credit {detailData.payment_method} {detailData.tax_amount?` • Tax → Tax account`: ""}</p>
                      </CardContent></Card>
                      <Card className="md:col-span-2"><CardContent className="p-3 text-xs">Created: {detailData.created_by?.slice(0,8)} @ {new Date(detailData.created_at).toLocaleString()} • Submitted: {detailData.submitted_by?.slice(0,8) ?? "—"} • Approved: {detailData.approved_by?.slice(0,8) ?? "—"} • Paid: {detailData.paid_by?.slice(0,8) ?? "—"} • ReversalOf: {detailData.reversal_of ?? "—"} • Idempotency: {detailData.idempotency_key?.slice(0,8) ?? "—"}</CardContent></Card>
                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        {(detailData.approval_status==="DRAFT"||detailData.approval_status==="REJECTED") && <Button size="sm" onClick={()=>{ setShowEdit(detailData); setEditForm({description:detailData.description, amount:String(detailData.amount), tax_amount:String(detailData.tax_amount??0), notes:detailData.notes ?? "", reference_number:detailData.reference_number ?? ""}); }}>Edit</Button>}
                        {detailData.approval_status==="DRAFT" && <Button size="sm" onClick={()=>handleAction(detailData.id,'submit')}>Submit</Button>}
                        {detailData.approval_status==="PENDING_APPROVAL" && <><Button size="sm" onClick={()=>handleAction(detailData.id,'approve')}>Approve</Button><Button size="sm" variant="outline" onClick={()=>setShowReject(detailData)}>Reject</Button></>}
                        {(detailData.approval_status==="APPROVED" && detailData.payment_status==="UNPAID") && <Button size="sm" onClick={()=>handleAction(detailData.id,'pay')}>Mark Paid</Button>}
                        {(detailData.approval_status==="DRAFT"||detailData.approval_status==="PENDING_APPROVAL") && <Button size="sm" variant="destructive" onClick={()=>handleAction(detailData.id,'cancel')}>Cancel</Button>}
                        {detailData.posting_status==="POSTED" && <Button size="sm" variant="destructive" onClick={()=>setShowReverse(detailData)}><Undo2 className="h-4 w-4 mr-1"/>Reverse</Button>}
                        <Button size="sm" variant="outline" onClick={()=>handleDuplicate(detailData.id)}><Copy className="h-4 w-4 mr-1"/>Duplicate</Button>
                        <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1"/>Print</Button>
                        <Button size="sm" variant="outline" onClick={()=>{
                          const csv=`Expense #,Date,Category,Amount,Tax,Total\n${detailData.expense_number},${detailData.expense_date},${detailData.category},${detailData.amount},${detailData.tax_amount??0},${detailData.total_amount??detailData.amount}`;
                          const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`expense_${detailData.expense_number}.csv`; a.click(); URL.revokeObjectURL(url);
                        }}><Download className="h-4 w-4 mr-1"/>Export</Button>
                        {detailData.supplier_id && <Button size="sm" variant="outline" onClick={()=> window.open(`/suppliers?id=${detailData.supplier_id}`,"_blank")}><Users className="h-4 w-4 mr-1"/>View Payee</Button>}
                        <Button size="sm" variant="outline" onClick={()=> window.open(`/branches`,"_blank")}><Building2 className="h-4 w-4 mr-1"/>View Branch</Button>
                      </div>
                    </div>
                </TabsContent>
                <TabsContent value="lines" className="mt-4 space-y-3">
                    <div className="space-y-3">
                      {(detailData.lines ?? []).length===0 ? <p className="text-sm text-muted-foreground">Single-line expense — no breakdown. For multi-line, total = sum(lines).</p> :
                        <Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.lines ?? []).map((l:any)=><TableRow key={l.id}><TableCell className="text-xs">{l.category_id?.slice(0,6) ?? "—"}</TableCell><TableCell className="text-xs">{l.description ?? "—"}</TableCell><TableCell className="text-right">UGX {Number(l.amount).toLocaleString()}</TableCell><TableCell className="text-right">UGX {Number(l.tax_amount??0).toLocaleString()}</TableCell><TableCell className="text-right font-bold">UGX {Number(l.total_amount).toLocaleString()}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <p className="text-xs text-muted-foreground">Validation ensures sum(lines) = total.</p>
                    </div>
                </TabsContent>
                <TabsContent value="payment" className="mt-4 space-y-3">
                    <div className="space-y-3">
                      <Card><CardContent className="p-3 text-sm space-y-1">
                        <div className="flex justify-between"><span>Method</span><Badge variant="outline">{detailData.payment_method}</Badge></div>
                        <div className="flex justify-between"><span>Account</span><span>{detailData.payment_account_id?.slice(0,8) ?? "—"} <a href="/cash" className="underline text-xs ml-1">View Account</a></span></div>
                        <div className="flex justify-between"><span>Status</span>{badgePayment(detailData.payment_status)}</div>
                        <div className="flex justify-between"><span>Date</span><span>{detailData.payment_date ? new Date(detailData.payment_date).toLocaleDateString() : "—"}</span></div>
                        <div className="flex justify-between"><span>Paid By</span><span>{detailData.paid_by?.slice(0,8) ?? "—"}</span></div>
                        <p className="text-xs text-muted-foreground">Payment creates: financial transaction + account balance + ledger entry + history + payment record (idempotent).</p>
                      </CardContent></Card>
                    </div>
                </TabsContent>
                <TabsContent value="attachments" className="mt-4 space-y-3">
                    <div className="space-y-3">
                      {(detailData.attachments ?? []).length===0 ? <p className="text-sm text-muted-foreground">No receipts attached.</p> :
                        <Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Type</TableHead><TableHead>Link</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.attachments ?? []).map((a:any)=><TableRow key={a.id}><TableCell className="text-xs">{a.file_name}</TableCell><TableCell><Badge variant="outline">{a.document_type}</Badge></TableCell><TableCell><a href={a.file_url} target="_blank" rel="noreferrer" className="underline text-xs">View</a></TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={async()=>{
                            if(!confirm("Remove attachment? Not allowed if posted.")) return;
                            const r=await fetch(`/api/expenses?attachment_id=${a.id}`,{method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({attachment_id:a.id})});
                            const j=await r.json(); if(!r.ok) alert(j.error); else openDetail(detailData);
                          }}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                      <Card><CardContent className="p-3 space-y-2">
                        <h4 className="font-medium text-sm">Attach Receipt / Invoice</h4>
                        <div className="grid md:grid-cols-2 gap-2">
                          <div><Label>File Name</Label><Input value={attachForm.file_name} onChange={e=>setAttachForm({...attachForm, file_name:e.target.value})} placeholder="receipt_001.pdf"/></div>
                          <div><Label>Type</Label><Select value={attachForm.document_type} onChange={e=>setAttachForm({...attachForm, document_type:e.target.value})}><option value="RECEIPT">Receipt</option><option value="INVOICE">Invoice</option><option value="PHOTO">Photo</option><option value="PDF">PDF</option><option value="OTHER">Other</option></Select></div>
                        </div>
                        <div><Label>File URL</Label><Input value={attachForm.file_url} onChange={e=>setAttachForm({...attachForm, file_url:e.target.value})} placeholder="https://.../receipt.pdf"/></div>
                        <Button size="sm" onClick={handleAttach}><Paperclip className="h-4 w-4 mr-1"/>Attach Receipt</Button>
                        <p className="text-xs text-muted-foreground">Uses existing attachment system — supports receipt, invoice, image, PDF. Never silently deletes evidence from posted.</p>
                      </CardContent></Card>
                    </div>
                </TabsContent>
                <TabsContent value="audit" className="mt-4 space-y-3">
                    <div className="space-y-3">
                      {(detailData.approvals ?? []).length>0 && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Approval History</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Actor</TableHead><TableHead>From→To</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
                        {(detailData.approvals ?? []).map((a:any)=><TableRow key={a.id}><TableCell className="text-xs">{a.action}</TableCell><TableCell className="text-xs">{a.actor_id?.slice(0,6)}</TableCell><TableCell className="text-xs">{a.previous_status}→{a.new_status} {a.reason ? `(${a.reason})`:""}</TableCell><TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell></TableRow>)}
                      </TableBody></Table></CardContent></Card>}
                      {(detailData.audit ?? []).length===0 ? <p className="text-sm text-muted-foreground">No audit logs yet.</p> :
                        <Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>
                          {(detailData.audit ?? []).map((l:any)=><TableRow key={l.id}><TableCell className="text-xs">{l.action}</TableCell><TableCell className="text-xs">{(l as any).user_id?.slice(0,6) ?? (l as any).created_by?.slice(0,6) ?? "—"}</TableCell><TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell><TableCell className="text-xs truncate max-w-[200px]">{JSON.stringify(l.new_values ?? l.old_values ?? "").slice(0,80)}</TableCell></TableRow>)}
                        </TableBody></Table>
                      }
                    </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : <div className="p-6 space-y-3">{[...Array(3)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>}
        </DialogContent>
      </Dialog>

      {/* EDIT */}
      <Dialog open={!!showEdit} onOpenChange={(o)=>!o && setShowEdit(null)}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader><DialogTitle>Edit Draft Expense</DialogTitle><DialogDescription>Only Draft/Rejected editable — posted/paid locked</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Description</Label><Input value={editForm.description ?? ""} onChange={e=>setEditForm({...editForm, description:e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount</Label><Input type="number" value={editForm.amount ?? ""} onChange={e=>setEditForm({...editForm, amount:e.target.value})}/></div>
              <div><Label>Tax</Label><Input type="number" value={editForm.tax_amount ?? ""} onChange={e=>setEditForm({...editForm, tax_amount:e.target.value})}/></div>
            </div>
            <div><Label>Reference #</Label><Input value={editForm.reference_number ?? ""} onChange={e=>setEditForm({...editForm, reference_number:e.target.value})}/></div>
            <div><Label>Notes</Label><Textarea value={editForm.notes ?? ""} onChange={(e:any)=>setEditForm({...editForm, notes:e.target.value})}/></div>
            <Button onClick={handleEdit} className="w-full">Save</Button>
            <Button variant="outline" className="w-full" onClick={()=>setShowEdit(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* REJECT */}
      <Dialog open={!!showReject} onOpenChange={(o)=>!o && setShowReject(null)}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader><DialogTitle>Reject Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Rejection Reason *</Label><Textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Reason..."/>
            <Button disabled={!rejectReason} onClick={()=>handleAction(showReject!.id,'reject', {reason: rejectReason})} className="w-full">Reject</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* REVERSE */}
      <Dialog open={!!showReverse} onOpenChange={(o)=>!o && setShowReverse(null)}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader><DialogTitle>Reverse Expense — Controlled Reversal</DialogTitle><DialogDescription>Original preserved, reversal REV- linked. Requires reason.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Label>Reason *</Label><Textarea value={reverseReason} onChange={e=>setReverseReason(e.target.value)} placeholder="Reason for reversal..."/>
            <Button disabled={!reverseReason} variant="destructive" onClick={()=>handleAction(showReverse!.id,'reverse', {reversal_reason: reverseReason})} className="w-full">Reverse (REV- creates -UGX)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
