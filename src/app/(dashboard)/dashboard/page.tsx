"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  Layers,
  Wallet,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
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

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  accent?: string;
}

function KpiCard({ title, value, icon: Icon, description, trend, trendValue, accent }: KpiCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${accent ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && trendValue && (
          <p
            className={`mt-1 text-xs font-medium ${
              trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"
            }`}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

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

export default function DashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [greeting, setGreeting] = React.useState("Hello");
  const [userName, setUserName] = React.useState("");
  const [todayLabel, setTodayLabel] = React.useState("");
  const [data, setData] = React.useState<any>(null);

  React.useEffect(() => {
    const hour = new Date().getHours();
    let g = "Good evening";
    if (hour < 12) g = "Good morning";
    else if (hour < 18) g = "Good afternoon";
    setGreeting(g);
    setTodayLabel(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }));

    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: u }) => {
      if (u.user) setUserName(u.user.user_metadata?.full_name?.split(" ")[0] ?? u.user.email?.split("@")[0] ?? "");
    });

    fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const fmt = (n: number) => UGX.format(n ?? 0);
  const trendOf = (cur: number, prev: number) => {
    if (!prev || prev <= 0) return { trend: "neutral" as const, trendValue: "" };
    const pct = Math.abs(Math.round((((cur ?? 0) - prev) / prev) * 1000) / 10);
    return { trend: ((cur ?? 0) >= prev ? "up" : "down") as "up" | "down", trendValue: `${pct}% vs yesterday` };
  };

  const salesTrend = data ? trendOf(data.todaySales, data.todaySalesLast) : { trend: "neutral" as const, trendValue: "" };
  const txTrend = data ? trendOf(data.todayCount, data.todayCountLast) : { trend: "neutral" as const, trendValue: "" };
  const profitTrend = data ? trendOf(data.grossProfit, data.grossProfitLast) : { trend: "neutral" as const, trendValue: "" };
  const expTrend = data ? trendOf(data.expenses, data.expensesLast) : { trend: "neutral" as const, trendValue: "" };

  const kpis = data
    ? [
        { title: "Today's Sales", value: fmt(data.todaySales), icon: ShoppingCart, description: `${data.todayCount} transactions`, ...salesTrend },
        { title: "Transactions", value: String(data.todayCount ?? 0), icon: Receipt, description: "Completed today", ...txTrend },
        { title: "Gross Profit", value: fmt(data.grossProfit), icon: TrendingUp, description: "Today (net of discounts)", ...profitTrend },
        { title: "Net Profit", value: fmt(data.netProfit), icon: Wallet, description: "After expenses" },
        { title: "Expenses", value: fmt(data.expenses), icon: DollarSign, description: "Today", ...expTrend },
        { title: "Low Stock", value: String(data.lowStock ?? 0), icon: AlertTriangle, description: "Items below minimum", accent: "text-amber-500" },
        { title: "Expiring Soon", value: String(data.expiringSoon ?? 0), icon: Clock, description: "Within 30 days", accent: "text-orange-500" },
        { title: "Expired Items", value: String(data.expired ?? 0), icon: XCircle, description: "Need removal", accent: "text-red-500" },
      ]
    : [];

  const COLORS = ["#0f766e", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {loading ? <Skeleton className="h-8 w-64" /> : (
              <span>{greeting}{userName ? `, ${userName}` : ""}</span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">
            {loading ? <Skeleton className="h-4 w-48 mt-1" /> : (
              <span>{todayLabel} — here&apos;s what&apos;s happening with your pharmacy today.</span>
            )}
          </p>
        </div>
        {!loading && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => window.location.assign("/pos")}><ShoppingCart className="h-4 w-4 mr-1" /> New Sale</Button>
            <Button size="sm" variant="outline" onClick={() => window.location.assign("/purchases")}><Truck className="h-4 w-4 mr-1" /> Purchases</Button>
            <Button size="sm" variant="outline" onClick={() => window.location.assign("/products")}><PlusCircle className="h-4 w-4 mr-1" /> Add Product</Button>
            <Button size="sm" variant="outline" onClick={() => window.location.assign("/reports")}><BarChart3 className="h-4 w-4 mr-1" /> Reports</Button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading
          ? [...Array(8)].map((_, i) => <KpiCardSkeleton key={i} />)
          : kpis.map((kpi) => <KpiCard key={kpi.title} {...kpi} />)}
      </div>

      {/* Secondary strip */}
      {!loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-3 p-4">
            <Package className="h-4 w-4 text-primary" />
            <div className="text-sm">
              <span className="text-muted-foreground">Inventory value: </span>
              <span className="font-medium">{fmt(data.inventoryValue)}</span>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <Truck className="h-4 w-4 text-primary" />
            <div className="text-sm">
              <span className="text-muted-foreground">Pending purchases: </span>
              <a href="/purchases" className="font-medium underline underline-offset-2">{data.pendingPurchases ?? 0}</a>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <Layers className="h-4 w-4 text-primary" />
            <div className="text-sm">
              <span className="text-muted-foreground">Cash session: </span>
              <span className="font-medium">{data.openCashSession ? "Open" : "Closed"}</span>
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
                      <Tooltip formatter={(v: any, n: any) => n === "Revenue" ? fmt(Number(v)) : String(v)} />
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
                  {data?.recentTxns?.length ? data.recentTxns.map((txn: any) => (
                    <div key={txn.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Receipt className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{txn.sale_number ?? txn.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                            {txn.sold_at ? new Date(txn.sold_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{txn.status ?? "COMPLETED"}</Badge>
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
                  <Badge variant="warning" className="text-xs">{data.lowStock ?? 0}</Badge>
                </a>
                <a href="/inventory" className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                  <span className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-orange-500" /> Expiring within 30 days</span>
                  <Badge variant="outline" className="text-xs">{data.expiringSoon ?? 0}</Badge>
                </a>
                <a href="/inventory" className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                  <span className="flex items-center gap-2 text-sm"><XCircle className="h-4 w-4 text-red-500" /> Expired batches</span>
                  <Badge variant="destructive" className="text-xs">{data.expired ?? 0}</Badge>
                </a>
                <a href="/purchases" className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                  <span className="flex items-center gap-2 text-sm"><Truck className="h-4 w-4 text-sky-500" /> Pending purchase orders</span>
                  <Badge variant="outline" className="text-xs">{data.pendingPurchases ?? 0}</Badge>
                </a>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}