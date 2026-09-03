"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Building2, MapPin, Receipt, Calculator, Bell, Shield, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage(){
  const [loading,setLoading]=React.useState(true);
  const [data,setData]=React.useState<any>(null);
  const [saving,setSaving]=React.useState(false);
  const { toast }=useToast();

  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const r=await fetch("/api/settings");
    const j=await r.json();
    if(!r.ok) toast({title:"Failed to load settings", description: j.error, variant:"error"});
    else setData(j);
    setLoading(false);
  },[toast]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

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

  if(loading) return <div className="space-y-6">{[...Array(3)].map((_,i)=><Card key={i}><CardHeader><Skeleton className="h-6 w-32"/></CardHeader><CardContent><Skeleton className="h-32 w-full"/></CardContent></Card>)}</div>;

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
        <CardHeader><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><MapPin className="h-5 w-5 text-primary"/></div><div><CardTitle>Branches</CardTitle><CardDescription>{(data?.branches ?? []).length} branch(es)</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-3">
          {(data?.branches ?? []).map((b:any)=>(
            <div key={b.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between border rounded p-3">
              <div><p className="font-medium">{b.name} <span className="text-xs text-muted-foreground">({b.code})</span></p><p className="text-xs text-muted-foreground">{b.address ?? ""} · {b.phone ?? ""}</p></div>
              <Badge variant={b.is_active?"success":"secondary"}>{b.is_active?"active":"inactive"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
