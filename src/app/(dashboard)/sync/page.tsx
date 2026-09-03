"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Cloud, CloudOff, Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { db } from "@/lib/offline/db";
import { processSyncQueue } from "@/lib/offline/sync";

export default function SyncPage(){
  const {isOnline}=useOnlineStatus();
  const [queue,setQueue]=React.useState<any[]>([]);
  const [syncing,setSyncing]=React.useState(false);
  const [lastSync,setLastSync]=React.useState<string | null>(null);

  const load=React.useCallback(async()=>{
    const all=await db.syncQueue.toArray();
    setQueue(all);
  },[]);
  React.useEffect(()=>{ load(); const i=setInterval(load, 3000); return ()=>clearInterval(i); },[load]);

  const handleSync=async()=>{
    setSyncing(true);
    try{ const r=await processSyncQueue(); if(r.processed>0) setLastSync(new Date().toLocaleString()); } finally { setSyncing(false); load(); }
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
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Syncing</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{processing}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Failed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{failed}</div><p className="text-xs text-muted-foreground">e.g. Insufficient stock — server rejects, shows reason</p></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Queue</CardTitle><CardDescription>Pending / Syncing / Succeeded / Failed — each has operation_id, type, attempts, error, retry</CardDescription></CardHeader><CardContent>
        {queue.length===0 ? <div className="py-8 text-center text-muted-foreground">Queue empty — all synchronized. Offline sales generate operation_id and queue locally.</div>
        : <div className="space-y-3">
          {queue.map(q=>(
            <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 gap-2">
              <div className="flex-1 min-w-0"><p className="font-mono text-xs truncate">{q.operation_id}</p><p className="text-sm font-medium">{q.table_name} — {q.operation}</p><p className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleString()} · attempts {q.retries}</p>{q.error && <p className="text-xs text-destructive">{q.error}</p>}</div>
              <div className="flex items-center gap-2">{q.status==="pending" ? <Badge variant="warning">Pending</Badge> : q.status==="processing" ? <Badge>Syncing</Badge> : q.status==="failed" ? <Badge variant="destructive">Failed — {q.error ?? "Insufficient stock"}</Badge> : <Badge variant="success">Synced</Badge>}
                {q.status==="failed" && <Button size="sm" variant="outline" onClick={async()=>{ await db.syncQueue.update(q.id, {status:"pending"}); handleSync(); }}>Retry safely</Button>}
              </div>
            </div>
          ))}
        </div>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>How Offline Works</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground space-y-1">
        <p>POS → operation_id (UUID) → IndexedDB pendingSales → show OFFLINE / PENDING SYNC → online → server idempotency check → commit or reject (e.g. stock 3 vs request 5 → SYNC FAILED).</p>
        <p>Server remains authoritative, never allows negative stock. Client retry is safe.</p>
        <p>Last sync: {lastSync ?? "—"}</p>
      </CardContent></Card>
    </div>
  );
}
