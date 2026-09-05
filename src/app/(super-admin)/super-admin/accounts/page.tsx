"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search } from "lucide-react";

type Registration = {
  id: string;
  reference: string;
  organization_id: string | null;
  business_name: string;
  business_type: string | null;
  owner_full_name: string;
  owner_email: string;
  owner_phone: string;
  location: string | null;
  status: string;
  rejection_reason: string | null;
  info_request_message: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  organizations?: {
    id: string;
    name: string;
    plan: string | null;
    status: string | null;
    trial_ends_at: string | null;
    paid_until: string | null;
  } | null;
};

type Counts = Record<string, number>;
type DialogKind = "approve" | "reject" | "suspend" | "activate" | "extend-trial" | "grant-full" | "approve-full" | null;

const STATUS_BADGE: Record<string, string> = {
  pending: "warning",
  active: "success",
  suspended: "destructive",
  rejected: "secondary",
  trial_expired: "destructive",
  cycle_expired: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  rejected: "Rejected",
  trial_expired: "Trial Expired",
  cycle_expired: "Cycle Expired",
};

function displayStatus(r: Registration): string {
  // Trial/paid-cycle expiry is tracked on the organization, not the registration row.
  if (r.organizations?.status === "trial_expired") {
    return r.organizations.plan === "full" ? "cycle_expired" : "trial_expired";
  }
  return r.status;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, json: j };
}

export default function SuperAdminAccountsPage() {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Registration[]>([]);
  const [total, setTotal] = React.useState(0);
  const [counts, setCounts] = React.useState<Counts>({ pending: 0, active: 0, suspended: 0, rejected: 0 });
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const perPage = 15;

  const [selected, setSelected] = React.useState<Registration | null>(null);
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [busy, setBusy] = React.useState<DialogKind>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [extendDays, setExtendDays] = React.useState(3);

  const load = React.useCallback(async (search = q, st = status, pg = page, showLoader = true) => {
    if (showLoader) setLoading(true);
    const params = new URLSearchParams({ page: String(pg), perPage: String(perPage) });
    if (search) params.set("q", search);
    if (st !== "all") params.set("status", st);
    const { json } = await api(`/api/super-admin/accounts?${params.toString()}`);
    if (json.error) {
      toast({ title: "Failed to load accounts", description: json.error, variant: "error" });
    } else {
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setCounts(json.counts ?? { pending: 0, active: 0, suspended: 0, rejected: 0 });
    }
    setLoading(false);
  }, [page, q, status, toast]);

  React.useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [q, status]);

  React.useEffect(() => {
    setLoading(true);
    load(q, status, page);
  }, [page, q, status, load]);

  const runAction = async (kind: Exclude<DialogKind, null>, id: string, body?: unknown) => {
    setBusy(kind);
    try {
      const { status: s, json } = await api(`/api/super-admin/accounts/${id}/${kind}`, "POST", body ?? {});
      if (s === 200 && json.ok) {
        let description = "Account updated.";
        if (kind === "approve" && json.login?.provisionalPassword) {
          description = `Temporary password for ${json.login.email}: ${json.login.provisionalPassword} (share it with the owner).`;
        } else if (kind === "approve") {
          description = `${json.login?.email ?? ""} can now sign in (3-day free trial starts now).`;
        } else if (kind === "extend-trial") {
          description = `${json.trial_days ?? "(unknown)"} more days added. The owner can sign in immediately.`;
        } else if (kind === "grant-full") {
          description = `Permanent access granted. ${json.email ?? ""}`;
        } else if (kind === "approve-full") {
          description = "Payment confirmed — this account can access MediFlow fully (no more trial deadline).";
        }
        toast({ title: "Done", description, variant: "success" });
        setSelected(null);
        setDialog(null);
        setRejectReason("");
        setExtendDays(3);
        load(q, status, page, true);
      } else {
        toast({ title: "Action failed", description: json.error || "Something went wrong.", variant: "error" });
      }
    } catch {
      toast({ title: "Action failed", description: "Network error. Please try again.", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account Management</h1>
        <p className="text-muted-foreground">Review MediFlow registrations and manage account access</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: "Pending Applications", value: counts.pending, cls: "text-amber-600" },
          { label: "Active Accounts", value: counts.active, cls: "text-green-600" },
          { label: "Trials Expired", value: counts.trial_expired, cls: "text-red-600" },
          { label: "Suspended Accounts", value: counts.suspended, cls: "text-orange-600" },
          { label: "Rejected Applications", value: counts.rejected, cls: "text-muted-foreground" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${c.cls}`}>{c.value ?? 0}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search accounts..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full md:w-[180px]">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="trial_expired">Trial Expired</option>
              <option value="suspended">Suspended</option>
              <option value="rejected">Rejected</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-lg font-medium">No accounts found</p>
              <p className="mt-1 text-sm">New MediFlow registrations will appear here when customers create accounts.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3 font-medium">Account</th>
                      <th className="p-3 font-medium">Business</th>
                      <th className="p-3 font-medium">Owner</th>
                      <th className="p-3 font-medium">Phone</th>
                      <th className="p-3 font-medium">Registered</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="p-3 font-mono text-xs">{r.reference}</td>
                        <td className="p-3 font-medium">{r.business_name}</td>
                        <td className="p-3">{r.owner_full_name}</td>
                        <td className="p-3">{r.owner_phone}</td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="p-3">
                          <Badge variant={STATUS_BADGE[displayStatus(r)] as any}>{STATUS_LABEL[displayStatus(r)]}</Badge>
                          {r.organizations?.plan === "trial" && <Badge variant="warning" className="ml-1">Trial</Badge>}
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelected(r)}>
                            {r.status === "pending" ? "Review" : "View"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y md:hidden">
                {rows.map((r) => (
                  <div key={r.id} className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{r.reference}</span>
                      <span className="flex items-center gap-1">
                        <Badge variant={STATUS_BADGE[displayStatus(r)] as any}>{STATUS_LABEL[displayStatus(r)]}</Badge>
                        {r.organizations?.plan === "trial" && <Badge variant="warning">Trial</Badge>}
                      </span>
                    </div>
                    <div className="text-sm font-medium">{r.business_name}</div>
                    <div className="text-xs text-muted-foreground">{r.owner_full_name} · {r.owner_phone}</div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setSelected(r)}>
                      {r.status === "pending" ? "Review" : "View"}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t p-4">
                <span className="text-sm text-muted-foreground">Total {total} · page {page}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={page * perPage >= total} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected && dialog === null && busy === null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.business_name}</SheetTitle>
                <SheetDescription>
                  {selected.reference} ·{" "}
                  <Badge variant={STATUS_BADGE[displayStatus(selected)] as any}>{STATUS_LABEL[displayStatus(selected)]}</Badge>
                  {selected.organizations?.plan === "trial" && <Badge variant="warning" className="ml-1">3-day free trial</Badge>}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Account Information</p>
                  <dl className="mt-2 space-y-1.5">
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Reference</dt><dd className="font-mono">{selected.reference}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Business type</dt><dd>{selected.business_type || "—"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Owner / Admin</dt><dd>{selected.owner_full_name}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Email</dt><dd className="break-all">{selected.owner_email}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Phone</dt><dd>{selected.owner_phone}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Location</dt><dd>{selected.location || "—"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Registered</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Plan</dt><dd>{selected.organizations?.plan === "trial" ? "Trial" : selected.organizations?.plan === "full" ? "Full" : "—"}</dd></div>
                    {selected.organizations?.plan === "trial"
                      ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Trial ends</dt><dd>{fmtDate(selected.organizations?.trial_ends_at)}</dd></div>
                      : <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Paid cycle ends</dt><dd>{fmtDate(selected.organizations?.paid_until)}</dd></div>}
                  </dl>
                </div>
                {selected.status === "rejected" && selected.rejection_reason && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Rejection reason</p>
                    <p className="mt-1">{selected.rejection_reason}</p>
                  </div>
                )}
                {selected.status === "pending" && (
                  <div className="rounded-md border border-amber-300/50 bg-amber-50 p-3 dark:bg-amber-950/20">
                    <p className="text-xs text-muted-foreground">
                      Contact {selected.owner_full_name} at {selected.owner_phone} to complete the offline payment, then
                      approve this account.
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                {selected.status === "pending" && (
                  <>
                    <Button className="flex-1" onClick={() => setDialog("approve")}>Approve Account</Button>
                    <Button variant="destructive" onClick={() => setDialog("reject")}>Reject</Button>
                  </>
                )}
                {selected.status === "active" && (
                  <Button variant="destructive" className="flex-1" onClick={() => setDialog("suspend")}>
                    Deactivate Account
                  </Button>
                )}
                {selected.status === "suspended" && (
                  <Button className="flex-1" onClick={() => setDialog("activate")}>Activate Account</Button>
                )}
                {(displayStatus(selected) === "trial_expired" || displayStatus(selected) === "cycle_expired") && (
                  <>
                    <Button className="flex-1" onClick={() => setDialog("approve-full")}>Approve</Button>
                    <Button variant="outline" className="flex-1" onClick={() => setDialog("extend-trial")}>Extend Trial</Button>
                    <Button variant="destructive" className="flex-1" onClick={() => setDialog("suspend")}>Suspend</Button>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={dialog === "approve"} onOpenChange={(o) => !o && setDialog(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve this MediFlow account?</DialogTitle>
              <DialogDescription>This will automatically create the pharmacy account and let the owner sign in.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Business:</span> {selected.business_name}</p>
              <p><span className="text-muted-foreground">Reference:</span> {selected.reference}</p>
              <p><span className="text-muted-foreground">Owner:</span> {selected.owner_full_name} ({selected.owner_email})</p>
              <p><span className="text-muted-foreground">Phone:</span> {selected.owner_phone}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy !== null}>Cancel</Button>
              <Button onClick={() => runAction("approve", selected.id)} disabled={busy !== null}>
                {busy === "approve" ? "Approving..." : "Approve Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={dialog === "reject"} onOpenChange={(o) => !o && setDialog(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject this registration?</DialogTitle>
              <DialogDescription>Please provide a reason for rejecting this registration.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Rejection reason</Label>
              <textarea
                id="reject-reason"
                className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Payment could not be verified"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy !== null}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={busy !== null || rejectReason.trim().length === 0}
                onClick={() => runAction("reject", selected.id, { reason: rejectReason })}
              >
                {busy === "reject" ? "Rejecting..." : "Reject Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={dialog === "suspend"} onOpenChange={(o) => !o && setDialog(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deactivate this account?</DialogTitle>
              <DialogDescription>
                {selected.business_name} ({selected.reference}) users will no longer be able to sign in. No data is deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy !== null}>Cancel</Button>
              <Button variant="destructive" onClick={() => runAction("suspend", selected.id)} disabled={busy !== null}>
                {busy === "suspend" ? "Deactivating..." : "Deactivate Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={dialog === "activate"} onOpenChange={(o) => !o && setDialog(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Activate this account?</DialogTitle>
              <DialogDescription>{selected.business_name} ({selected.reference}) users can sign in again.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy !== null}>Cancel</Button>
              <Button onClick={() => runAction("activate", selected.id)} disabled={busy !== null}>
                {busy === "activate" ? "Activating..." : "Activate Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={dialog === "extend-trial"} onOpenChange={(o) => !o && setDialog(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Extend trial period</DialogTitle>
              <DialogDescription>
                Re-open {selected.business_name}&apos;s full access for more days. They can sign in immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Business:</span> {selected.business_name} ({selected.reference})</p>
              <p><span className="text-muted-foreground">Owner:</span> {selected.owner_full_name} ({selected.owner_email})</p>
              <p><span className="text-muted-foreground">Contact:</span> {selected.owner_phone}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extend-days">Extra days</Label>
              <Input id="extend-days" type="number" min={1} max={90} value={extendDays} onChange={(e) => setExtendDays(Math.max(1, Math.min(90, Number(e.target.value) || 3)))} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy !== null}>Cancel</Button>
              <Button onClick={() => runAction("extend-trial", selected.id, { trial_days: extendDays })} disabled={busy !== null}>
                {busy === "extend-trial" ? "Extending..." : "Extend Trial"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={dialog === "approve-full"} onOpenChange={(o) => !o && setDialog(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve this account for a new cycle?</DialogTitle>
              <DialogDescription>
                Confirm payment and activate {selected.business_name} for the next monthly billing cycle — access lapses
                again when the cycle ends.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Business:</span> {selected.business_name} ({selected.reference})</p>
              <p><span className="text-muted-foreground">Owner:</span> {selected.owner_full_name} ({selected.owner_email})</p>
              <p><span className="text-muted-foreground">Contact:</span> {selected.owner_phone}</p>
              <p className="pt-1 text-xs text-muted-foreground">
                The owner is waiting on this approval — their screen reloads automatically the moment you click Approve.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy !== null}>Cancel</Button>
              <Button onClick={() => runAction("approve-full", selected.id)} disabled={busy !== null}>
                {busy === "approve-full" ? "Approving..." : "Approve Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={dialog === "grant-full"} onOpenChange={(o) => !o && setDialog(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant full access?</DialogTitle>
              <DialogDescription>
                {selected.business_name} will have permanent access — the trial deadline is removed until you deactivate the account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Business:</span> {selected.business_name} ({selected.reference})</p>
              <p><span className="text-muted-foreground">Owner:</span> {selected.owner_full_name} ({selected.owner_email})</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy !== null}>Cancel</Button>
              <Button onClick={() => runAction("grant-full", selected.id)} disabled={busy !== null}>
                {busy === "grant-full" ? "Granting..." : "Grant Full Access"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}