"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Eye, Edit } from "lucide-react";

type Supplier = { id:string; name:string; phone:string|null; email:string|null; is_active:boolean; balance?:number };

export default function SuppliersPage(){
  const [loading, setLoading]=React.useState(true);
  const [q,setQ]=React.useState("");
  const [data,setData]=React.useState<Supplier[]>([]);
  const [err,setErr]=React.useState<string|null>(null);
  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    try{ const r=await fetch("/api/suppliers"); const j=await r.json();
      if(!r.ok) throw new Error(j.error); setData(j);
    }catch(e:any){ setErr(e.message); }
    setLoading(false);
  },[]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);
  const filtered=data.filter(s=> s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Suppliers</h1><p className="text-muted-foreground">Supplier balances are transaction-derived (purchases - payments - returns)</p></div>
        <Button onClick={()=>{const n=prompt("Supplier name"); if(n) fetch("/api/suppliers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n})}).then(()=>fetchData());}}><Plus className="h-4 w-4 mr-2"/>Add Supplier</Button>
      </div>
      <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search suppliers..." value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div></CardContent></Card>
      {err && <Card><CardContent className="p-4 text-sm text-destructive">{err}</CardContent></Card>}
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-3">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : filtered.length===0 ? <div className="py-12 text-center text-muted-foreground">No suppliers — add your first supplier</div>
        : <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Balance (UGX)</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map(s=>(
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.phone ?? s.email ?? "—"}</TableCell>
              <TableCell className="font-mono">{s.balance !== undefined ? Number(s.balance).toLocaleString() : "—"}</TableCell>
              <TableCell><Badge variant={s.is_active?"success":"secondary"}>{s.is_active?"active":"inactive"}</Badge></TableCell>
              <TableCell className="text-right"><Button variant="ghost" size="icon"><Eye className="h-4 w-4"/></Button><Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button></TableCell>
            </TableRow>
          ))}
        </TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}
