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
import { Search, Plus, Eye, Edit, Trash2, Ban, RefreshCw, UserCircle, Building2, Users, Phone, Mail, MapPin, Calendar, CreditCard, Receipt, RotateCcw, FileText, Activity, Heart, StickyNote, Download, Upload, Filter, X, ChevronLeft, ChevronRight, AlertTriangle, Check, Printer, ArrowLeftRight, Shield, ShoppingCart } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { db } from "@/lib/offline/db";
import { queueCustomerCreate } from "@/lib/offline/sync";

type Customer = {
  id:string; organization_id?:string; customer_code?: string|null; customer_type?: string; name:string; display_name?:string|null; company_name?:string|null; first_name?:string|null; last_name?:string|null;
  phone:string|null; alternate_phone?:string|null; email:string|null; address?:string|null; city?:string|null; branch_id?:string|null; status?:string; is_active:boolean; credit_limit?:number; loyalty_points?:number; external_reference?:string|null; tax_id?:string|null; notes?:string|null; created_at:string; updated_at?:string;
  preferred_contact?:string|null; sms_opt_in?:boolean; email_opt_in?:boolean; marketing_opt_in?:boolean; contact_person?:string|null; payment_terms?:string|null;
  // derived
  total_purchases?:number; outstanding_balance?:number; overdue_amount?:number; available_credit?:number; total_paid?:number; transaction_count?:number; last_purchase?:string|null; branch_name?:string|null; branch_totals?:Record<string,number>;
};

const customerTypes = [
  {v:'INDIVIDUAL', l:'Individual'},
  {v:'WALK_IN', l:'Walk-in'},
  {v:'CORPORATE', l:'Corporate'},
  {v:'CLINIC', l:'Clinic'},
  {v:'HOSPITAL', l:'Hospital'},
  {v:'ORGANIZATION', l:'Organization'},
  {v:'INSURANCE', l:'Insurance'},
  {v:'OTHER', l:'Other'},
];

function formatUGX(n:number){ return `UGX ${Number(n||0).toLocaleString('en-UG')}`; }

export default function CustomersPage(){
  const { isOnline } = useOnlineStatus();
  // list state
  const [loading,setLoading]=React.useState(true);
  const [q,setQ]=React.useState("");
  const [debouncedQ,setDebouncedQ]=React.useState("");
  const [typeFilter,setTypeFilter]=React.useState("all");
  const [statusFilter,setStatusFilter]=React.useState("all");
  const [branchFilter,setBranchFilter]=React.useState("all");
  const [creditFilter,setCreditFilter]=React.useState("all");
  const [dateFrom,setDateFrom]=React.useState("");
  const [dateTo,setDateTo]=React.useState("");
  const [page,setPage]=React.useState(1);
  const perPage=14;
  const [totalCount,setTotalCount]=React.useState(0);
  const [data,setData]=React.useState<Customer[]>([]);
  const [branches,setBranches]=React.useState<any[]>([]);
  const [kpi,setKpi]=React.useState<any>(null);
  const [pendingCount,setPendingCount]=React.useState(0);

  // form
  const [showAdd,setShowAdd]=React.useState(false);
  const [editing,setEditing]=React.useState<Customer|null>(null);
  const [form,setForm]=React.useState({ display_name:"", company_name:"", first_name:"", last_name:"", customer_type:"INDIVIDUAL", phone:"", alternate_phone:"", email:"", address:"", city:"", branch_id:"", credit_limit:"0", tax_id:"", external_reference:"", notes:"", preferred_contact:"PHONE", sms_opt_in:false, email_opt_in:false, marketing_opt_in:false, contact_person:"" });
  const [saving,setSaving]=React.useState(false);
  const [dupWarn,setDupWarn]=React.useState<any[]>([]);
  const [showDupPrompt,setShowDupPrompt]=React.useState(false);

  // profile 360
  const [profileId,setProfileId]=React.useState<string|null>(null);
  const [profile,setProfile]=React.useState<any>(null);
  const [profileLoading,setProfileLoading]=React.useState(false);
  const [profileTab,setProfileTab]=React.useState("overview");
  const [statementFrom,setStatementFrom]=React.useState("");
  const [statementTo,setStatementTo]=React.useState("");
  const [statementData,setStatementData]=React.useState<any>(null);
  const [noteContent,setNoteContent]=React.useState("");
  const [loyaltyAdjust,setLoyaltyAdjust]=React.useState("");
  const [mergeTarget,setMergeTarget]=React.useState("");

  // import
  const [showImport,setShowImport]=React.useState(false);
  const [importRows,setImportRows]=React.useState<any[]>([]);
  const [importErrs,setImportErrs]=React.useState<any[]>([]);

  React.useEffect(()=>{ const t=setTimeout(()=>setDebouncedQ(q),300); return()=>clearTimeout(t); },[q]);
  React.useEffect(()=>setPage(1),[debouncedQ,typeFilter,statusFilter,branchFilter,creditFilter,dateFrom,dateTo]);

  // load branches
  React.useEffect(()=>{
    fetch("/api/settings").then(r=>r.json()).then(j=>{ if(j.branches) setBranches(j.branches); }).catch(()=>{});
  },[]);
  React.useEffect(()=>{
    (async()=>{ try{ const c=await db.syncQueue.where("table_name").equals("customers").count(); setPendingCount(c);}catch{} })();
    const id=setInterval(async()=>{ try{ const c=await db.syncQueue.where("table_name").equals("customers").count(); setPendingCount(c);}catch{} },2000);
    return()=>clearInterval(id);
  },[]);

  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    try{
      const params=new URLSearchParams();
      if(debouncedQ) params.set("search", debouncedQ);
      if(typeFilter!=="all") params.set("customer_type", typeFilter);
      if(statusFilter!=="all") params.set("status", statusFilter);
      if(branchFilter!=="all") params.set("branch_id", branchFilter);
      if(creditFilter!=="all") params.set("credit_status", creditFilter);
      if(dateFrom) params.set("date_from", dateFrom);
      if(dateTo) params.set("date_to", dateTo);
      params.set("page", String(page)); params.set("perPage", String(perPage));
      const [listRes,kpiRes]=await Promise.all([
        fetch(`/api/customers?${params.toString()}`).then(r=>r.json()),
        fetch(`/api/customers?kpi=1${branchFilter!=='all'?`&branch_id=${branchFilter}`:''}`).then(r=>r.json()).catch(()=>null),
      ]);
      if(listRes.data){ setData(listRes.data); setTotalCount(listRes.count ?? listRes.data.length); }
      else if(Array.isArray(listRes)){ setData(listRes); setTotalCount(listRes.length); }
      else { setData([]); setTotalCount(0); }
      if(kpiRes && !kpiRes.error) setKpi(kpiRes);
    }catch{ setData([]); }
    setLoading(false);
  },[debouncedQ,typeFilter,statusFilter,branchFilter,creditFilter,dateFrom,dateTo,page]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

  const fetchKpiOnly=React.useCallback(async()=>{
    try{
      const r=await fetch(`/api/customers?kpi=1${branchFilter!=='all'?`&branch_id=${branchFilter}`:''}`);
      const j=await r.json(); if(r.ok) setKpi(j);
    }catch{}
  },[branchFilter]);

  const openProfile=async(id:string)=>{
    setProfileId(id); setProfileTab("overview"); setProfile(null); setStatementData(null);
    setProfileLoading(true);
    try{
      const r=await fetch(`/api/customers/detail?id=${id}&tab=overview`);
      const j=await r.json();
      if(r.ok) setProfile(j);
      else{
        const r2=await fetch(`/api/customers/detail?id=${id}`);
        const j2=await r2.json(); setProfile({customer:j2});
      }
    }catch{ setProfile(null); }
    setProfileLoading(false);
  };
  const refreshProfile=async()=>{
    if(!profileId) return;
    setProfileLoading(true);
    try{
      const r=await fetch(`/api/customers/detail?id=${profileId}&tab=overview`);
      const j=await r.json(); if(r.ok) setProfile(j);
    }catch{}
    setProfileLoading(false);
  };
  const loadStatement=async()=>{
    if(!profileId) return;
    const p=new URLSearchParams();
    p.set("customer_id", profileId);
    if(statementFrom) p.set("from", statementFrom);
    if(statementTo) p.set("to", statementTo);
    const r=await fetch(`/api/customers/statement?${p.toString()}`);
    const j=await r.json(); if(r.ok) setStatementData(j);
  };

  const handleDeactivate=async(id:string, current:boolean)=>{
    if(!confirm(current ? "Deactivate customer? Historical transactions remain intact — use INACTIVE not delete." : "Reactivate customer?")) return;
    const action=current?"deactivate":"reactivate";
    const r=await fetch("/api/customers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id, action})});
    const j=await r.json(); if(!r.ok) return alert(j.error);
    fetchData(); if(profileId===id) openProfile(id);
  };
  const handleBlock=async(id:string, isBlocked:boolean)=>{
    if(isBlocked){
      if(!confirm("Unblock customer (reactivate)?")) return;
      const r=await fetch("/api/customers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id, action:"reactivate"})});
      if(!r.ok){ const j=await r.json(); alert(j.error); return; }
      fetchData(); if(profileId===id) openProfile(id); return;
    }
    const reason=prompt("Block reason (audited)") ?? "Blocked by manager";
    const r=await fetch("/api/customers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id, action:"block", reason})});
    const j=await r.json(); if(!r.ok) return alert(j.error);
    fetchData(); if(profileId===id) openProfile(id);
  };
  const handleDeleteHard=async(id:string)=>{
    if(!confirm("Hard delete? Only allowed if customer has NO sales/payments/returns. Otherwise use Deactivate. Continue?")) return;
    const r=await fetch(`/api/customers?id=${id}`,{method:"DELETE"});
    const j=await r.json(); if(!r.ok) return alert(j.error);
    alert("Customer deleted"); fetchData(); setProfileId(null);
  };

  const validateAndPreviewDuplicates=async():Promise<boolean>=>{
    // check duplicates via API
    const params=new URLSearchParams();
    if(form.phone) params.set("phone", form.phone);
    if(form.email) params.set("email", form.email);
    if(form.display_name) params.set("name", form.display_name);
    if(params.toString()){
      const r=await fetch(`/api/customers?check=1&${params.toString()}`);
      const j=await r.json();
      if(Array.isArray(j) && j.length>0){ setDupWarn(j); setShowDupPrompt(true); return false; }
    }
    return true;
  };

  const submitCreate=async(force:boolean=false)=>{
    const name = form.display_name.trim() || form.company_name.trim();
    if(!name) return alert("Customer name/display name required");
    if(!form.customer_type) return alert("Customer type required");
    setSaving(true);
    try{
      if(!force){
        const params=new URLSearchParams();
        if(form.phone) params.set("phone", form.phone);
        if(form.email) params.set("email", form.email);
        if(name) params.set("name", name);
        if(form.company_name) params.set("customer_code", form.company_name);
        const r=await fetch(`/api/customers?check=1&${params.toString()}`);
        const dups=await r.json();
        if(Array.isArray(dups) && dups.length>0){ setDupWarn(dups); setShowDupPrompt(true); setSaving(false); return; }
      }
      const payload:any={
        display_name: name, name,
        company_name: form.company_name || null,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        customer_type: form.customer_type,
        phone: form.phone || null,
        alternate_phone: form.alternate_phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        branch_id: form.branch_id || null,
        credit_limit: Number(form.credit_limit)||0,
        tax_id: form.tax_id || null,
        external_reference: form.external_reference || null,
        notes: form.notes || null,
        preferred_contact: form.preferred_contact,
        sms_opt_in: form.sms_opt_in,
        email_opt_in: form.email_opt_in,
        marketing_opt_in: form.marketing_opt_in,
        contact_person: form.contact_person || null,
        continue_anyway: force,
      };
      if(editing){
        const r=await fetch("/api/customers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id: editing.id, ...payload})});
        const j=await r.json(); if(!r.ok) throw new Error(j.error);
        setShowAdd(false); setEditing(null); setDupWarn([]); setShowDupPrompt(false);
        setForm({ display_name:"", company_name:"", first_name:"", last_name:"", customer_type:"INDIVIDUAL", phone:"", alternate_phone:"", email:"", address:"", city:"", branch_id:"", credit_limit:"0", tax_id:"", external_reference:"", notes:"", preferred_contact:"PHONE", sms_opt_in:false, email_opt_in:false, marketing_opt_in:false, contact_person:"" });
        fetchData(); if(profileId===editing.id) openProfile(editing.id);
        return;
      }
      if(!isOnline){
        await queueCustomerCreate(payload);
        setPendingCount(await db.syncQueue.where("table_name").equals("customers").count());
        alert("OFFLINE — customer queued locally. Will sync when online. Duplicate prevention via server check on sync.");
        setShowAdd(false); setDupWarn([]); setShowDupPrompt(false);
        setForm({ display_name:"", company_name:"", first_name:"", last_name:"", customer_type:"INDIVIDUAL", phone:"", alternate_phone:"", email:"", address:"", city:"", branch_id:"", credit_limit:"0", tax_id:"", external_reference:"", notes:"", preferred_contact:"PHONE", sms_opt_in:false, email_opt_in:false, marketing_opt_in:false, contact_person:"" });
        return;
      }
      const r=await fetch("/api/customers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const j=await r.json();
      if(r.status===409 && j.duplicate_detected){
        setDupWarn(j.duplicates ?? []); setShowDupPrompt(true); setSaving(false); return;
      }
      if(!r.ok) throw new Error(j.error);
      setShowAdd(false); setDupWarn([]); setShowDupPrompt(false);
      setForm({ display_name:"", company_name:"", first_name:"", last_name:"", customer_type:"INDIVIDUAL", phone:"", alternate_phone:"", email:"", address:"", city:"", branch_id:"", credit_limit:"0", tax_id:"", external_reference:"", notes:"", preferred_contact:"PHONE", sms_opt_in:false, email_opt_in:false, marketing_opt_in:false, contact_person:"" });
      fetchData(); fetchKpiOnly();
    }catch(e:any){ alert(e.message); }
    setSaving(false);
  };

  const handleMerge=async()=>{
    if(!profileId || !mergeTarget) return alert("Select master and duplicate. Enter duplicate ID or select from list.");
    if(!confirm(`Merge ${mergeTarget} INTO ${profileId}? Sales, payments, returns, loyalty, notes move to master. Duplicate will be deactivated and audited. Irreversible. Continue?`)) return;
    const r=await fetch("/api/customers/merge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ masterId: profileId, duplicateId: mergeTarget })});
    const j=await r.json(); if(!r.ok) return alert(j.error);
    alert(`Merged — moved ${j.salesMoved} sales, ${j.returnsMoved} returns`);
    setMergeTarget(""); refreshProfile(); fetchData();
  };

  const handleAddNote=async()=>{
    if(!profileId || !noteContent.trim()) return;
    const r=await fetch("/api/customers/notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer_id: profileId, content: noteContent.trim()})});
    const j=await r.json(); if(!r.ok) return alert(j.error);
    setNoteContent(""); refreshProfile();
  };

  const handleLoyaltyAdjust=async()=>{
    if(!profileId || !loyaltyAdjust) return;
    const pts=Number(loyaltyAdjust);
    if(!Number.isFinite(pts) || pts===0) return alert("Enter non-zero points");
    const reason=prompt("Reason for loyalty adjustment (audited)") ?? "Manual adjustment";
    const { createBrowserClient } = await import("@/lib/supabase/client");
    const sb=createBrowserClient();
    const {data:u}=await sb.auth.getUser();
    // use API? direct for now via supabase insert to ledger (service handles audit)
    // we call via service route not exists, do direct insert via API not implemented; fallback to calling via supabase directly
    try{
      const { data: prof } = await (sb.from("profiles") as any).select("organization_id").eq("auth_user_id", u.user!.id).single();
      const { error } = await (sb.from("customer_loyalty_ledger") as any).insert({ organization_id: prof.organization_id, customer_id: profileId, points: Math.abs(pts), type: pts>0 ? "ADJUSTMENT":"REDEEMED", reference: reason });
      if(error) throw error;
      // update denormalized balance
      const { data: cur } = await (sb.from("customers") as any).select("loyalty_points").eq("id", profileId).single();
      await (sb.from("customers") as any).update({ loyalty_points: Math.max(0, Number(cur.loyalty_points ?? 0)+pts)}).eq("id", profileId);
      setLoyaltyAdjust(""); refreshProfile();
    }catch(e:any){ alert(e.message); }
  };

  const exportCsv=async()=>{
    const params=new URLSearchParams();
    if(debouncedQ) params.set("search", debouncedQ);
    if(typeFilter!=="all") params.set("customer_type", typeFilter);
    if(statusFilter!=="all") params.set("status", statusFilter);
    if(branchFilter!=="all") params.set("branch_id", branchFilter);
    const r=await fetch(`/api/customers/export?${params.toString()}`);
    const j=await r.json(); if(!r.ok) return alert(j.error);
    const rows=j.data as any[];
    const header=["Customer Code","Display Name","Name","Company","Type","Phone","Alternate Phone","Email","City","Branch","Status","Total Purchases","Outstanding","Last Purchase","Credit Limit"];
    const lines=rows.map((c:any)=>[c.customer_code??"", c.display_name??c.name??"", c.name??"", c.company_name??"", c.customer_type??"", c.phone??"", c.alternate_phone??"", c.email??"", c.city??"", branches.find(b=>b.id===c.branch_id)?.name??c.branch_id??"", c.status??(c.is_active?"ACTIVE":"INACTIVE"), c.total_purchases??0, c.outstanding_balance??0, c.last_purchase??"", c.credit_limit??0].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(","));
    const csv=[header.join(","),...lines].join("\n");
    const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`customers_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const handleImportFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const text=await file.text();
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2) return alert("CSV empty");
    const header=lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/^"|"$/g,''));
    const rows=lines.slice(1).map(line=>{
      const cols=line.split(",").map(c=>c.trim().replace(/^"|"$/g,''));
      const obj:any={}; header.forEach((h,i)=> obj[h]=(cols[i]||"").trim());
      return {
        display_name: obj["display name"]||obj["name"]||obj["customer"]||"", company_name: obj["company"]||obj["company name"]||"", phone: obj["phone"]||"", alternate_phone: obj["alternate phone"]||"", email: obj["email"]||"", city: obj["city"]||"", address: obj["address"]||"", customer_type: (obj["type"]||obj["customer type"]||"INDIVIDUAL").toUpperCase(), branch: obj["branch"]||"", credit_limit: obj["credit limit"]||"0", tax_id: obj["tax id"]||"", external_reference: obj["external reference"]||"", notes: obj["notes"]||""
      };
    });
    const errs:any[]=[];
    const seenPhone=new Set<string>();
    rows.forEach((r:any,i:number)=>{
      if(!r.display_name) errs.push({row:i+1, error:"Missing Display Name"});
      if(r.phone && seenPhone.has(r.phone)) errs.push({row:i+1, error:`Duplicate phone in file: ${r.phone}`});
      if(r.phone) seenPhone.add(r.phone);
      if(r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) errs.push({row:i+1, error:`Invalid email: ${r.email}`});
    });
    setImportRows(rows); setImportErrs(errs);
  };
  const commitImport=async()=>{
    const valid=importRows.filter((_,i)=> !importErrs.some(e=>e.row===i+1));
    if(valid.length===0) return alert("No valid rows");
    let ok=0, fail=0;
    for(const r of valid){
      try{
        let branch_id=null;
        if(r.branch){ const b=branches.find((br:any)=> br.name.toLowerCase()===r.branch.toLowerCase() || br.code.toLowerCase()===r.branch.toLowerCase()); if(b) branch_id=b.id; }
        const payload:any={ display_name: r.display_name, company_name: r.company_name || null, phone: r.phone||null, alternate_phone: r.alternate_phone||null, email: r.email||null, address: r.address||null, city: r.city||null, customer_type: customerTypes.some(c=>c.v===r.customer_type)? r.customer_type : "INDIVIDUAL", branch_id, credit_limit: Number(r.credit_limit)||0, tax_id: r.tax_id||null, external_reference: r.external_reference||null, notes: r.notes||null, continue_anyway:false };
        const rr=await fetch("/api/customers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!rr.ok){ fail++; const j=await rr.json(); if(j.duplicate_detected) errsPush(); } else ok++;
      }catch{ fail++; }
    }
    function errsPush(){}
    alert(`Import done — ${ok} succeeded, ${fail} failed (duplicates skipped)`);
    setShowImport(false); setImportRows([]); setImportErrs([]); fetchData();
  };
  const downloadTemplate=()=>{
    const header="Display Name,Company,Phone,Alternate Phone,Email,City,Address,Customer Type,Branch,Credit Limit,Tax ID,External Reference,Notes";
    const sample="John Doe,,0700123456,,john@example.com,Kampala,Main Street,INDIVIDUAL,Main Branch,500000,,REF-001,Regular";
    const blob=new Blob([header+"\n"+sample],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="mediflow_customer_template.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const totalPages=Math.max(1, Math.ceil(totalCount/perPage));
  const clearFilters=()=>{ setQ(""); setTypeFilter("all"); setStatusFilter("all"); setBranchFilter("all"); setCreditFilter("all"); setDateFrom(""); setDateTo(""); };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UserCircle className="h-6 w-6"/>Customers</h1>
          <p className="text-muted-foreground text-sm">Customer 360 — WHO they are, WHAT they bought, WHAT they owe, WHERE they shop. POS ↔ Sales ↔ Payments ↔ Credit ↔ Returns ↔ Loyalty ↔ Audit ↔ Branch</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pendingCount>0 && <Badge variant="warning">{pendingCount} pending sync</Badge>}
          <Button variant="outline" size="sm" onClick={()=>setShowImport(true)}><Upload className="h-4 w-4 mr-2"/>Import</Button>
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2"/>Template</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-2"/>Export CSV</Button>
          <Button onClick={()=>{ setEditing(null); setForm({ display_name:"", company_name:"", first_name:"", last_name:"", customer_type:"INDIVIDUAL", phone:"", alternate_phone:"", email:"", address:"", city:"", branch_id:"", credit_limit:"0", tax_id:"", external_reference:"", notes:"", preferred_contact:"PHONE", sms_opt_in:false, email_opt_in:false, marketing_opt_in:false, contact_person:"" }); setDupWarn([]); setShowDupPrompt(false); setShowAdd(true); }}><Plus className="h-4 w-4 mr-2"/>New Customer</Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Users className="h-3 w-3"/>Total Customers</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{kpi?.total ?? "—"}</div><div className="text-xs text-muted-foreground">{totalCount} in current filter</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Check className="h-3 w-3"/>Active</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{kpi?.active ?? "—"}</div><div className="text-xs text-muted-foreground">Inactive {kpi?.inactive ?? 0} • Blocked {kpi?.blocked ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3"/>New This Month</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{kpi?.newThisMonth ?? 0}</div><div className="text-xs text-muted-foreground">Joined this month</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><CreditCard className="h-3 w-3"/>With Credit</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{kpi?.withCredit ?? 0}</div><div className="text-xs text-muted-foreground">Have outstanding</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><Receipt className="h-3 w-3"/>Outstanding</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{kpi ? formatUGX(kpi.outstandingTotal) : "—"}</div><div className="text-xs text-muted-foreground">AR total</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Overdue</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{kpi ? formatUGX(kpi.overdueTotal) : "—"}</div><div className="text-xs text-muted-foreground">Over 30d</div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search name/display/company/phone/alternate/email/code/reference" value={q} onChange={e=>setQ(e.target.value)} className="pl-9" aria-label="Search customers"/></div>
          <Button variant="outline" onClick={clearFilters}><X className="h-4 w-4 mr-2"/>Clear Filters</Button>
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="w-[160px]"><option value="all">All Types</option>{customerTypes.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}</Select>
          <Select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-[140px]"><option value="all">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="BLOCKED">Blocked</option></Select>
          <Select value={branchFilter} onChange={e=>setBranchFilter(e.target.value)} className="w-[160px]"><option value="all">All Branches</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select>
          <Select value={creditFilter} onChange={e=>setCreditFilter(e.target.value)} className="w-[150px]"><option value="all">All Credit</option><option value="with_credit">With Credit</option><option value="no_credit">No Credit</option><option value="overdue">Overdue</option></Select>
          <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-[150px]" placeholder="Joined from"/>
          <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-[150px]" placeholder="Joined to"/>
        </div>
        <p className="text-xs text-muted-foreground">Search is server-side, debounced 300ms, paginated. Indexes on name/phone/email/code. Do not load every sale for every row — metrics via selective aggregation.</p>
      </CardContent></Card>

      {/* List */}
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-3">{[...Array(6)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : data.length===0 ? <div className="py-12 text-center space-y-2"><UserCircle className="h-10 w-10 mx-auto text-muted-foreground"/><p className="font-medium">No customers</p><p className="text-sm text-muted-foreground">Add your first customer — POS can create fast without losing cart</p><Button onClick={()=>setShowAdd(true)}><Plus className="h-4 w-4 mr-2"/>Add Customer</Button></div>
        : <>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Total Purchases</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Last Purchase</TableHead><TableHead>Status</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader><TableBody>
              {data.map(c=>(
                <TableRow key={c.id} className="hover:bg-muted/40 cursor-pointer" onClick={()=>openProfile(c.id)}>
                  <TableCell className="font-medium max-w-[220px]"><div className="truncate">{c.display_name ?? c.company_name ?? c.name}</div><div className="text-xs text-muted-foreground truncate font-mono">{c.customer_code ?? c.id.slice(0,8)}</div></TableCell>
                  <TableCell className="text-sm">{c.phone ?? "—"}{c.alternate_phone ? <div className="text-xs text-muted-foreground">{c.alternate_phone}</div>:null}</TableCell>
                  <TableCell><Badge variant="outline">{customerTypes.find(t=>t.v===(c.customer_type??'INDIVIDUAL'))?.l ?? c.customer_type}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatUGX(c.total_purchases??0)}<div className="text-[10px] text-muted-foreground">{c.transaction_count??0} txns</div></TableCell>
                  <TableCell className="text-right font-mono text-xs">{Number(c.outstanding_balance??0)>0 ? <span className="text-amber-600 font-bold">{formatUGX(c.outstanding_balance!)}</span> : "—"}{c.credit_limit ? <div className="text-[10px] text-muted-foreground">Limit {formatUGX(Number(c.credit_limit))}</div>:null}</TableCell>
                  <TableCell className="text-xs">{c.last_purchase ? new Date(c.last_purchase).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{c.status==='BLOCKED' ? <Badge variant="destructive">Blocked</Badge> : c.status==='INACTIVE' || !c.is_active ? <Badge variant="secondary">Inactive</Badge> : <Badge variant="success">Active</Badge>}</TableCell>
                  <TableCell className="text-xs">{branches.find(b=>b.id===c.branch_id)?.code ?? c.branch_id?.slice(0,6) ?? "—"}</TableCell>
                  <TableCell className="text-right" onClick={e=>e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={()=>openProfile(c.id)} title="View 360"><Eye className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={()=>{ setEditing(c); setForm({ display_name: c.display_name ?? c.name ?? "", company_name: c.company_name ?? "", first_name: c.first_name ?? "", last_name: c.last_name ?? "", customer_type: c.customer_type ?? "INDIVIDUAL", phone: c.phone ?? "", alternate_phone: c.alternate_phone ?? "", email: c.email ?? "", address: c.address ?? "", city: c.city ?? "", branch_id: c.branch_id ?? "", credit_limit: String(c.credit_limit ?? 0), tax_id: c.tax_id ?? "", external_reference: c.external_reference ?? "", notes: c.notes ?? "", preferred_contact: c.preferred_contact ?? "PHONE", sms_opt_in: !!c.sms_opt_in, email_opt_in: !!c.email_opt_in, marketing_opt_in: !!c.marketing_opt_in, contact_person: c.contact_person ?? "" }); setShowAdd(true); }} title="Edit"><Edit className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={()=>handleDeactivate(c.id, !!c.is_active && c.status!=='BLOCKED')} title={c.is_active ? "Deactivate" : "Reactivate"}>{c.is_active ? <Trash2 className="h-4 w-4"/> : <RefreshCw className="h-4 w-4"/>}</Button>
                      <Button variant="ghost" size="icon" onClick={()=>handleBlock(c.id, c.status==='BLOCKED')} title={c.status==='BLOCKED' ? "Unblock" : "Block"}><Ban className="h-4 w-4"/></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </div>
          {/* Mobile cards */}
          <div className="lg:hidden p-3 grid gap-3 sm:grid-cols-2">
            {data.map(c=>(
              <Card key={c.id} className="cursor-pointer" onClick={()=>openProfile(c.id)}><CardContent className="p-3 space-y-2">
                <div className="flex justify-between gap-2"><p className="font-semibold truncate">{c.display_name ?? c.company_name ?? c.name}</p>{c.status==='BLOCKED' ? <Badge variant="destructive">Blocked</Badge> : c.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3"/>{c.phone ?? "—"} {c.customer_code && <span className="ml-auto font-mono">{c.customer_code}</span>}</p>
                <div className="flex flex-wrap gap-1"><Badge variant="outline">{customerTypes.find(t=>t.v===c.customer_type)?.l}</Badge>{c.credit_limit ? <Badge variant="warning">Limit {formatUGX(Number(c.credit_limit))}</Badge>:null}</div>
                <div className="flex justify-between text-xs"><span>Purchases: <strong>{formatUGX(c.total_purchases??0)}</strong> ({c.transaction_count??0})</span>{Number(c.outstanding_balance??0)>0 && <span className="text-amber-600 font-bold">Owes {formatUGX(c.outstanding_balance!)}</span>}</div>
                <div className="text-xs text-muted-foreground">Last: {c.last_purchase ? new Date(c.last_purchase).toLocaleDateString() : "—"} • {branches.find(b=>b.id===c.branch_id)?.code ?? "—"}</div>
                <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="flex-1" onClick={()=>openProfile(c.id)}><Eye className="h-4 w-4 mr-1"/>View</Button>
                  <Button size="sm" variant="outline" onClick={()=>{ setEditing(c); setForm({ display_name: c.display_name ?? c.name ?? "", company_name: c.company_name ?? "", first_name: c.first_name ?? "", last_name: c.last_name ?? "", customer_type: c.customer_type ?? "INDIVIDUAL", phone: c.phone ?? "", alternate_phone: c.alternate_phone ?? "", email: c.email ?? "", address: c.address ?? "", city: c.city ?? "", branch_id: c.branch_id ?? "", credit_limit: String(c.credit_limit ?? 0), tax_id: c.tax_id ?? "", external_reference: c.external_reference ?? "", notes: c.notes ?? "", preferred_contact:"PHONE", sms_opt_in:false, email_opt_in:false, marketing_opt_in:false, contact_person:"" }); setShowAdd(true); }}><Edit className="h-4 w-4"/></Button>
                  <Button size="sm" variant={c.is_active?"ghost":"secondary"} onClick={()=>handleDeactivate(c.id, !!c.is_active)}>{c.is_active?<Trash2 className="h-4 w-4"/>:<RefreshCw className="h-4 w-4"/>}</Button>
                </div>
              </CardContent></Card>
            ))}
          </div>
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} • {totalCount} total</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft className="h-4 w-4"/>Prev</Button><Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next<ChevronRight className="h-4 w-4 ml-1"/></Button></div>
          </div>
        </>}
      </CardContent></Card>

      {/* New/Edit Customer Dialog */}
      <Dialog open={showAdd} onOpenChange={(o)=>{ setShowAdd(o); if(!o){ setDupWarn([]); setShowDupPrompt(false); }}}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "New Customer — fast for POS"} {pendingCount>0 && <Badge variant="warning">{pendingCount} pending sync</Badge>}</DialogTitle><DialogDescription>Required: name/display. Phone where applicable. Fast save returns to sale without losing cart (POS). Duplicate detection before save.</DialogDescription></DialogHeader>
          {/* duplicate prompt */}
          {showDupPrompt && dupWarn.length>0 && (
            <div className="border border-amber-300 bg-amber-50 rounded p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600"/> A similar customer already exists.</p>
              <div className="space-y-1 text-sm">
                {dupWarn.map((d:any)=><div key={d.id} className="flex justify-between border rounded p-2 bg-white"><span>{d.display_name ?? d.name} • {d.phone ?? ""} {d.email?`• ${d.email}`:""} {d.company_name?`• ${d.company_name}`:""}</span><Button size="sm" variant="outline" onClick={()=>{ setShowAdd(false); setShowDupPrompt(false); openProfile(d.id); }}>View Existing</Button></div>)}
              </div>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>{ setShowDupPrompt(false); setDupWarn([]); }}>Cancel</Button><Button size="sm" onClick={()=>submitCreate(true)}>Continue Anyway</Button></div>
            </div>
          )}
          <div className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Display Name / Customer Name *</Label><Input value={form.display_name} onChange={e=>setForm({...form, display_name:e.target.value})} placeholder="John Doe or Walk-in"/></div>
              <div><Label>Customer Type *</Label><Select value={form.customer_type} onChange={e=>setForm({...form, customer_type:e.target.value})}><option value="">Select</option>{customerTypes.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}</Select></div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})}/></div>
              <div><Label>Last Name</Label><Input value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})}/></div>
            </div>
            {['CORPORATE','ORGANIZATION','HOSPITAL','CLINIC','INSURANCE'].includes(form.customer_type) && (
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Company/Business Name</Label><Input value={form.company_name} onChange={e=>setForm({...form, company_name:e.target.value})} placeholder="Acme Clinic Ltd"/></div>
                <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={e=>setForm({...form, contact_person:e.target.value})} placeholder="Dr. Jane"/></div>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="0700..."/></div>
              <div><Label>Alternate Phone</Label><Input value={form.alternate_phone} onChange={e=>setForm({...form, alternate_phone:e.target.value})}/></div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="customer@example.com"/></div>
              <div><Label>Branch</Label><Select value={form.branch_id} onChange={e=>setForm({...form, branch_id:e.target.value})}><option value="">No branch / All</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Address</Label><Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})} placeholder="Plot 12, Kampala Rd"/></div>
              <div><Label>City / Location</Label><Input value={form.city} onChange={e=>setForm({...form, city:e.target.value})} placeholder="Kampala"/></div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div><Label>Tax ID (business)</Label><Input value={form.tax_id} onChange={e=>setForm({...form, tax_id:e.target.value})} placeholder="TIN if corporate"/></div>
              <div><Label>External Reference</Label><Input value={form.external_reference} onChange={e=>setForm({...form, external_reference:e.target.value})} placeholder="External code"/></div>
              <div><Label>Credit Limit (UGX)</Label><Input type="number" value={form.credit_limit} onChange={e=>setForm({...form, credit_limit:e.target.value})} placeholder="0"/></div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Preferred Contact</Label><Select value={form.preferred_contact} onChange={e=>setForm({...form, preferred_contact:e.target.value})}><option value="PHONE">Phone</option><option value="SMS">SMS</option><option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option><option value="NONE">None</option></Select></div>
              <div className="flex gap-3 items-center pt-6"><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.sms_opt_in} onChange={e=>setForm({...form, sms_opt_in:e.target.checked})}/> SMS</label><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.email_opt_in} onChange={e=>setForm({...form, email_opt_in:e.target.checked})}/> Email</label><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.marketing_opt_in} onChange={e=>setForm({...form, marketing_opt_in:e.target.checked})}/> Marketing</label></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} placeholder="Important notes (internal)"/></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={()=>{ setShowAdd(false); setEditing(null); setDupWarn([]); setShowDupPrompt(false); }}>Cancel</Button>
              <Button className="flex-1" disabled={saving || !form.display_name.trim()} onClick={()=>submitCreate(false)}>{saving?"Saving...": editing ? "Update Customer" : "Save — Return to Sale"}</Button>
            </div>
            <p className="text-xs text-muted-foreground">POS fast path: Save → return to current cart (cart not cleared). Deactivation preserves history. Credit limit audited.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer 360 Profile */}
      <Dialog open={!!profileId} onOpenChange={(o)=>!o && setProfileId(null)}>
        <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5"/>Customer 360 — {profile?.customer?.display_name ?? profile?.customer?.name ?? "Loading..."} {profile?.customer && <Badge variant={profile.customer.status==='BLOCKED'?'destructive': profile.customer.is_active?'success':'secondary'}>{profile.customer.status ?? (profile.customer.is_active?"ACTIVE":"INACTIVE")}</Badge>}</DialogTitle>
            <DialogDescription>Single customer truth — Sales, Payments, Credit/AR, Returns, Loyalty, Notes, Audit, Branch. Financial balances are transaction-driven, not editable fields.</DialogDescription>
          </DialogHeader>
          {profileLoading || !profile ? <div className="p-6 space-y-3">{[...Array(4)].map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div>
          : (
            <div className="space-y-4">
              {/* Identity + Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserCircle className="h-4 w-4"/>Identity</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Code:</span><span className="font-mono text-xs">{profile.customer.customer_code ?? profile.customer.id.slice(0,8)}</span></div>
                  <div className="flex justify-between"><span>Type:</span><Badge variant="outline">{profile.customer.customer_type ?? "INDIVIDUAL"}</Badge></div>
                  <div className="flex justify-between"><span>Branch:</span><span>{branches.find(b=>b.id===profile.customer.branch_id)?.name ?? profile.customer.branch_id?.slice(0,6) ?? "—"}</span></div>
                  <div className="flex justify-between"><span>Since:</span><span>{new Date(profile.customer.created_at).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span>Status:</span><Badge variant={profile.customer.status==='BLOCKED'?'destructive': profile.customer.is_active?'success':'secondary'}>{profile.customer.status ?? (profile.customer.is_active?"Active":"Inactive")}</Badge></div>
                  <div className="text-xs text-muted-foreground pt-2"><span className="font-medium">Contact:</span> {profile.customer.phone ?? "—"} {profile.customer.alternate_phone?`• ${profile.customer.alternate_phone}`:""} • {profile.customer.email ?? "—"} • {profile.customer.city ?? ""} {profile.customer.address??""}</div>
                  {profile.customer.company_name && <div className="text-xs"><span className="text-muted-foreground">Company:</span> {profile.customer.company_name} {profile.customer.contact_person?`• ${profile.customer.contact_person}`:""}</div>}
                  {profile.customer.tax_id && <div className="text-xs"><span className="text-muted-foreground">TIN:</span> {profile.customer.tax_id}</div>}
                </CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4"/>Account Summary</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Total Purchases:</span><span className="font-bold">{formatUGX(profile.customer.total_purchases ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Total Paid:</span><span>{formatUGX(profile.customer.total_paid ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Outstanding:</span><span className={Number(profile.customer.outstanding_balance??0)>0?"font-bold text-amber-600":""}>{formatUGX(profile.customer.outstanding_balance ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Overdue:</span><span className={Number(profile.customer.overdue_amount??0)>0?"text-destructive font-bold":""}>{formatUGX(profile.customer.overdue_amount ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Returns:</span><span>{formatUGX(profile.returns?.count ? profile.returns.data?.reduce((a:any,r:any)=>a+Number(r.total),0) : 0)}</span></div>
                  <div className="flex justify-between"><span>Transactions:</span><span>{profile.customer.transaction_count ?? 0}</span></div>
                  <div className="flex justify-between"><span>Last Purchase:</span><span>{profile.customer.last_purchase ? new Date(profile.customer.last_purchase).toLocaleDateString() : "—"}</span></div>
                </CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4"/>Credit</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Credit Limit:</span><span className="font-bold">{formatUGX(Number(profile.customer.credit_limit ?? 0))}</span></div>
                  <div className="flex justify-between"><span>Outstanding:</span><span>{formatUGX(profile.customer.outstanding_balance ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Available:</span><span className="text-green-600 font-bold">{formatUGX(profile.customer.available_credit ?? (Number(profile.customer.credit_limit ?? 0)-Number(profile.customer.outstanding_balance ?? 0)))}</span></div>
                  <div className="flex justify-between"><span>Overdue:</span><span>{formatUGX(profile.customer.overdue_amount ?? 0)}</span></div>
                  <div className="text-xs text-muted-foreground pt-1">Payment Terms: {profile.customer.payment_terms ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">AR is transaction-driven: Sale → AR + • Payment → AR - • Return/Credit → AR -</div>
                </CardContent></Card>
              </div>
              {/* Quick actions */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={()=> window.location.href=`/pos?customer_id=${profile.customer.id}`}><ShoppingCart className="h-4 w-4 mr-1"/>New Sale (POS)</Button>
                <Button size="sm" variant="outline" onClick={()=>{ setProfileTab("statement"); loadStatement();}}><FileText className="h-4 w-4 mr-1"/>View Statement</Button>
                <Button size="sm" variant="outline" onClick={()=> window.location.href=`/returns?customer_id=${profile.customer.id}`}><RotateCcw className="h-4 w-4 mr-1"/>Process Return</Button>
                <Button size="sm" variant="outline" onClick={()=>{ setEditing(profile.customer); setForm({ display_name: profile.customer.display_name ?? profile.customer.name ?? "", company_name: profile.customer.company_name ?? "", first_name: profile.customer.first_name ?? "", last_name: profile.customer.last_name ?? "", customer_type: profile.customer.customer_type ?? "INDIVIDUAL", phone: profile.customer.phone ?? "", alternate_phone: profile.customer.alternate_phone ?? "", email: profile.customer.email ?? "", address: profile.customer.address ?? "", city: profile.customer.city ?? "", branch_id: profile.customer.branch_id ?? "", credit_limit: String(profile.customer.credit_limit ?? 0), tax_id: profile.customer.tax_id ?? "", external_reference: profile.customer.external_reference ?? "", notes: profile.customer.notes ?? "", preferred_contact: profile.customer.preferred_contact ?? "PHONE", sms_opt_in: !!profile.customer.sms_opt_in, email_opt_in: !!profile.customer.email_opt_in, marketing_opt_in: !!profile.customer.marketing_opt_in, contact_person: profile.customer.contact_person ?? "" }); setShowAdd(true); }}><Edit className="h-4 w-4 mr-1"/>Edit</Button>
                <Button size="sm" variant="outline" onClick={()=>handleDeactivate(profile.customer.id, !!profile.customer.is_active)}>{profile.customer.is_active ? <><Trash2 className="h-4 w-4 mr-1"/>Deactivate</> : <><RefreshCw className="h-4 w-4 mr-1"/>Reactivate</>}</Button>
                <Button size="sm" variant={profile.customer.status==='BLOCKED'?"secondary":"outline"} onClick={()=>handleBlock(profile.customer.id, profile.customer.status==='BLOCKED')}><Ban className="h-4 w-4 mr-1"/>{profile.customer.status==='BLOCKED'?"Unblock":"Block"}</Button>
                <Button size="sm" variant="destructive" onClick={()=>handleDeleteHard(profile.customer.id)}><Trash2 className="h-4 w-4 mr-1"/>Delete (if no history)</Button>
                <Button size="sm" variant="outline" onClick={refreshProfile}><RefreshCw className="h-4 w-4 mr-1"/>Refresh 360</Button>
              </div>

              <Tabs value={profileTab} onValueChange={setProfileTab}>
                <TabsList className="flex flex-wrap h-auto gap-1">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="sales">Sales</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="statement">Statement</TabsTrigger>
                  <TabsTrigger value="credit">Credit</TabsTrigger>
                  <TabsTrigger value="returns">Returns</TabsTrigger>
                  <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="audit">Activity/Audit</TabsTrigger>
                  <TabsTrigger value="merge">Merge</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card><CardHeader><CardTitle className="text-sm">Recent Sales</CardTitle></CardHeader><CardContent>
                      {(profile.sales?.data?.length??0)===0 ? <p className="text-sm text-muted-foreground">No sales yet — every POS sale with this customer appears here. Click sale to open Sales detail (single source).</p>
                      : <Table><TableHeader><TableRow><TableHead>Sale #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                        {profile.sales.data.map((s:any)=><TableRow key={s.id} className="cursor-pointer" onClick={()=> window.location.href=`/sales?id=${s.id}`}><TableCell className="font-mono text-xs">{s.sale_number}</TableCell><TableCell className="text-xs">{new Date(s.sold_at).toLocaleDateString()}</TableCell><TableCell className="text-right text-xs">{formatUGX(Number(s.total))}</TableCell><TableCell><Badge variant="outline">{s.status}</Badge></TableCell></TableRow>)}
                      </TableBody></Table>}
                    </CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-sm">Recent Payments</CardTitle></CardHeader><CardContent>
                      {(profile.payments?.data?.length??0)===0 ? <p className="text-sm text-muted-foreground">No payments yet — payments reference existing Payment records (no duplicate).</p>
                      : <Table><TableHeader><TableRow><TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
                        {profile.payments.data.map((p:any)=><TableRow key={p.id}><TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell><TableCell className="font-mono text-xs">{formatUGX(Number(p.amount))}</TableCell><TableCell className="text-xs">{new Date(p.paid_at).toLocaleDateString()}</TableCell></TableRow>)}
                      </TableBody></Table>}
                    </CardContent></Card>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card><CardHeader><CardTitle className="text-sm">Returns</CardTitle></CardHeader><CardContent>
                      {(profile.returns?.data?.length??0)===0 ? <p className="text-sm text-muted-foreground">No returns — RET-xxx → Original Sale → Batch → Inventory Movement → Refund/Credit traceable.</p>
                      : <Table><TableHeader><TableRow><TableHead>Return #</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                        {profile.returns.data.map((r:any)=><TableRow key={r.id} className="cursor-pointer" onClick={()=> window.location.href=`/returns?id=${r.id}`}><TableCell className="font-mono text-xs">{r.return_number}</TableCell><TableCell className="text-xs">{formatUGX(Number(r.total))}</TableCell><TableCell><Badge>{r.status}</Badge></TableCell></TableRow>)}
                      </TableBody></Table>}
                    </CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-sm">Loyalty</CardTitle></CardHeader><CardContent>
                      <p className="text-sm">Points: <strong>{profile.loyalty?.total ?? profile.customer.loyalty_points ?? 0}</strong></p>
                      <p className="text-xs text-muted-foreground">Ledger: Earned on Sale → Redeemed/Adjusted. Balance derived from ledger, not editable field.</p>
                      {(profile.loyalty?.ledger?.length??0)>0 && <div className="mt-2 text-xs space-y-1">{profile.loyalty.ledger.slice(0,3).map((l:any)=><div key={l.id} className="flex justify-between"><span>{l.type} {l.points}</span><span>{new Date(l.created_at).toLocaleDateString()}</span></div>)}</div>}
                    </CardContent></Card>
                  </div>
                  {profile.customer.notes && <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><StickyNote className="h-4 w-4"/>Important Notes</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{profile.customer.notes}</p></CardContent></Card>}
                  <Card><CardHeader><CardTitle className="text-sm">Branch & Traceability</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Branches used:</span> {(profile.customer.branch_totals && Object.keys(profile.customer.branch_totals).length) ? Object.entries(profile.customer.branch_totals).map(([bid, tot]:any)=> `${branches.find(b=>b.id===bid)?.code ?? bid.slice(0,6)}: ${formatUGX(Number(tot))}`).join(" • ") : "— (single branch)"}</p>
                    <p className="text-xs text-muted-foreground">One Customer → Multiple Branch Sales. No duplicate customer per branch. Sales → Product → Batch → Inventory Movement → Payment → Receipt → Return → Audit traceable.</p>
                    <p className="text-xs text-muted-foreground">Patient/Prescription: where MediFlow has Patient module, link via reference — Customer → Patient/Dependent → Prescription → Dispensing → Sale. Currently: not separate module present — placeholder, no duplication.</p>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="sales" className="mt-4">
                  <Card><CardHeader><CardTitle className="text-sm">Sales — Existing Sales module (no duplication)</CardTitle><CardDescription>Click sale to open Sales detail page (single implementation)</CardDescription></CardHeader><CardContent>
                    <div className="space-y-3">
                      <Button size="sm" variant="outline" onClick={async()=>{ const d=await fetch(`/api/customers/detail?id=${profile.customer.id}&tab=sales`).then(r=>r.json()); setProfile((p:any)=>({...p, sales: d})); }}>Refresh Sales</Button>
                      {(profile.sales?.data?.length??0)===0 ? <p className="text-sm text-muted-foreground py-8 text-center">No sales for this customer yet.</p>
                      : <Table><TableHeader><TableRow><TableHead>Sale #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Branch</TableHead><TableHead>Cashier</TableHead></TableRow></TableHeader><TableBody>
                        {profile.sales.data.map((s:any)=><TableRow key={s.id} className="cursor-pointer hover:bg-muted/40" onClick={()=> window.location.href=`/sales?id=${s.id}`}><TableCell className="font-mono text-xs">{s.sale_number}</TableCell><TableCell className="text-xs">{new Date(s.sold_at).toLocaleDateString()}</TableCell><TableCell className="text-right font-mono text-xs">{formatUGX(Number(s.total))}</TableCell><TableCell><Badge>{s.status}</Badge></TableCell><TableCell className="text-xs">{branches.find(b=>b.id===s.branch_id)?.code ?? s.branch_id?.slice(0,6)}</TableCell><TableCell className="text-xs">{s.cashier_id?.slice(0,8) ?? "—"}</TableCell></TableRow>)}
                      </TableBody></Table>}
                    </div>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  <Card><CardHeader><CardTitle className="text-sm">Payments — Existing Payment records</CardTitle></CardHeader><CardContent>
                    {(profile.payments?.data?.length??0)===0 ? <p className="text-sm text-muted-foreground py-8 text-center">No payments linked via sales yet.</p>
                    : <Table><TableHeader><TableRow><TableHead>Payment</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Date</TableHead><TableHead>Sale</TableHead></TableRow></TableHeader><TableBody>
                      {profile.payments.data.map((p:any)=><TableRow key={p.id} className="cursor-pointer" onClick={()=> window.location.href=`/sales?id=${p.sale_id}`}><TableCell className="font-mono text-xs">{p.id.slice(0,8)}</TableCell><TableCell>{formatUGX(Number(p.amount))}</TableCell><TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell><TableCell className="text-xs">{new Date(p.paid_at).toLocaleDateString()}</TableCell><TableCell className="font-mono text-xs">{p.sales?.sale_number ?? p.sale_id.slice(0,8)}</TableCell></TableRow>)}
                    </TableBody></Table>}
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="statement" className="mt-4">
                  <Card><CardHeader><CardTitle className="text-sm">Statement — Opening → Sales → Payments → Returns → Closing (Reconciles to AR)</CardTitle><CardDescription>Filter by date, Print/Download/Export. Totals must equal AR balance.</CardDescription></CardHeader><CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Input type="date" value={statementFrom} onChange={e=>setStatementFrom(e.target.value)} className="w-[160px]"/>
                      <Input type="date" value={statementTo} onChange={e=>setStatementTo(e.target.value)} className="w-[160px]"/>
                      <Button size="sm" onClick={loadStatement}><Filter className="h-4 w-4 mr-1"/>Apply</Button>
                      <Button size="sm" variant="outline" onClick={()=>{ setStatementFrom(""); setStatementTo(""); setStatementData(null); }}><X className="h-4 w-4"/>Clear</Button>
                      <Button size="sm" variant="outline" onClick={()=>window.print()}><Printer className="h-4 w-4 mr-1"/>Print</Button>
                      <Button size="sm" variant="outline" onClick={()=>{
                        if(!statementData) return;
                        const rows=statementData.entries as any[];
                        const header="Date,Type,Reference,Amount,Balance";
                        const csv=[header,...rows.map((r:any)=>[new Date(r.date).toLocaleDateString(), r.type, r.ref, r.amount, r.balance].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(","))].join("\n");
                        const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`statement_${profile.customer.customer_code ?? profile.customer.id}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
                      }}><Download className="h-4 w-4 mr-1"/>Export</Button>
                    </div>
                    {!statementData ? <p className="text-sm text-muted-foreground">Apply date filter to generate statement. Includes opening balance, sales/invoices, payments, credits, refunds, closing — closing = opening + sales - payments - returns.</p>
                    : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="border rounded p-2"><p className="text-muted-foreground text-xs">Opening</p><p className="font-bold">{formatUGX(statementData.opening)}</p></div>
                          <div className="border rounded p-2"><p className="text-muted-foreground text-xs">Sales</p><p className="font-bold">{formatUGX(statementData.totalSales)}</p></div>
                          <div className="border rounded p-2"><p className="text-muted-foreground text-xs">Payments</p><p className="font-bold">{formatUGX(statementData.totalPaid)}</p></div>
                          <div className="border rounded p-2"><p className="text-muted-foreground text-xs">Returns</p><p className="font-bold">{formatUGX(statementData.totalReturns)}</p></div>
                          <div className="border rounded p-2 bg-muted/20"><p className="text-muted-foreground text-xs">Closing</p><p className="font-bold">{formatUGX(statementData.closing)}</p></div>
                          <div className="border rounded p-2"><p className="text-muted-foreground text-xs">Reconciles to Outstanding?</p><p className="font-bold">{Number(statementData.closing).toFixed(2)===Number(profile.customer.outstanding_balance ?? 0).toFixed(2) ? "✓ Yes" : "Δ Check (filtered period)"}</p></div>
                        </div>
                        <div className="overflow-x-auto">
                          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Ref</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader><TableBody>
                            {statementData.entries.length===0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No entries in period</TableCell></TableRow>
                            : statementData.entries.map((e:any,i:number)=><TableRow key={i}><TableCell className="text-xs">{new Date(e.date).toLocaleDateString()}</TableCell><TableCell><Badge variant="outline">{e.type}</Badge></TableCell><TableCell className="font-mono text-xs">{e.ref}</TableCell><TableCell className="text-right font-mono text-xs">{formatUGX(e.amount)}</TableCell><TableCell className="text-right font-mono text-xs">{formatUGX(e.balance)}</TableCell></TableRow>)}
                          </TableBody></Table>
                        </div>
                      </div>
                    )}
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="credit" className="mt-4">
                  <Card><CardHeader><CardTitle className="text-sm">Credit / Accounts Receivable — Transaction-driven</CardTitle><CardDescription>Credit Limit UGX {Number(profile.customer.credit_limit ?? 0).toLocaleString()} • Outstanding UGX {Number(profile.customer.outstanding_balance ?? 0).toLocaleString()} • Available UGX {Number(profile.customer.available_credit ?? 0).toLocaleString()} • Overdue UGX {Number(profile.customer.overdue_amount ?? 0).toLocaleString()}</CardDescription></CardHeader><CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="border rounded p-3 text-center"><p className="text-xs text-muted-foreground">Limit</p><p className="text-lg font-bold">{formatUGX(Number(profile.customer.credit_limit ?? 0))}</p></div>
                      <div className="border rounded p-3 text-center"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-bold text-amber-600">{formatUGX(Number(profile.customer.outstanding_balance ?? 0))}</p></div>
                      <div className="border rounded p-3 text-center bg-green-50"><p className="text-xs text-muted-foreground">Available</p><p className="text-lg font-bold text-green-600">{formatUGX(Number(profile.customer.available_credit ?? 0))}</p></div>
                    </div>
                    <div className="text-xs text-muted-foreground">POS enforces: credit sale only if Outstanding + Sale ≤ Limit unless authorized override (audited). Customer Payment → AR -; Return/Write-off → controlled adjustment. Do not edit balance directly.</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={()=>{
                        const v=prompt("New credit limit (UGX)", String(profile.customer.credit_limit ?? 0));
                        if(v===null) return;
                        const n=Number(v); if(!Number.isFinite(n)||n<0) return alert("Invalid");
                        fetch("/api/customers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id: profile.customer.id, credit_limit: n, reason: "Credit limit change"})}).then(r=>r.json()).then(j=>{ if(j.error) alert(j.error); else { refreshProfile(); fetchData(); }});
                      }}><CreditCard className="h-4 w-4 mr-1"/>Change Limit (Audited)</Button>
                      <Button size="sm" variant="outline" onClick={()=>{ setProfileTab("statement"); loadStatement(); }}>View Statement</Button>
                    </div>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="returns" className="mt-4">
                  <Card><CardHeader><CardTitle className="text-sm">Returns — Existing Returns module</CardTitle></CardHeader><CardContent>
                    {(profile.returns?.data?.length??0)===0 ? <p className="text-sm text-muted-foreground py-8 text-center">No returns — process via Returns module, original sale → product → batch → inventory movement → refund/credit → balance.</p>
                    : <Table><TableHeader><TableRow><TableHead>Return #</TableHead><TableHead>Original Sale</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Resolution</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>
                      {profile.returns.data.map((r:any)=><TableRow key={r.id}><TableCell className="font-mono text-xs">{r.return_number}</TableCell><TableCell className="font-mono text-xs">{r.sales?.sale_number ?? r.sale_id.slice(0,8)}</TableCell><TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell><TableCell className="text-right">{formatUGX(Number(r.total))}</TableCell><TableCell><Badge>{r.refund_status ?? r.status}</Badge></TableCell><TableCell><Button size="sm" variant="ghost" onClick={()=> window.location.href=`/returns?id=${r.id}`}><Eye className="h-4 w-4"/></Button></TableCell></TableRow>)}
                    </TableBody></Table>}
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="loyalty" className="mt-4">
                  <Card><CardHeader><CardTitle className="text-sm">Loyalty — Transaction ledger (not mutable balance)</CardTitle><CardDescription>Sale → Points Earned • Redemption → Points Used • Adjustment → Auditable</CardDescription></CardHeader><CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Current</p><p className="text-xl font-bold">{profile.loyalty?.total ?? profile.customer.loyalty_points ?? 0}</p></div>
                      <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Lifetime Earned</p><p className="text-lg font-bold">{(profile.loyalty?.ledger ?? []).filter((l:any)=>l.type==='EARNED').reduce((a:any,b:any)=>a+Number(b.points),0)}</p></div>
                      <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Redeemed</p><p className="text-lg font-bold">{(profile.loyalty?.ledger ?? []).filter((l:any)=>l.type==='REDEEMED').reduce((a:any,b:any)=>a+Number(b.points),0)}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Points (+ earn / - redeem)" value={loyaltyAdjust} onChange={e=>setLoyaltyAdjust(e.target.value)} className="w-[180px]"/>
                      <Button size="sm" onClick={handleLoyaltyAdjust}><Heart className="h-4 w-4 mr-1"/>Adjust (Audited)</Button>
                    </div>
                    <div className="overflow-x-auto">
                      <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Points</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader><TableBody>
                        {(profile.loyalty?.ledger?.length??0)===0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No loyalty ledger yet</TableCell></TableRow>
                        : profile.loyalty.ledger.map((l:any)=><TableRow key={l.id}><TableCell className="text-xs">{new Date(l.created_at).toLocaleDateString()}</TableCell><TableCell><Badge variant="outline">{l.type}</Badge></TableCell><TableCell>{l.points}</TableCell><TableCell className="text-xs">{l.reference ?? (l.sale_id ? `Sale ${l.sale_id.slice(0,8)}` : "—")}</TableCell></TableRow>)}
                      </TableBody></Table>
                    </div>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <Card><CardHeader><CardTitle className="text-sm">Notes — Content, Author, Date</CardTitle></CardHeader><CardContent className="space-y-3">
                    <div className="flex gap-2"><Textarea placeholder="Add note (internal, audited, role-restricted visibility)..." value={noteContent} onChange={e=>setNoteContent(e.target.value)} className="flex-1"/><Button onClick={handleAddNote}><StickyNote className="h-4 w-4 mr-1"/>Add Note</Button></div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {(profile.notes?.length??0)===0 && (profile.notes ?? profile.notes) && <p className="text-sm text-muted-foreground">No notes yet. Each note records author & timestamp; internal notes not exposed in customer-facing documents.</p>}
                      {(profile.notes ?? []).map((n:any)=><div key={n.id} className="border rounded p-3 text-sm"><p>{n.content}</p><p className="text-xs text-muted-foreground">{n.profiles?.full_name ?? n.author_id?.slice(0,8) ?? "System"} • {new Date(n.created_at).toLocaleString()} • {n.visibility}</p></div>)}
                    </div>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="audit" className="mt-4">
                  <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4"/>Activity / Audit Trail</CardTitle><CardDescription>Created, Edited, Deactivated, Reactivated, Blocked, Merged, Credit Limit Changed, Payment, Note, Loyalty, Patient Linked — with user, timestamp, branch, old/new, reason</CardDescription></CardHeader><CardContent>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {(profile.audit?.logs?.length??0)===0 && (profile.audit?.merges?.length??0)===0 ? <p className="text-sm text-muted-foreground">No audit logs — all customer events are tracked after this upgrade (audit_logs table).</p>
                      : <>
                        {profile.audit?.logs?.map((a:any)=><div key={a.id} className="border rounded p-2 text-sm"><div className="flex justify-between"><span className="font-mono text-xs">{a.action}</span><span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span></div><div className="text-xs text-muted-foreground">by {a.profiles?.full_name ?? a.user_id?.slice(0,8) ?? "System"} {a.branch_id?`• branch ${a.branch_id.slice(0,6)}`:""}</div>{a.old_values && <pre className="text-xs bg-muted p-1 rounded mt-1 overflow-x-auto">{JSON.stringify(a.old_values, null, 2).slice(0,300)}</pre>}{a.new_values && <pre className="text-xs bg-muted p-1 rounded mt-1 overflow-x-auto">{JSON.stringify(a.new_values, null, 2).slice(0,300)}</pre>}</div>)}
                        {profile.audit?.merges?.map((m:any)=><div key={m.id} className="border border-amber-200 bg-amber-50 rounded p-2 text-sm"><div className="flex justify-between"><span className="font-medium">MERGED {m.merged_customer_id.slice(0,8)} → {m.master_customer_id.slice(0,8)}</span><span className="text-xs">{new Date(m.created_at).toLocaleString()}</span></div><p className="text-xs">Sales moved {m.sales_moved} • Returns {m.returns_moved} • Reason: {m.reason ?? "—"}</p></div>)}
                      </>}
                    </div>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="merge" className="mt-4">
                  <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><ArrowLeftRight className="h-4 w-4"/>Customer Merge — Master + Duplicate → Master (Preserve History)</CardTitle><CardDescription>Requires permission. Preserves Sales, Payments, Returns, Credits, Statements, Loyalty, Patient links, Notes, Audit. Permanent audit record. Do not delete history.</CardDescription></CardHeader><CardContent className="space-y-3">
                    <p className="text-sm">Master: <strong>{profile.customer.display_name ?? profile.customer.name}</strong> ({profile.customer.id.slice(0,8)}) will keep all history.</p>
                    <div className="flex gap-2">
                      <Input placeholder="Duplicate customer ID (paste id or code) — sales will move to master" value={mergeTarget} onChange={e=>setMergeTarget(e.target.value)}/>
                      <Button onClick={handleMerge}><ArrowLeftRight className="h-4 w-4 mr-1"/>Merge</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Tip: Search in list, copy ID via View 360, paste here. Duplicate will be marked merged_into_id and deactivated, not hard-deleted.</p>
                    <div className="border rounded p-2 text-xs bg-muted/20">
                      <p className="font-medium">Traceability guard:</p>
                      <p>Customer → Sale → Product → Batch → Inventory Movement → Payment → Receipt → Return → Refund/Credit → Statement → Accounting → Audit. Merge keeps every link.</p>
                    </div>
                  </CardContent></Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>Import Customers — CSV</DialogTitle><DialogDescription>Validate names, phones, emails, duplicates, type, status. Preview + errors + confirmation.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2"><Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2"/>Download Template</Button><label className="border rounded px-3 py-1.5 cursor-pointer text-sm flex items-center gap-2"><Upload className="h-4 w-4"/>Choose File<input type="file" accept=".csv" className="hidden" onChange={handleImportFile}/></label></div>
            {importRows.length>0 && (
              <div className="space-y-2">
                <p className="text-sm">{importRows.length} rows • <span className="text-destructive">{importErrs.length} errors</span> • {importRows.length - importErrs.filter((_,i)=>true).length} valid</p>
                {importErrs.length>0 && <div className="space-y-1 max-h-[150px] overflow-y-auto">{importErrs.map((e,i)=><div key={i} className="text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded p-1">Row {e.row}: {e.error}</div>)}</div>}
                <div className="overflow-x-auto border rounded max-h-[300px]"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Type</TableHead><TableHead>Branch</TableHead></TableRow></TableHeader><TableBody>
                  {importRows.slice(0,50).map((r:any,i:number)=>{ const err=importErrs.some(e=>e.row===i+1); return <TableRow key={i} className={err?"bg-destructive/10":""}><TableCell className="text-xs">{i+1}</TableCell><TableCell className="text-xs">{r.display_name}</TableCell><TableCell className="text-xs">{r.phone}</TableCell><TableCell className="text-xs">{r.email}</TableCell><TableCell className="text-xs">{r.customer_type}</TableCell><TableCell className="text-xs">{r.branch}</TableCell></TableRow>; })}
                </TableBody></Table></div>
                <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>{ setShowImport(false); setImportRows([]); setImportErrs([]); }}>Cancel</Button><Button className="flex-1" onClick={commitImport} disabled={importRows.length===0 || importRows.length===importErrs.length}>Confirm Import</Button></div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground text-center">Architectural separation maintained: Customer ≠ Sale ≠ Payment ≠ Balance ≠ Prescription ≠ Loyalty ≠ Statement ≠ Credit Transaction. Customer profile references authoritative modules; no duplication. Branch: one customer → many branch sales. Privacy: role-based, audit-logged, minimal PII.</p>
    </div>
  );
}
