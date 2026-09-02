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

  React.useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good morning");
    } else if (hour < 18) {
      setGreeting("Good afternoon");
    } else {
      setGreeting("Good evening");
    }

    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const kpis = [
    {
      title: "Today's Sales",
      value: "$12,450.00",
      icon: ShoppingCart,
      description: "+12% from yesterday",
      trend: "up" as const,
      trendValue: "+$1,320.00",
    },
    {
      title: "Transactions",
      value: "48",
      icon: Receipt,
      description: "+8 from yesterday",
      trend: "up" as const,
      trendValue: "+8",
    },
    {
      title: "Gross Profit",
      value: "$4,230.00",
      icon: TrendingUp,
      description: "+5% from yesterday",
      trend: "up" as const,
      trendValue: "+$210.00",
    },
    {
      title: "Expenses",
      value: "$890.00",
      icon: DollarSign,
      description: "-3% from yesterday",
      trend: "down" as const,
      trendValue: "-$27.00",
    },
    {
      title: "Low Stock",
      value: "12",
      icon: AlertTriangle,
      description: "Items below minimum",
      trend: "neutral" as const,
      trendValue: "No change",
    },
    {
      title: "Expiring Soon",
      value: "8",
      icon: Clock,
      description: "Within 30 days",
      trend: "neutral" as const,
      trendValue: "No change",
    },
    {
      title: "Expired Items",
      value: "3",
      icon: XCircle,
      description: "Need removal",
      trend: "up" as const,
      trendValue: "+1",
    },
  ];

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
                  {[
                    { id: "TXN-001", customer: "John Doe", amount: "$125.00", time: "2 min ago" },
                    { id: "TXN-002", customer: "Jane Smith", amount: "$89.50", time: "15 min ago" },
                    { id: "TXN-003", customer: "Walk-in", amount: "$45.00", time: "32 min ago" },
                    { id: "TXN-004", customer: "Bob Wilson", amount: "$210.75", time: "1 hr ago" },
                    { id: "TXN-005", customer: "Alice Brown", amount: "$67.25", time: "2 hr ago" },
                  ].map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                          {txn.customer.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{txn.customer}</p>
                          <p className="text-xs text-muted-foreground">{txn.id} · {txn.time}</p>
                        </div>
                      </div>
                      <p className="text-sm font-medium">{txn.amount}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Low Stock Products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Low Stock Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "Amoxicillin 500mg", sku: "AMX-500", stock: 5, min: 20 },
                    { name: "Paracetamol 500mg", sku: "PCM-500", stock: 8, min: 50 },
                    { name: "Ibuprofen 400mg", sku: "IBU-400", stock: 12, min: 30 },
                    { name: "Cetirizine 10mg", sku: "CTZ-10", stock: 3, min: 25 },
                    { name: "Omeprazole 20mg", sku: "OMP-20", stock: 7, min: 15 },
                  ].map((product) => (
                    <div key={product.sku} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-600">{product.stock} left</p>
                        <p className="text-xs text-muted-foreground">Min: {product.min}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}