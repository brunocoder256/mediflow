"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Search, Plus, Eye, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type R = { id:string; return_number?:string; sale_id:string; total:number; status:string; created_at:string; reason?:string };

export default function ReturnsPage(){
  const [loading,setLoading]=React.useState(true);
  const [data,setData]=React.useState<R[]>([]);
  const [q,setQ]=React.useState("");
  const [status,setStatus]=React.useState("all");
  const [showNew,setShowNew]=React.useState(false);
  const [saleId,setSaleId]=React.useState("");
  const [saleDetail,setSaleDetail]=React.useState<any>(null);
  const [returnQty,setReturnQty]=React.useState<Record<string, number>>({});
  const [cond,setCond]=React.useState<Record<string, string>>({});

  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const r=await fetch("/api/returns");
    const j=await r.json();
    setData(j.data ?? []);
    setLoading(false);
  },[]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

  const fetchSale=async()=>{
    if(!saleId) return;
    const r=await fetch(`/api/sales?id=${saleId}`);
    const j=await r.json();
    if(j.error) alert(j.error); else setSaleDetail(j);
  };

  const submitReturn=async()=>{
    if(!saleDetail) return;
    const items = (saleDetail.sale_items ?? []).filter((it:any)=> (returnQty[it.id] ?? 0) > 0).map((it:any)=>({
      sale_item_id: it.id, product_id: it.product_id, batch_id: it.batch_id,
      quantity: returnQty[it.id], reason: "Customer return", return_condition: cond[it.id] ?? "SELLABLE"
    }));
    if(!items.length) { alert("Select quantity"); return; }
    const r=await fetch("/api/returns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ sale_id: saleDetail.id, branch_id: saleDetail.branch_id, items, reason:"Customer request"})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { alert("Return created: "+j.id); setShowNew(false); setSaleDetail(null); fetchData(); }
  };

  const filtered=data.filter(r=>{
    const query=q.toLowerCase();
    return !query || r.id.toLowerCase().includes(query) || r.sale_id.toLowerCase().includes(query);
  }).filter(r=> status==="all" || r.status===status);

  const badge=(s:string)=>{
    if(s==="completed") return <Badge variant="success">Completed</Badge>;
    if(s==="approved") return <Badge variant="warning">Approved</Badge>;
    if(s==="pending") return <Badge>Pending</Badge>;
    return <Badge variant="destructive">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Returns</h1><p className="text-muted-foreground">Server-validated returns — max returnable = sold - already returned</p></div>
        <Button onClick={()=>setShowNew(true)}><Plus className="h-4 w-4 mr-2"/>New Return</Button>
      </div>
      <Card><CardContent className="p-4"><div className="flex flex-col gap-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search return / sale" value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div><Select value={status} onChange={e=>setStatus(e.target.value)} className="w-full md:w-[180px]"><option value="all">All Status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="completed">Completed</option></Select></div></CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-3">{[...Array(4)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : filtered.length===0 ? <div className="py-12 text-center text-muted-foreground">No returns yet — returns start from a real sale</div>
        : <Table><TableHeader><TableRow><TableHead>Return #</TableHead><TableHead>Sale #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Refund</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map(r=>(
            <TableRow key={r.id}><TableCell className="font-mono text-xs">{r.return_number ?? r.id.slice(0,8)}</TableCell><TableCell className="font-mono text-xs">{r.sale_id.slice(0,8)}</TableCell><TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell><TableCell className="text-right">UGX {Number(r.total).toLocaleString()}</TableCell><TableCell>{badge(r.status)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon"><Eye className="h-4 w-4"/></Button></TableCell></TableRow>
          ))}
        </TableBody></Table>}
      </CardContent></Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Return — select sale</DialogTitle><DialogDescription>Enter sale ID, then select items and quantity. Server enforces max returnable.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2"><Input placeholder="Sale UUID" value={saleId} onChange={e=>setSaleId(e.target.value)}/><Button onClick={fetchSale}>Load Sale</Button></div>
            {saleDetail && (
              <div className="space-y-3">
                <p className="text-sm">Sale {saleDetail.sale_number} — {new Date(saleDetail.sold_at).toLocaleString()} — UGX {Number(saleDetail.total).toLocaleString()}</p>
                <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Sold</TableHead><TableHead>Return Qty</TableHead><TableHead>Condition</TableHead></TableRow></TableHeader><TableBody>
                  {(saleDetail.sale_items ?? []).map((it:any)=>(
                    <TableRow key={it.id}><TableCell>{it.products?.name ?? it.product_id.slice(0,8)}</TableCell><TableCell className="text-right">{it.quantity}</TableCell><TableCell><Input type="number" min={0} max={it.quantity} value={returnQty[it.id] ?? 0} onChange={e=>setReturnQty(s=>({...s, [it.id]: Math.min(it.quantity, Math.max(0, Number(e.target.value)))}))} className="w-20"/></TableCell><TableCell><Select value={cond[it.id] ?? "SELLABLE"} onChange={e=>setCond(s=>({...s, [it.id]: e.target.value}))}><option value="SELLABLE">Sellable</option><option value="DAMAGED">Damaged</option><option value="COMPROMISED">Compromised</option></Select></TableCell></TableRow>
                  ))}
                </TableBody></Table>
                <p className="text-xs text-muted-foreground">SELLABLE → stock returns as SALE_RETURN. DAMAGED → DAMAGED movement, not sellable.</p>
                <Button onClick={submitReturn} className="w-full"><RotateCcw className="h-4 w-4 mr-2"/>Submit Return</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
