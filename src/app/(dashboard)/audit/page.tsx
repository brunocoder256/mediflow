"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Filter,
  FileText,
  User,
  ShoppingCart,
  Package,
  Settings,
  AlertTriangle,
} from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  type: "auth" | "sale" | "inventory" | "system" | "security";
}

const mockAuditLogs: AuditLog[] = [
  { id: "LOG-001", timestamp: "2026-09-02 10:30:15", user: "Admin", action: "LOGIN", entity: "User", entityId: "USR-001", details: "Successful login", type: "auth" },
  { id: "LOG-002", timestamp: "2026-09-02 10:32:45", user: "Admin", action: "CREATE", entity: "Product", entityId: "PRD-012", details: "Added new product: Vitamin C 1000mg", type: "inventory" },
  { id: "LOG-003", timestamp: "2026-09-02 10:45:20", user: "Cashier 1", action: "SALE", entity: "Sale", entityId: "SALE-006", details: "Completed sale for $125.00", type: "sale" },
  { id: "LOG-004", timestamp: "2026-09-02 11:00:00", user: "System", action: "BACKUP", entity: "System", entityId: "SYS-001", details: "Automated backup completed", type: "system" },
  { id: "LOG-005", timestamp: "2026-09-02 11:15:30", user: "Manager", action: "UPDATE", entity: "User", entityId: "USR-003", details: "Updated user role to Cashier", type: "security" },
  { id: "LOG-006", timestamp: "2026-09-02 11:30:45", user: "Inventory", action: "ADJUST", entity: "Stock", entityId: "STK-045", details: "Adjusted stock for Amoxicillin: +50 units", type: "inventory" },
  { id: "LOG-007", timestamp: "2026-09-02 12:00:00", user: "System", action: "ALERT", entity: "Inventory", entityId: "PRD-003", details: "Low stock alert: Ibuprofen 400mg (8 units remaining)", type: "system" },
];

export default function AuditPage() {
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const filteredLogs = mockAuditLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type: AuditLog["type"]) => {
    switch (type) {
      case "auth":
        return <Badge variant="secondary">Auth</Badge>;
      case "sale":
        return <Badge variant="success">Sale</Badge>;
      case "inventory":
        return <Badge variant="warning">Inventory</Badge>;
      case "system":
        return <Badge>System</Badge>;
      case "security":
        return <Badge variant="destructive">Security</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getTypeIcon = (type: AuditLog["type"]) => {
    switch (type) {
      case "auth":
        return <User className="h-4 w-4" />;
      case "sale":
        return <ShoppingCart className="h-4 w-4" />;
      case "inventory":
        return <Package className="h-4 w-4" />;
      case "system":
        return <Settings className="h-4 w-4" />;
      case "security":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all system activities and changes
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full md:w-[180px]"
            >
              <option value="all">All Types</option>
              <option value="auth">Authentication</option>
              <option value="sale">Sales</option>
              <option value="inventory">Inventory</option>
              <option value="system">System</option>
              <option value="security">Security</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">
                      {getTypeIcon(log.type)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {log.timestamp}
                    </TableCell>
                    <TableCell className="font-medium">{log.user}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {log.entity} ({log.entityId})
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {log.details}
                    </TableCell>
                    <TableCell>{getTypeBadge(log.type)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}