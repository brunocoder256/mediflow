"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Search, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { PERMISSION_CATALOG } from "@/lib/permissions-catalog";

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  is_active: boolean;
  permissionCount: number;
  userCount: number;
  permission_ids?: string[];
};

type Perm = { id: string; code: string; name: string; description: string | null };

const MODULES = [
  "dashboard",
  "users",
  "products",
  "inventory",
  "purchases",
  "sales",
  "expenses",
  "customers",
  "suppliers",
  "reports",
  "settings",
  "audit",
];

export default function RolesPage() {
  const [loading, setLoading] = React.useState(true);
  const [roles, setRoles] = React.useState<RoleRow[]>([]);
  const [permissions, setPermissions] = React.useState<Perm[]>([]);
  const [q, setQ] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<RoleRow | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([
        fetch("/api/roles?with_permissions=1"),
        fetch("/api/permissions"),
      ]);
      if (rRes.status === 403) {
        setForbidden(true);
        return;
      }
      const rData = await rRes.json();
      const pData = await pRes.json();
      if (!rRes.ok) throw new Error(rData.error || "Failed to load roles");
      setRoles(Array.isArray(rData) ? rData : []);
      setPermissions(Array.isArray(pData) ? pData : []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "error" });
    }
    setLoading(false);
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = roles.filter(
    (r) =>
      !q ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const createRole = async (form: { name: string; description: string; permission_ids: string[] }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast({ title: "Success", description: "Role created" });
      setShowCreate(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async (id: string, patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast({ title: "Success", description: "Role updated" });
      setEditing(null);
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const duplicateRole = async (role: RoleRow) => {
    await createRole({
      name: `${role.name} (Copy)`,
      description: role.description ?? "",
      permission_ids: role.permission_ids ?? [],
    });
  };

  const deactivateRole = async (role: RoleRow) => {
    if (role.is_system_role) {
      toast({ title: "Error", description: "Cannot deactivate a system role", variant: "error" });
      return;
    }
    if (role.userCount > 0) {
      toast({ title: "Error", description: "Reassign users before deactivating this role", variant: "error" });
      return;
    }
    if (!confirm(`Deactivate role "${role.name}"?`)) return;
    await saveRole(role.id, { is_active: false });
  };

  if (forbidden) {
    return (
      <div className="py-24 text-center text-muted-foreground">You do not have permission to manage roles.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link href="/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Link>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">Define what each role can do across MediFlow modules</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search roles"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((role) => (
            <Card key={role.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{role.name}</span>
                    {role.is_system_role && <Badge variant="secondary">System</Badge>}
                    {!role.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{role.description || "No description"}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{role.permissionCount} permissions</span>
                    <span>{role.userCount} users</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setEditing(role)}>
                    Edit permissions
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => duplicateRole(role)} title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!role.is_system_role && (
                    <Button variant="ghost" size="sm" onClick={() => deactivateRole(role)}>
                      Deactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">No roles found</div>
          )}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>Custom organization role with selected permissions.</DialogDescription>
          </DialogHeader>
          <RoleEditor
            permissions={permissions}
            saving={saving}
            onCancel={() => setShowCreate(false)}
            onSave={(data) => createRole(data)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
            <DialogDescription>
              {editing?.is_system_role
                ? "System role — you can adjust permissions but not rename or deactivate."
                : "Update role details and permission matrix."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <RoleEditor
              permissions={permissions}
              initial={{
                name: editing.name,
                description: editing.description ?? "",
                permission_ids: editing.permission_ids ?? [],
              }}
              lockName={editing.is_system_role}
              saving={saving}
              onCancel={() => setEditing(null)}
              onSave={(data) =>
                saveRole(editing.id, {
                  name: editing.is_system_role ? undefined : data.name,
                  description: data.description,
                  permission_ids: data.permission_ids,
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleEditor({
  permissions,
  initial,
  lockName,
  saving,
  onSave,
  onCancel,
}: {
  permissions: Perm[];
  initial?: { name: string; description: string; permission_ids: string[] };
  lockName?: boolean;
  saving: boolean;
  onSave: (data: { name: string; description: string; permission_ids: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [selected, setSelected] = React.useState<Set<string>>(new Set(initial?.permission_ids ?? []));
  const [permSearch, setPermSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(MODULES));

  // Map codes → ids from DB permissions; fall back to catalog module grouping
  const codeToId = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of permissions) m.set(p.code, p.id);
    return m;
  }, [permissions]);

  const byModule = React.useMemo(() => {
    const groups: Record<string, Perm[]> = {};
    for (const p of permissions) {
      const mod = p.code.split(".")[0] || "other";
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(p);
    }
    // Ensure catalog modules appear even if empty
    for (const mod of MODULES) if (!groups[mod]) groups[mod] = [];
    return groups;
  }, [permissions]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectModule = (mod: string, all: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of byModule[mod] ?? []) {
        if (all) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  };

  const toggleExpand = (mod: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: name.trim(), description, permission_ids: [...selected] });
      }}
    >
      <div className="space-y-2">
        <Label>Role name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required disabled={lockName} />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Permissions ({selected.size})</Label>
          <Input
            placeholder="Search permission…"
            value={permSearch}
            onChange={(e) => setPermSearch(e.target.value)}
            className="max-w-xs h-8"
          />
        </div>
        <div className="border rounded-md max-h-80 overflow-y-auto divide-y">
          {Object.entries(byModule)
            .filter(([mod, perms]) => perms.length > 0 || MODULES.includes(mod))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mod, perms]) => {
              const visible = perms.filter(
                (p) =>
                  !permSearch ||
                  p.code.toLowerCase().includes(permSearch.toLowerCase()) ||
                  p.name.toLowerCase().includes(permSearch.toLowerCase()),
              );
              if (permSearch && visible.length === 0) return null;
              const open = expanded.has(mod);
              const allSelected = perms.length > 0 && perms.every((p) => selected.has(p.id));
              return (
                <div key={mod}>
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                    <button type="button" onClick={() => toggleExpand(mod)} className="p-0.5">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <span className="font-medium text-sm capitalize flex-1">{mod}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => selectModule(mod, !allSelected)}>
                      {allSelected ? "Clear" : "Select all"}
                    </Button>
                  </div>
                  {open &&
                    visible.map((p) => (
                      <label key={p.id} className="flex items-start gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-muted/30">
                        <input type="checkbox" className="mt-1" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                        <span>
                          <span className="font-medium">{p.name}</span>
                          <span className="block text-xs text-muted-foreground font-mono">{p.code}</span>
                        </span>
                      </label>
                    ))}
                </div>
              );
            })}
        </div>
        {permissions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No permissions in database. Catalog has {PERMISSION_CATALOG.length} definitions — run migrations / seed.
            {codeToId.size === 0 ? "" : ""}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !name.trim()} className="flex-1">
          {saving ? "Saving..." : "Save Role"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
