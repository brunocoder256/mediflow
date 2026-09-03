"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Search, Download, FileText } from "lucide-react";

type Log = { id:string; action:string; entity_type:string; entity_id:string|null; user_name:string; created_at:string; old_values:any; new_values:any };

export default function AuditPage(){
  const [loading,setLoading]=React.useState(true);
  const [q,setQ]=React.useState("");
  const [type,setType]=React.useState("all");
  const [page,setPage]=React.useState(1);
  const perPage=20;
  const [data,setData]=React.useState<Log[]>([]);
  const [total,setTotal]=React.useState(0);
  const [expanded,setExpanded]=React.useState<string|null>(null);

  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const params=new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if(q) params.set("search", q);
    if(type!=="all") params.set("type", type);
    const r=await fetch(`/api/audit?${params.toString()}`);
    const j=await r.json();
    if(j.error){ setData([]); } else { setData(j.data ?? []); setTotal(j.count ?? 0); }
    setLoading(false);
  },[q,type,page]);
  React.useEffect(()=>{ const t=setTimeout(fetchData,300); return()=>clearTimeout(t); },[fetchData]);
  React.useEffect(()=>{ fetchData(); },[]);

  const typeBadge=(t:string)=>{
    if(t.includes("sale")) return <Badge variant="success">Sale</Badge>;
    if(t.includes("inventory")|| t.includes("stock")) return <Badge variant="warning">Inventory</Badge>;
    if(t.includes("auth") || t.includes("user")) return <Badge variant="secondary">Auth</Badge>;
    if(t.includes("security")|| t.includes("permission")) return <Badge variant="destructive">Security</Badge>;
    return <Badge variant="outline">{t}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">Audit Logs</h1><p className="text-muted-foreground">Append-only, organization isolated, immutable history</p></div><Button variant="outline" onClick={()=>window.print()}><Download className="h-4 w-4 mr-2"/>Export</Button></div>
      <Card><CardContent className="p-4"><div className="flex flex-col gap-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search action / entity / user" value={q} onChange={e=>{setQ(e.target.value); setPage(1);}} className="pl-9"/></div><Select value={type} onChange={e=>{setType(e.target.value); setPage(1);}} className="w-full md:w-[180px]"><option value="all">All Types</option><option value="sale">Sales</option><option value="inventory">Inventory</option><option value="auth">Auth</option><option value="security">Security</option><option value="system">System</option></Select></div></CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-3">{[...Array(7)].map((_,i)=><div key={i} className="flex gap-4"><Skeleton className="h-10 w-10"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48"/><Skeleton className="h-3 w-64"/></div><Skeleton className="h-6 w-20"/></div>)}</div>
        : data.length===0 ? <div className="py-12 text-center text-muted-foreground">No audit logs — perform a sale, purchase, or stock operation to generate trail</div>
        : <><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader><TableBody>
          {data.map(l=>(
            <React.Fragment key={l.id}>
              <TableRow className="cursor-pointer" onClick={()=>setExpanded(expanded===l.id?null:l.id)}><TableCell className="font-mono text-xs">{new Date(l.created_at).toLocaleString()}</TableCell><TableCell>{l.user_name}</TableCell><TableCell><Badge variant="outline">{l.action}</Badge></TableCell><TableCell className="font-mono text-xs">{l.entity_type} {l.entity_id?.slice(0,6) ?? ""}</TableCell><TableCell>{typeBadge(l.entity_type)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm"><FileText className="h-4 w-4"/></Button></TableCell></TableRow>
              {expanded===l.id && <TableRow><TableCell colSpan={6}><div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap break-all">old: {JSON.stringify(l.old_values, null, 2) ?? "null"} {"\n"}new: {JSON.stringify(l.new_values, null,2) ?? "null"}</div></TableCell></TableRow>}
            </React.Fragment>
          ))}
        </TableBody></Table></div>
        <div className="flex items-center justify-between p-4 border-t"><span className="text-sm text-muted-foreground">Total {total} · page {page}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</Button><Button variant="outline" size="sm" disabled={page*perPage >= total} onClick={()=>setPage(p=>p+1)}>Next</Button></div></div></>}
      </CardContent></Card>
    </div>
  );
}
