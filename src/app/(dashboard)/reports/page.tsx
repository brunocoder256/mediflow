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
import { BarChart3, TrendingUp, Package, Users, Download, FileText, DollarSign, AlertTriangle, Building2, ShoppingCart, Truck, Printer, Calendar, Clock, XCircle, Receipt, CreditCard, UserCircle, Boxes, Activity, Scale } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

function formatUGX(n: number) { return `UGX ${Number(n ?? 0).toLocaleString('en-UG')}`; }
function formatNum(n: number) { return Number(n ?? 0).toLocaleString('en-UG'); }
function csvEscape(v: any) { const s = String(v ?? ""); if (s.includes(",") || s.includes('"') || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"'; return s; }
function safeSlice<T>(arr: any, start?: number, end?: number): T[] { if (!Array.isArray(arr)) return []; return arr.slice(start, end); }
function safeStrSlice(s: any, start: number, end?: number): string { if (typeof s !== 'string') s = String(s ?? ''); return s.slice(start, end); }
function safeIdSlice(id: any, len = 8): string { if (!id || typeof id !== 'string') return String(id ?? '—').slice(0, len); return id.slice(0, len); }

const COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#4b5563"];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [branchFilter, setBranchFilter] = React.useState("all");
  const [branches, setBranches] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [productFilter, setProductFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [supplierFilter, setSupplierFilter] = React.useState("all");
  const [customerFilter, setCustomerFilter] = React.useState("all");
  const [paymentMethod, setPaymentMethod] = React.useState("all");
  const [granularity, setGranularity] = React.useState("day");
  const [expiryBucket, setExpiryBucket] = React.useState("all");
  const [compare, setCompare] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [reportData, setReportData] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [syncTime, setSyncTime] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [page, setPage] = React.useState(1); const perPage = 20;
  const [sortBy, setSortBy] = React.useState<string | null>(null); const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('desc');
  const [selectedLow, setSelectedLow] = React.useState<Set<string>>(new Set());

  React.useEffect(() => { setMounted(true); }, []);

  React.useEffect(() => {
    const safeFetchJson = async (url: string) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return null;
        return await r.json();
      } catch { return null; }
    };
    safeFetchJson("/api/settings").then(j => { if (j?.branches) setBranches(j.branches); });
    safeFetchJson("/api/categories").then(j => { if (!j) return; if (Array.isArray(j)) setCategories(j); else if (j.data) setCategories(j.data); });
    safeFetchJson("/api/suppliers").then(j => { if (!j) return; const list = j.data ?? j; if (Array.isArray(list)) setSuppliers(safeSlice(list, 0, 50)); });
    safeFetchJson("/api/customers").then(j => { if (!j) return; const list = j.data ?? j; if (Array.isArray(list)) setCustomers(safeSlice(list, 0, 50)); });
    try {
      const t = localStorage.getItem("mediflow_last_sync");
      if (t) setSyncTime(t);
    } catch { /* ignore */ }
  }, []);

  const setPreset = (p: string) => {
    const now = new Date(); const iso = (d: Date) => d.toISOString().slice(0, 10);
    const startOfWeek = (d: Date) => { const c = new Date(d); c.setDate(c.getDate() - c.getDay()); return c; };
    if (p === "today") { setDateFrom(iso(now)); setDateTo(iso(now)); }
    else if (p === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); setDateFrom(iso(y)); setDateTo(iso(y)); }
    else if (p === "last7") { const s = new Date(now); s.setDate(s.getDate() - 6); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if (p === "last30") { const s = new Date(now); s.setDate(s.getDate() - 29); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if (p === "thisWeek") { const s = startOfWeek(now); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if (p === "lastWeek") { const s = startOfWeek(now); s.setDate(s.getDate() - 7); const e = new Date(s); e.setDate(e.getDate() + 6); setDateFrom(iso(s)); setDateTo(iso(e)); }
    else if (p === "thisMonth") { const s = new Date(now.getFullYear(), now.getMonth(), 1); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if (p === "lastMonth") { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); setDateFrom(iso(s)); setDateTo(iso(e)); }
    else if (p === "thisQuarter") { const s = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if (p === "thisYear") { const s = new Date(now.getFullYear(), 0, 1); setDateFrom(iso(s)); setDateTo(iso(now)); }
    else if (p === "lastYear") { const s = new Date(now.getFullYear() - 1, 0, 1); const e = new Date(now.getFullYear() - 1, 11, 31); setDateFrom(iso(s)); setDateTo(iso(e)); }
    else if (p === "clear") { setDateFrom(""); setDateTo(""); }
  };

  const mapTabToType = (tab: string) => {
    const m: Record<string, string> = {
      overview: "overview", sales: "sales", financial: "financial", pnl: "pnl", inventory: "inventory", movements: "stock-movement", expiry: "expiry", lowstock: "low-stock", slow: "slow-moving", dead: "dead-stock",
      purchasing: "purchasing", suppliers: "supplier", customers: "customer", expenses: "expense", staff: "staff", cash: "cash", ar: "ar", ap: "ap", branches: "branches", audit: "audit", reconciliation: "reconciliation"
    };
    return m[tab] ?? tab;
  };

  const fetchReport = React.useCallback(async (tab: string) => {
    setLoading(true); setErr(null);
    try {
      const params = new URLSearchParams();
      params.set("type", mapTabToType(tab));
      if (branchFilter !== "all") params.set("branch_id", branchFilter);
      if (productFilter) params.set("product_id", productFilter);
      if (categoryFilter !== "all") params.set("category_id", categoryFilter);
      if (supplierFilter !== "all") params.set("supplier_id", supplierFilter);
      if (customerFilter !== "all") params.set("customer_id", customerFilter);
      if (paymentMethod !== "all") params.set("payment_method", paymentMethod);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (granularity) params.set("granularity", granularity);
      if (expiryBucket !== "all") params.set("bucket", expiryBucket);
      if (compare) params.set("compare", "1");
      params.set("page", String(page));
      params.set("perPage", String(perPage));

      // Combined tabs fetch two report types in parallel
      if (tab === "slow") {
        const slow = new URLSearchParams(params);
        const dead = new URLSearchParams(params); dead.set("type", "dead-stock");
        const [r1, r2] = await Promise.all([fetch(`/api/reports?${slow.toString()}`), fetch(`/api/reports?${dead.toString()}`)]);
        const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
        if (!r1.ok) throw new Error(j1.error ?? "Failed to load report");
        setReportData({ type: "slow", data: j1.data ?? [], count: j1.count ?? 0, dead: j2.data ?? [], deadCount: j2.count ?? 0 });
        setGeneratedAt(j1.generated_at ?? new Date().toISOString());
        setLoading(false);
        return;
      }
      if (tab === "ar") {
        const ar = new URLSearchParams(params);
        const ap = new URLSearchParams(params); ap.set("type", "ap");
        const [r1, r2] = await Promise.all([fetch(`/api/reports?${ar.toString()}`), fetch(`/api/reports?${ap.toString()}`)]);
        const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
        if (!r1.ok) throw new Error(j1.error ?? "Failed to load report");
        setReportData({ type: "ar", ...j1, ap: j2 });
        setGeneratedAt(j1.generated_at ?? new Date().toISOString());
        setLoading(false);
        return;
      }

      const r = await fetch(`/api/reports?${params.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Failed to load report');
      setReportData(j);
      setGeneratedAt(j.generated_at ?? new Date().toISOString());
    } catch (e: any) { setErr(e.message); setReportData(null); }
    setLoading(false);
  }, [branchFilter, productFilter, categoryFilter, supplierFilter, customerFilter, paymentMethod, dateFrom, dateTo, granularity, expiryBucket, compare, page]);

  React.useEffect(() => { fetchReport(activeTab); }, [fetchReport, activeTab]);
  React.useEffect(() => { setPage(1); }, [activeTab, branchFilter, dateFrom, dateTo]);

  const handleTab = (id: string) => { setActiveTab(id); setPage(1); };

  const exportCsv = () => {
    if (!reportData) return;
    const branchName = branches.find(b => b.id === branchFilter)?.name ?? 'All';
    let csv = `MediFlow Report,${activeTab}\nBranch,${csvEscape(branchName)}\nDate From,${dateFrom || '—'}\nDate To,${dateTo || '—'}\nGenerated,${mounted ? new Date().toLocaleString() : ''}\nGenerated By,Current User\nFilters,${csvEscape(JSON.stringify({ branch: branchFilter, product: productFilter, category: categoryFilter, supplier: supplierFilter, customer: customerFilter, payment: paymentMethod }))}\n\n`;
    const pushSection = (title: string, headers: string[], rows: any[][]) => {
      csv += `${title}\n` + headers.map(csvEscape).join(",") + "\n";
      for (const r of rows) csv += r.map(csvEscape).join(",") + "\n";
      csv += "\n";
    };
    if (activeTab === "overview" && reportData.sales) {
      pushSection("KPIs", ["Metric", "Value"], [["Sales", reportData.sales.total], ["Gross Profit", reportData.grossProfit], ["Net Profit", reportData.netProfit], ["Stock Value", reportData.stockValue], ["Expenses", reportData.expenses?.total]]);
    } else if (activeTab === "sales" && reportData.sales?.data) {
      pushSection("Sales", ["Sale Number", "Date", "Total", "Status"], safeSlice(reportData.sales.data, 0, 100).map((s: any) => [s.sale_number, s.sold_at, s.total, s.status]));
    } else if (activeTab === "inventory" && reportData.low) {
      pushSection("Low Stock", ["Batch", "Product", "Qty", "Expiry"], safeSlice(reportData.low, 0, 100).map((b: any) => [b.batch_number, b.products?.name ?? b.product_id, b.quantity_available, b.expiry_date]));
    } else if (activeTab === "expiry" && reportData.data) {
      pushSection("Expiry", ["Batch", "Product", "Expiry", "Qty", "Value at Risk"], safeSlice(reportData.data, 0, 100).map((b: any) => [b.batch_number, b.products?.name ?? b.product_id, b.expiry_date, b.quantity_available, b.value_at_risk]));
    } else if (activeTab === "lowstock" && Array.isArray(reportData.data)) {
      pushSection("Low Stock", ["Product", "Qty", "Reorder Level", "Suggested"], safeSlice(reportData.data, 0, 100).map((r: any) => [r.product_name, r.quantity_available, r.reorder_level, r.suggested_reorder]));
    } else if (activeTab === "staff" && Array.isArray(reportData)) {
      pushSection("Staff", ["Cashier", "Sales", "Revenue", "Discounts", "Voids"], safeSlice(reportData, 0, 100).map((s: any) => [s.cashier_name, s.salesCount, s.revenue, s.discounts, s.voids]));
    } else if (activeTab === "cash" && Array.isArray(reportData)) {
      pushSection("Cash Sessions", ["Session", "Status", "Opening", "Expected", "Variance", "Date"], safeSlice(reportData, 0, 100).map((s: any) => [safeIdSlice(s.id, 8), s.status, s.opening_float, s.expected_cash, s.cash_variance, s.opened_at]));
    } else {
      csv += `Data\n${csvEscape(JSON.stringify(reportData).slice(0, 8000))}\n`;
    }
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `mediflow_${activeTab}_${branchFilter}_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  // Excel export: the codebase has no XLSX writer, so we emit a UTF-8 CSV
  // (opens natively in Excel) instead of a corrupt fake .xlsx.
  const exportXlsx = () => exportCsv();
  const printReport = () => {
    const branchName = branches.find(b => b.id === branchFilter)?.name ?? 'All Branches';
    const html = `<html><head><title>MediFlow Report — ${activeTab}</title><style>body{font-family:Inter,sans-serif;padding:20px;color:#111} h1{margin:0;font-size:18px} h2{font-size:14px;color:#444} table{border-collapse:collapse;width:100%;margin-top:12px} th,td{border:1px solid #d1d5db;padding:6px;font-size:11px;text-align:left} th{background:#f3f4f6} .hdr{border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px} .meta{font-size:11px;color:#555} .kpi{display:flex;gap:10px;margin:12px 0} .kpi div{border:1px solid #ddd;padding:8px;border-radius:6px;flex:1;text-align:center;font-size:12px} .foot{margin-top:16px;font-size:10px;color:#666;border-top:1px solid #ddd;padding-top:6px} @media print{ @page{margin:12mm} }</style></head><body><div class="hdr"><h1>MediFlow Pharmacy — ${activeTab.toUpperCase()}</h1><div class="meta">Branch: ${branchName} • Period: ${dateFrom || '—'} to ${dateTo || '—'} • Generated: ${new Date().toLocaleString()} • By: Current User • Filters: ${[productFilter ? 'product' : '', categoryFilter !== 'all' ? 'category' : '', supplierFilter !== 'all' ? 'supplier' : ''].filter(Boolean).join(',') || 'none'} • Page 1</div></div><pre style="font-size:10px;white-space:pre-wrap;background:#f9fafb;padding:10px;border:1px solid #eee;border-radius:6px;max-height:600px;overflow:auto">${JSON.stringify(reportData, null, 2).slice(0, 7000)}</pre><div class="foot">MediFlow ERP • Confidential — Branch-scoped, server-authoritative • Reconciliation: sales vs payments vs inventory</div><script>window.print()</script></body></html>`;
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); }
  };

  const comparisonBadge = (cmp: any) => {
    if (!cmp || cmp.pct === null || cmp.pct === undefined) return <span className="text-xs text-muted-foreground">—</span>;
    const up = cmp.pct > 0; return <span className={`text-xs font-medium ${up ? 'text-green-600' : cmp.pct < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{up ? '↑' : cmp.pct < 0 ? '↓' : '→'} {Math.abs(cmp.pct).toFixed(1)}%</span>;
  };

  const sorted = (data: any[], key: string) => {
    if (!sortBy) return data;
    return [...data].sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" />Reports</h1>
          <p className="text-sm text-muted-foreground">Executive reporting & BI — branch-scoped, server-authoritative</p>
          <p className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>
            Last synchronized: {mounted && syncTime ? new Date(syncTime).toLocaleString() : 'Never'} {mounted && generatedAt ? <span>• Generated: {new Date(generatedAt).toLocaleString()}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" />{branches.find(b => b.id === branchFilter)?.name ?? 'All Branches'}</Badge>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}><FileText className="h-4 w-4 mr-1" />Excel</Button>
          <Button variant="outline" size="sm" onClick={printReport}><Printer className="h-4 w-4 mr-1" />Print/PDF</Button>
        </div>
      </div>

      {/* Global Filters */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />Global Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>{showFilters ? 'Hide' : 'Show'}</Button>
        </CardHeader>
        {showFilters && <CardContent className="space-y-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
              <Select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="w-full md:w-[200px]" aria-label="Branch">
                <option value="all">All Branches</option>
                {safeSlice(branches, 0, 100).map((b: any) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
              </Select>
              <div className="flex flex-wrap gap-1">
                <Button variant="outline" size="sm" onClick={() => setPreset("today")}>Today</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("yesterday")}>Yesterday</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("last7")}>Last 7 Days</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("last30")}>Last 30 Days</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("thisWeek")}>This Week</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("lastWeek")}>Last Week</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("thisMonth")}>This Month</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("lastMonth")}>Last Month</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("thisQuarter")}>This Quarter</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("thisYear")}>This Year</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("lastYear")}>Last Year</Button>
                <Button variant="outline" size="sm" onClick={() => setPreset("clear")}>Clear</Button>
              </div>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full md:w-[160px]" placeholder="From" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full md:w-[160px]" placeholder="To" />
              <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full md:w-[160px]">
                <option value="all">All Payments</option>
                <option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="CARD">Card</option><option value="BANK">Bank</option><option value="OTHER">Other</option>
              </Select>
              <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full md:w-[180px]">
                <option value="all">All Categories</option>
                {safeSlice(categories, 0, 100).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="w-full md:w-[180px]">
                <option value="all">All Suppliers</option>
                {safeSlice(suppliers, 0, 100).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="w-full md:w-[180px]">
                <option value="all">All Customers</option>
                {safeSlice(customers, 0, 100).map((c: any) => <option key={c.id} value={c.id}>{c.display_name ?? c.name}</option>)}
              </Select>
              <Select value={granularity} onChange={e => setGranularity(e.target.value)} className="w-full md:w-[140px]">
                <option value="hour">By Hour</option><option value="day">By Day</option><option value="week">By Week</option><option value="month">By Month</option>
              </Select>
              <Select value={expiryBucket} onChange={e => setExpiryBucket(e.target.value)} className="w-full md:w-[160px]">
                <option value="all">All Expiry</option><option value="expired">Expired</option><option value="0-30">0–30 days</option><option value="31-60">31–60 days</option><option value="61-90">61–90 days</option><option value="90+">90+ days</option>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> Compare to previous period</label>
              <Button size="sm" onClick={() => { setPage(1); fetchReport(activeTab); }}>Run Report</Button>
              <Button variant="outline" size="sm" onClick={() => { setBranchFilter("all"); setDateFrom(""); setDateTo(""); setCategoryFilter("all"); setSupplierFilter("all"); setCustomerFilter("all"); setPaymentMethod("all"); setCompare(false); }}>Clear Filters</Button>
            </div>
            <p className="text-xs text-muted-foreground">Filters persist while navigating/paginating. Branch filter is server-side authoritative. Date range is inclusive. Only relevant filters affect each report.</p>
          </div>
        </CardContent>}
      </Card>

      {err && <Card><CardContent className="p-4 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{err}</CardContent></Card>}

      <Tabs value={activeTab} onValueChange={handleTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview"><Scale className="h-4 w-4 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="sales"><BarChart3 className="h-4 w-4 mr-1" />Sales</TabsTrigger>
          <TabsTrigger value="financial"><TrendingUp className="h-4 w-4 mr-1" />Financial</TabsTrigger>
          <TabsTrigger value="inventory"><Package className="h-4 w-4 mr-1" />Inventory</TabsTrigger>
          <TabsTrigger value="expiry"><Clock className="h-4 w-4 mr-1" />Expiry</TabsTrigger>
          <TabsTrigger value="lowstock"><AlertTriangle className="h-4 w-4 mr-1" />Low Stock</TabsTrigger>
          <TabsTrigger value="slow"><Activity className="h-4 w-4 mr-1" />Slow/Dead</TabsTrigger>
          <TabsTrigger value="purchasing"><Truck className="h-4 w-4 mr-1" />Purchasing</TabsTrigger>
          <TabsTrigger value="suppliers"><Boxes className="h-4 w-4 mr-1" />Suppliers</TabsTrigger>
          <TabsTrigger value="customers"><UserCircle className="h-4 w-4 mr-1" />Customers</TabsTrigger>
          <TabsTrigger value="expenses"><DollarSign className="h-4 w-4 mr-1" />Expenses</TabsTrigger>
          <TabsTrigger value="staff"><Users className="h-4 w-4 mr-1" />Staff</TabsTrigger>
          <TabsTrigger value="cash"><Receipt className="h-4 w-4 mr-1" />Cash</TabsTrigger>
          <TabsTrigger value="ar"><CreditCard className="h-4 w-4 mr-1" />AR/AP</TabsTrigger>
          <TabsTrigger value="branches"><Building2 className="h-4 w-4 mr-1" />Branches</TabsTrigger>
          <TabsTrigger value="audit"><FileText className="h-4 w-4 mr-1" />Audit</TabsTrigger>
        </TabsList>

        {/* OVERVIEW — Executive Dashboard */}
        <TabsContent value="overview" className="space-y-4">
          {loading ? <div className="grid gap-4 md:grid-cols-3">{[...Array(6)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-20" /></CardContent></Card>)}</div>
            : reportData ? (
              <>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                  <Card className="cursor-pointer hover:shadow-md" onClick={() => handleTab("sales")}><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Sales</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.sales?.total ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData.sales?.count ?? 0} txns • Net {formatUGX(reportData.sales?.net ?? 0)} {compare && reportData.comparison && comparisonBadge(reportData.comparison.sales)}</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-md" onClick={() => handleTab("financial")}><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Gross Profit</CardTitle><TrendingUp className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatUGX(reportData.grossProfit ?? 0)}</div><p className="text-xs text-muted-foreground">Margin {reportData.margin ?? 0}% {compare && reportData.comparison && comparisonBadge(reportData.comparison.grossProfit)}</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-md" onClick={() => handleTab("financial")}><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Net Profit</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.netProfit ?? 0)}</div><p className="text-xs text-muted-foreground">After expenses {formatUGX(reportData.expenses?.total ?? 0)} {compare && reportData.comparison && comparisonBadge(reportData.comparison.netProfit)}</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-md" onClick={() => handleTab("expenses")}><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Expenses</CardTitle><Receipt className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.expenses?.total ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData.expenses?.count ?? 0} records</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-md" onClick={() => handleTab("inventory")}><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Stock Value</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.stockValue ?? 0)}</div><p className="text-xs text-muted-foreground">{formatNum(reportData.stockQty ?? 0)} units {compare && reportData.comparison && comparisonBadge(reportData.comparison.stockValue)}</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-md" onClick={() => handleTab("ar")}><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Receivables</CardTitle><CreditCard className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.ar?.total ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData.ar?.count ?? 0} customers owe</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-md" onClick={() => handleTab("ar")}><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Payables</CardTitle><Truck className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.ap?.total ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData.ap?.count ?? 0} suppliers</p></CardContent></Card>
                  <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Transactions</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{reportData.transactions ?? 0}</div><p className="text-xs text-muted-foreground">Completed sales</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-md" onClick={() => handleTab("expiry")}><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Expiring Value</CardTitle><Clock className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-xl font-bold text-orange-600">{formatUGX(reportData.expiringValue ?? 0)}</div><p className="text-xs text-muted-foreground">At risk • Exp {reportData.expiringCounts?.expired ?? 0} • 0-30:{reportData.expiringCounts?.['0-30'] ?? 0}</p></CardContent></Card>
                  <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Returns</CardTitle><XCircle className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.returns?.value ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData.returns?.count ?? 0} returns</p></CardContent></Card>
                </div>
                {reportData.comparison && <Card><CardContent className="p-3 text-xs">Period comparison: Current {dateFrom}→{dateTo} vs Previous. Percentage change avoids misleading when baseline is zero.</CardContent></Card>}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card><CardHeader><CardTitle className="text-sm">Sales Trend ({granularity})</CardTitle></CardHeader><CardContent className="h-[240px]">
                    {Array.isArray(reportData.trend ?? reportData.salesTrend) && (reportData.trend ?? reportData.salesTrend).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%"><BarChart data={reportData.trend ?? reportData.salesTrend}><XAxis dataKey="period" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: any) => formatUGX(v)} /><Bar dataKey="revenue" fill="#16a34a" /></BarChart></ResponsiveContainer>
                    ) : <p className="text-xs text-muted-foreground text-center mt-2">No sales found for the selected period.</p>}
                  </CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Expenses by Category</CardTitle></CardHeader><CardContent className="h-[240px]">
                    {Object.keys(reportData.expenses?.byCategory ?? {}).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={Object.entries(reportData.expenses?.byCategory ?? {}).map(([name, value]: any) => ({ name, value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{Object.entries(reportData.expenses?.byCategory ?? {}).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => formatUGX(v)} /></PieChart></ResponsiveContainer>
                    ) : <p className="text-xs text-muted-foreground text-center mt-10">No expenses</p>}
                  </CardContent></Card>
                </div>
                <Card><CardContent className="p-3 text-xs text-muted-foreground">Each KPI links to the relevant report. Reports aggregate authoritative data — no duplicate transactions. Drill down via tables below.</CardContent></Card>
              </>
            ) : <Card><CardContent className="p-6 text-center text-muted-foreground">No data — adjust filters</CardContent></Card>}
        </TabsContent>

        {/* SALES */}
        <TabsContent value="sales" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.aggregates?.totalRevenue ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData.aggregates?.count ?? 0} sales • Net {formatUGX(reportData.aggregates?.netSales ?? 0)}</p>{reportData.comparison && <div className="mt-1">{comparisonBadge(reportData.comparison)}</div>}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Avg Order</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.aggregates?.avgOrder ?? 0)}</div><p className="text-xs text-muted-foreground">Discount {formatUGX(reportData.aggregates?.totalDiscount ?? 0)} • Tax {formatUGX(reportData.aggregates?.totalTax ?? 0)}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Returns</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.aggregates?.retTotal ?? 0)}</div><p className="text-xs text-muted-foreground">Refunds</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Transactions</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{reportData.aggregates?.count ?? 0}</div><p className="text-xs text-muted-foreground" suppressHydrationWarning>{dateFrom || '—'} → {dateTo || '—'}</p></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Recent Sales (paginated)</CardTitle><CardDescription>Drill into <a href="/sales" className="underline">Sales History</a> → SALE-xxx → Sale Detail</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="cursor-pointer" onClick={() => { setSortBy('sale_number'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Sale #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                {safeSlice(sorted(safeSlice(reportData.sales?.data, 0, 1000), sortBy ?? ''), 0, perPage).map((s: any) => <TableRow key={s.id}><TableCell className="font-mono text-xs"><a href={`/sales?search=${encodeURIComponent(s.sale_number)}`} className="underline">{s.sale_number}</a></TableCell><TableCell className="text-xs" suppressHydrationWarning>{mounted ? new Date(s.sold_at).toLocaleString() : s.sold_at}</TableCell><TableCell className="text-right text-xs">{formatUGX(Number(s.total))}</TableCell><TableCell><Badge variant={s.status === 'COMPLETED' ? 'default' : 'outline'}>{s.status}</Badge></TableCell></TableRow>)}
                {safeSlice(reportData.sales?.data, 0, 1000).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No sales found for the selected period.</TableCell></TableRow>}
              </TableBody></Table></div>
                <div className="flex items-center justify-between p-3 border-t"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button><span className="text-xs">Page {page}</span><Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Next</Button></div>
              </CardContent></Card>
            </>
          ) : <Card><CardContent className="p-6 text-center text-muted-foreground">No sales data — try broadening filters or check <a href="/pos" className="underline">POS</a></CardContent></Card>}
        </TabsContent>

        {/* FINANCIAL */}
        <TabsContent value="financial" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Net Sales</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.pnl?.revenue?.netRevenue ?? reportData.cogs?.netSales ?? 0)}</div><div className="text-xs text-muted-foreground">Gross {formatUGX(reportData.pnl?.revenue?.grossSales ?? 0)} • Discount {formatUGX(reportData.pnl?.revenue?.discount ?? 0)} • Refunds {formatUGX(reportData.pnl?.revenue?.returns ?? 0)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">COGS</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.pnl?.cogs ?? reportData.cogs?.cogs ?? 0)}</div><div className="text-xs text-muted-foreground">Batch purchase_price (historical)</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Gross Profit</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatUGX(reportData.pnl?.grossProfit ?? reportData.cogs?.grossProfit ?? 0)}</div><div className="text-xs text-muted-foreground">Margin {Number(reportData.pnl?.margin ?? reportData.cogs?.margin ?? 0).toFixed(1)}%</div></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="text-sm">P&L Structure</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Revenue (Net)</span><span className="font-medium">{formatUGX(reportData.pnl?.revenue?.netRevenue ?? 0)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>– COGS</span><span>{formatUGX(reportData.pnl?.cogs ?? 0)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Gross Profit</span><span className="text-green-600">{formatUGX(reportData.pnl?.grossProfit ?? 0)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>– Operating Expenses</span><span>{formatUGX(reportData.pnl?.operatingExpenses ?? 0)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1 text-base"><span>Net Operating Profit</span><span>{formatUGX(reportData.pnl?.netOperatingProfit ?? 0)}</span></div>
              </CardContent></Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm">Profit Trend</CardTitle></CardHeader><CardContent className="h-[200px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={[{ name: 'GP', value: reportData.pnl?.grossProfit ?? 0 }, { name: 'Net', value: reportData.pnl?.netOperatingProfit ?? 0 }]}><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: any) => formatUGX(v)} /><Line type="monotone" dataKey="value" stroke="#16a34a" /></LineChart></ResponsiveContainer></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Expenses by Category</CardTitle></CardHeader><CardContent><div className="space-y-2">{safeSlice(Object.entries(reportData.pnl?.byExpenseCategory ?? reportData.expenses?.byCategory ?? {}), 0, 6).map(([k, v]: any) => <div key={String(k)} className="flex justify-between text-xs"><span>{String(k)}</span><span>{formatUGX(Number(v))}</span></div>)}{Object.keys(reportData.pnl?.byExpenseCategory ?? reportData.expenses?.byCategory ?? {}).length === 0 && <p className="text-xs text-muted-foreground">No expenses in period — <a href="/expenses" className="underline">Expenses</a></p>}</div></CardContent></Card>
              </div>
            </>
          ) : <Card><CardContent className="p-6 text-center">No financial data</CardContent></Card>}
        </TabsContent>

        {/* INVENTORY */}
        <TabsContent value="inventory" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Current Lots</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{safeSlice(reportData.current, 0, 10000).length}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Low Stock</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-amber-600">{safeSlice(reportData.low, 0, 10000).length}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Expiring ≤30d</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-orange-600">{safeSlice(reportData.expiring, 0, 10000).length}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Expired</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-destructive">{safeSlice(reportData.expired, 0, 10000).length}</div></CardContent></Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm">Valuation</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatUGX(reportData.valuation?.valuation ?? 0)}</div><p className="text-xs text-muted-foreground">Sell value {formatUGX(reportData.valuation?.valuationSell ?? 0)} • Margin {formatUGX(reportData.valuation?.potentialMargin ?? 0)}</p><div className="h-[160px] mt-2"><ResponsiveContainer width="100%" height="100%"><BarChart data={Object.entries(reportData.valuation?.byBranch ?? {}).map(([k, v]: any) => ({ name: safeStrSlice(k, 0, 6), value: v }))}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: any) => formatUGX(v)} /><Bar dataKey="value" fill="#2563eb" /></BarChart></ResponsiveContainer></div></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Stock Summary (top value)</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-[260px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader><TableBody>{safeSlice(reportData.summary, 0, 10).map((r: any) => <TableRow key={r.product_id}><TableCell className="text-xs"><a href={`/products?search=${encodeURIComponent(r.product_name)}`} className="underline">{r.product_name}</a></TableCell><TableCell className="text-right text-xs">{r.quantity_available}</TableCell><TableCell className="text-right text-xs">{formatUGX(r.stock_value_cost)}</TableCell></TableRow>)}{safeSlice(reportData.summary, 0, 10).length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No stock</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
              </div>
            </>
          ) : <Card><CardContent className="p-6 text-center">No inventory</CardContent></Card>}
        </TabsContent>

        {/* EXPIRY */}
        <TabsContent value="expiry" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <>
              <div className="grid gap-4 md:grid-cols-5">
                {Object.entries(reportData.counts ?? {}).map(([k, v]: any) => <Card key={String(k)}><CardHeader className="pb-1"><CardTitle className="text-xs">{String(k)}</CardTitle></CardHeader><CardContent><div className={`text-xl font-bold ${k === 'expired' ? 'text-destructive' : k === '0-30' ? 'text-orange-600' : ''}`}>{Number(v)}</div></CardContent></Card>)}
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Expiry Buckets — Value at risk {formatUGX(reportData.totalAtRisk ?? 0)}</CardTitle><CardDescription>Actions: View Product / Batch / Supplier — Create Return via <a href="/returns" className="underline">Returns workflow</a></CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Product</TableHead><TableHead>Expiry</TableHead><TableHead>Days</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Supplier</TableHead></TableRow></TableHeader><TableBody>
                {safeSlice(reportData.data, 0, perPage).map((b: any) => <TableRow key={b.id}><TableCell className="font-mono text-xs"><a href={`/inventory?search=${encodeURIComponent(b.batch_number)}`} className="underline">{b.batch_number}</a></TableCell><TableCell className="text-xs"><a href={`/products?search=${encodeURIComponent(b.products?.name ?? '')}`} className="underline">{b.products?.name ?? safeIdSlice(b.product_id, 8)}</a></TableCell><TableCell className="text-xs" suppressHydrationWarning>{mounted ? new Date(b.expiry_date).toLocaleDateString() : b.expiry_date}</TableCell><TableCell className={`text-xs ${b.days_to_expiry <= 0 ? 'text-destructive' : b.days_to_expiry <= 30 ? 'text-orange-600' : ''}`}>{b.days_to_expiry}</TableCell><TableCell className="text-right text-xs">{b.quantity_available}</TableCell><TableCell className="text-right text-xs">{formatUGX(b.value_at_risk)}</TableCell><TableCell className="text-xs"><a href={`/suppliers?search=${encodeURIComponent(b.suppliers?.name ?? '')}`} className="underline">{b.suppliers?.name ?? safeIdSlice(b.supplier_id, 6) ?? '—'}</a></TableCell></TableRow>)}
                {safeSlice(reportData.data, 0, perPage).length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No expiring stock — FEFO clean</TableCell></TableRow>}
              </TableBody></Table></div></CardContent></Card>
            </>
          ) : <Card><CardContent className="p-6 text-center">No expiry data</CardContent></Card>}
        </TabsContent>

        {/* LOW STOCK */}
        <TabsContent value="lowstock" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <>
              <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">Low Stock — {reportData.count ?? safeSlice(reportData.data, 0, 10000).length ?? 0} items</CardTitle><Button size="sm" disabled={selectedLow.size === 0} onClick={() => { window.location.href = `/purchases?create=1&products=${Array.from(selectedLow).join(',')}`; }}>Create Purchase Order ({selectedLow.size})</Button></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead><input type="checkbox" onChange={e => { if (e.target.checked) setSelectedLow(new Set(safeSlice(reportData.data, 0, 10000).map((r: any) => r.product_id))); else setSelectedLow(new Set()); }} /></TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Reorder</TableHead><TableHead className="text-right">Suggested</TableHead><TableHead>Supplier</TableHead></TableRow></TableHeader><TableBody>
                {safeSlice(reportData.data, 0, 50).map((r: any) => <TableRow key={r.product_id}><TableCell><input type="checkbox" checked={selectedLow.has(r.product_id)} onChange={e => { const s = new Set(selectedLow); if (e.target.checked) s.add(r.product_id); else s.delete(r.product_id); setSelectedLow(s); }} /></TableCell><TableCell className="text-xs"><a href={`/products?search=${encodeURIComponent(r.product_name)}`} className="underline">{r.product_name}</a></TableCell><TableCell className="text-right">{r.quantity_available}</TableCell><TableCell className="text-right">{r.reorder_level}</TableCell><TableCell className="text-right">{r.suggested_reorder}</TableCell><TableCell className="text-xs"><a href={`/suppliers?search=${encodeURIComponent(r.preferred_supplier_name ?? '')}`} className="underline">{r.preferred_supplier_name ?? '—'}</a></TableCell></TableRow>)}
                {safeSlice(reportData.data, 0, 10000).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No low stock — inventory healthy</TableCell></TableRow>}
              </TableBody></Table></div></CardContent></Card>
              <p className="text-xs text-muted-foreground">Selecting products → Create Purchase Order opens existing Purchasing workflow — no duplicate PO system.</p>
            </>
          ) : <Card><CardContent className="p-6 text-center">No low stock data</CardContent></Card>}
        </TabsContent>

        {/* SLOW / DEAD */}
        <TabsContent value="slow" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-sm">Slow-Moving (≤5 in 30d)</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-[300px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Velocity</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader><TableBody>
                {safeSlice(reportData.data ?? reportData, 0, 20).map((r: any) => <TableRow key={r.product_id}><TableCell className="text-xs">{r.product_name}</TableCell><TableCell className="text-right">{r.quantity}</TableCell><TableCell className="text-right">{r.velocity}</TableCell><TableCell className="text-right">{formatUGX(r.value)}</TableCell></TableRow>)}
                {safeSlice(reportData.data ?? [], 0, 10000).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No slow-moving in period</TableCell></TableRow>}
              </TableBody></Table></div></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Dead Stock (no sales 60d)</CardTitle><CardDescription>Navigate to Product / Inventory / Supplier / Purchasing — never auto-delete</CardDescription></CardHeader><CardContent className="p-0"><div className="max-h-[300px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Last Sale</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader><TableBody>
                {safeSlice(reportData.dead, 0, 20).map((r: any) => <TableRow key={r.product_id}><TableCell className="text-xs"><a href={`/products?search=${encodeURIComponent(r.product_name)}`} className="underline">{r.product_name}</a></TableCell><TableCell className="text-right">{r.quantity}</TableCell><TableCell className="text-xs" suppressHydrationWarning>{r.last_sale_date ? (mounted ? new Date(r.last_sale_date).toLocaleDateString() : r.last_sale_date) : 'Never'} ({r.days_since_sale ?? '—'}d)</TableCell><TableCell className="text-right">{formatUGX(r.value)}</TableCell></TableRow>)}
                {safeSlice(reportData.dead, 0, 20).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No dead stock — every product sold in the last 60 days</TableCell></TableRow>}
              </TableBody></Table></div></CardContent></Card>
            </div>
          ) : <Card><CardContent className="p-6 text-center">No slow/dead data</CardContent></Card>}
        </TabsContent>

        {/* PURCHASING */}
        <TabsContent value="purchasing" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Total PO Value</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{formatUGX(reportData.analytics?.total ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData.analytics?.count ?? 0} orders</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Outstanding</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{reportData.analytics?.outstanding ?? 0}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Partially Received</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{reportData.analytics?.partially ?? 0}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Trend</CardTitle></CardHeader><CardContent className="h-[80px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={Object.entries(reportData.analytics?.trend ?? {}).map(([k, v]: any) => ({ period: String(k), value: v }))}><XAxis dataKey="period" fontSize={9} /><YAxis fontSize={9} /><Tooltip formatter={(v: any) => formatUGX(v)} /><Bar dataKey="value" fill="#2563eb" /></BarChart></ResponsiveContainer></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Purchase Orders</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead></TableRow></TableHeader><TableBody>
                {safeSlice(reportData.data, 0, perPage).map((po: any) => <TableRow key={po.id}><TableCell className="font-mono text-xs"><a href={`/purchases?search=${encodeURIComponent(po.purchase_number)}`} className="underline">{po.purchase_number}</a></TableCell><TableCell><Badge variant="outline">{po.status}</Badge></TableCell><TableCell className="text-right">{formatUGX(Number(po.total))}</TableCell><TableCell className="text-xs" suppressHydrationWarning>{mounted ? new Date(po.ordered_at).toLocaleDateString() : po.ordered_at}</TableCell><TableCell className="text-xs">{po.suppliers?.name ?? safeIdSlice(po.supplier_id, 8)}</TableCell></TableRow>)}
                {safeSlice(reportData.data, 0, perPage).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No purchase orders</TableCell></TableRow>}
              </TableBody></Table></div></CardContent></Card>
            </>
          ) : <Card><CardContent className="p-6 text-center">No purchasing data</CardContent></Card>}
        </TabsContent>

        {/* SUPPLIERS */}
        <TabsContent value="suppliers" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <Card><CardHeader><CardTitle className="text-sm">Supplier Balances (purchased - paid - returned)</CardTitle><CardDescription>Click supplier → <a href="/suppliers" className="underline">Supplier profile</a></CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Purchased</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader><TableBody>
              {safeSlice(reportData.balances, 0, perPage).map((s: any) => <TableRow key={s.supplier_id}><TableCell className="text-xs"><a href={`/suppliers?search=${encodeURIComponent(s.supplier_name)}`} className="underline">{s.supplier_name}</a></TableCell><TableCell className="text-right text-xs">{formatUGX(s.purchased)}</TableCell><TableCell className="text-right text-xs">{formatUGX(s.paid)}</TableCell><TableCell className="text-right font-medium">{formatUGX(s.balance)}</TableCell></TableRow>)}
              {safeSlice(reportData.balances, 0, perPage).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No supplier balances</TableCell></TableRow>}
            </TableBody></Table></div></CardContent></Card>
          ) : <Card><CardContent className="p-6 text-center">No supplier data</CardContent></Card>}
        </TabsContent>

        {/* CUSTOMERS */}
        <TabsContent value="customers" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <Card><CardHeader><CardTitle className="text-sm">Top Customers by Revenue</CardTitle><CardDescription><a href="/customers" className="underline">Customer profiles</a> — credit exposure & overdue</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Txns</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader><TableBody>
              {safeSlice(Array.isArray(reportData) ? reportData : reportData.data, 0, perPage).map((c: any) => <TableRow key={c.customer_id}><TableCell className="text-xs"><a href={`/customers?search=${encodeURIComponent(c.customer_name)}`} className="underline">{c.customer_name}</a></TableCell><TableCell className="text-right">{c.transactions}</TableCell><TableCell className="text-right">{formatUGX(c.revenue)}</TableCell><TableCell className="text-right">{formatUGX(c.netSales)}</TableCell></TableRow>)}
              {safeSlice(Array.isArray(reportData) ? reportData : reportData.data, 0, perPage).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No customer sales</TableCell></TableRow>}
            </TableBody></Table></div></CardContent></Card>
          ) : <Card><CardContent className="p-6 text-center">No customer data</CardContent></Card>}
        </TabsContent>

        {/* EXPENSES */}
        <TabsContent value="expenses" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Expenses</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatUGX(reportData.total ?? 0)}</div><p className="text-xs text-muted-foreground">{reportData.count ?? 0} approved/posted</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">By Month</CardTitle></CardHeader><CardContent className="h-[100px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={Object.entries(reportData.byMonth ?? {}).map(([k, v]: any) => ({ period: String(k), value: v }))}><XAxis dataKey="period" fontSize={9} /><YAxis fontSize={9} /><Tooltip formatter={(v: any) => formatUGX(v)} /><Bar dataKey="value" fill="#f59e0b" /></BarChart></ResponsiveContainer></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">By Payment</CardTitle></CardHeader><CardContent><div className="space-y-1">{safeSlice(Object.entries(reportData.byPayment ?? {}), 0, 4).map(([k, v]: any) => <div key={String(k)} className="flex justify-between text-xs"><span>{String(k)}</span><span>{formatUGX(Number(v))}</span></div>)}</div></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Expenses Detail</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>
                {safeSlice(reportData.data, 0, perPage).map((e: any) => <TableRow key={e.id}><TableCell className="text-xs" suppressHydrationWarning>{mounted ? new Date(e.expense_date).toLocaleDateString() : e.expense_date}</TableCell><TableCell><Badge variant="outline">{e.category ?? e.category_id ?? 'Other'}</Badge></TableCell><TableCell className="text-xs max-w-[240px] truncate">{e.description}</TableCell><TableCell className="text-right text-xs">{formatUGX(Number(e.total_amount ?? e.amount))}</TableCell></TableRow>)}
                {safeSlice(reportData.data, 0, perPage).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No expenses — <a href="/expenses" className="underline">Expenses</a></TableCell></TableRow>}
              </TableBody></Table></div></CardContent></Card>
            </>
          ) : <Card><CardContent className="p-6 text-center">No expense data</CardContent></Card>}
        </TabsContent>

        {/* STAFF */}
        <TabsContent value="staff" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : Array.isArray(reportData) ? (
            <Card><CardHeader><CardTitle className="text-sm">Staff Performance — factual sales/discounts/voids</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cashier</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Avg</TableHead><TableHead className="text-right">Discounts</TableHead><TableHead className="text-right">Voids</TableHead></TableRow></TableHeader><TableBody>
              {safeSlice(reportData, 0, 100).map((r: any) => <TableRow key={r.cashier_id}><TableCell className="text-xs">{r.cashier_name}</TableCell><TableCell className="text-right">{r.salesCount}</TableCell><TableCell className="text-right">{formatUGX(r.revenue)}</TableCell><TableCell className="text-right">{formatUGX(r.avgSale)}</TableCell><TableCell className="text-right">{formatUGX(r.discounts)}</TableCell><TableCell className="text-right">{r.voids}</TableCell></TableRow>)}
              {safeSlice(reportData, 0, 100).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No staff sales</TableCell></TableRow>}
            </TableBody></Table></div></CardContent></Card>
          ) : <Card><CardContent className="p-6 text-center">No staff data</CardContent></Card>}
        </TabsContent>

        {/* CASH */}
        <TabsContent value="cash" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : Array.isArray(reportData) ? (
            <Card><CardHeader><CardTitle className="text-sm">Cash Sessions — Expected = Opening + Sales − Refunds − Expenses; variance = actual − expected</CardTitle><CardDescription>Do not close shift from Reports unless architecture supports it</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Variance</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
              {safeSlice(reportData, 0, perPage).map((s: any) => <TableRow key={s.id}><TableCell className="font-mono text-xs">{safeIdSlice(s.id, 8)}</TableCell><TableCell><Badge variant={s.status === 'OPEN' ? 'default' : 'outline'}>{s.status}</Badge></TableCell><TableCell className="text-right text-xs">{formatUGX(Number(s.opening_float ?? 0))}</TableCell><TableCell className="text-right text-xs">{formatUGX(Number(s.expected_cash ?? 0))}</TableCell><TableCell className={`text-right text-xs ${Number(s.cash_variance) !== 0 ? 'text-destructive' : ''}`}>{formatUGX(Number(s.cash_variance ?? 0))}</TableCell><TableCell className="text-xs" suppressHydrationWarning>{mounted ? new Date(s.opened_at).toLocaleString() : s.opened_at}</TableCell></TableRow>)}
              {safeSlice(reportData, 0, perPage).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No cash sessions</TableCell></TableRow>}
            </TableBody></Table></div></CardContent></Card>
          ) : <Card><CardContent className="p-6 text-center">No cash data</CardContent></Card>}
        </TabsContent>

        {/* AR/AP */}
        <TabsContent value="ar" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-sm">Accounts Receivable — {formatUGX(reportData.totalOutstanding ?? reportData.total ?? 0)}</CardTitle><CardDescription>Aging: Current • 1–30 • 31–60 • 61–90 • 90+ days</CardDescription></CardHeader><CardContent>
                <div className="flex flex-wrap gap-2 mb-3">{Object.entries(reportData.buckets ?? {}).map(([k, v]: any) => <Badge key={String(k)} variant="outline">{String(k)}: {formatUGX(Number(v))}</Badge>)}</div>
                <div className="max-h-[300px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Aging</TableHead></TableRow></TableHeader><TableBody>
                  {safeSlice(reportData.data, 0, 20).map((r: any) => <TableRow key={r.customer_id}><TableCell className="text-xs"><a href={`/customers?search=${encodeURIComponent(r.customer_name)}`} className="underline">{r.customer_name}</a></TableCell><TableCell className="text-right text-xs">{formatUGX(r.outstanding)}</TableCell><TableCell><Badge variant="outline">{r.bucket} • {r.days_overdue}d</Badge></TableCell></TableRow>)}
                  {safeSlice(reportData.data, 0, 20).length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No receivables</TableCell></TableRow>}
                </TableBody></Table></div>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Accounts Payable — {formatUGX(reportData.ap?.totalOutstanding ?? 0)}</CardTitle><CardDescription>Aging: Current • 1–30 • 31–60 • 61–90 • 90+ days (paid = supplier_payments)</CardDescription></CardHeader><CardContent>
                <div className="flex flex-wrap gap-2 mb-3">{Object.entries(reportData.ap?.buckets ?? {}).map(([k, v]: any) => <Badge key={String(k)} variant="outline">{String(k)}: {formatUGX(Number(v))}</Badge>)}</div>
                <div className="max-h-[300px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Purchased</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Aging</TableHead></TableRow></TableHeader><TableBody>
                  {safeSlice(reportData.ap?.data, 0, 20).map((r: any) => <TableRow key={r.supplier_id}><TableCell className="text-xs"><a href={`/suppliers?search=${encodeURIComponent(r.supplier_name)}`} className="underline">{r.supplier_name}</a></TableCell><TableCell className="text-right text-xs">{formatUGX(r.purchased)}</TableCell><TableCell className="text-right text-xs">{formatUGX(r.paid)}</TableCell><TableCell className="text-right text-xs font-medium">{formatUGX(r.outstanding)}</TableCell><TableCell><Badge variant="outline">{r.bucket} • {r.days_overdue}d</Badge></TableCell></TableRow>)}
                  {safeSlice(reportData.ap?.data, 0, 20).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No payables — suppliers fully paid</TableCell></TableRow>}
                </TableBody></Table></div>
              </CardContent></Card>
            </div>
          ) : <Card><CardContent className="p-6 text-center">No AR/AP data</CardContent></Card>}
        </TabsContent>

        {/* BRANCHES */}
        <TabsContent value="branches" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <Card><CardHeader><CardTitle className="text-sm">Branch Comparison</CardTitle><CardDescription>[All Branches] vs individual — respects permissions</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Branch</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Txns</TableHead><TableHead className="text-right">Gross Profit</TableHead><TableHead className="text-right">Net Profit</TableHead><TableHead className="text-right">Stock Value</TableHead></TableRow></TableHeader><TableBody>
              {safeSlice(reportData.data, 0, 100).map((b: any) => <TableRow key={b.branch_id}><TableCell className="text-xs">{b.branch_name}</TableCell><TableCell className="text-right text-xs">{formatUGX(b.revenue)}</TableCell><TableCell className="text-right text-xs">{b.transactions}</TableCell><TableCell className="text-right text-xs">{formatUGX(b.grossProfit)}</TableCell><TableCell className="text-right text-xs">{formatUGX(b.netProfit)}</TableCell><TableCell className="text-right text-xs">{formatUGX(b.stockValue)}</TableCell></TableRow>)}
              {safeSlice(reportData.data, 0, 100).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No branch data</TableCell></TableRow>}
            </TableBody></Table></div>
              <div className="h-[200px] p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={safeSlice(reportData.data, 0, 6)}><XAxis dataKey="branch_name" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: any) => formatUGX(v)} /><Bar dataKey="revenue" fill="#16a34a" /><Bar dataKey="grossProfit" fill="#2563eb" /></BarChart></ResponsiveContainer></div>
            </CardContent></Card>
          ) : <Card><CardContent className="p-6 text-center">No branch comparison</CardContent></Card>}
        </TabsContent>

        {/* AUDIT */}
        <TabsContent value="audit" className="space-y-4">
          {loading ? <Skeleton className="h-64 w-full" /> : reportData ? (
            <Card><CardHeader><CardTitle className="text-sm">Audit Log — {reportData.count ?? 0} events • Voided: {reportData.voidedCount ?? 0}</CardTitle><CardDescription>Append-only, permission-sensitive; user activity & stock adjustments</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
              {safeSlice(reportData.data, 0, perPage).map((r: any) => <TableRow key={r.id}><TableCell><Badge variant="outline">{r.action}</Badge></TableCell><TableCell className="text-xs">{r.entity_type} • {safeIdSlice(r.entity_id, 8)}</TableCell><TableCell className="text-xs" suppressHydrationWarning>{mounted ? new Date(r.created_at).toLocaleString() : r.created_at}</TableCell></TableRow>)}
              {safeSlice(reportData.data, 0, perPage).length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No audit events — <a href="/audit" className="underline">Audit trail</a></TableCell></TableRow>}
            </TableBody></Table></div>
              <div className="flex justify-between p-3 border-t"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button><span className="text-xs">Page {page}</span><Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Next</Button></div>
            </CardContent></Card>
          ) : <Card><CardContent className="p-6 text-center">No audit data</CardContent></Card>}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center">Reports are a reporting layer — not transactions. All numbers trace to sales / batches / payments / suppliers / customers / accounting. Branch-scoped server filtering, period comparison avoids misleading % when baseline is zero, and exports respect filters/branch/permissions. Mobile: KPI cards stack, tables scroll horizontally, filters collapse.</p>
    </div>
  );
}
