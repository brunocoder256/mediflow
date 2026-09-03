"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart,
  Receipt,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  XCircle,
} from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

function KpiCard({ title, value, icon: Icon, description, trend, trendValue }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && trendValue && (
          <p
            className={`text-xs ${
              trend === "up"
                ? "text-green-600"
                : trend === "down"
                ? "text-red-600"
                : "text-muted-foreground"
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

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">Chart will be displayed here</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentTransactionsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LowStockSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [greeting, setGreeting] = React.useState("");
  const [data, setData] = React.useState<any>(null);

  React.useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
    fetch("/api/dashboard").then(r=>r.json()).then(d=>{ setData(d); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  const fmt = (n:number, c='UGX') => new Intl.NumberFormat('en-UG',{style:'currency',currency:c,minimumFractionDigits:0}).format(n ?? 0);
  const kpis = data ? [
    { title: "Today's Sales", value: fmt(data.todaySales), icon: ShoppingCart, description: `${data.todayCount} transactions`, trend: "neutral" as const, trendValue: "" },
    { title: "Transactions", value: String(data.todayCount ?? 0), icon: Receipt, description: "Today", trend: "neutral" as const, trendValue: "" },
    { title: "Gross Profit", value: fmt(data.grossProfit), icon: TrendingUp, description: "Today", trend: "neutral" as const, trendValue: "" },
    { title: "Expenses", value: fmt(data.expenses), icon: DollarSign, description: "Today", trend: "neutral" as const, trendValue: "" },
    { title: "Low Stock", value: String(data.lowStock ?? 0), icon: AlertTriangle, description: "Items below minimum", trend: "neutral" as const, trendValue: "" },
    { title: "Expiring Soon", value: String(data.expiringSoon ?? 0), icon: Clock, description: "Within 30 days", trend: "neutral" as const, trendValue: "" },
    { title: "Expired Items", value: String(data.expired ?? 0), icon: XCircle, description: "Need removal", trend: "neutral" as const, trendValue: "" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {loading ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <span>{greeting}, Admin</span>
          )}
        </h1>
        <p className="text-muted-foreground">
          {loading ? (
            <Skeleton className="h-4 w-48 mt-1" />
          ) : (
            "Here's what's happening with your pharmacy today."
          )}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading
          ? [...Array(7)].map((_, i) => <KpiCardSkeleton key={i} />)
          : kpis.map((kpi) => (
              <KpiCard key={kpi.title} {...kpi} />
            ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full rounded-lg" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full rounded-lg" />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <ChartPlaceholder title="Sales Trend" />
            <ChartPlaceholder title="Top Products" />
          </>
        )}
      </div>

      {/* Tables Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <>
            <RecentTransactionsSkeleton />
            <LowStockSkeleton />
          </>
        ) : (
          <>
            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data?.recentTxns?.length ? data.recentTxns.map((txn:any)=>(
                    <div key={txn.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">S</div>
                        <div><p className="text-sm font-medium">{txn.id.slice(0,8)}</p><p className="text-xs text-muted-foreground">{fmt(txn.total)}</p></div>
                      </div>
                      <p className="text-sm font-medium">{fmt(txn.total)}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">{loading ? 'Loading...' : 'No transactions today'}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Products Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data?.topProducts?.length ? data.topProducts.map((p:any)=>(
                    <div key={p.product_id} className="flex items-center justify-between">
                      <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.product_id.slice(0,8)}</p></div>
                      <div className="text-right"><p className="text-sm font-medium">{p.qty} sold</p></div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">{loading ? 'Loading...' : 'No sales today'}</p>}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}