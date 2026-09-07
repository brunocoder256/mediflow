"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Eye, EyeOff, Shield, Ban, ShieldCheck, Activity, Unlock, Building2, KeyRound, AtSign, Phone, Users, Lock, Mail } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type UserRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email?: string | null;
  username?: string | null;
  avatar_url: string | null;
  is_active: boolean;
  status: string;
  last_login_at: string | null;
  created_at: string;
  organization_id: string;
  auth_user_id: string;
  default_branch_id: string | null;
  failed_login_attempts: number;
  roles: string[];
  role_ids?: string[];
  branch_ids?: string[];
};

type Branch = { id: string; name: string; code: string };
type RoleItem = { id: string; name: string; is_system_role: boolean };

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "secondary" },
  invited: { label: "Invited", variant: "outline" },
  pending_invitation: { label: "Invited", variant: "outline" },
  suspended: { label: "Suspended", variant: "destructive" },
  locked: { label: "Locked", variant: "destructive" },
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function UsersPage() {
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [roles, setRoles] = React.useState<RoleItem[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [showAdd, setShowAdd] = React.useState(false);
  const [showDetail, setShowDetail] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<UserRow | null>(null);
  const [filterRole, setFilterRole] = React.useState("all");
  const [filterStatus, setFilterStatus] = React.useState("all");
  const [filterBranch, setFilterBranch] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [forbidden, setForbidden] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const perPage = 10;
  const { toast } = useToast();

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
      if (q) params.set("search", q);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterRole !== "all") params.set("role_id", filterRole);
      if (filterBranch !== "all") params.set("branch_id", filterBranch);
      const res = await fetch(`/api/users?${params}`);
      const json = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        setUsers([]);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Failed to load users");
      const list = Array.isArray(json) ? json : (json.data ?? []);
      setUsers(list);
      setTotal(json.count ?? list.length);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load users", variant: "error" });
    }
    try {
      const [rRes, bRes] = await Promise.all([fetch("/api/roles"), fetch("/api/branches")]);
      const rData = await rRes.json();
      const bData = await bRes.json();
      setRoles(Array.isArray(rData) ? rData : []);
      setBranches(Array.isArray(bData) ? bData : bData?.data ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [q, page, filterStatus, filterRole, filterBranch, toast]);

  React.useEffect(() => {
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [fetchData]);

  const activeCount = users.filter((u) => u.status === "active").length;
  const inactiveCount = users.filter((u) => u.status === "inactive" || u.status === "suspended").length;
  const invitedCount = users.filter((u) => u.status === "invited" || u.status === "pending_invitation").length;
  const lockedCount = users.filter((u) => u.status === "locked").length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const createUser = async (form: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Unable to create user");
      toast({
        title: "Success",
        description: `${form.email} can now sign in with the password you set.`,
        variant: "success",
      });
      setShowAdd(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const patchUser = async (userId: string, patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      toast({ title: "Success", description: "User updated" });
      fetchData();
      return true;
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Deactivate this user? Historical records will be preserved.")) return;
    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast({ title: "Success", description: "User deactivated" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "error" });
    }
  };

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Shield className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground max-w-md">You do not have permission to view users. Ask an administrator for users.view access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Users} title="Users" description="Manage team members, roles, and branch access">
        <Link
          href="/users/roles"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
        >
          <ShieldCheck className="h-4 w-4" />
          Roles
        </Link>
        <Link
          href="/audit"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
        >
          <Activity className="h-4 w-4" />
          Activity
        </Link>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Users} title="Total Users" value={total}/>
        <StatCard icon={ShieldCheck} title="Active" value={<span className="text-green-600">{activeCount}</span>}/>
        <StatCard icon={Ban} title="Inactive" value={<span className="text-muted-foreground">{inactiveCount}</span>}/>
        <StatCard icon={Mail} title="Invited" value={<span className="text-orange-600">{invitedCount}</span>}/>
        <StatCard icon={Lock} title="Locked" value={<span className="text-red-600">{lockedCount}</span>}/>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or username"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-[160px]"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.is_system_role ? " (System)" : ""}
                </option>
              ))}
            </Select>
            <Select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
              <option value="locked">Locked</option>
            </Select>
            <Select
              value={filterBranch}
              onChange={(e) => {
                setFilterBranch(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-[160px]"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <EmptyState icon={Users} title="No users found" description="Create your first team member — they can sign in immediately with the email and password you set."/>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} className="cursor-pointer" onClick={() => { setSelectedUser(u); setShowDetail(true); }}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{initials(u.full_name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{u.full_name}</div>
                              <div className="text-xs text-muted-foreground">{u.email || u.phone || "—"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.roles.length ? (
                            u.roles.map((r) => (
                              <Badge key={r} variant="secondary" className="mr-1">
                                {r}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">No role</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.default_branch_id ? branches.find((b) => b.id === u.default_branch_id)?.name ?? "—" : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig[u.status]?.variant ?? "default"}>
                            {statusConfig[u.status]?.label ?? u.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(u);
                                setShowDetail(true);
                              }}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {u.status === "locked" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => patchUser(u.id, { status: "active", unlock: true })}
                                title="Unlock"
                              >
                                <Unlock className="h-4 w-4 text-green-600" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => patchUser(u.id, { status: u.status === "active" ? "inactive" : "active" })}
                                title={u.status === "active" ? "Deactivate" : "Activate"}
                              >
                                {u.status === "active" ? (
                                  <Ban className="h-4 w-4 text-orange-600" />
                                ) : (
                                  <Shield className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => deleteUser(u.id)} title="Deactivate">
                              <Ban className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} · {total} users
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                      Prev
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No users found"/>
        ) : (
          users.map((u) => (
            <Card
              key={u.id}
              className="cursor-pointer"
              onClick={() => {
                setSelectedUser(u);
                setShowDetail(true);
              }}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{initials(u.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="font-medium truncate">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email || u.phone || "—"}</div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {u.roles.map((r) => (
                      <Badge key={r} variant="secondary">
                        {r}
                      </Badge>
                    ))}
                    <Badge variant={statusConfig[u.status]?.variant ?? "default"}>
                      {statusConfig[u.status]?.label ?? u.status}
                    </Badge>
                    {u.default_branch_id && (
                      <Badge variant="outline">{branches.find((b) => b.id === u.default_branch_id)?.name}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Set up a team member account. They can sign in immediately with the email and password you set — access is
              scoped to their role and branch.
            </DialogDescription>
          </DialogHeader>
          <AddUserForm roles={roles} branches={branches} loading={saving} onSubmit={createUser} onCancel={() => setShowAdd(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <UserDetail
              userId={selectedUser.id}
              roles={roles}
              branches={branches}
              saving={saving}
              onClose={() => setShowDetail(false)}
              onPatch={patchUser}
              onDeactivate={deleteUser}
              onRefresh={fetchData}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddUserForm({
  roles,
  branches,
  loading,
  onSubmit,
  onCancel,
}: {
  roles: RoleItem[];
  branches: Branch[];
  loading: boolean;
  onSubmit: (form: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState({
    full_name: "",
    email: "",
    username: "",
    phone: "",
    role_id: "",
    branch_id: "",
    password: "",
    confirmPassword: "",
  });
  const [extraBranches, setExtraBranches] = React.useState<string[]>([]);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [orgName, setOrgName] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.organization?.name) setOrgName(j.organization.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-suggest a username from the email's local part unless the user typed one.
      if (key === "email" && (!prev.username.trim() || prev.username === prev.email.split("@")[0])) {
        next.username = value.split("@")[0].replace(/[^a-z0-9._-]/gi, "");
      }
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [key]: "", username: prev.username ?? "" }));
  };

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.full_name.trim().length < 2) errs.full_name = "Full name is required";
    if (!isEmail(form.email.trim())) errs.email = "Enter a valid email address";
    if (!form.role_id) errs.role_id = "Select a role";
    if (!form.branch_id) errs.branch_id = "Select a branch — data access is scoped to branches";
    const p = form.password;
    if (p.length < 8) errs.password = "At least 8 characters";
    else {
      if (!/[a-z]/.test(p)) errs.password = "Include a lowercase letter";
      if (!/[A-Z]/.test(p)) errs.password = (errs.password ? errs.password + " " : "") + "Include an uppercase letter";
      if (!/[0-9]/.test(p)) errs.password = (errs.password ? errs.password + " " : "") + "Include a number";
    }
    if (form.confirmPassword !== p) errs.confirmPassword = "Passwords do not match";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    const branch_ids = [...new Set([form.branch_id, ...extraBranches].filter(Boolean))];
    await onSubmit({
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      username: form.username.trim() || form.email.split("@")[0],
      phone: form.phone.trim() || null,
      role_id: form.role_id,
      default_branch_id: form.branch_id,
      branch_ids,
      password: p,
    });
  };

  const strength = (p: string) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    return score;
  };
  const strengthMeta = [
    { label: "Too short", className: "bg-muted" },
    { label: "Weak", className: "bg-red-500" },
    { label: "Fair", className: "bg-amber-500" },
    { label: "Good", className: "bg-lime-500" },
    { label: "Strong", className: "bg-green-600" },
  ];
  const score = strength(form.password);

  const error = (key: string) =>
    fieldErrors[key] ? <p className="text-sm text-[var(--destructive)]">{fieldErrors[key]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Org context — always the actor's own organization, never client-supplied */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organization</p>
          <p className="truncate font-semibold text-foreground">{orgName || "Your pharmacy"}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name *</Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={set("full_name")}
            placeholder="Jane Doe"
            autoComplete="off"
          />
          {error("full_name")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="jane@pharmacy.com"
            autoComplete="off"
          />
          {error("email")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="username"
              value={form.username}
              onChange={set("username")}
              placeholder="jane"
              autoComplete="off"
              className="pl-9"
            />
          </div>
          {error("username")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+256 700 000 000"
              autoComplete="off"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role">Role *</Label>
          <Select
            id="role"
            value={form.role_id}
            onChange={(e) => {
              setForm({ ...form, role_id: e.target.value });
              setFieldErrors((prev) => ({ ...prev, role_id: "" }));
            }}
            required
          >
            <option value="">Select role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.is_system_role ? " (System)" : ""}
              </option>
            ))}
          </Select>
          {error("role_id")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch">Default branch *</Label>
          <Select
            id="branch"
            value={form.branch_id}
            onChange={(e) => {
              setForm({ ...form, branch_id: e.target.value });
              setFieldErrors((prev) => ({ ...prev, branch_id: "" }));
            }}
            required
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          {branches.length === 0 && (
            <p className="text-sm text-muted-foreground">No branches yet — create one in Settings.</p>
          )}
          {error("branch_id")}
        </div>
      </div>

      {branches.length > 1 && form.branch_id && (
        <div className="space-y-2">
          <Label>Additional branches</Label>
          <div className="flex flex-wrap gap-2">
            {branches
              .filter((b) => b.id !== form.branch_id)
              .map((b) => {
                const checked = extraBranches.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm transition-colors hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setExtraBranches((prev) => (checked ? prev.filter((id) => id !== b.id) : [...prev, b.id]))
                      }
                    />
                    {b.name}
                  </label>
                );
              })}
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" />
          Sign-in credentials
          <span className="font-normal text-muted-foreground">— the user signs in with this email + password.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder="Min 8 chars, A–z, 0–9"
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.password && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-1.5 flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-full flex-1 rounded-full transition-colors ${
                          i < score ? strengthMeta[score].className : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="w-16 text-right text-xs text-muted-foreground">{strengthMeta[score].label}</span>
                </div>
              </div>
            )}
            {error("password")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password *</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Re-type password"
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error("confirmPassword")}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Creating..." : "Create User"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function UserDetail({
  userId,
  roles,
  branches,
  saving,
  onClose,
  onPatch,
  onDeactivate,
  onRefresh,
}: {
  userId: string;
  roles: RoleItem[];
  branches: Branch[];
  saving: boolean;
  onClose: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  onDeactivate: (id: string) => void;
  onRefresh: () => void;
}) {
  const [detail, setDetail] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [roleId, setRoleId] = React.useState("");
  const [branchIds, setBranchIds] = React.useState<string[]>([]);
  const [defaultBranch, setDefaultBranch] = React.useState("");
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?id=${userId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setDetail(j);
      setRoleId(j.role_ids?.[0] ?? "");
      setBranchIds(j.branch_ids ?? []);
      setDefaultBranch(j.default_branch_id ?? "");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "error" });
    }
    setLoading(false);
  }, [userId, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const saveAccess = async () => {
    const ok = await onPatch(userId, {
      role_id: roleId || null,
      branch_ids: branchIds,
      default_branch_id: defaultBranch || branchIds[0] || null,
    });
    if (ok) {
      onRefresh();
      load();
    }
  };

  if (loading || !detail) {
    return (
      <div className="space-y-3 p-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{initials(detail.full_name)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-semibold text-lg">{detail.full_name}</div>
          <div className="text-sm text-muted-foreground">{detail.email || detail.phone || "No contact"}</div>
          <Badge variant={statusConfig[detail.status]?.variant ?? "default"} className="mt-1">
            {statusConfig[detail.status]?.label ?? detail.status}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 text-sm pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-muted-foreground">Email</span>
              <div>{detail.email || "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Phone</span>
              <div>{detail.phone || "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Role(s)</span>
              <div>{detail.roles?.join(", ") || "None"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Default branch</span>
              <div>{branches.find((b) => b.id === detail.default_branch_id)?.name || "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Last login</span>
              <div>{detail.last_login_at ? new Date(detail.last_login_at).toLocaleString() : "Never"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <div>{new Date(detail.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="access" className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">No role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Authorized branches</Label>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => {
                const checked = branchIds.includes(b.id);
                return (
                  <label key={b.id} className="flex items-center gap-2 text-sm border rounded-md px-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setBranchIds((prev) => (checked ? prev.filter((id) => id !== b.id) : [...prev, b.id]))
                      }
                    />
                    {b.name}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Default branch</Label>
            <Select value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)}>
              <option value="">Select</option>
              {branches
                .filter((b) => branchIds.includes(b.id) || !branchIds.length)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </Select>
          </div>
          <Button onClick={saveAccess} disabled={saving}>
            {saving ? "Saving..." : "Save access"}
          </Button>
        </TabsContent>

        <TabsContent value="permissions" className="pt-2">
          <p className="text-sm text-muted-foreground mb-2">Effective permissions from role (+ overrides).</p>
          <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
            {(detail.permissions ?? []).length === 0 ? (
              <span className="text-sm text-muted-foreground">No permissions</span>
            ) : (
              detail.permissions.map((p: string) => (
                <Badge key={p} variant="outline" className="font-mono text-xs">
                  {p}
                </Badge>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="pt-2">
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {(detail.activity ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              detail.activity.map((a: any) => (
                <div key={a.id} className="text-xs border rounded-md p-2">
                  <div className="flex justify-between gap-2">
                    <Badge variant="outline">{a.action}</Badge>
                    <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {a.entity_type} {a.entity_id?.slice?.(0, 8) ?? ""}
                  </div>
                </div>
              ))
            )}
          </div>
          <Link href="/audit" className="text-sm text-primary underline-offset-4 hover:underline">
            Open full audit log
          </Link>
        </TabsContent>

        <TabsContent value="security" className="space-y-3 pt-2">
          <div className="text-sm grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Failed logins</span>
              <div>{detail.failed_login_attempts ?? 0}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Locked until</span>
              <div>{detail.locked_until ? new Date(detail.locked_until).toLocaleString() : "—"}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.status === "active" ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={saving}
                onClick={async () => {
                  if (!confirm("Deactivate this user?")) return;
                  await onPatch(userId, { status: "inactive" });
                  onRefresh();
                  onClose();
                }}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={saving}
                onClick={async () => {
                  await onPatch(userId, { status: "active" });
                  onRefresh();
                }}
              >
                Activate
              </Button>
            )}
            {detail.status === "locked" && (
              <Button size="sm" disabled={saving} onClick={() => onPatch(userId, { status: "active", unlock: true })}>
                Unlock
              </Button>
            )}
            {detail.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={async () => {
                  if (!confirm("Suspend this user?")) return;
                  await onPatch(userId, { status: "suspended", suspended_reason: "Suspended by administrator" });
                  onRefresh();
                }}
              >
                Suspend
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onDeactivate(userId)}>
              Soft-deactivate
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
