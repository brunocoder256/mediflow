"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Receipt, printReceipt } from "@/components/receipt";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { isSeparateCheckout, requiresHandover } from "@/lib/checkout-workflow";
import { Banknote, Smartphone, CreditCard, RefreshCw, AlertTriangle, Plus, Trash2, Printer, ShieldCheck, Lock, WifiOff, CheckCircle2, XCircle, Wallet } from "lucide-react";

type PaymentMethod = 'CASH'|'MOBILE_MONEY'|'CARD'|'BANK'|'OTHER';

function formatUGX(n:number){ return `UGX ${Number(n||0).toLocaleString('en-UG')}`; }
function genOpId(){ const c:any=(globalThis as any).crypto; return c?.randomUUID ? c.randomUUID() : `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; }

export default function CashierPage(){
  const [loading,setLoading]=React.useState(true);
  const [branches,setBranches]=React.useState<any[]>([]);
  const [branchId,setBranchId]=React.useState("");
  const [organization,setOrganization]=React.useState<any>(null);
  const [orgSettings,setOrgSettings]=React.useState<any>(null);
  const [bills,setBills]=React.useState<any[]>([]);
  const [handovers,setHandovers]=React.useState<any[]>([]);
  const [listBusy,setListBusy]=React.useState(false);
  const [busy,setBusy]=React.useState(false);

  const [selected,setSelected]=React.useState<any|null>(null);
  const [paymentMethod,setPaymentMethod]=React.useState<PaymentMethod>('CASH');
  const [amountReceived,setAmountReceived]=React.useState("");
  const [paymentRef,setPaymentRef]=React.useState("");
  const [splitMode,setSplitMode]=React.useState(false);
  const [splitPayments,setSplitPayments]=React.useState<Array<{id:string; method:PaymentMethod; amount:string; reference:string}>>([]);
  const [receiptData,setReceiptData]=React.useState<any>(null);
  const [error,setError]=React.useState("");

  const { isOnline }=useOnlineStatus();
  const { toast }=useToast();

  const separate = isSeparateCheckout(orgSettings?.checkout_workflow, organization?.plan_tier);
  const handoverRequired = requiresHandover(orgSettings?.checkout_workflow, organization?.plan_tier);

  React.useEffect(()=>{
    fetch("/api/settings")
      .then(r=> r.json())
      .then((j:any)=>{
        setBranches(j?.branches ?? []);
        if(j?.organization) setOrganization(j.organization);
        if(j?.organization_settings) setOrgSettings(j.organization_settings);
        const br=j?.branches ?? [];
        if(br[0]) setBranchId(br[0].id);
      })
      .catch(()=>{})
      .finally(()=> setLoading(false));
  },[]);

  const refresh=React.useCallback(async()=>{
    if(!branchId) return;
    setListBusy(true);
    try{
      const r=await fetch(`/api/sales?status=AWAITING_PAYMENT&branch_id=${branchId}&perPage=100`);
      const j=await r.json();
      setBills(j?.data ?? []);
      if(handoverRequired){
        const r2=await fetch(`/api/sales?status=COMPLETED&handover_status=PENDING&branch_id=${branchId}&perPage=50`);
        const j2=await r2.json();
        setHandovers(j2?.data ?? []);
      } else {
        setHandovers([]);
      }
    }catch{
      toast({ title: "Unable to load bills", description: "Cashier requires a connection — reconnect and retry.", variant: "error" });
    }finally{ setListBusy(false); }
  },[branchId, handoverRequired, toast]);

  React.useEffect(()=>{ refresh(); },[refresh]);

  const openBill=async(b:any)=>{
    try{
      const r=await fetch(`/api/sales?id=${b.id}`);
      const j=await r.json();
      const sale=j?.sale ?? j;
      const items=j?.sale_items ?? j?.items ?? sale?.sale_items ?? [];
      setSelected({ ...sale, items });
      setError("");
      setPaymentMethod('CASH'); setAmountReceived(""); setPaymentRef(""); setSplitMode(false);
      setSplitPayments([{ id:genOpId(), method:'CASH', amount:String(sale?.total ?? b.total), reference:'' }]);
    }catch(e:any){ toast({ title:"Failed to open bill", description:e.message, variant:"error" }); }
  };

  const closeBill=()=>{ setSelected(null); setError(""); };

  const billTotal=Number(selected?.total ?? 0);
  const change=(()=>{
    if(splitMode){
      const cashSum=splitPayments.filter(p=>p.method==='CASH').reduce((s,p)=>s+Number(p.amount||0),0);
      const totalPaid=splitPayments.reduce((s,p)=>s+Number(p.amount||0),0);
      if(cashSum>0 && totalPaid>=billTotal) return Math.max(0, Math.round((cashSum - Math.max(0, billTotal-(totalPaid-cashSum)))*100)/100);
      return 0;
    }
    return paymentMethod==='CASH' && amountReceived ? Math.max(0, Math.round((Number(amountReceived||0) - billTotal)*100)/100) : 0;
  })();

  const canPay=(()=>{
    if(!selected || busy || !isOnline) return false;
    if(splitMode){
      const sum=splitPayments.reduce((s,p)=> s+Number(p.amount||0),0);
      if(splitPayments.length===0) return false;
      if(sum < billTotal - 0.01) return false;
      if(splitPayments.some(p=> !p.amount || Number(p.amount)<=0)) return false;
      if(splitPayments.some(p=> p.method!=='CASH' && !p.reference.trim())) return false;
      return true;
    }
    if(paymentMethod==='CASH' && (!amountReceived || Number(amountReceived) < billTotal - 0.01)) return false;
    if(paymentMethod!=='CASH' && !paymentRef.trim()) return false;
    return true;
  })();

  const completePayment=async()=>{
    if(!selected || busy) return;
    if(!isOnline){ toast({ title:"Connection required", description:"Collecting payment requires the server to record it.", variant:"error" }); return; }
    setBusy(true);
    setError("");
    const op=genOpId();
    const payments = splitMode && splitPayments.length
      ? splitPayments.map(p=>({ method:p.method, amount: Math.round(Number(p.amount||0)*100)/100, reference: p.method!=='CASH' ? (p.reference||undefined) : undefined }))
      : [{ method:paymentMethod, amount: Math.round(billTotal*100)/100, reference: paymentMethod!=='CASH' ? (paymentRef||undefined) : undefined }];
    const controller=new AbortController();
    const timeout=setTimeout(()=> controller.abort(), 25000);
    try{
      const r=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({
        action:'complete_bill', sale_id: selected.id, payments, payment_operation_id: op,
      })});
      const j=await r.json().catch(()=>({}));
      if(!r.ok){
        const msg=j.error ? `${j.error} (HTTP ${r.status})` : `Could not complete payment (HTTP ${r.status})`;
        console.error('[cashier] complete_bill failed:', r.status, j);
        setError(msg);
        toast({ title:"Payment failed", description:msg, variant:"error" });
        setBusy(false); return;
      }
      const paySummary = payments.map(p=>`${p.method}${p.reference?`(${p.reference})`:''}`).join(' + ');
      setReceiptData({
        sale: j.sale ?? { ...selected, status: 'COMPLETED' },
        items: j.items && j.items.length ? j.items : selected.items,
        total: j.saleTotal ?? billTotal,
        subtotal: j.saleSubtotal ?? selected.subtotal,
        discount: selected.discount ?? 0,
        branchId,
        paymentMethod: paySummary,
        customer: selected.customers?.name,
        salesperson: selected.salesperson?.full_name,
        handoverStatus: handoverRequired ? 'PENDING' : null,
        saleId: selected.id,
      });
      toast({ title:"Payment recorded", description:`Bill ${selected.sale_number ?? ''} completed.` });
      setSelected(null);
      refresh();
    }catch(e:any){
      const msg=e?.name==='AbortError' ? "Request timed out — the payment was not recorded. Check your connection and try again." : (e?.message ?? 'Payment failed');
      console.error('[cashier] complete_bill error:', e);
      setError(msg);
      toast({ title:"Payment failed", description:msg, variant:"error" });
    }finally{ clearTimeout(timeout); }
    setBusy(false);
  };

  const cancelBill=async(b:any)=>{
    const reason=(typeof window!=='undefined' ? window.prompt(`Cancel bill ${b.sale_number ?? ''}? Enter a reason:`, 'Cancelled by cashier') : null);
    if(reason===null) return;
    try{
      const r=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ action:'cancel_bill', sale_id:b.id, reason: reason || 'Cancelled' })});
      const j=await r.json();
      if(!r.ok){ toast({ title:"Cancel failed", description:j.error, variant:"error" }); return; }
      toast({ title:"Bill cancelled" });
      refresh();
    }catch(e:any){ toast({ title:"Cancel failed", description:e.message, variant:"error" }); }
  };

  const doHandover=async(sale:any)=>{
    try{
      const r=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ action:'confirm_handover', sale_id: sale.id })});
      const j=await r.json();
      if(!r.ok){ toast({ title:"Handover failed", description:j.error, variant:"error" }); return; }
      toast({ title:"Handover confirmed" });
      refresh();
    }catch(e:any){ toast({ title:"Handover failed", description:e.message, variant:"error" }); }
  };

  if(receiptData){
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="text-center py-2">
          <p className="text-sm font-semibold flex items-center justify-center gap-2 text-green-600"><CheckCircle2 className="h-4 w-4"/> Sale completed</p>
          <p className="text-xs text-muted-foreground">Receipt #{receiptData.sale?.sale_number}</p>
          {receiptData.handoverStatus==='PENDING' && <p className="text-xs text-blue-600 mt-1">Handover pending — confirm when medicines are given to the customer.</p>}
        </div>
        <Receipt
          organization={{ name: organization?.name ?? orgSettings?.receipt_header?.split('\n')[0] ?? "", address: organization?.address, phone: organization?.phone, registration_number: organization?.registration_number }}
          branch={{ name: branches.find(b=>b.id===receiptData.branchId)?.name ?? "Main Branch" }}
          receipt_number={receiptData.sale?.sale_number ?? ''}
          sold_at={receiptData.sale?.sold_at ?? new Date().toISOString()}
          cashier="Cashier"
          salesperson={receiptData.salesperson}
          handover_status={receiptData.handoverStatus}
          customer={receiptData.customer}
          items={(receiptData.items ?? []).map((it:any)=>({ name: it.products?.name ?? it.name ?? String(it.product_id).slice(0,8), quantity: it.quantity, unit_price: Number(it.unit_price ?? 0), discount: Number(it.discount ?? 0), tax: Number(it.tax ?? 0), subtotal: Number(it.subtotal ?? 0) }))}
          subtotal={Number(receiptData.subtotal ?? 0)}
          discount={Number(receiptData.discount ?? 0)}
          tax={0}
          total={Number(receiptData.total ?? 0)}
          payment_method={receiptData.paymentMethod}
        />
        <div className="flex gap-2">
          <Button onClick={printReceipt} className="flex-1"><Printer className="h-4 w-4 mr-2"/>Print</Button>
          {receiptData.handoverStatus==='PENDING' && (
            <Button variant="outline" className="flex-1" onClick={async()=>{ await doHandover({ id: receiptData.saleId }); setReceiptData(null); }}>
              <ShieldCheck className="h-4 w-4 mr-2"/>Confirm handover
            </Button>
          )}
          <Button variant="outline" onClick={()=> setReceiptData(null)} className="flex-1">Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Wallet}
        title="Cashier"
        description="Collect payment for bills submitted by salespeople."
      >
        <Select value={branchId} onChange={(e)=> setBranchId(e.target.value)} className="w-[220px]">
          {branches.length===0 && <option value="">No branch</option>}
          {branches.map((b:any)=> <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Button variant="outline" size="sm" onClick={refresh} disabled={!branchId || listBusy}>
          <RefreshCw className={`h-4 w-4 mr-2 ${listBusy?"animate-spin":""}`}/>Refresh
        </Button>
      </PageHeader>

      {!isOnline && (
        <div className="bg-amber-500 text-white text-sm rounded px-3 py-2 flex items-center gap-2"><WifiOff className="h-4 w-4"/>Offline — collecting payment requires a connection. Pending bills will appear when you reconnect.</div>
      )}

      {loading ? (
        <Skeleton className="h-40 w-full"/>
      ) : !separate ? (
        <Card>
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <Lock className="h-5 w-5 mt-0.5 text-muted-foreground"/>
            <div>
              <p className="font-medium">Separate salesperson/cashier checkout is not enabled</p>
              <p className="text-muted-foreground">Enable it in Settings → Sales &amp; POS (Pharmacy and Enterprise plans). Until then, sales are completed in one step at the POS.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pending bills {bills.length>0 && <Badge variant="secondary" className="ml-1">{bills.length}</Badge>}</CardTitle>
              <CardDescription>Bills awaiting payment for this branch. No stock is deducted until payment is collected.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {bills.length===0 && <p className="text-sm text-muted-foreground py-6 text-center">No pending bills.</p>}
              {bills.map((b:any)=>(
                <div key={b.id} className="border rounded p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div className="text-sm">
                    <p className="font-medium font-mono">{b.sale_number}</p>
                    <p className="text-muted-foreground">
                      {b.salesperson?.full_name ? `Salesperson: ${b.salesperson.full_name} · ` : ''}
                      {b.customers?.name ? `${b.customers.name} · ` : ''}
                      {new Date(b.sold_at).toLocaleString()} · {formatUGX(b.total)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={()=> openBill(b)} disabled={!isOnline}><Banknote className="h-4 w-4 mr-1"/>Collect payment</Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={()=> cancelBill(b)} disabled={!isOnline}><XCircle className="h-4 w-4 mr-1"/>Cancel</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {handoverRequired && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Awaiting handover {handovers.length>0 && <Badge variant="warning" className="ml-1">{handovers.length}</Badge>}</CardTitle>
                <CardDescription>Paid sales that still need a handover confirmation (three-stage workflow).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {handovers.length===0 && <p className="text-sm text-muted-foreground py-6 text-center">No sales awaiting handover.</p>}
                {handovers.map((h:any)=>(
                  <div key={h.id} className="border rounded p-3 flex items-center justify-between gap-2">
                    <div className="text-sm">
                      <p className="font-medium font-mono">{h.sale_number}</p>
                      <p className="text-muted-foreground">{new Date(h.sold_at).toLocaleString()} · {formatUGX(h.total)}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={()=> doHandover(h)} disabled={!isOnline}><ShieldCheck className="h-4 w-4 mr-1"/>Confirm handover</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Payment dialog */}
      <Dialog open={!!selected} onOpenChange={(o)=> { if(!o) closeBill(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Collect payment — {formatUGX(billTotal)}</DialogTitle>
            <DialogDescription>{selected?.sale_number}{selected?.customers?.name ? ` · ${selected.customers.name}` : ''}{selected?.salesperson?.full_name ? ` · Salesperson: ${selected.salesperson.full_name}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded border p-3 bg-muted/10 text-sm max-h-40 overflow-y-auto">
              {(selected?.items ?? []).map((it:any,i:number)=>(
                <div key={i} className="flex justify-between">
                  <span>{it.products?.name ?? it.name ?? it.product_id?.slice(0,8)} × {it.quantity}</span>
                  <span>{formatUGX(it.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total</span><span>{formatUGX(billTotal)}</span></div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={splitMode} onChange={e=>{ setSplitMode(e.target.checked); if(e.target.checked && splitPayments.length===0){ setSplitPayments([{id:genOpId(), method:'CASH', amount:String(billTotal), reference:''},{id:genOpId(), method:'MOBILE_MONEY', amount:'', reference:''}]); } }}/>
              Split payment
            </label>

            {splitMode ? (
              <div className="space-y-3">
                {splitPayments.map((sp)=>(
                  <div key={sp.id} className="border rounded p-2 space-y-2">
                    <div className="flex gap-2">
                      <Select value={sp.method} onChange={e=> setSplitPayments(a=> a.map(x=> x.id===sp.id ? {...x, method:e.target.value as PaymentMethod}:x))} className="w-[140px]">
                        <option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="CARD">Card</option><option value="BANK">Bank</option><option value="OTHER">Other</option>
                      </Select>
                      <Input placeholder="Amount" type="number" value={sp.amount} onChange={e=> setSplitPayments(a=> a.map(x=> x.id===sp.id ? {...x, amount:e.target.value}:x))} className="flex-1"/>
                      <Button variant="ghost" size="icon" onClick={()=> setSplitPayments(a=> a.filter(x=>x.id!==sp.id))} disabled={splitPayments.length<=1}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                    {sp.method!=='CASH' && <Input placeholder="Reference (required)" value={sp.reference} onChange={e=> setSplitPayments(a=> a.map(x=> x.id===sp.id ? {...x, reference:e.target.value}:x))}/>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={()=> setSplitPayments(a=> [...a, {id:genOpId(), method:'MOBILE_MONEY', amount:'', reference:''}])}><Plus className="h-4 w-4 mr-1"/>Add payment</Button>
                {splitPayments.reduce((s,p)=>s+Number(p.amount||0),0) < billTotal - 0.01 && <p className="text-xs text-destructive">Sum {formatUGX(splitPayments.reduce((s,p)=>s+Number(p.amount||0),0))} &lt; Total {formatUGX(billTotal)}</p>}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant={paymentMethod==='CASH'?"default":"outline"} onClick={()=>setPaymentMethod('CASH')}><Banknote className="h-4 w-4 mr-1"/>Cash</Button>
                  <Button variant={paymentMethod==='MOBILE_MONEY'?"default":"outline"} onClick={()=>setPaymentMethod('MOBILE_MONEY')}><Smartphone className="h-4 w-4 mr-1"/>Mobile</Button>
                  <Button variant={paymentMethod==='CARD'?"default":"outline"} onClick={()=>setPaymentMethod('CARD')}><CreditCard className="h-4 w-4 mr-1"/>Card</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={paymentMethod==='BANK'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('BANK')}>Bank</Button>
                  <Button variant={paymentMethod==='OTHER'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('OTHER')}>Other / Credit</Button>
                </div>
                {paymentMethod==='CASH' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount Received</label>
                    <Input type="number" value={amountReceived} onChange={e=>setAmountReceived(e.target.value)} placeholder="UGX"/>
                    <div className="flex justify-between text-sm"><span>Change</span><span className="font-bold text-green-600">{formatUGX(change)}</span></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Transaction reference {paymentMethod==='OTHER' ? '(optional for credit)' : ''}</label>
                    <Input value={paymentRef} onChange={e=>setPaymentRef(e.target.value)} placeholder="e.g. MTN 123... or credit note"/>
                  </div>
                )}
              </>
            )}

            {error && (
              <div role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0"/>
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={closeBill}>Cancel</Button>
              <Button className="flex-1" disabled={!canPay} onClick={completePayment}>{busy ? "Processing..." : `Complete payment — ${formatUGX(billTotal)}`}</Button>
            </div>
            {!isOnline && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Reconnect to record the payment.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
