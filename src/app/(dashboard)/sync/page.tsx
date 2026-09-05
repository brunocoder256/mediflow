"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Clock, Cloud, CloudOff, Wifi, WifiOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { db } from "@/lib/offline/db";
import { processSyncQueue } from "@/lib/offline/sync";

function formatPayload(p:any){
  try{
    const items=(p.items ?? []) as any[];
    const total= items.reduce((s:any,it:any)=> s+ (it.quantity??0),0);
    return `${items.length} items · ${total} units`;
  }catch{ return "—"; }
}

export default function SyncPage(){
  const {isOnline}=useOnlineStatus();
  const [queue,setQueue]=React.useState<any[]>([]);
  const [syncing,setSyncing]=React.useState(false);
  const [lastSync,setLastSync]=React.useState<string | null>(null);
  const [detail,setDetail]=React.useState<any|null>(null);

  const load=React.useCallback(async()=>{
    const all=await db.syncQueue.toArray();
    // newest first
    all.sort((a,b)=> new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
    setQueue(all);
  },[]);
  React.useEffect(()=>{ load(); const i=setInterval(load, 2000); return ()=>clearInterval(i); },[load]);

  const handleSync=async()=>{
    setSyncing(true);
    try{ const r=await processSyncQueue(); if(r.processed>0) setLastSync(new Date().toLocaleString()); } finally { setSyncing(false); load(); }
  };

  const handleDismiss=async(id:string)=>{
    await db.syncQueue.delete(id);
    load();
  };
  const handleClearFailed=async()=>{
    const failed=queue.filter(q=>q.status==='failed');
    for(const f of failed) await db.syncQueue.delete(f.id);
    load();
  };

  const pending=queue.filter(q=>q.status==="pending").length;
  const processing=queue.filter(q=>q.status==="processing").length;
  const failed=queue.filter(q=>q.status==="failed").length;
  const state = !isOnline ? "OFFLINE" : syncing || processing>0 ? "SYNCING" : failed>0 ? "SYNC_ERROR" : "ONLINE";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Sync Center</h1><p className="text-muted-foreground">ONLINE / OFFLINE / SYNCING / SYNC_ERROR — queue survives offline POS</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button><Button onClick={handleSync} disabled={syncing || !isOnline}>{syncing ? "Syncing..." : "Sync Now"}</Button></div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">State</CardTitle>{state==="ONLINE"?<Wifi className="h-4 w-4 text-green-500"/>:state==="OFFLINE"?<WifiOff className="h-4 w-4 text-red-500"/>:<Clock className="h-4 w-4 text-yellow-500"/>}</CardHeader><CardContent><div className="flex items-center gap-2">{state==="ONLINE"?<Cloud className="h-5 w-5 text-green-500"/>:<CloudOff className="h-5 w-5 text-red-500"/>}<span className="text-lg font-bold">{state}</span></div><p className="text-xs text-muted-foreground mt-1">{isOnline ? "Connected" : "Offline — sales will queue"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{pending}</div><p className="text-xs text-muted-foreground">Will sync when online. Operation_id ensures idempotency.</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Syncing</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{processing}</div><p className="text-xs text-muted-foreground">In-flight, locked batches</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Failed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{failed}</div><p className="text-xs text-muted-foreground">Conflicts require review</p></CardContent></Card>
      </div>

      {failed>0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader><CardTitle className="flex items-center gap-2 text-amber-800"><AlertTriangle className="h-5 w-5"/> Conflicts Need Attention</CardTitle><CardDescription className="text-amber-700">Server is authoritative. Failed sales were not created — stock changed while offline, expired batches excluded, or discount exceeded permission.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={!isOnline}>Retry All Pending</Button>
            <Button variant="ghost" size="sm" onClick={handleClearFailed}>Dismiss All Failed</Button>
            <span className="text-xs text-muted-foreground py-2">Retrying a duplicate operation_id is safe — server returns existing sale (one sale only).</span>
          </CardContent>
        </Card>
      )}

      <Card><CardHeader><CardTitle>Queue</CardTitle><CardDescription>Pending / Syncing / Failed / Synced — each shows operation_id, branch, items, attempts, server reason. Tap View for full payload.</CardDescription></CardHeader><CardContent>
        {queue.length===0 ? <div className="py-8 text-center text-muted-foreground">Queue empty — all synchronized. Offline sales generate operation_id and queue locally.</div>
        : <div className="space-y-3">
          {queue.map(q=>(
            <div key={q.id} className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 gap-3 ${q.status==='failed' ? 'bg-red-50 border-red-200' : q.status==='pending' ? 'bg-amber-50 border-amber-200' : 'bg-card'}`}>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs truncate">{q.operation_id}</p>
                <p className="text-sm font-medium">{q.table_name} — {q.operation} · {formatPayload(q.payload)}</p>
                <p className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleString()} · attempts {q.retries}{q.last_attempt_at ? ` · last ${new Date(q.last_attempt_at).toLocaleTimeString()}`:''}</p>
                {(q.payload as any)?.branch_id && <p className="text-xs text-muted-foreground font-mono">Branch: {(q.payload as any).branch_id.slice(0,8)}…</p>}
                {q.error && <div className="mt-1 rounded bg-white border border-red-200 p-2"><p className="text-xs font-medium text-destructive">Reason: {q.error}</p><p className="text-xs text-muted-foreground">Server keeps stock authoritative. If stock changed offline, adjust cart and retry with new operation_id.</p></div>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {q.status==="pending" ? <Badge variant="warning">Pending</Badge> : q.status==="processing" ? <Badge>Syncing</Badge> : q.status==="failed" ? <Badge variant="destructive">Failed</Badge> : <Badge variant="success">Synced</Badge>}
                <Button size="sm" variant="outline" onClick={()=>setDetail(q)}>View</Button>
                {q.status==="failed" && <Button size="sm" variant="outline" onClick={async()=>{ await db.syncQueue.update(q.id, {status:"pending", error:null} as any); handleSync(); }}>Retry safely</Button>}
                {q.status==="failed" && <Button size="sm" variant="ghost" onClick={()=>handleDismiss(q.id)}>Dismiss</Button>}
              </div>
            </div>
          ))}
        </div>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>How Offline Works</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground space-y-1">
        <p>POS → operation_id (UUID) → IndexedDB syncQueue → show OFFLINE / PENDING SYNC → online → server RPC validates (FEFO, expiry, stock, discount permission, cash session, idempotency) → commit in single PostgreSQL transaction or reject with reason.</p>
        <p>Conflicts: server changed stock → SYNC FAILED with reason “Insufficient stock for product X: need 5, available 3”. No silent overwrite, no duplicate sale on retry.</p>
        <p>Last sync: {lastSync ?? "—"}</p>
      </CardContent></Card>

      <Dialog open={!!detail} onOpenChange={(o)=>!o && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Queued Operation</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="rounded border bg-muted/20 p-3 font-mono text-xs break-all">
                <p><span className="font-semibold">operation_id:</span> {detail.operation_id}</p>
                <p><span className="font-semibold">status:</span> {detail.status} · retries {detail.retries}</p>
                <p><span className="font-semibold">created:</span> {new Date(detail.created_at).toLocaleString()}</p>
                {detail.error && <p className="text-destructive"><span className="font-semibold">error:</span> {detail.error}</p>}
              </div>
              <div>
                <p className="font-semibold mb-1">Payload (decoded):</p>
                <pre className="rounded bg-muted p-3 text-xs overflow-auto max-h-60">{JSON.stringify(detail.payload, null, 2)}</pre>
              </div>
              {(detail.payload as any)?.items && (
                <div>
                  <p className="font-semibold mb-1">Items:</p>
                  <div className="space-y-1">
                    {(detail.payload as any).items.map((it:any,i:number)=><div key={i} className="flex justify-between border rounded p-2 text-xs"><span>{it.product_id.slice(0,8)}…</span><span>Qty {it.quantity} · {it.discount ? `disc ${it.discount}${it.discount_type==='percent'?'%':''}`:''}</span></div>)}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={()=>setDetail(null)}>Close</Button>
                {detail.status==='failed' && <Button onClick={async()=>{ await db.syncQueue.update(detail.id, {status:"pending", error:null} as any); setDetail(null); handleSync(); }}><RefreshCw className="h-4 w-4 mr-2"/>Retry</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
