"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  ShoppingCart,
  Receipt,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  XCircle,
  Package,
  PlusCircle,
  Truck,
  BarChart3,
  Wallet,
  WifiOff,
  Lightbulb,
  RefreshCw,
  Banknote,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { usePendingSales, useMediflowSynced } from "@/lib/offline/pending-overlay";
import { cachedFetch } from "@/lib/offline/cached-fetch";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function KpiCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

const UGX = new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 });
const fmt = (n: number) => UGX.format(Number(n ?? 0));

function safeSlice(arr: any, n: number): any[] {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

export default function DashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [greeting, setGreeting] = React.useState("Hello");
  const [userName, setUserName] = React.useState("");
  const [todayLabel, setTodayLabel] = React.useState("");
  const [data, setData] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [viewingCached, setViewingCached] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const pendingSales = usePendingSales();
  const { isOnline } = useOnlineStatus();

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    const offlineNow = typeof navigator !== "undefined" && !navigator.onLine;
    setViewingCached(offlineNow);
    try {
      // cachedFetch keeps the dashboard authoritative online and replays the
      // last-good snapshot (IndexedDB) offline so the page never blanks out.
      const d = await cachedFetch<any>("/api/dashboard");
      if (d && !d.error) setData(d);
      else if (d?.error) throw new Error(String(d.error));
    } catch (e: any) {
      setViewingCached(true);
      if (offlineNow) setErr("Offline — no cached dashboard yet. Open the dashboard once while online and it becomes available offline.");
      else setErr(e?.message ?? "Couldn't load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    let g = "Good evening";
    if (hour < 12) g = "Good morning";
    else if (hour < 18) g = "Good afternoon";
    setGreeting(g);
    setTodayLabel(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }));

    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: u }) => {
      if (u.user) setUserName(u.user.user_metadata?.full_name?.split(" ")[0] ?? u.user.email?.split("@")[0] ?? "");
    }).catch(() => { /* offline / unauthenticated — greeting just omits the name */ });
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Re-pull real figures once queued offline work finishes syncing.
  useMediflowSynced(() => { load(); });

  // Overlay unsynced offline sales (from IndexedDB) on the server "today" figures
  // so a user working offline still sees today's true sales even before sync.
  const todayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayOffsetPending = React.useMemo(() => {
    const today = todayKey(new Date());
    const rows = (pendingSales ?? []).filter((p: any) => {
      try { return todayKey(new Date(p.sold_at)) === today; } catch { return false; }
    });
    let amount = 0;
    for (const r of rows) amount += Number(r.total ?? 0);
    return { amount, count: rows.length };
  }, [pendingSales]);

  const offlineTodayTxns = React.useMemo(() => {
    const today = todayKey(new Date());
    return (pendingSales ?? [])
      .filter((p: any) => { try { return todayKey(new Date(p.sold_at)) === today; } catch { return false; } })
      .map((p: any) => ({ id: p.id, sale_number: p.sale_number ?? "PENDING…", sold_at: p.sold_at, total: p.total, status: "PENDING_SYNC" }));
  }, [pendingSales]);

  const merged = React.useMemo(
    () =>
      data
        ? { ...data, todaySales: (data.todaySales ?? 0) + todayOffsetPending.amount, todayCount: (data.todayCount ?? 0) + todayOffsetPending.count }
        : data,
    [data, todayOffsetPending],
  );

  const trendOf = (cur: number, prev: number) => {
    if (!prev || prev <= 0) return { trend: "neutral" as const, trendValue: "" };
    const pct = Math.abs(Math.round((((cur ?? 0) - prev) / prev) * 1000) / 10);
    return { trend: ((cur ?? 0) >= prev ? "up" : "down") as "up" | "down", trendValue: `${pct}% vs yesterday` };
  };

  const go = (path: string) => window.location.assign(path);

  const salesTrend = merged ? trendOf(merged.todaySales, merged.todaySalesLast) : { trend: "neutral" as const, trendValue: "" };
  const txTrend = merged ? trendOf(merged.todayCount, merged.todayCountLast) : { trend: "neutral" as const, trendValue: "" };
  const profitTrend = merged ? trendOf(merged.grossProfit, merged.grossProfitLast) : { trend: "neutral" as const, trendValue: "" };
  const netTrend = merged ? trendOf(merged.netProfit, merged.netProfitLast) : { trend: "neutral" as const, trendValue: "" };
  const expTrend = merged ? trendOf(merged.expenses, merged.expensesLast) : { trend: "neutral" as const, trendValue: "" };

  const kpis = merged
    ? [
        { title: "Today's Sales", value: fmt(merged.todaySales), icon: ShoppingCart, description: `${merged.todayCount} transactions${todayOffsetPending.count ? ` (+${todayOffsetPending.count} offline)` : ""}${Number(merged.todayRefunds) > 0 ? ` · ${fmt(merged.todayRefunds)} refunded` : ""}`, onClick: () => go("/sales"), ...salesTrend },
        { title: "Transactions", value: String(merged.todayCount ?? 0), icon: Receipt, description: todayOffsetPending.count ? `${todayOffsetPending.count} pending offline sync` : "Completed today", onClick: () => go("/sales"), ...txTrend },
        { title: "Gross Profit", value: fmt(merged.grossProfit), icon: TrendingUp, description: "Today (net of discounts)", onClick: () => go("/reports"), ...profitTrend },
        { title: "Net Profit", value: fmt(merged.netProfit), icon: Wallet, description: "After expenses", onClick: () => go("/reports"), ...netTrend },
        { title: "Expenses", value: fmt(merged.expenses), icon: DollarSign, description: "Today", onClick: () => go("/expenses"), ...expTrend },
        { title: "Low Stock", value: String(merged.lowStock ?? 0), icon: AlertTriangle, description: "Items below minimum", accent: "text-amber-500", onClick: () => go("/inventory") },
        { title: "Expiring Soon", value: String(merged.expiringSoon ?? 0), icon: Clock, description: "Within 30 days", accent: "text-orange-500", onClick: () => go("/inventory") },
        { title: "Expired Items", value: String(merged.expired ?? 0), icon: XCircle, description: "Need removal", accent: "text-red-500", onClick: () => go("/inventory") },
      ]
    : [];

  // Plain-language, filter-aware summary so the dashboard explains itself rather
  // than only showing raw figures. Derived entirely from the data already shown.
  const insights: string[] = React.useMemo(() => {
    if (!merged) return [];
    const out: string[] = [];
    const sales = Number(merged.todaySales ?? 0);
    const count = Number(merged.todayCount ?? 0);
    const lastSales = Number(merged.todaySalesLast ?? 0);
    const gp = Number(merged.grossProfit ?? 0);
    const net = Number(merged.netProfit ?? 0);
    const expenses = Number(merged.expenses ?? 0);
    const refunds = Number(merged.todayRefunds ?? 0);
    const low = Number(merged.lowStock ?? 0);
    const soon = Number(merged.expiringSoon ?? 0);
    const exp = Number(merged.expired ?? 0);

    if (lastSales > 0) {
      const pct = Math.round(((sales - lastSales) / lastSales) * 1000) / 10;
      out.push(`Sales are ${pct >= 0 ? "up" : "down"} ${Math.abs(pct)}% versus yesterday (${fmt(sales)} vs ${fmt(lastSales)}).`);
    } else if (sales > 0) {
      out.push(`Today's sales are ${fmt(sales)} across ${count} transaction(s) — no sales yesterday to compare.`);
    } else {
      out.push("No sales recorded today yet.");
    }
    if (sales > 0 && gp > 0) {
      const margin = Math.round((gp / sales) * 1000) / 10;
      out.push(`Gross margin is ${margin}% — ${fmt(gp)} of profit on ${fmt(sales)} net sales.`);
    }
    if (net < 0) out.push(`Today is running at a net LOSS of ${fmt(Math.abs(net))} — expenses (${fmt(expenses)}) exceeded gross profit.`);
    else if (net > 0) out.push(`Net profit so far is ${fmt(net)} after ${fmt(expenses)} of operating expenses.`);
    if (refunds > 0) out.push(`${fmt(refunds)} was refunded today — keep an eye on return drivers.`);
    if (low > 0) out.push(`${low} item(s) are at or below reorder level — plan a purchase order.`);
    if (soon > 0) out.push(`${soon} batch(es) expire within 30 days — prioritise FEFO dispatch.`);
    if (exp > 0) out.push(`${exp} batch(es) are already expired — remove or write them off.`);
    if (low === 0 && soon === 0 && exp === 0 && sales > 0) out.push("Inventory is healthy — no low-stock or expiry alerts today.");
    if (Number(merged.pendingPurchases ?? 0) > 0) out.push(`${merged.pendingPurchases} purchase order(s) are still awaiting delivery.`);
    out.push(merged.openCashSession ? "The cash register is open — remember to reconcile at close." : "No cash session is open — open the register before taking sales.");
    if (todayOffsetPending.count > 0) out.push(`${todayOffsetPending.count} offline sale(s) (${fmt(todayOffsetPending.amount)}) are pending sync.`);
    return out;
  }, [merged, todayOffsetPending]);

  // Recent activity = queued (offline) sales first, then today's server sales.
  const recentList = React.useMemo(() => {
    const pending = offlineTodayTxns.map((p: any) => ({ id: `p-${p.id}`, sale_number: p.sale_number ?? "PENDING…", sold_at: p.sold_at, total: p.total, status: "PENDING_SYNC", pending: true }));
    const server = safeSlice(merged?.recentTxns, 6).map((s: any) => ({ id: `s-${s.id}`, sale_number: s.sale_number, sold_at: s.sold_at, total: s.total, status: s.status, pending: false }));
    return [...pending, ...server].slice(0, 6);
  }, [merged, offlineTodayTxns]);

  const COLORS = ["#0f766e", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed"];
  const hasData = !!merged;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={
          loading ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <span>
              {greeting}
              {userName ? `, ${userName}` : ""}
            </span>
          )
        }
        description={
          loading ? (
            <Skeleton className="h-4 w-48 mt-1" />
          ) : (
            <span>
              {todayLabel} — here&apos;s what&apos;s happening with your pharmacy today.
            </span>
          )
        }
      >
        {!loading && (
          <>
            <Button size="sm" onClick={() => go("/pos")}><ShoppingCart className="h-4 w-4 mr-1" /> New Sale</Button>
            <Button size="sm" variant="outline" onClick={() => go("/purchases")}><Truck className="h-4 w-4 mr-1" /> Purchases</Button>
            <Button size="sm" variant="outline" onClick={() => go("/products")}><PlusCircle className="h-4 w-4 mr-1" /> Add Product</Button>
            <Button size="sm" variant="outline" onClick={() => go("/reports")}><BarChart3 className="h-4 w-4 mr-1" /> Reports</Button>
            <Button size="sm" variant="ghost" onClick={load} title="Refresh dashboard"><RefreshCw className="h-4 w-4" /></Button>
          </>
        )}
      </PageHeader>

      {(!isOnline || viewingCached) && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            {!isOnline
              ? "OFFLINE — showing the last synchronized snapshot. Offline sales are overlaid on today's figures and will sync automatically when you reconnect."
              : "Showing the last-good cached dashboard — the live refresh had a hiccup. Use Refresh to retry."}
          </span>
        </div>
      )}

      {err && (
        <Card><CardContent className="p-4 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{err}
          <Button variant="outline" size="sm" className="ml-auto" onClick={load}>Retry</Button>
        </CardContent></Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading
          ? [...Array(8)].map((_, i) => <KpiCardSkeleton key={i} />)
          : kpis.length
            ? kpis.map((kpi) => <StatCard key={kpi.title} {...kpi} />)
            : (
              <Card className="md:col-span-2 lg:col-span-4">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No dashboard data available{!isOnline ? " — reconnect and refresh" : ""}.
                  <div className="mt-3"><Button size="sm" variant="outline" onClick={load}>Retry</Button></div>
                </CardContent>
              </Card>
            )}
      </div>

      {/* Insights */}
      {!loading && hasData && insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" /> Today at a Glance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5 md:grid-cols-2">
            {insights.map((t, i) => (
              <p key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-primary">•</span><span>{t}</span></p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Secondary strip */}
      {!loading && hasData && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-3 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => go("/inventory")}>
            <Package className="h-4 w-4 text-primary" />
            <div className="text-sm">
              <span className="text-muted-foreground">Inventory value: </span>
              <span className="font-medium">{fmt(merged.inventoryValue)}</span>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <Truck className="h-4 w-4 text-primary" />
            <div className="text-sm">
              <span className="text-muted-foreground">Pending purchases: </span>
              <a href="/purchases" className="font-medium underline underline-offset-2">{merged.pendingPurchases ?? 0}</a>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => go("/cash")}>
            <Banknote className="h-4 w-4 text-primary" />
            <div className="text-sm">
              <span className="text-muted-foreground">Cash session: </span>
              <span className="font-medium">{merged.openCashSession ? "Open" : "Closed"}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <>
            <Card><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent><Skeleton className="h-[260px] w-full rounded-lg" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent><Skeleton className="h-[260px] w-full rounded-lg" /></CardContent></Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Sales Trend — last 7 days</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                {data?.salesSeries?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.salesSeries} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                      <Tooltip formatter={(v: any) => fmt(Number(v))} labelFormatter={(l: any) => `Date: ${l}`} />
                      <Area type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} fill="url(#salesFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center mt-10">No sales in the last 7 days.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> Top Products Today</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                {data?.topProducts?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topProducts} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} interval={0} tickFormatter={(v: string) => v.length > 12 ? `${v.slice(0, 12)}…` : v} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                      <Tooltip formatter={(v: any, _n: any, p: any) => [`${Number(v)} units · ${fmt(Number(p?.payload?.revenue ?? 0))}`, "Sold"]} />
                      <Bar dataKey="qty" name="Units sold" radius={[4, 4, 0, 0]}>
                        {data.topProducts.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center mt-10">No sales today yet.</p>}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recent transactions + alert cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <>
            <Card><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
            <Card><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentList.length ? recentList.map((txn: any) => (
                    <div key={txn.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Receipt className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          {txn.pending ? (
                            <p className="text-sm font-medium truncate">{txn.sale_number ?? "PENDING…"}</p>
                          ) : (
                            <a href={`/sales?search=${encodeURIComponent(txn.sale_number ?? "")}`} className="text-sm font-medium truncate underline underline-offset-2">{txn.sale_number ?? txn.id.slice(0, 8)}</a>
                          )}
                          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                            {txn.sold_at && mounted ? new Date(txn.sold_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (txn.sold_at ? new Date(txn.sold_at).toISOString().slice(11, 16) : "—")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={txn.pending ? "outline" : txn.status === "COMPLETED" ? "success" : "outline"} className="text-xs">{txn.pending ? "Pending offline" : txn.status}</Badge>
                        <p className="text-sm font-semibold">{fmt(txn.total)}</p>
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-6">No transactions today.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Needs Attention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <a href="/inventory" className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                  <span className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock items</span>
                  <Badge variant="warning" className="text-xs">{merged?.lowStock ?? 0}</Badge>
                </a>
                <a href="/inventory" className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                  <span className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-orange-500" /> Expiring within 30 days</span>
                  <Badge variant="outline" className="text-xs">{merged?.expiringSoon ?? 0}</Badge>
                </a>
                <a href="/inventory" className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                  <span className="flex items-center gap-2 text-sm"><XCircle className="h-4 w-4 text-red-500" /> Expired batches</span>
                  <Badge variant="destructive" className="text-xs">{merged?.expired ?? 0}</Badge>
                </a>
                <a href="/purchases" className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                  <span className="flex items-center gap-2 text-sm"><Truck className="h-4 w-4 text-sky-500" /> Pending purchase orders</span>
                  <Badge variant="outline" className="text-xs">{merged?.pendingPurchases ?? 0}</Badge>
                </a>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
