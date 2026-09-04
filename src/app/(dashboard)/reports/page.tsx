"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Package, Users, Download, Calendar, FileText, DollarSign, AlertTriangle, Building2, ShoppingCart, Truck, Printer } from "lucide-react";

function formatUGX(n:number){ return `UGX ${Number(n).toLocaleString('en-UG')}`; }

export default function ReportsPage() {
  const [activeTab, setActiveTab] = React.useState("sales");
  const [branchFilter, setBranchFilter] = React.useState("all");
  const [branches, setBranches] = React.useState<any[]>([]);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [reportData, setReportData] = React.useState<any>(null);
  const [err, setErr] = React.useState<string|null>(null);

  React.useEffect(()=>{
    fetch("/api/settings").then(r=>r.json()).then(j=>{ if(j.branches) setBranches(j.branches); }).catch(()=>{});
  },[]);

  const setPreset=(p:string)=>{
    const now=new Date();
    const iso=(d:Date)=> d.toISOString().slice(0,10);
    if(p==="today"){ setDateFrom(iso(now)); setDateTo(iso(now)); }
    else if(p==="week"){ const s=new Date(); s.setDate(now.getDate()-now.getDay()); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if(p==="month"){ const s=new Date(now.getFullYear(), now.getMonth(),1); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if(p==="clear"){ setDateFrom(""); setDateTo(""); }
  };

  const fetchReport = React.useCallback(async (tab:string)=>{
    setLoading(true); setErr(null);
    try{
      const params=new URLSearchParams();
      params.set("type", tab);
      if(branchFilter!=="all") params.set("branch_id", branchFilter);
      if(dateFrom) params.set("date_from", dateFrom);
      if(dateTo) params.set("date_to", dateTo);
      const r=await fetch(`/api/reports?${params.toString()}`);
      const j=await r.json();
      if(!r.ok) throw new Error(j.error ?? 'Failed to load report');
      setReportData(j);
    }catch(e:any){ setErr(e.message); setReportData(null); }
    setLoading(false);
  },[branchFilter, dateFrom, dateTo]);

  React.useEffect(()=>{ fetchReport(activeTab); },[fetchReport, activeTab]);

  const handleTab=(id:string)=>{ setActiveTab(id); };

  const exportCsv=()=>{
    if(!reportData){ return; }
    let csv="Report Type,"+activeTab+"\n";
    csv+=`Branch,${branchFilter}\n`;
    csv+=`Date From,${dateFrom}\nDate To,${dateTo}\n\n`;
    // simple per tab export
    if(activeTab==="sales" && reportData.sales?.data){
      csv+="Sale Number,Date,Total,Status\n";
      for(const s of reportData.sales.data){ csv+=`${s.sale_number},${s.sold_at},${s.total},${s.status}\n`; }
    } else if(activeTab==="inventory" && reportData.low){
      csv+="Batch,Product,Qty,Expiry\n";
      for(const b of (reportData.low??[]).slice(0,50)){ csv+=`${b.batch_number},${b.products?.name ?? b.product_id},${b.quantity_available},${b.expiry_date}\n`; }
    } else if(activeTab==="staff" && Array.isArray(reportData)){
      csv+="Cashier,Sales,Revenue,Discounts,Voids\n";
      for(const s of reportData){ csv+=`${s.cashier_name},${s.salesCount},${s.revenue},${s.discounts},${s.voids}\n`; }
    } else {
      csv+=JSON.stringify(reportData, null, 2).slice(0,4000);
    }
    const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`report_${activeTab}_${branchFilter}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const printReport=()=>{
    const html=`<html><head><title>Report ${activeTab}</title><style>body{font-family:sans-serif;padding:20px} h2{margin-bottom:4px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:6px;font-size:11px} th{background:#f3f4f6} .kpi{display:flex;gap:12px;margin-bottom:12px} .kpi div{border:1px solid #ddd;padding:10px;border-radius:6px;flex:1;text-align:center}</style></head><body><h2>MediFlow Report — ${activeTab}</h2><p>Branch: ${branches.find(b=>b.id===branchFilter)?.name ?? 'All'} • ${dateFrom||'—'} to ${dateTo||'—'} • ${new Date().toLocaleString()}</p><pre style="font-size:10px;white-space:pre-wrap">${JSON.stringify(reportData, null, 2).slice(0,6000)}</pre><script>window.print()</script></body></html>`;
    const w=window.open('','_blank'); if(w){ w.document.write(html); w.document.close(); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6"/>Reports</h1>
          <p className="text-sm text-muted-foreground">Branch-scoped, server-authoritative • Sales / Financial (COGS) / Inventory / Purchasing / Staff / Cash</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3"/>{branches.find(b=>b.id===branchFilter)?.name ?? 'All Branches'}</Badge>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1"/>Export CSV</Button>
          <Button variant="outline" size="sm" onClick={printReport}><Printer className="h-4 w-4 mr-1"/>Print</Button>
        </div>
      </div>

      {/* Global Filters — branch + date */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select value={branchFilter} onChange={e=>setBranchFilter(e.target.value)} className="w-full md:w-[220px]" aria-label="Branch">
            <option value="all">All Branches</option>
            {branches.map((b:any)=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={()=>setPreset("today")}>Today</Button>
            <Button variant="outline" size="sm" onClick={()=>setPreset("week")}>This Week</Button>
            <Button variant="outline" size="sm" onClick={()=>setPreset("month")}>This Month</Button>
            <Button variant="outline" size="sm" onClick={()=>setPreset("clear")}>Clear</Button>
          </div>
          <div className="flex gap-2 ml-auto w-full md:w-auto">
            <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="flex-1 md:w-[160px]" placeholder="From"/>
            <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="flex-1 md:w-[160px]" placeholder="To"/>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">All reports are branch-scoped. Selecting a branch filters sales, COGS, inventory valuation, purchasing, staff and cash sessions server-side. Date range applies where supported (sales/financial/purchasing/staff/cash).</p>
      </CardContent></Card>

      {err && <Card><CardContent className="p-4 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>{err}</CardContent></Card>}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="sales"><BarChart3 className="h-4 w-4 mr-1"/>Sales</TabsTrigger>
          <TabsTrigger value="financial"><TrendingUp className="h-4 w-4 mr-1"/>Financial</TabsTrigger>
          <TabsTrigger value="inventory"><Package className="h-4 w-4 mr-1"/>Inventory</TabsTrigger>
          <TabsTrigger value="purchasing"><Truck className="h-4 w-4 mr-1"/>Purchasing</TabsTrigger>
          <TabsTrigger value="staff"><Users className="h-4 w-4 mr-1"/>Staff</TabsTrigger>
          <TabsTrigger value="cash"><DollarSign className="h-4 w-4 mr-1"/>Cash</TabsTrigger>
        </TabsList>

        {/* SALES */}
        <TabsContent value="sales" className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">{[...Array(3)].map((_, i) => (
                <Card key={i}><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-24" /></CardContent></Card>
              ))}</div>
              <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatUGX(reportData?.aggregates?.totalRevenue ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData?.aggregates?.count ?? 0} completed sales • {branches.find(b=>b.id===branchFilter)?.name ?? 'All'}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Average Order</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatUGX(reportData?.aggregates?.avgOrder ?? 0)}</div><p className="text-xs text-muted-foreground">Discount {formatUGX(reportData?.aggregates?.totalDiscount ?? 0)} • Tax {formatUGX(reportData?.aggregates?.totalTax ?? 0)}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Transactions</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{reportData?.aggregates?.count ?? 0}</div><p className="text-xs text-muted-foreground">{dateFrom||'—'} → {dateTo||'—'} • Branch-scoped</p></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-4 w-4"/>Recent Sales ({reportData?.sales?.count ?? reportData?.sales?.data?.length ?? 0})</CardTitle><CardDescription>Server-paginated, branch-scoped, payment-method aware</CardDescription></CardHeader><CardContent className="p-0">
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sale #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                  {(reportData?.sales?.data ?? []).slice(0,20).map((s:any)=><TableRow key={s.id}><TableCell className="font-mono text-xs">{s.sale_number}</TableCell><TableCell className="text-xs">{new Date(s.sold_at).toLocaleString()}</TableCell><TableCell className="text-right text-xs">{formatUGX(Number(s.total))}</TableCell><TableCell><Badge variant={s.status==='COMPLETED'?'success':'outline'}>{s.status}</Badge></TableCell></TableRow>)}
                  {(reportData?.sales?.data ?? []).length===0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No sales in this branch/date range</TableCell></TableRow>}
                </TableBody></Table></div>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-xs text-muted-foreground">Sales feed Accounting (Revenue) and Reports. Use branch filter to compare Kampala vs Jinja. Drill into <a href="/sales" className="underline">Sales History</a> for product/batch trace.</CardContent></Card>
            </>
          )}
        </TabsContent>

        {/* FINANCIAL */}
        <TabsContent value="financial" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full"/> : reportData ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><DollarSign className="h-3 w-3"/>Net Sales</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.netProfit?.netSales ?? reportData.cogs?.netSales ?? 0)}</div><div className="text-xs text-muted-foreground">Gross {formatUGX(reportData.cogs?.grossSales ?? 0)} • Discount {formatUGX(reportData.cogs?.totalDiscount ?? 0)} • Refunds {formatUGX(reportData.cogs?.refundTotal ?? 0)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Package className="h-3 w-3"/>COGS</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.cogs?.cogs ?? 0)}</div><div className="text-xs text-muted-foreground">From batch purchase_price at sale time (historical)</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><TrendingUp className="h-3 w-3"/>Gross Profit</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatUGX(reportData.cogs?.grossProfit ?? reportData.netProfit?.grossProfit ?? 0)}</div><div className="text-xs text-muted-foreground">Margin {Number(reportData.cogs?.margin ?? 0).toFixed(1)}% • {reportData.cogs?.salesCount ?? 0} sales</div></CardContent></Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm">Net Profit</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatUGX(reportData.netProfit?.netProfit ?? 0)}</div><p className="text-xs text-muted-foreground">Gross Profit {formatUGX(reportData.netProfit?.grossProfit ?? 0)} − Expenses {formatUGX(reportData.netProfit?.totalExpenses ?? reportData.expenses?.total ?? 0)}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Expenses (Approved)</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.expenses?.total ?? reportData.netProfit?.totalExpenses ?? 0)}</div><div className="text-xs text-muted-foreground">{reportData.expenses?.count ?? 0} records • by category: {Object.entries(reportData.expenses?.byCategory ?? {}).slice(0,3).map(([k,v]:any)=>`${k}: ${formatUGX(v)}`).join(' • ') || '—'}</div></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Branch valuation note</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Financials are branch-scoped. Changing branch recomputes COGS/net profit server-side using `product_batches.purchase_price` preserved at sale time (historical cost, not current). No duplicate ledger — sales reuse accounting.</CardContent></Card>
            </>
          ) : <Card><CardContent className="p-6 text-center text-muted-foreground">No financial data for this branch/range</CardContent></Card>}
        </TabsContent>

        {/* INVENTORY */}
        <TabsContent value="inventory" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full"/> : reportData ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Current Lots</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{(reportData.current ?? []).length}</div><div className="text-xs text-muted-foreground">Branch-scoped batches</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Low Stock</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-amber-600">{(reportData.low ?? []).length}</div><div className="text-xs text-muted-foreground">qty ≤ reorder_level</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Expiring ≤30d</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-orange-600">{(reportData.expiring ?? []).length}</div><div className="text-xs text-muted-foreground">FEFO urgency</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Expired</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-destructive">{(reportData.expired ?? []).length}</div><div className="text-xs text-muted-foreground">Blocked from sale</div></CardContent></Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm">Valuation (branch-scoped)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatUGX(reportData.valuation?.valuation ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData.valuation?.totalQty ?? 0} units • by branch {Object.keys(reportData.valuation?.byBranch ?? {}).length} • by product {Object.keys(reportData.valuation?.byProduct ?? {}).length}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Low Stock Preview</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-64 overflow-auto"><Table><TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Expiry</TableHead></TableRow></TableHeader><TableBody>{(reportData.low ?? []).slice(0,10).map((b:any)=><TableRow key={b.id}><TableCell className="font-mono text-xs">{b.batch_number}</TableCell><TableCell className="text-xs">{b.products?.name ?? b.product_id?.slice(0,8)}</TableCell><TableCell className="text-right">{b.quantity_available}</TableCell><TableCell className="text-xs">{new Date(b.expiry_date).toLocaleDateString()}</TableCell></TableRow>)}{(reportData.low ?? []).length===0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No low stock in branch</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
              </div>
              <Card><CardContent className="p-3 text-xs text-muted-foreground">Inventory reports consume `product_batches` directly (branch-scoped). Sale branch never affects other branches. Link: <a href="/inventory" className="underline">Inventory</a> • Expiring uses FEFO thresholds.</CardContent></Card>
            </>
          ) : <Card><CardContent className="p-6 text-center text-muted-foreground">No inventory data</CardContent></Card>}
        </TabsContent>

        {/* PURCHASING */}
        <TabsContent value="purchasing" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full"/> : (
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4"/>Purchase Orders ({reportData?.count ?? reportData?.data?.length ?? 0})</CardTitle><CardDescription>Branch-scoped, date-aware</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{(reportData?.data ?? []).slice(0,20).map((po:any)=><TableRow key={po.id}><TableCell className="font-mono text-xs">{po.purchase_number}</TableCell><TableCell><Badge variant="outline">{po.status}</Badge></TableCell><TableCell className="text-right">{formatUGX(Number(po.total))}</TableCell><TableCell className="text-xs">{new Date(po.ordered_at).toLocaleDateString()}</TableCell></TableRow>)}{(reportData?.data ?? []).length===0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No purchase orders for this branch/range</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
          )}
        </TabsContent>

        {/* STAFF */}
        <TabsContent value="staff" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full"/> : Array.isArray(reportData) ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Active Cashiers</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{reportData.length}</div><div className="text-xs text-muted-foreground">Branch-scoped</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Total Sales</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{reportData.reduce((s:any,r:any)=>s+r.salesCount,0)}</div><div className="text-xs text-muted-foreground">Transactions</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.reduce((s:any,r:any)=>s+r.revenue,0))}</div><div className="text-xs text-muted-foreground">Voids {reportData.reduce((s:any,r:any)=>s+r.voids,0)}</div></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Staff Performance</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cashier</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Discounts</TableHead><TableHead className="text-right">Voids</TableHead></TableRow></TableHeader><TableBody>{reportData.map((r:any)=><TableRow key={r.cashier_id}><TableCell className="text-sm">{r.cashier_name}<div className="text-xs text-muted-foreground">{r.cashier_id.slice(0,8)}</div></TableCell><TableCell className="text-right">{r.salesCount}</TableCell><TableCell className="text-right">{formatUGX(r.revenue)}</TableCell><TableCell className="text-right">{formatUGX(r.discounts)}</TableCell><TableCell className="text-right">{r.voids}</TableCell></TableRow>)}{reportData.length===0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No staff activity in branch/range</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
            </>
          ) : <Card><CardContent className="p-6 text-center text-muted-foreground">No staff data</CardContent></Card>}
        </TabsContent>

        {/* CASH */}
        <TabsContent value="cash" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full"/> : Array.isArray(reportData) ? (
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4"/>Cash Sessions ({reportData.length})</CardTitle><CardDescription>Branch-scoped, expected vs actual variance</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Variance</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{reportData.slice(0,20).map((s:any)=><TableRow key={s.id}><TableCell className="font-mono text-xs">{s.id.slice(0,8)}</TableCell><TableCell><Badge variant={s.status==='OPEN'?'success':'outline'}>{s.status}</Badge></TableCell><TableCell className="text-right">{formatUGX(Number(s.opening_float ?? 0))}</TableCell><TableCell className="text-right">{formatUGX(Number(s.expected_cash ?? 0))}</TableCell><TableCell className="text-right">{formatUGX(Number(s.cash_variance ?? 0))}</TableCell><TableCell className="text-xs">{new Date(s.opened_at).toLocaleString()}</TableCell></TableRow>)}{reportData.length===0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No cash sessions for this branch/range</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
          ) : <Card><CardContent className="p-6 text-center text-muted-foreground">No cash data</CardContent></Card>}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center">Reports reuse sales/inventory/financial services — branch_id is server-filtered (never client-only). Changing branch in header recomputes all KPIs. Date range is inclusive.</p>
    </div>
  );
}
