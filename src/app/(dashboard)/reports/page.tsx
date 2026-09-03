"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  Download,
  Calendar,
  FileText,
} from "lucide-react";

export default function ReportsPage() {
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("sales");
  const [reportData, setReportData] = React.useState<any>(null);

  React.useEffect(() => {
    fetch(`/api/reports?type=${activeTab}`).then(r=>r.json()).then(d=>{ setReportData(d); setLoading(false); }).catch(()=>setLoading(false));
  }, [activeTab]);
  const handleTab = (id:string)=>{ setLoading(true); setActiveTab(id); };

  const tabs = [
    { id: "sales", label: "Sales Reports", icon: BarChart3 },
    { id: "financial", label: "Financial Reports", icon: TrendingUp },
    { id: "inventory", label: "Inventory Reports", icon: Package },
    { id: "product", label: "Product Performance", icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Analyze your business performance and trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Date Range
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sales">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} active={activeTab === tab.id} onClick={() => handleTab(tab.id)}>
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          {loading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-[400px] w-full" />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reportData ? new Intl.NumberFormat('en-UG',{style:'currency',currency:'UGX'}).format(reportData.aggregates?.totalRevenue ?? 0) : '—'}</div>
                    <p className="text-xs text-muted-foreground">{reportData?.aggregates?.count ?? 0} transactions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reportData ? new Intl.NumberFormat('en-UG',{style:'currency',currency:'UGX'}).format(reportData.aggregates?.avgOrder ?? 0) : '—'}</div>
                    <p className="text-xs text-muted-foreground">Avg per txn</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reportData?.aggregates?.count ?? 0}</div>
                    <p className="text-xs text-muted-foreground">Sales count</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Sales Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] flex items-center justify-center border rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Sales chart will be displayed here</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center py-12">
                Financial reports will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center py-12">
                Inventory reports will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center py-12">
                Product performance reports will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}