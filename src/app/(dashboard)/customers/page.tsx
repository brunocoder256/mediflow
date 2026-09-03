"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Customer={id:string; name:string; phone:string|null; email:string|null; is_active:boolean; created_at:string};

export default function CustomersPage(){
  const [loading,setLoading]=React.useState(true);
  const [q,setQ]=React.useState("");
  const [data,setData]=React.useState<Customer[]>([]);
  const [showAdd,setShowAdd]=React.useState(false);
  const [form,setForm]=React.useState({name:"", phone:"", email:"", notes:""});
  const [history,setHistory]=React.useState<{customer:Customer|null, sales:any[]}>({customer:null, sales:[]});
  const [historyLoading,setHistoryLoading]=React.useState(false);

  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const r=await fetch(`/api/customers?search=${encodeURIComponent(q)}`);
    const j=await r.json();
    setData(Array.isArray(j)?j:[]);
    setLoading(false);
  },[q]);
  React.useEffect(()=>{ const t=setTimeout(fetchData,300); return()=>clearTimeout(t); },[fetchData]);
  React.useEffect(()=>{ fetchData(); },[]);

  const add=async()=>{
    const r=await fetch("/api/customers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    if(!r.ok){ const j=await r.json(); alert(j.error); } else { setShowAdd(false); setForm({name:"",phone:"",email:"",notes:""}); fetchData(); }
  };
  const deactivate=async(id:string)=>{
    if(!confirm("Deactivate customer?")) return;
    await fetch("/api/customers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id, is_active:false})});
    fetchData();
  };
  const viewHistory=async(c:Customer)=>{
    setHistory({customer:c, sales:[]});
    setHistoryLoading(true);
    try{
      const r=await fetch(`/api/sales?customer_id=${c.id}&perPage=20`);
      const j=await r.json();
      setHistory({customer:c, sales: j.data ?? []});
    }catch{ setHistory({customer:c, sales:[]}); }
    setHistoryLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Customers</h1><p className="text-muted-foreground">Simple: name, phone, email — no CRM bloat</p></div>
        <Button onClick={()=>setShowAdd(true)}><Plus className="h-4 w-4 mr-2"/>Add Customer</Button>
      </div>
      <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search name/phone/email" value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div></CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-3">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : data.length===0 ? <div className="py-12 text-center text-muted-foreground">No customers — add your first customer</div>
        : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead className="hidden md:table-cell">Email</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {data.map(c=>(
            <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.phone ?? "—"}</TableCell><TableCell className="hidden md:table-cell">{c.email ?? "—"}</TableCell><TableCell><Badge variant={c.is_active?"success":"secondary"}>{c.is_active?"active":"inactive"}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={()=>viewHistory(c)}><Eye className="h-4 w-4"/></Button><Button variant="ghost" size="icon" onClick={()=>deactivate(c.id)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>
          ))}
        </TableBody></Table></div>}
      </CardContent></Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent><DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name *" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
            <Input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/>
            <Input placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
            <Input placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
            <Button onClick={add} disabled={!form.name.trim()} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!history.customer} onOpenChange={(o)=>!o && setHistory({customer:null, sales:[]})}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Transaction History — {history.customer?.name}</DialogTitle></DialogHeader>
          {historyLoading ? <Skeleton className="h-32 w-full"/> : history.sales.length===0 ? <p className="text-sm text-muted-foreground py-8 text-center">No sales for this customer yet. All sales are linked via customer_id and branch.</p>
          : <Table><TableHeader><TableRow><TableHead>Sale #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
            {history.sales.map((s:any)=>(
              <TableRow key={s.id}><TableCell className="font-mono text-xs">{s.sale_number}</TableCell><TableCell>{new Date(s.sold_at).toLocaleDateString()}</TableCell><TableCell className="text-right">UGX {Number(s.total).toLocaleString()}</TableCell><TableCell><Badge>{s.status}</Badge></TableCell></TableRow>
            ))}
          </TableBody></Table>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
