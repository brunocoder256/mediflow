"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";

interface Purchase {
  id: string;
  date: string;
  supplier: string;
  items: number;
  total: number;
  status: "draft" | "ordered" | "partially-received" | "received" | "cancelled";
}

const mockPurchases: Purchase[] = [
  { id: "PO-001", date: "2026-09-01", supplier: "PharmaCorp", items: 15, total: 2500.00, status: "received" },
  { id: "PO-002", date: "2026-09-02", supplier: "MedSupply Inc", items: 8, total: 1200.00, status: "ordered" },
  { id: "PO-003", date: "2026-09-02", supplier: "HealthDistributors", items: 22, total: 4500.00, status: "partially-received" },
  { id: "PO-004", date: "2026-09-03", supplier: "PharmaCorp", items: 5, total: 800.00, status: "draft" },
  { id: "PO-005", date: "2026-08-30", supplier: "MedSupply Inc", items: 10, total: 1800.00, status: "cancelled" },
];

export default function PurchasesPage() {
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const tabs = [
    { id: "all", label: "All", count: mockPurchases.length },
    { id: "draft", label: "Draft", count: mockPurchases.filter((p) => p.status === "draft").length },
    { id: "ordered", label: "Ordered", count: mockPurchases.filter((p) => p.status === "ordered").length },
    { id: "partially-received", label: "Partially Received", count: mockPurchases.filter((p) => p.status === "partially-received").length },
    { id: "received", label: "Received", count: mockPurchases.filter((p) => p.status === "received").length },
    { id: "cancelled", label: "Cancelled", count: mockPurchases.filter((p) => p.status === "cancelled").length },
  ];

  const filteredPurchases = mockPurchases.filter((purchase) => {
    const matchesSearch =
      purchase.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      purchase.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab =
      activeTab === "all" || purchase.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const getStatusBadge = (status: Purchase["status"]) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "ordered":
        return <Badge variant="warning">Ordered</Badge>;
      case "partially-received":
        return <Badge>Partially Received</Badge>;
      case "received":
        return <Badge variant="success">Received</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchases</h1>
          <p className="text-muted-foreground">
            Manage purchase orders and track deliveries
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Purchase Order
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {tab.count}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {/* Search */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by PO number or supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : filteredPurchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">No purchase orders found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium">{purchase.id}</TableCell>
                        <TableCell className="text-muted-foreground">{purchase.date}</TableCell>
                        <TableCell>{purchase.supplier}</TableCell>
                        <TableCell className="text-right">{purchase.items}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${purchase.total.toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {purchase.status === "draft" && (
                              <>
                                <Button variant="ghost" size="icon">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}