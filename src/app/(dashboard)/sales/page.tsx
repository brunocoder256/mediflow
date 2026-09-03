"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Search, Eye, Printer, RotateCcw, Download } from "lucide-react";
import { Receipt, printReceipt } from "@/components/receipt";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Sale = { id:string; sale_number:string; sold_at:string; cashier_id:string; customer_id:string|null; total:number; subtotal:number; discount:number; tax:number; status:string; branch_id:string; profiles?:{full_name:string}; customers?:{name:string} };

export default function SalesPage(){
  const [loading,setLoading]=React.useState(true);
  const [sales,setSales]=React.useState<Sale[]>([]);
  const [q,setQ]=React.useState("");
  const [status,setStatus]=React.useState("all");
  const [dateFrom,setDateFrom]=React.useState("");
  const [dateTo,setDateTo]=React.useState("");
  const [paymentMethod,setPaymentMethod]=React.useState("all");
  const [detail,setDetail]=React.useState<any>(null);
  const [err,setErr]=React.useState<string|null>(null);

  const setPreset=(p:string)=>{
    const now=new Date();
    const iso=(d:Date)=> d.toISOString().slice(0,10);
    if(p==="today"){ setDateFrom(iso(now)); setDateTo(iso(now)); }
    else if(p==="yesterday"){ const y=new Date(); y.setDate(y.getDate()-1); setDateFrom(iso(y)); setDateTo(iso(y)); }
    else if(p==="week"){ const s=new Date(); s.setDate(now.getDate()-now.getDay()); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if(p==="month"){ const s=new Date(now.getFullYear(), now.getMonth(),1); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if(p==="custom"){ /* keep */ }
  };

  const fetchData=React.useCallback(async()=>{
    setLoading(true); setErr(null);
    try{
      const params=new URLSearchParams();
      if(status!=="all") params.set("status",status.toUpperCase());
      if(paymentMethod!=="all") params.set("payment_method",paymentMethod);
      if(dateFrom) params.set("date_from",dateFrom);
      if(dateTo) params.set("date_to",dateTo);
      if(q) params.set("search", q);
      const r=await fetch(`/api/sales?${params.toString()}`);
      const j=await r.json();
      if(!r.ok) throw new Error(j.error);
      setSales(j.data ?? []);
    }catch(e:any){ setErr(e.message); }
    setLoading(false);
  },[status,paymentMethod,dateFrom,dateTo,q]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

  const filtered=sales.filter(s=>{
    const query=q.toLowerCase();
    return !query || s.sale_number.toLowerCase().includes(query) || (s.customers?.name??"").toLowerCase().includes(query) || s.cashier_id.toLowerCase().includes(query);
  });

  const openDetail=async(id:string)=>{
    const r=await fetch(`/api/sales?id=${id}`);
    const j=await r.json();
    setDetail(j);
  };

  const voidSale=async(id:string)=>{
    if(!confirm("Void this sale? This will reverse stock and requires permission.")) return;
    const r=await fetch(`/api/sales`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"void", sale_id:id, reason:"User void"})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { alert("Sale voided"); fetchData(); setDetail(null); }
  };

  const badge=(s:string)=>{
    if(s==="COMPLETED") return <Badge variant="success">Completed</Badge>;
    if(s==="HELD") return <Badge variant="warning">Held</Badge>;
    if(s==="VOIDED") return <Badge variant="destructive">Voided</Badge>;
    if(s==="REFUNDED") return <Badge variant="destructive">Refunded</Badge>;
    return <Badge>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Sales History</h1><p className="text-muted-foreground">Real transactions — server authoritative</p></div>
        <Button variant="outline" onClick={fetchData}><Download className="h-4 w-4 mr-2"/>Refresh</Button>
      </div>
      <Card><CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search sale # / customer / cashier" value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div>
            <Select value={status} onChange={e=>setStatus(e.target.value)} className="w-full md:w-[150px]"><option value="all">All Status</option><option value="COMPLETED">Completed</option><option value="HELD">Held</option><option value="VOIDED">Voided</option><option value="REFUNDED">Refunded</option></Select>
            <Select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full md:w-[150px]"><option value="all">All Payments</option><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="CARD">Card</option><option value="BANK">Bank</option></Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={()=>setPreset("today")}>Today</Button>
            <Button variant="outline" size="sm" onClick={()=>setPreset("yesterday")}>Yesterday</Button>
            <Button variant="outline" size="sm" onClick={()=>setPreset("week")}>This Week</Button>
            <Button variant="outline" size="sm" onClick={()=>setPreset("month")}>This Month</Button>
            <Button variant="outline" size="sm" onClick={()=>{setDateFrom(""); setDateTo("");}}>Clear</Button>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-full md:w-[180px]"/>
            <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-full md:w-[180px]"/>
            <Button variant="outline" onClick={fetchData}>Apply</Button>
          </div>
        </div>
      </CardContent></Card>
      {err && <Card><CardContent className="p-4 text-sm text-destructive">{err}</CardContent></Card>}
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-4">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : filtered.length===0 ? <div className="py-12 text-center text-muted-foreground">No sales found</div>
        : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sale #</TableHead><TableHead>Date</TableHead><TableHead className="hidden md:table-cell">Cashier</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map(s=>(
            <TableRow key={s.id}>
              <TableCell className="font-medium font-mono text-xs">{s.sale_number}</TableCell>
              <TableCell>{new Date(s.sold_at).toLocaleString()}</TableCell>
              <TableCell className="hidden md:table-cell">{s.profiles?.full_name ?? s.cashier_id.slice(0,8)}</TableCell>
              <TableCell>{s.customers?.name ?? "Walk-in"}</TableCell>
              <TableCell className="text-right">UGX {Number(s.total).toLocaleString()}</TableCell>
              <TableCell>{badge(s.status)}</TableCell>
              <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={()=>openDetail(s.id)}><Eye className="h-4 w-4"/></Button><Button variant="ghost" size="icon" onClick={()=>openDetail(s.id)}><Printer className="h-4 w-4"/></Button>{s.status==="COMPLETED" && <Button variant="ghost" size="icon" onClick={()=>voidSale(s.id)}><RotateCcw className="h-4 w-4"/></Button>}</div></TableCell>
            </TableRow>
          ))}
        </TableBody></Table></div>}
      </CardContent></Card>

      <Dialog open={!!detail} onOpenChange={(o)=>!o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sale {detail?.sale_number ?? detail?.id}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">Date</p><p>{new Date(detail.sold_at).toLocaleString()}</p></div><div><p className="text-muted-foreground">Status</p>{badge(detail.status)}</div><div><p className="text-muted-foreground">Cashier</p><p>{detail.profiles?.full_name ?? detail.cashier_id}</p></div><div><p className="text-muted-foreground">Total</p><p className="font-bold">UGX {Number(detail.total).toLocaleString()}</p></div></div>
              <div>
                <h4 className="font-medium mb-2">Items</h4>
                <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>
                  {(detail.sale_items ?? []).map((it:any)=>(
                    <TableRow key={it.id}><TableCell>{it.products?.name ?? it.product_id.slice(0,8)}</TableCell><TableCell className="font-mono text-xs">{it.batch_id.slice(0,8)}</TableCell><TableCell className="text-right">{it.quantity}</TableCell><TableCell className="text-right">UGX {Number(it.unit_price).toLocaleString()}</TableCell><TableCell className="text-right">UGX {Number(it.subtotal).toLocaleString()}</TableCell></TableRow>
                  ))}
                </TableBody></Table>
              </div>
              {detail.payments && <div><h4 className="font-medium">Payments</h4>{detail.payments.map((p:any)=><p key={p.id} className="text-sm">{p.payment_method}: UGX {Number(p.amount).toLocaleString()} {p.reference ? `(${p.reference})` : ""} — {p.reconciliation_status ?? p.status}</p>)}</div>}
              <Receipt organization={{name:"MediFlow Demo Pharmacy", address:"Kampala Road", phone:"+256700123456"}} branch={{name:"Main Branch"}} receipt_number={detail.sale_number} sold_at={detail.sold_at} cashier={detail.profiles?.full_name ?? "Cashier"} items={(detail.sale_items ?? []).map((it:any)=>({name: it.products?.name ?? it.product_id.slice(0,8), quantity: it.quantity, unit_price: Number(it.unit_price), discount: Number(it.discount ?? 0), tax: Number(it.tax ?? 0), subtotal: Number(it.subtotal)}))} subtotal={Number(detail.subtotal)} discount={Number(detail.discount)} tax={Number(detail.tax)} total={Number(detail.total)} payment_method={detail.payments?.[0]?.payment_method ?? "CASH"} />
              <Button onClick={printReceipt} className="w-full"><Printer className="h-4 w-4 mr-2"/>Print Receipt</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
