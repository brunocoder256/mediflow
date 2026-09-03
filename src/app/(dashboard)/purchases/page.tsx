"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Search, Plus, Eye, Truck, Trash2 } from "lucide-react";

type Purchase = { id:string; purchase_number:string; supplier_id:string; status:string; total:number; created_at:string; suppliers?:{name:string} };
type Line = { product_id:string; product_name?:string; quantity_ordered:number; unit_cost:number; discount:number; tax:number };

export default function PurchasesPage(){
  const [loading,setLoading]=React.useState(true);
  const [tab,setTab]=React.useState("all");
  const [q,setQ]=React.useState("");
  const [data,setData]=React.useState<Purchase[]>([]);
  const [suppliers,setSuppliers]=React.useState<any[]>([]);
  const [products,setProducts]=React.useState<any[]>([]);
  const [branches,setBranches]=React.useState<any[]>([]);
  const [showCreate,setShowCreate]=React.useState(false);
  const [showReceive,setShowReceive]=React.useState<Purchase|null>(null);
  const [receiveDetail,setReceiveDetail]=React.useState<any>(null);
  const [form,setForm]=React.useState<{supplier_id:string; branch_id:string; lines:Line[]}>({supplier_id:"", branch_id:"", lines:[{product_id:"", quantity_ordered:1, unit_cost:0, discount:0, tax:0}]});
  const [receiveLines,setReceiveLines]=React.useState<any[]>([]);

  const fetchAll=React.useCallback(async()=>{
    setLoading(true);
    const params=new URLSearchParams();
    if(tab!=="all") params.set("status", tab.toUpperCase());
    const [pr, sr, prd, br]=await Promise.all([
      fetch(`/api/purchases?${params.toString()}`).then(r=>r.json()).catch(()=>({data:[]})),
      fetch("/api/suppliers").then(r=>r.json()).catch(()=>[]),
      fetch("/api/products").then(r=>r.json()).catch(()=>[]),
      fetch("/api/settings").then(r=>r.json()).catch(()=>({branches:[]}))
    ]);
    setData(pr.data ?? pr ?? []);
    setSuppliers(Array.isArray(sr)?sr:[]);
    setProducts(Array.isArray(prd)?prd: (prd.data ?? []));
    setBranches(br.branches ?? []);
    if(!form.branch_id && br.branches?.[0]) setForm(f=>({...f, branch_id: br.branches[0].id}));
    if(!form.supplier_id && sr[0]) setForm(f=>({...f, supplier_id: sr[0].id}));
    setLoading(false);
  },[tab]);
  React.useEffect(()=>{ fetchAll(); },[fetchAll]);

  const filtered=data.filter(p=> !q || p.purchase_number.toLowerCase().includes(q.toLowerCase()) || (p as any).suppliers?.name?.toLowerCase().includes(q.toLowerCase()));

  const addLine=()=> setForm({...form, lines:[...form.lines, {product_id:"", quantity_ordered:1, unit_cost:0, discount:0, tax:0}]});
  const updateLine=(i:number, patch:Partial<Line>)=> setForm({...form, lines: form.lines.map((l,idx)=> idx===i ? {...l, ...patch}: l)});
  const removeLine=(i:number)=> setForm({...form, lines: form.lines.filter((_,idx)=>idx!==i)});

  const submitCreate=async()=>{
    if(!form.supplier_id || !form.branch_id) return alert("Select supplier & branch");
    if(form.lines.some(l=>!l.product_id || l.quantity_ordered<=0)) return alert("Fill product & quantity for each line");
    const r=await fetch("/api/purchases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({branch_id: form.branch_id, supplier_id: form.supplier_id, items: form.lines})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setShowCreate(false); setForm({supplier_id: suppliers[0]?.id ?? "", branch_id: branches[0]?.id ?? form.branch_id, lines:[{product_id:"", quantity_ordered:1, unit_cost:0, discount:0, tax:0}]}); fetchAll(); }
  };

  const openReceive=async(p:Purchase)=>{
    setShowReceive(p);
    const r=await fetch(`/api/purchases?id=${p.id}`);
    const j=await r.json();
    setReceiveDetail(j);
    // init receive lines from purchase_items: ordered - received = remaining
    const items=j.purchase_items ?? j.items ?? [];
    setReceiveLines(items.map((it:any)=>({ purchase_item_id: it.id, product_id: it.product_id, quantity_ordered: it.quantity_ordered, quantity_received: it.quantity_received, remaining: it.quantity_ordered - (it.quantity_received ?? 0), batch_number:"", expiry_date:"", unit_cost: it.unit_cost, selling_price: Math.round(it.unit_cost*1.5) })));
  };

  const submitReceive=async()=>{
    if(!showReceive) return;
    const payloadLines=receiveLines.filter(l=> l.quantity_received >0 && l.quantity_received <= l.remaining + l.quantity_received).map(l=>({
      purchase_item_id: l.purchase_item_id, product_id: l.product_id, quantity_received: Number(l.quantity_received), unit_cost: Number(l.unit_cost), batch_number: l.batch_number, expiry_date: l.expiry_date, supplier_id: showReceive.supplier_id
    }));
    // validate batch fields
    if(payloadLines.some(l=>!l.batch_number || !l.expiry_date)) return alert("Batch number & expiry required for each receiving line");
    const r=await fetch("/api/purchases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"receive", purchase_order_id: showReceive.id, received_items: payloadLines})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setShowReceive(null); fetchAll(); }
  };

  const badge=(s:string)=>{
    if(s==="DRAFT") return <Badge variant="secondary">Draft</Badge>;
    if(s==="ORDERED") return <Badge variant="warning">Ordered</Badge>;
    if(s==="PARTIALLY_RECEIVED") return <Badge>Partial</Badge>;
    if(s==="RECEIVED") return <Badge variant="success">Received</Badge>;
    return <Badge variant="destructive">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Purchases</h1><p className="text-muted-foreground">Draft → Ordered → Partial → Received — only receiving creates batches & stock</p></div>
        <Button onClick={()=>setShowCreate(true)}><Plus className="h-4 w-4 mr-2"/>New Purchase Order</Button>
      </div>
      <Tabs defaultValue="all">
        <TabsList className="flex flex-wrap">{["all","DRAFT","ORDERED","PARTIALLY_RECEIVED","RECEIVED","CANCELLED"].map(id=>(
          <TabsTrigger key={id} value={id.toLowerCase()} active={tab===id.toLowerCase()} onClick={()=>setTab(id.toLowerCase())}>{id}</TabsTrigger>
        ))}</TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card className="mb-4"><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search PO or supplier" value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div></CardContent></Card>
          <Card><CardContent className="p-0">
            {loading ? <div className="p-6 space-y-3">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
            : filtered.length===0 ? <div className="py-12 text-center text-muted-foreground">No purchase orders</div>
            : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
              {filtered.map(p=>(
                <TableRow key={p.id}><TableCell className="font-mono text-xs">{p.purchase_number}</TableCell><TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell><TableCell>{(p as any).suppliers?.name ?? p.supplier_id.slice(0,8)}</TableCell><TableCell className="text-right">UGX {Number(p.total).toLocaleString()}</TableCell><TableCell>{badge(p.status)}</TableCell><TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={()=>openReceive(p)} title="View/Receive"><Eye className="h-4 w-4"/></Button>
                  {(p.status==="DRAFT" || p.status==="ORDERED" || p.status==="PARTIALLY_RECEIVED") && <Button variant="ghost" size="icon" onClick={()=>openReceive(p)}><Truck className="h-4 w-4"/></Button>}
                </TableCell></TableRow>
              ))}
            </TableBody></Table></div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle><DialogDescription>Select supplier, branch, products — server recalculates totals. Stock not yet added.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="text-sm font-medium">Supplier</label><Select value={form.supplier_id} onChange={e=>setForm({...form, supplier_id:e.target.value})}><option value="">Select supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
              <div><label className="text-sm font-medium">Branch</label><Select value={form.branch_id} onChange={e=>setForm({...form, branch_id:e.target.value})}><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h4 className="font-medium">Products</h4><Button variant="outline" size="sm" onClick={addLine}>Add Line</Button></div>
              {form.lines.map((l,i)=>(
                <div key={i} className="grid gap-2 md:grid-cols-12 items-end border rounded p-3">
                  <div className="md:col-span-5"><label className="text-xs">Product</label><Select value={l.product_id} onChange={e=>updateLine(i,{product_id:e.target.value})}><option value="">Search product...</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.name} {p.sku?`(${p.sku})`:""} {p.barcode?`[${p.barcode}]`:""}</option>)}</Select></div>
                  <div><label className="text-xs">Qty</label><Input type="number" min={1} value={l.quantity_ordered} onChange={e=>updateLine(i,{quantity_ordered: Number(e.target.value)})}/></div>
                  <div><label className="text-xs">Unit Cost</label><Input type="number" value={l.unit_cost} onChange={e=>updateLine(i,{unit_cost: Number(e.target.value)})}/></div>
                  <div><label className="text-xs">Discount</label><Input type="number" value={l.discount} onChange={e=>updateLine(i,{discount: Number(e.target.value)})}/></div>
                  <div><label className="text-xs">Tax</label><Input type="number" value={l.tax} onChange={e=>updateLine(i,{tax: Number(e.target.value)})}/></div>
                  <div><Button variant="ghost" size="icon" onClick={()=>removeLine(i)}><Trash2 className="h-4 w-4"/></Button></div>
                  <div className="md:col-span-12 text-xs text-muted-foreground">Subtotal: UGX {(l.quantity_ordered * l.unit_cost - l.discount + l.tax).toLocaleString()} — server will recalculate</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold"><span>Total</span><span>UGX {form.lines.reduce((s,l)=> s + l.quantity_ordered*l.unit_cost - l.discount + l.tax, 0).toLocaleString()}</span></div>
            <Button onClick={submitCreate} className="w-full">Create DRAFT Order</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showReceive} onOpenChange={(o)=>!o && setShowReceive(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Receive — {showReceive?.purchase_number}</DialogTitle><DialogDescription>Enter batch details per product. Supports partial: ordered vs remaining.</DialogDescription></DialogHeader>
          {receiveDetail && (
            <div className="space-y-3">
              {receiveLines.map((l:any,idx:number)=>(
                <div key={idx} className="border rounded p-3 space-y-2">
                  <p className="font-medium text-sm">{products.find(p=>p.id===l.product_id)?.name ?? l.product_id.slice(0,8)} — Ordered {l.quantity_ordered}, Received {l.quantity_received ?? 0}, Remaining {l.remaining}</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div><label className="text-xs">Qty Received</label><Input type="number" min={0} max={l.remaining} value={l.quantity_received} onChange={e=>{ const v=Math.min(l.remaining, Math.max(0, Number(e.target.value))); const copy=[...receiveLines]; copy[idx].quantity_received=v; setReceiveLines(copy); }}/></div>
                    <div><label className="text-xs">Batch #</label><Input value={l.batch_number} onChange={e=>{ const copy=[...receiveLines]; copy[idx].batch_number=e.target.value; setReceiveLines(copy); }}/></div>
                    <div><label className="text-xs">Expiry</label><Input type="date" value={l.expiry_date} onChange={e=>{ const copy=[...receiveLines]; copy[idx].expiry_date=e.target.value; setReceiveLines(copy); }}/></div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div><label className="text-xs">Purchase Cost</label><Input type="number" value={l.unit_cost} onChange={e=>{ const copy=[...receiveLines]; copy[idx].unit_cost=Number(e.target.value); setReceiveLines(copy); }}/></div>
                    <div><label className="text-xs">Selling Price</label><Input type="number" value={l.selling_price} onChange={e=>{ const copy=[...receiveLines]; copy[idx].selling_price=Number(e.target.value); setReceiveLines(copy); }}/></div>
                  </div>
                </div>
              ))}
              <Button onClick={submitReceive} className="w-full"><Truck className="h-4 w-4 mr-2"/>Confirm Receiving (creates batches & movements)</Button>
              <p className="text-xs text-muted-foreground">Partial receiving leaves status PARTIALLY_RECEIVED. Full receiving → RECEIVED.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
