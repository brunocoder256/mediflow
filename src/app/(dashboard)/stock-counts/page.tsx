"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function StockCountsPage(){
  const [loading,setLoading]=React.useState(true);
  const [data,setData]=React.useState<any[]>([]);
  const [show,setShow]=React.useState(false);
  const [form,setForm]=React.useState({branch_id:"b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", name:"", scope_type:"ALL"});
  const [view,setView]=React.useState<any>(null);
  const [viewLoading,setViewLoading]=React.useState(false);
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
  const openView=async(id:string)=>{
    setViewLoading(true); setView(null);
    try{
      const r=await fetch(`/api/stock-counts?id=${encodeURIComponent(id)}`);
      const j=await r.json();
      if(!r.ok){ alert(j.error); return; }
      setView(j);
    }catch{ alert("Failed to load count details"); }
    setViewLoading(false);
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
            <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="font-mono text-xs">{c.branch_id.slice(0,8)}</TableCell><TableCell>{badge(c.status)}</TableCell><TableCell className="text-right">{c.variance_total ?? 0}</TableCell><TableCell className="text-right space-x-1"><Button variant="ghost" size="icon" title="Approve" onClick={()=>fetch(`/api/stock-counts`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"approve", id:c.id})}).then(()=>fetchData())}><Check className="h-4 w-4"/></Button><Button variant="ghost" size="icon" title="View details" onClick={()=>openView(c.id)}><Eye className="h-4 w-4"/></Button></TableCell></TableRow>
          ))}
        </TableBody></Table>}
      </CardContent></Card>
      <Dialog open={show} onOpenChange={setShow}><DialogContent><DialogHeader><DialogTitle>New Stock Count</DialogTitle></DialogHeader>
        <div className="space-y-3"><Input placeholder="Count name (e.g. Weekly audit)" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/><Input placeholder="Branch ID" value={form.branch_id} onChange={e=>setForm({...form, branch_id:e.target.value})}/><Button onClick={create} className="w-full">Create DRAFT</Button><p className="text-xs text-muted-foreground">Workflow: DRAFT → IN_PROGRESS → COUNTED → REVIEW → APPROVED (via approve) → POSTED (immutable). Positive variance → ADJUSTMENT_IN.</p></div>
      </DialogContent></Dialog>
      <Dialog open={!!view || viewLoading} onOpenChange={(o)=>{ if(!o){ setView(null); } }}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{view ? `Stock Count — ${view.name}` : "Stock Count"}</DialogTitle></DialogHeader>
          {viewLoading ? <div className="flex items-center gap-2 py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading details…</div>
          : view && <>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">{badge(view.status)}<span>Variance: {view.variance_total ?? 0}</span><span>Impact: {view.financial_impact ?? 0}</span><span className="font-mono">{view.branch_id.slice(0,8)}</span></div>
            <div className="max-h-[320px] overflow-auto border rounded-md">
              <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">System</TableHead><TableHead className="text-right">Counted</TableHead><TableHead className="text-right">Variance</TableHead></TableRow></TableHeader><TableBody>
                {(view.stock_count_items ?? []).map((it:any)=>(
                  <TableRow key={it.id}><TableCell className="font-mono text-xs">{it.product_id.slice(0,8)}</TableCell><TableCell className="text-right">{it.system_quantity ?? 0}</TableCell><TableCell className="text-right">{it.counted_quantity ?? 0}</TableCell><TableCell className={`text-right font-medium ${Number(it.variance)<0?"text-red-600":"text-emerald-600"}`}>{it.variance ?? 0}</TableCell></TableRow>
                ))}
                {(view.stock_count_items ?? []).length===0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No line items recorded yet</TableCell></TableRow>}
              </TableBody></Table>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
