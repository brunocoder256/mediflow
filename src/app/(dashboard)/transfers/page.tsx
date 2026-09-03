"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Search, Plus, ArrowRight, Check, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function TransfersPage(){
  const [loading,setLoading]=React.useState(true);
  const [data,setData]=React.useState<any[]>([]);
  const [status,setStatus]=React.useState("all");
  const [show,setShow]=React.useState(false);
  const [form,setForm]=React.useState({source_branch_id:"b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", destination_branch_id:"", product_id:"", batch_id:"", quantity:"", unit_cost:""});
  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const params=new URLSearchParams();
    if(status!=="all") params.set("status", status.toUpperCase());
    const r=await fetch(`/api/transfers?${params.toString()}`.replace("/api/transfers","/api/stock-movements")); // fallback placeholder
    // try real transfers API via cash-style generic: we use supabase directly via transfers service if exists, else stock movements as demo
    // For now fetch via direct supabase not available, so try /api/purchases trick: call supabase via transfers service if implemented
    // Attempt fetch transfers via POST list simulation: use GET /api/transfers if exists
    let rr: any;
    try{ rr=await fetch(`/api/transfers?${params.toString()}`); if(rr.ok){ const j=await rr.json(); setData(j ?? []); } else throw new Error(); } catch { setData([]); }
    setLoading(false);
  },[status]);
  React.useEffect(()=>{ fetch("/api/transfers").then(r=> r.ok ? r.json() : []).then(j=>{ setData(Array.isArray(j)?j:[]); setLoading(false); }).catch(()=>{ setLoading(false); }); },[]);
  const create=async()=>{
    const r=await fetch("/api/transfers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ source_branch_id: form.source_branch_id, destination_branch_id: form.destination_branch_id, notes:"UI transfer", items:[{product_id: form.product_id, batch_id: form.batch_id || undefined, quantity: Number(form.quantity), unit_cost: Number(form.unit_cost)}]})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setShow(false); fetchData(); }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">Transfers</h1><p className="text-muted-foreground">Branch to branch — TRANSFER_OUT / TRANSFER_IN, audited</p></div><Button onClick={()=>setShow(true)}><Plus className="h-4 w-4 mr-2"/>New Transfer</Button></div>
      <Card><CardContent className="p-4"><div className="flex gap-4"><Select value={status} onChange={e=>setStatus(e.target.value)} className="w-[180px]"><option value="all">All Status</option><option value="DRAFT">Draft</option><option value="REQUESTED">Requested</option><option value="APPROVED">Approved</option><option value="IN_TRANSIT">In Transit</option><option value="RECEIVED">Received</option></Select><Button variant="outline" onClick={fetchData}>Refresh</Button></div></CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6"><Skeleton className="h-12 w-full"/></div>
        : data.length===0 ? <div className="py-12 text-center text-muted-foreground">No transfers — create a transfer between branches. Stock leaves on SHIP, arrives on RECEIVE.</div>
        : <Table><TableHeader><TableRow><TableHead>Transfer #</TableHead><TableHead>Source <ArrowRight className="inline h-3 w-3"/> Dest</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {data.map((t:any)=>(
            <TableRow key={t.id}><TableCell className="font-mono text-xs">{t.transfer_number ?? t.id.slice(0,8)}</TableCell><TableCell>{t.source_branch_id.slice(0,6)} → {t.destination_branch_id.slice(0,6)}</TableCell><TableCell><Badge>{t.status}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={()=>fetch("/api/transfers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"approve", id:t.id})}).then(()=>fetchData())}><Check className="h-4 w-4"/>Approve</Button><Button variant="ghost" size="sm" onClick={()=>fetch("/api/transfers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"ship", id:t.id})}).then(()=>fetchData())}><Truck className="h-4 w-4"/>Ship</Button></TableCell></TableRow>
          ))}
        </TableBody></Table>}
      </CardContent></Card>
      <Dialog open={show} onOpenChange={setShow}><DialogContent><DialogHeader><DialogTitle>New Transfer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Destination branch UUID" value={form.destination_branch_id} onChange={e=>setForm({...form, destination_branch_id: e.target.value})}/>
          <Input placeholder="Product ID" value={form.product_id} onChange={e=>setForm({...form, product_id: e.target.value})}/>
          <Input placeholder="Batch ID (optional)" value={form.batch_id} onChange={e=>setForm({...form, batch_id: e.target.value})}/>
          <div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="Qty" value={form.quantity} onChange={e=>setForm({...form, quantity: e.target.value})}/><Input type="number" placeholder="Unit cost" value={form.unit_cost} onChange={e=>setForm({...form, unit_cost: e.target.value})}/></div>
          <Button onClick={create} className="w-full">Create Draft</Button>
          <p className="text-xs text-muted-foreground">Draft → Requested → Approved → Ship (TRANSFER_OUT) → Receive (TRANSFER_IN). Never edit stock directly.</p>
        </div>
      </DialogContent></Dialog>
    </div>
  );
}
