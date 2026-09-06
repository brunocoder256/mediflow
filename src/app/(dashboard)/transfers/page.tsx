"use client";
import * as React from "react";
import { useBranch } from "@/hooks/branch-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ArrowRight, Check, Truck, Package, X, Search, Send, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Branch = { id: string; name: string; code: string; is_active?: boolean };
type Capabilities = { canManage: boolean; branchIds: string[] };
type DraftItem = { product_id: string; name: string; quantity: number; unit_cost: number };

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "secondary",
  REQUESTED: "outline",
  APPROVED: "default",
  IN_TRANSIT: "secondary",
  RECEIVED: "success",
  CANCELLED: "secondary",
};

export default function TransfersPage(){
  const { toast } = useToast();
  const { currentBranchId } = useBranch();
  const [loading,setLoading]=React.useState(true);
  const [data,setData]=React.useState<any[]>([]);
  const [status,setStatus]=React.useState("all");
  const [caps,setCaps]=React.useState<Capabilities>({ canManage:false, branchIds:[] });
  const [allBranches,setAllBranches]=React.useState<Branch[]>([]);
  const [show,setShow]=React.useState(false);

  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const params=new URLSearchParams();
    if(status!=="all") params.set("status", status.toUpperCase());
    if(currentBranchId) params.set("branch_id", currentBranchId);
    try{
      const res=await fetch(`/api/transfers?${params.toString()}`);
      const j=await res.json();
      setData(Array.isArray(j)?j:[]);
    }catch{ setData([]); }
    setLoading(false);
  },[status,currentBranchId]);

  React.useEffect(()=>{
    fetch("/api/branches").then(r=>r.ok?r.json():[]).then((j:any)=>setAllBranches(Array.isArray(j)?j:[])).catch(()=>{});
    fetch("/api/transfers?capabilities=1").then(r=>r.ok?r.json():null).then((j:any)=>{ if(j) setCaps({ canManage: !!j.canManage, branchIds: Array.isArray(j.branchIds)?j.branchIds:[] }); }).catch(()=>{});
  },[]);

  React.useEffect(()=>{ fetchData(); },[fetchData]);

  const runAction=async(id:string, action:string, successMsg:string)=>{
    const r=await fetch("/api/transfers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,id})});
    const j=await r.json();
    if(!r.ok){ toast({title:"Action failed", description: j.error, variant:"error"}); return false; }
    toast({title: successMsg});
    fetchData();
    return true;
  };

  const branchName=(id?:string)=>allBranches.find(b=>b.id===id)?.name ?? (id?id.slice(0,8):"—");

  const availableBranches = allBranches.filter(b=>b.is_active !== false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Transfers</h1><p className="text-muted-foreground">Branch to branch — stock leaves on SHIP, arrives on RECEIVE, audited</p></div>
        {caps.canManage && <Button onClick={()=>setShow(true)}><Plus className="h-4 w-4 mr-2"/>New Transfer</Button>}
      </div>

      <Card><CardContent className="p-4"><div className="flex gap-4">
        <Select value={status} onChange={e=>setStatus(e.target.value)} className="w-[180px]">
          <option value="all">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="REQUESTED">Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="RECEIVED">Received</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <Button variant="outline" onClick={fetchData}>Refresh</Button>
      </div></CardContent></Card>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-6"><Skeleton className="h-12 w-full"/></div>
        : data.length===0 ? <div className="py-12 text-center text-muted-foreground">
            No transfers for this filter. {caps.canManage ? "Create a transfer between your branches to move stock." : "You do not have transfer permissions — ask a manager to create one."}
          </div>
        : <Table><TableHeader><TableRow>
            <TableHead>Transfer #</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader><TableBody>
          {data.map((t:any)=>(
            <TableRow key={t.id}>
              <TableCell className="font-mono text-xs">{t.transfer_number}</TableCell>
              <TableCell>{branchName(t.source_branch_id)} <ArrowRight className="inline h-3 w-3"/> {branchName(t.destination_branch_id)}</TableCell>
              <TableCell>{t.item_count}</TableCell>
              <TableCell className="text-right">{Number(t.total_cost??0).toLocaleString()}</TableCell>
              <TableCell><Badge variant={(STATUS_BADGE[t.status] ?? "secondary") as any}>{t.status}</Badge></TableCell>
              <TableCell className="text-right">
                {caps.canManage && (
                  <div className="flex gap-1 justify-end flex-wrap">
                    {t.status==="DRAFT" && <><Button variant="ghost" size="sm" onClick={()=>runAction(t.id,"request","Transfer requested")}><Send className="h-3.5 w-3.5"/>Request</Button><Button variant="ghost" size="sm" onClick={()=>runAction(t.id,"cancel","Transfer cancelled")}><Ban className="h-3.5 w-3.5"/>Cancel</Button></>}
                    {t.status==="REQUESTED" && <><Button variant="ghost" size="sm" onClick={()=>runAction(t.id,"approve","Transfer approved")}><Check className="h-3.5 w-3.5"/>Approve</Button><Button variant="ghost" size="sm" onClick={()=>runAction(t.id,"cancel","Transfer cancelled")}><Ban className="h-3.5 w-3.5"/>Cancel</Button></>}
                    {t.status==="APPROVED" && <Button variant="ghost" size="sm" onClick={()=>runAction(t.id,"ship","Transfer shipped")}><Truck className="h-3.5 w-3.5"/>Ship</Button>}
                    {t.status==="IN_TRANSIT" && <Button variant="ghost" size="sm" onClick={()=>runAction(t.id,"receive","Transfer received")}><Package className="h-3.5 w-3.5"/>Receive</Button>}
                  </div>
                )}
                {!caps.canManage && <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody></Table>}
      </CardContent></Card>

      <NewTransferDialog
        open={show}
        onOpenChange={setShow}
        branches={availableBranches}
        defaultSource={currentBranchId ?? caps.branchIds[0] ?? ""}
        onSaved={(ok)=>{ if(ok){ setShow(false); fetchData(); } }}
      />
    </div>
  );
}

function NewTransferDialog(props:{
  open:boolean;
  onOpenChange:(o:boolean)=>void;
  branches: Branch[];
  defaultSource:string;
  onSaved:(ok:boolean)=>void;
}){
  const { open,onOpenChange,branches,defaultSource,onSaved } = props;
  const { toast } = useToast();
  const [src,setSrc]=React.useState(defaultSource);
  const [dst,setDst]=React.useState("");
  const [notes,setNotes]=React.useState("");
  const [search,setSearch]=React.useState("");
  const [results,setResults]=React.useState<any[]>([]);
  const [items,setItems]=React.useState<DraftItem[]>([]);
  const [saving,setSaving]=React.useState(false);
  const [searching,setSearching]=React.useState(false);

  React.useEffect(()=>{
    if(open){ setSrc(defaultSource); setDst(""); setNotes(""); setSearch(""); setResults([]); setItems([]); }
  },[open,defaultSource]);

  const doSearch=React.useCallback(async(q:string)=>{
    if(!q.trim() || !src) return;
    setSearching(true);
    try{
      const r=await fetch(`/api/products?search=${encodeURIComponent(q)}&pos=1&branch_id=${src}`);
      const j=await r.json();
      setResults(Array.isArray(j)?j:[]);
    }catch{ setResults([]); }
    setSearching(false);
  },[src]);

  const dstOptions=branches.filter(b=>b.id!==src);

  const addItem=(p:any)=>{
    if(items.some(i=>i.product_id===p.id)){ toast({title:"Already in transfer", variant:"error"}); return; }
    setItems(prev=>[...prev,{product_id:p.id, name:`${p.name}${p.strength?` ${p.strength}`:""}`, quantity:1, unit_cost:Number(p.price??0)}]);
    setSearch(""); setResults([]);
  };

  const create=async()=>{
    if(!src || !dst){ toast({title:"Select source and destination branches", variant:"error"}); return; }
    if(!items.length){ toast({title:"Add at least one item", variant:"error"}); return; }
    setSaving(true);
    const r=await fetch("/api/transfers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      source_branch_id: src, destination_branch_id: dst, notes: notes||undefined,
      items: items.map(i=>({product_id:i.product_id, quantity:i.quantity, unit_cost:i.unit_cost}))
    })});
    const j=await r.json();
    setSaving(false);
    if(!r.ok){ toast({title:"Create failed", description: j.error, variant:"error"}); return; }
    toast({title:`Transfer ${j.transfer_number} created`});
    onSaved(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Transfer</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Source branch</Label>
              <Select value={src} onChange={e=>setSrc(e.target.value)}>
                {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1"><Label>Destination branch</Label>
              <Select value={dst} onChange={e=>setDst(e.target.value)}>
                <option value="">Select branch…</option>
                {dstOptions.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Add items (from {branches.find(b=>b.id===src)?.name ?? "source"})</Label>
            <div className="flex gap-2">
              <Input value={search} onChange={e=>{ setSearch(e.target.value); doSearch(e.target.value); }} placeholder="Search products…"/>
              <Button variant="outline" onClick={()=>doSearch(search)} disabled={searching}><Search className="h-4 w-4"/></Button>
            </div>
            {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
            {results.length>0 && (
              <div className="border rounded max-h-44 overflow-y-auto divide-y">
                {results.slice(0,6).map((p:any)=>(
                  <button key={p.id} type="button" onClick={()=>addItem(p)} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between gap-2">
                    <span>{p.name}{p.strength?` ${p.strength}`:""} <span className="text-xs text-muted-foreground">({p.stock} in stock)</span></span>
                    <span className="text-xs font-mono">{Number(p.price??0).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length>0 && (
            <div className="space-y-2">
              <Label>Items — {items.length}</Label>
              <div className="space-y-2">
                {items.map((it,i)=>(
                  <div key={it.product_id} className="flex items-center gap-2 border rounded p-2 text-sm">
                    <span className="flex-1 truncate">{it.name}</span>
                    <Input type="number" min={1} className="w-20" value={it.quantity} onChange={e=>setItems(prev=>prev.map((x,ix)=>ix===i?{...x,quantity:Number(e.target.value)}:x))}/>
                    <Input type="number" min={0} className="w-24" value={it.unit_cost} onChange={e=>setItems(prev=>prev.map((x,ix)=>ix===i?{...x,unit_cost:Number(e.target.value)}:x))}/>
                    <span className="text-xs text-muted-foreground w-20 text-right font-mono">{(it.quantity*it.unit_cost).toLocaleString()}</span>
                    <Button variant="ghost" size="sm" onClick={()=>setItems(prev=>prev.filter((_,ix)=>ix!==i))}><X className="h-4 w-4"/></Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1"><Label>Notes</Label><Input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional note"/></div>

          <div className="flex gap-2">
            <Button onClick={create} disabled={saving||!src||!dst||!items.length} className="flex-1">Create Draft</Button>
            <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
          </div>
          <p className="text-xs text-muted-foreground">Draft → Request → Approve → Ship (TRANSFER_OUT) → Receive (TRANSFER_IN). Stock is never edited directly.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}