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
  Download,
  RefreshCw,
  AlertTriangle,
  Clock,
  XCircle,
  ArrowUpDown,
} from "lucide-react";

interface InventoryItem {
  id: string;
  product: string;
  batch: string;
  quantity: number;
  expiry: string;
  location: string;
  status: "in-stock" | "low-stock" | "expiring" | "expired";
}

const mockInventory: InventoryItem[] = [
  { id: "1", product: "Amoxicillin 500mg", batch: "BAT-001", quantity: 150, expiry: "2026-12-31", location: "Shelf A1", status: "in-stock" },
  { id: "2", product: "Paracetamol 500mg", batch: "BAT-002", quantity: 300, expiry: "2027-06-15", location: "Shelf A2", status: "in-stock" },
  { id: "3", product: "Ibuprofen 400mg", batch: "BAT-003", quantity: 8, expiry: "2026-03-20", location: "Shelf B1", status: "low-stock" },
  { id: "4", product: "Cetirizine 10mg", batch: "BAT-004", quantity: 3, expiry: "2026-02-28", location: "Shelf B2", status: "expiring" },
  { id: "5", product: "Omeprazole 20mg", batch: "BAT-005", quantity: 75, expiry: "2026-01-15", location: "Shelf C1", status: "expired" },
  { id: "6", product: "Metformin 500mg", batch: "BAT-006", quantity: 0, expiry: "2026-09-30", location: "Shelf C2", status: "expired" },
];

export default function InventoryPage() {
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [branchFilter, setBranchFilter] = React.useState("all");

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const tabs = [
    { id: "overview", label: "Stock Overview", icon: ArrowUpDown },
    { id: "low-stock", label: "Low Stock", icon: AlertTriangle, count: 2 },
    { id: "expiring", label: "Expiring", icon: Clock, count: 1 },
    { id: "expired", label: "Expired", icon: XCircle, count: 2 },
    { id: "movements", label: "Movements", icon: RefreshCw },
  ];

  const filteredInventory = mockInventory.filter((item) => {
    const matchesSearch =
      item.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.batch.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: InventoryItem["status"]) => {
    switch (status) {
      case "in-stock":
        return <Badge variant="success">In Stock</Badge>;
      case "low-stock":
        return <Badge variant="warning">Low Stock</Badge>;
      case "expiring":
        return <Badge variant="destructive">Expiring</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            Track and manage your inventory across all branches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
              {tab.count && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search products or batches..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full md:w-[180px]"
                >
                  <option value="all">All Categories</option>
                  <option value="antibiotics">Antibiotics</option>
                  <option value="analgesics">Analgesics</option>
                  <option value="anti-inflammatory">Anti-inflammatory</option>
                </Select>
                <Select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full md:w-[180px]"
                >
                  <option value="all">All Branches</option>
                  <option value="main">Main Store</option>
                  <option value="branch1">Branch 1</option>
                  <option value="branch2">Branch 2</option>
                </Select>
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
              ) : filteredInventory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">No inventory items found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="hidden md:table-cell">Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product}</TableCell>
                        <TableCell className="text-muted-foreground">{item.batch}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell>{item.expiry}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {item.location}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="low-stock" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center py-8">
                Low stock items will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center py-8">
                Expiring items will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expired" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center py-8">
                Expired items will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center py-8">
                Inventory movements will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}