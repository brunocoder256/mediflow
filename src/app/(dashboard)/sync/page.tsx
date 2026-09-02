"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cloud,
  CloudOff,
  Upload,
  Download,
  Wifi,
  WifiOff,
} from "lucide-react";

interface SyncItem {
  id: string;
  type: string;
  status: "synced" | "pending" | "error" | "syncing";
  lastSync: string;
  count: number;
}

const mockSyncItems: SyncItem[] = [
  { id: "1", type: "Products", status: "synced", lastSync: "2026-09-02 10:30", count: 245 },
  { id: "2", type: "Sales", status: "synced", lastSync: "2026-09-02 10:28", count: 1523 },
  { id: "3", type: "Inventory", status: "pending", lastSync: "2026-09-02 10:15", count: 245 },
  { id: "4", type: "Customers", status: "synced", lastSync: "2026-09-02 10:20", count: 89 },
  { id: "5", type: "Suppliers", status: "synced", lastSync: "2026-09-02 10:22", count: 12 },
  { id: "6", type: "Expenses", status: "error", lastSync: "2026-09-02 09:45", count: 45 },
];

export default function SyncPage() {
  const [loading, setLoading] = React.useState(true);
  const [isOnline, setIsOnline] = React.useState(true);
  const [lastFullSync, setLastFullSync] = React.useState("2026-09-02 10:30:15");

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const getStatusIcon = (status: SyncItem["status"]) => {
    switch (status) {
      case "synced":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "syncing":
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: SyncItem["status"]) => {
    switch (status) {
      case "synced":
        return <Badge variant="success">Synced</Badge>;
      case "syncing":
        return <Badge>Syncing</Badge>;
      case "pending":
        return <Badge variant="warning">Pending</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const syncedCount = mockSyncItems.filter((i) => i.status === "synced").length;
  const pendingCount = mockSyncItems.filter((i) => i.status === "pending").length;
  const errorCount = mockSyncItems.filter((i) => i.status === "error").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sync Center</h1>
          <p className="text-muted-foreground">
            Monitor and manage data synchronization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Push Data
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Pull Data
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection</CardTitle>
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Cloud className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">Online</span>
                </>
              ) : (
                <>
                  <CloudOff className="h-5 w-5 text-red-500" />
                  <span className="text-2xl font-bold">Offline</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Full Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{lastFullSync}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Synced Items</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{syncedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{errorCount + pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Items */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
          <CardDescription>Current synchronization status for all data types</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {mockSyncItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(item.status)}
                    <div>
                      <p className="font-medium">{item.type}</p>
                      <p className="text-sm text-muted-foreground">
                        Last sync: {item.lastSync} · {item.count} records
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(item.status)}
                    <Button variant="ghost" size="icon">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { time: "10:30:15", action: "Products sync completed", type: "success" },
                { time: "10:28:45", action: "Sales data pushed to cloud", type: "success" },
                { time: "10:15:20", action: "Inventory sync started", type: "info" },
                { time: "09:45:00", action: "Expenses sync failed - retrying", type: "error" },
                { time: "09:30:00", action: "Daily backup completed", type: "success" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground font-mono">{activity.time}</span>
                  <span
                    className={
                      activity.type === "error"
                        ? "text-red-600"
                        : activity.type === "success"
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }
                  >
                    {activity.action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}