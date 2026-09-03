"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function StockCountsPage(){
  const [loading,setLoading]=React.useState(true);
  const [data,setData]=React.useState<any[]>([]);
  const [show,setShow]=React.useState(false);
  const [form,setForm]=React.useState({branch_id:"b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", name:"", scope_type:"ALL"});
  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const r=await fetch("/api/stock-counts");
    const j=await r.json();
    setData(j.data ?? []);
    setLoading(false);
  },[]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);
  const create=async()=>{
    const r=await fetch("/api/stock-counts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setShow(false); fetchData(); }
  };
  const badge=(s:string)=>{
    if(s==="POSTED") return <Badge variant="success">Posted</Badge>;
    if(s==="APPROVED") return <Badge variant="warning">Approved</Badge>;
    if(s==="DRAFT") return <Badge variant="secondary">Draft</Badge>;
    return <Badge>{s}</Badge>;
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">Stock Counts</h1><p className="text-muted-foreground">Variance = Counted - System → ADJUSTMENT_IN/OUT on POST, immutable</p></div><Button onClick={()=>setShow(true)}><Plus className="h-4 w-4 mr-2"/>New Count</Button></div>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6"><Skeleton className="h-12 w-full"/></div>
        : data.length===0 ? <div className="py-12 text-center text-muted-foreground">No counts — create a count to reconcile physical stock</div>
        : <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Branch</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Variance</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {data.map((c:any)=>(
            <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="font-mono text-xs">{c.branch_id.slice(0,8)}</TableCell><TableCell>{badge(c.status)}</TableCell><TableCell className="text-right">{c.variance_total ?? 0}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={()=>fetch(`/api/stock-counts`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"approve", id:c.id})}).then(()=>fetchData())}><Check className="h-4 w-4"/></Button><Button variant="ghost" size="icon"><Eye className="h-4 w-4"/></Button></TableCell></TableRow>
          ))}
        </TableBody></Table>}
      </CardContent></Card>
      <Dialog open={show} onOpenChange={setShow}><DialogContent><DialogHeader><DialogTitle>New Stock Count</DialogTitle></DialogHeader>
        <div className="space-y-3"><Input placeholder="Count name (e.g. Weekly audit)" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/><Input placeholder="Branch ID" value={form.branch_id} onChange={e=>setForm({...form, branch_id:e.target.value})}/><Button onClick={create} className="w-full">Create DRAFT</Button><p className="text-xs text-muted-foreground">Workflow: DRAFT → IN_PROGRESS → COUNTED → REVIEW → APPROVED (via approve) → POSTED (immutable). Positive variance → ADJUSTMENT_IN.</p></div>
      </DialogContent></Dialog>
    </div>
  );
}
