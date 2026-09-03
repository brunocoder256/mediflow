"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Search, Plus, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Expense={id:string; expense_date:string; category:string; description:string; amount:number; payment_method:string; status:string};

export default function ExpensesPage(){
  const [loading,setLoading]=React.useState(true);
  const [q,setQ]=React.useState("");
  const [cat,setCat]=React.useState("all");
  const [data,setData]=React.useState<Expense[]>([]);
  const [summary,setSummary]=React.useState<any>(null);
  const [showAdd,setShowAdd]=React.useState(false);
  const [form,setForm]=React.useState({branch_id:"b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", category:"rent", description:"", amount:"", payment_method:"CASH", expense_date: new Date().toISOString().slice(0,10)});

  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const r=await fetch("/api/expenses");
    const j=await r.json();
    setData(j.data ?? []);
    setSummary(j.summary ?? null);
    setLoading(false);
  },[]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

  const filtered=data.filter(e=>{
    const matchQ=!q || e.description.toLowerCase().includes(q.toLowerCase()) || e.category.toLowerCase().includes(q.toLowerCase());
    const matchCat=cat==="all" || e.category===cat;
    return matchQ && matchCat;
  });
  const cats=[...new Set(data.map(e=>e.category))];
  const badge=(s:string)=> s==="APPROVED" ? <Badge variant="success">Approved</Badge> : s==="PENDING" ? <Badge variant="warning">Pending</Badge> : <Badge variant="destructive">{s}</Badge>;
  const total=filtered.reduce((s,e)=>s+Number(e.amount),0);

  const add=async()=>{
    const r=await fetch("/api/expenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form, amount: Number(form.amount)})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setShowAdd(false); fetchData(); }
  };
  const approve=async(id:string)=>{
    if(!confirm("Approve this expense? Requires expense.approve permission.")) return;
    const r=await fetch("/api/expenses",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id, action:"approve"})});
    const j=await r.json();
    if(!r.ok) alert(j.error); else fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">Expenses</h1><p className="text-muted-foreground">Approved expenses flow into Net Profit = Gross - Expenses</p></div><Button onClick={()=>setShowAdd(true)}><Plus className="h-4 w-4 mr-2"/>Add Expense</Button></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">UGX {total.toLocaleString()}</div><p className="text-xs text-muted-foreground">{filtered.length} transactions</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">UGX {data.filter(e=>e.status==="PENDING").reduce((s,e)=>s+Number(e.amount),0).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Approved Total</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">UGX {summary ? Number(summary.total).toLocaleString() : "—"}</div></CardContent></Card>
      </div>
      <Card><CardContent className="p-4"><div className="flex flex-col gap-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div><Select value={cat} onChange={e=>setCat(e.target.value)} className="w-full md:w-[180px]"><option value="all">All Categories</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</Select></div></CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-3">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : filtered.length===0 ? <div className="py-12 text-center text-muted-foreground">No expenses</div>
        : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map(e=>(
            <TableRow key={e.id}><TableCell>{new Date(e.expense_date).toLocaleDateString()}</TableCell><TableCell><Badge variant="secondary">{e.category}</Badge></TableCell><TableCell>{e.description}</TableCell><TableCell className="text-right">UGX {Number(e.amount).toLocaleString()}</TableCell><TableCell>{badge(e.status)}</TableCell><TableCell className="text-right">{e.status==="PENDING" ? <Button size="sm" variant="outline" onClick={()=>approve(e.id)}>Approve</Button> : <span className="text-xs text-muted-foreground">—</span>}</TableCell></TableRow>
          ))}
        </TableBody></Table></div>}
      </CardContent></Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent><DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={form.category} onChange={e=>setForm({...form, category: e.target.value})}><option value="rent">Rent</option><option value="utilities">Utilities</option><option value="salaries">Salaries</option><option value="supplies">Supplies</option><option value="maintenance">Maintenance</option><option value="marketing">Marketing</option><option value="other">Other</option></Select>
            <Input placeholder="Description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})}/>
            <Input type="number" placeholder="Amount UGX" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})}/>
            <Input type="date" value={form.expense_date} onChange={e=>setForm({...form, expense_date:e.target.value})}/>
            <Button onClick={add} disabled={!form.description || !form.amount} className="w-full">Save (PENDING → APPROVED)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
