"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, MapPin, Receipt, Save, Plus, Pencil, Trash2, Power, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Branch = { id: string; name: string; code: string; phone?: string | null; address?: string | null; is_active: boolean };

export default function SettingsPage(){
  const [loading,setLoading]=React.useState(true);
  const [data,setData]=React.useState<any>(null);
  const [saving,setSaving]=React.useState(false);
  const [canManageBranches,setCanManageBranches]=React.useState(false);
  const { toast }=useToast();

  // Branch CRUD
  const [branchDlg,setBranchDlg]=React.useState<{ open:boolean; editing:Branch|null }>({open:false,editing:null});
  const [bForm,setBForm]=React.useState({name:"",code:"",phone:"",address:"",is_active:true});
  const [expanded,setExpanded]=React.useState<string|null>(null);
  const [bsForm,setBsForm]=React.useState<Record<string,{receipt_prefix:string;invoice_prefix:string;default_payment_method:string}>>({});

  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const r=await fetch("/api/settings");
    const j=await r.json();
    if(!r.ok) toast({title:"Failed to load settings", description: j.error, variant:"error"});
    else setData(j);
    setLoading(false);
  },[toast]);

  const fetchCapabilities=React.useCallback(async()=>{
    try{
      const r=await fetch("/api/me");
      const j=await r.json();
      if(Array.isArray(j.permissions) && j.permissions.includes("settings.manage_branches")) setCanManageBranches(true);
    }catch{/* non-blocking */}
  },[]);

  React.useEffect(()=>{ fetchData(); fetchCapabilities(); },[fetchData,fetchCapabilities]);

  const saveOrg=async()=>{
    setSaving(true);
    const r=await fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization: data.organization})});
    const j=await r.json();
    if(!r.ok) toast({title:"Save failed", description: j.error, variant:"error"}); else toast({title:"Saved"});
    setSaving(false);
  };
  const saveOrgSettings=async()=>{
    setSaving(true);
    const r=await fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_settings: data.organization_settings})});
    const j=await r.json();
    if(!r.ok) toast({title:"Save failed", description: j.error, variant:"error"}); else toast({title:"Receipt & tax saved"});
    setSaving(false);
  };

  const openAdd=()=>{ setBForm({name:"",code:"",phone:"",address:"",is_active:true}); setBranchDlg({open:true,editing:null}); };
  const openEdit=(b:Branch)=>{ setBForm({name:b.name,code:b.code,phone:b.phone??"",address:b.address??"",is_active:b.is_active}); setBranchDlg({open:true,editing:b}); };

  const saveBranch=async()=>{
    setSaving(true);
    const editing=branchDlg.editing;
    const body=editing ? { id: editing.id, ...bForm } : { ...bForm };
    const r=await fetch("/api/branches",{method: editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const j=await r.json();
    setSaving(false);
    if(!r.ok){ toast({title: editing?"Update failed":"Create failed", description: j.error, variant:"error"}); return; }
    toast({title: editing?"Branch updated":"Branch created"});
    setBranchDlg({open:false,editing:null});
    fetchData();
  };

  const toggleActive=async(b:Branch)=>{
    const r=await fetch("/api/branches",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:b.id,is_active:!b.is_active})});
    const j=await r.json();
    if(!r.ok){ toast({title:"Update failed", description: j.error, variant:"error"}); return; }
    toast({title: (b.is_active?"Deactivated":"Activated")+" "+b.name});
    fetchData();
  };

  const deleteBranch=async(b:Branch)=>{
    if(!confirm(`Delete branch "${b.name}"? Branches with assigned users cannot be deleted.`)) return;
    const r=await fetch(`/api/branches?id=${b.id}`,{method:"DELETE"});
    const j=await r.json();
    if(!r.ok){ toast({title:"Delete failed", description: j.error, variant:"error"}); return; }
    toast({title:"Branch deleted"});
    fetchData();
  };

  const saveBranchSettings=async(b:Branch)=>{
    const s=bsForm[b.id]; if(!s) return;
    setSaving(true);
    const r=await fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({branch_settings:[{branch_id:b.id,...s}]})});
    const j=await r.json();
    setSaving(false);
    if(!r.ok){ toast({title:"Save failed", description: j.error, variant:"error"}); return; }
    toast({title:`Settings saved for ${b.name}`});
    setExpanded(null);
    fetchData();
  };

  const toggleExpand=(b:Branch)=>{
    if(expanded===b.id){ setExpanded(null); return; }
    const existing=(data?.branch_settings??[]).find((s:any)=>s.branch_id===b.id);
    setBsForm(prev=>({...prev,[b.id]:{receipt_prefix: existing?.receipt_prefix ?? "RCP", invoice_prefix: existing?.invoice_prefix ?? "INV", default_payment_method: existing?.default_payment_method ?? "CASH"}}));
    setExpanded(b.id);
  };

  if(loading) return <div className="space-y-6">{[...Array(3)].map((_,i)=><Card key={i}><CardHeader><Skeleton className="h-6 w-32"/></CardHeader><CardContent><Skeleton className="h-32 w-full"/></CardContent></Card>)}</div>;

  const branches:Branch[] = Array.isArray(data?.branches) ? data.branches : [];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-muted-foreground">Organization, branches, tax, receipt — RLS isolated, audited</p></div>

      <Card>
        <CardHeader><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Building2 className="h-5 w-5 text-primary"/></div><div><CardTitle>Organization</CardTitle><CardDescription>{data?.organization?.name}</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><label className="text-sm font-medium">Name</label><Input value={data?.organization?.name ?? ""} onChange={e=>setData((d:any)=>({...d, organization:{...d.organization, name:e.target.value}}))}/></div>
            <div className="space-y-2"><label className="text-sm font-medium">Registration</label><Input value={data?.organization?.registration_number ?? ""} onChange={e=>setData((d:any)=>({...d, organization:{...d.organization, registration_number:e.target.value}}))}/></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><label className="text-sm font-medium">Email</label><Input value={data?.organization?.email ?? ""} onChange={e=>setData((d:any)=>({...d, organization:{...d.organization, email:e.target.value}}))}/></div>
            <div className="space-y-2"><label className="text-sm font-medium">Phone</label><Input value={data?.organization?.phone ?? ""} onChange={e=>setData((d:any)=>({...d, organization:{...d.organization, phone:e.target.value}}))}/></div>
          </div>
          <div className="space-y-2"><label className="text-sm font-medium">Address</label><Input value={data?.organization?.address ?? ""} onChange={e=>setData((d:any)=>({...d, organization:{...d.organization, address:e.target.value}}))}/></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><label className="text-sm font-medium">Currency</label><Input value={data?.organization?.currency ?? "UGX"} onChange={e=>setData((d:any)=>({...d, organization:{...d.organization, currency:e.target.value}}))}/></div>
            <div className="space-y-2"><label className="text-sm font-medium">Timezone</label><Input value={data?.organization?.timezone ?? "Africa/Kampala"} onChange={e=>setData((d:any)=>({...d, organization:{...d.organization, timezone:e.target.value}}))}/></div>
          </div>
          <Button onClick={saveOrg} disabled={saving}><Save className="h-4 w-4 mr-2"/>{saving?"Saving...":"Save Organization"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Receipt className="h-5 w-5 text-primary"/></div><div><CardTitle>Receipt & Tax</CardTitle><CardDescription>EFRIS fields reserved — do not claim compliance</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><label className="text-sm font-medium">Receipt Header</label><Input value={data?.organization_settings?.receipt_header ?? ""} onChange={e=>setData((d:any)=>({...d, organization_settings:{...d.organization_settings, receipt_header:e.target.value}}))} placeholder="Thank you for shopping"/></div>
          <div className="space-y-2"><label className="text-sm font-medium">Receipt Footer</label><Input value={data?.organization_settings?.receipt_footer ?? ""} onChange={e=>setData((d:any)=>({...d, organization_settings:{...d.organization_settings, receipt_footer:e.target.value}}))} placeholder="Returns within 7 days"/></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><label className="text-sm font-medium">Tax Rate %</label><Input type="number" value={data?.organization_settings?.default_tax_rate ?? 0} onChange={e=>setData((d:any)=>({...d, organization_settings:{...d.organization_settings, default_tax_rate: Number(e.target.value)}}))}/></div>
            <div className="space-y-2"><label className="text-sm font-medium">Low Stock Threshold</label><Input type="number" value={data?.organization_settings?.low_stock_threshold ?? 10} onChange={e=>setData((d:any)=>({...d, organization_settings:{...d.organization_settings, low_stock_threshold: Number(e.target.value)}}))}/></div>
            <div className="space-y-2"><label className="text-sm font-medium">Expiry Warning Days</label><Input type="number" value={data?.organization_settings?.expiry_warning_days ?? 30} onChange={e=>setData((d:any)=>({...d, organization_settings:{...d.organization_settings, expiry_warning_days: Number(e.target.value)}}))}/></div>
          </div>
          <p className="text-xs text-muted-foreground">Fiscal/EFRIS information pending integration — placeholders only.</p>
          <Button onClick={saveOrgSettings} disabled={saving}><Save className="h-4 w-4 mr-2"/>Save Receipt & Tax</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><MapPin className="h-5 w-5 text-primary"/></div><div><CardTitle>Branches</CardTitle><CardDescription>{branches.length} branch(es) · active branches accept sales, purchases and transfers</CardDescription></div></div>
            {canManageBranches && <Button onClick={openAdd} className="shrink-0"><Plus className="h-4 w-4 mr-2"/>Add Branch</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {branches.length===0 && <p className="text-sm text-muted-foreground py-4">No branches yet.</p>}
          {branches.map((b)=>(
            <div key={b.id} className="border rounded">
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between p-3">
                <div>
                  <p className="font-medium">{b.name} <span className="text-xs text-muted-foreground">({b.code})</span></p>
                  <p className="text-xs text-muted-foreground">{b.address ?? "No address"} · {b.phone ?? "No phone"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={b.is_active?"success":"secondary"}>{b.is_active?"active":"inactive"}</Badge>
                  <Button variant="ghost" size="sm" onClick={()=>toggleExpand(b)} className="gap-1">{expanded===b.id?<ChevronUp className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}Settings</Button>
                  {canManageBranches && <>
                    <Button variant="outline" size="sm" onClick={()=>openEdit(b)}><Pencil className="h-4 w-4 mr-1"/>Edit</Button>
                    <Button variant="outline" size="sm" onClick={()=>toggleActive(b)}><Power className="h-4 w-4 mr-1"/>{b.is_active?"Deactivate":"Activate"}</Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={()=>deleteBranch(b)}><Trash2 className="h-4 w-4 mr-1"/>Delete</Button>
                  </>}
                </div>
              </div>
              {expanded===b.id && (
                <div className="border-t p-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Branch receipt & payment defaults</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1"><Label className="text-xs">Receipt prefix</Label><Input value={bsForm[b.id]?.receipt_prefix ?? "RCP"} onChange={e=>setBsForm(p=>({...p,[b.id]:{...(p[b.id]??{receipt_prefix:"RCP",invoice_prefix:"INV",default_payment_method:"CASH"}),receipt_prefix:e.target.value}}))}/></div>
                    <div className="space-y-1"><Label className="text-xs">Invoice prefix</Label><Input value={bsForm[b.id]?.invoice_prefix ?? "INV"} onChange={e=>setBsForm(p=>({...p,[b.id]:{...(p[b.id]??{receipt_prefix:"RCP",invoice_prefix:"INV",default_payment_method:"CASH"}),invoice_prefix:e.target.value}}))}/></div>
                    <div className="space-y-1"><Label className="text-xs">Default payment method</Label>
                      <Select value={bsForm[b.id]?.default_payment_method ?? "CASH"} onChange={e=>setBsForm(p=>({...p,[b.id]:{...(p[b.id]??{receipt_prefix:"RCP",invoice_prefix:"INV",default_payment_method:"CASH"}),default_payment_method:e.target.value}}))}>
                        <option value="CASH">Cash</option>
                        <option value="MOBILE_MONEY">Mobile Money</option>
                        <option value="CARD">Card</option>
                        <option value="BANK">Bank</option>
                        <option value="OTHER">Other</option>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={()=>saveBranchSettings(b)} disabled={saving}><Save className="h-4 w-4 mr-1"/>Save Branch Settings</Button>
                    <Button size="sm" variant="ghost" onClick={()=>setExpanded(null)}>Close</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={branchDlg.open} onOpenChange={(o)=>setBranchDlg(d=>({...d,open:o}))}>
        <DialogContent>
          <DialogHeader><DialogTitle>{branchDlg.editing ? "Edit Branch" : "Add Branch"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Branch name *</Label><Input value={bForm.name} onChange={e=>setBForm(f=>({...f,name:e.target.value}))} placeholder="Downtown Pharmacy"/></div>
            <div className="space-y-1"><Label>Code</Label><Input value={bForm.code} onChange={e=>setBForm(f=>({...f,code:e.target.value}))} placeholder="DT1"/></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={bForm.phone} onChange={e=>setBForm(f=>({...f,phone:e.target.value}))} placeholder="+256 700 000 000"/></div>
            <div className="space-y-1"><Label>Address</Label><Input value={bForm.address} onChange={e=>setBForm(f=>({...f,address:e.target.value}))} placeholder="Plot 1, Kampala Road"/></div>
            <Button onClick={saveBranch} disabled={saving||!bForm.name.trim()} className="w-full">{branchDlg.editing?"Save Changes":"Create Branch"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}