"use client";

import * as React from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Banknote,
  Wallet,
  MapPin,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  RefreshCw,
  ShoppingCart,
  LogIn,
} from "lucide-react";

type SessionRow = {
  id: string;
  register_id: string;
  branch_id: string;
  cashier_id: string;
  status: "OPEN" | "CLOSING" | "CLOSED" | "APPROVAL_REQUIRED" | "APPROVED";
  opening_float: number;
  expected_cash: number | null;
  closing_cash: number | null;
  cash_variance: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  cash_registers?: { name: string; code: string } | null;
  cashiers?: { full_name: string } | null;
  profiles?: { full_name: string } | null;
};

type Summary = {
  session: SessionRow;
  opening: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  refunds: number;
  expected: number;
  moves: any[];
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: "warning",
  CLOSING: "secondary",
  CLOSED: "secondary",
  APPROVAL_REQUIRED: "destructive",
  APPROVED: "success",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  CLOSING: "Closing",
  CLOSED: "Closed",
  APPROVAL_REQUIRED: "Needs Approval",
  APPROVED: "Approved",
};

function fmt(n: number | null | undefined) {
  return `UGX ${(Number(n) || 0).toLocaleString("en-UG")}`;
}

const STATUS = "status=OPEN,APPROVAL_REQUIRED,CLOSED,APPROVED,CLOSING";

export default function CashPage() {
  const { toast } = useToast();
  const [branches, setBranches] = React.useState<any[]>([]);
  const [branchId, setBranchId] = React.useState("");
  const [registers, setRegisters] = React.useState<any[]>([]);
  const [current, setCurrent] = React.useState<SessionRow | null>(null);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [history, setHistory] = React.useState<{ data: SessionRow[]; count: number }>({ data: [], count: 0 });
  const [page, setPage] = React.useState(1);
  const perPage = 15;
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<"open" | "close" | "move" | "approve" | "register" | null>(null);

  // Open session dialog
  const [showOpen, setShowOpen] = React.useState(false);
  const [openForm, setOpenForm] = React.useState({ register_id: "", opening_float: "", notes: "" });
  // Create register inline (when branch has none)
  const [showRegister, setShowRegister] = React.useState(false);
  const [regForm, setRegForm] = React.useState({ name: "", code: "" });
  // Close dialog
  const [showClose, setShowClose] = React.useState(false);
  const [closeForm, setCloseForm] = React.useState({ closing_cash: "", notes: "" });
  // Movement dialog
  const [showMove, setShowMove] = React.useState(false);
  const [moveType, setMoveType] = React.useState<"CASH_IN" | "CASH_OUT">("CASH_IN");
  const [moveForm, setMoveForm] = React.useState({ amount: "", reason: "" });
  // Approve dialog
  const [approveTarget, setApproveTarget] = React.useState<SessionRow | null>(null);

  const blast = (title: string, description?: string) => toast({ title, description, variant: "success" });
  const failToast = (title: string, description?: string) => toast({ title, description, variant: "error" });

  const refresh = React.useCallback(async (bId: string, showLoader = true) => {
    if (!bId) return;
    if (showLoader) setLoading(true);
    try {
      const [regRes, curRes, histRes] = await Promise.all([
        fetch(`/api/cash/registers?branch_id=${bId}`).then((r) => r.json()),
        fetch(`/api/cash/sessions?current=true&branch_id=${bId}`).then((r) => r.json()),
        fetch(`/api/cash/sessions?branch_id=${bId}&page=1&perPage=${perPage}`).then((r) => r.json()),
      ]);
      setRegisters(Array.isArray(regRes) ? regRes : regRes.data ?? []);
      setCurrent(curRes ?? null);
      if (curRes?.id) {
        const s = await fetch(`/api/cash/sessions?summary=${curRes.id}`).then((r) => r.json());
        setSummary(s ?? null);
      } else {
        setSummary(null);
      }
      setHistory({ data: histRes.data ?? [], count: histRes.count ?? 0 });
    } catch {
      setCurrent(null);
      setSummary(null);
      setHistory({ data: [], count: 0 });
    }
    setLoading(false);
  }, [perPage]);

  React.useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        const br = j.branches ?? [];
        setBranches(br);
        if (br[0]) setBranchId(br[0].id);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (branchId) refresh(branchId);
  }, [branchId, refresh]);

  React.useEffect(() => {
    if (branchId) {
      fetch(`/api/cash/sessions?branch_id=${branchId}&page=${page}&perPage=${perPage}`)
        .then((r) => r.json())
        .then((j) => setHistory({ data: j.data ?? [], count: j.count ?? 0 }))
        .catch(() => {});
    }
  }, [page, branchId, perPage]);

  const openSession = async () => {
    if (!branchId || !openForm.register_id) return;
    if (!openForm.opening_float || Number(openForm.opening_float) < 0) {
      failToast("Opening float required");
      return;
    }
    setBusy("open");
    try {
      const r = await fetch("/api/cash/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          register_id: openForm.register_id,
          branch_id: branchId,
          opening_float: Number(openForm.opening_float),
          notes: openForm.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to open session");
      blast(`Cash session opened`, `Register ${registers.find((x) => x.id === openForm.register_id)?.name ?? ""} · opening float ${fmt(Number(openForm.opening_float))}. You can now take cash sales in POS.`);
      setShowOpen(false);
      setOpenForm({ register_id: "", opening_float: "", notes: "" });
      refresh(branchId);
    } catch (e: any) {
      failToast("Could not open session", e.message);
    } finally {
      setBusy(null);
    }
  };

  const createRegister = async () => {
    if (!branchId || !regForm.name.trim() || !regForm.code.trim()) {
      failToast("Register name and code are required");
      return;
    }
    setBusy("register");
    try {
      const r = await fetch("/api/cash/registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch_id: branchId, name: regForm.name.trim(), code: regForm.code.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to create register");
      const created = await fetch(`/api/cash/registers?branch_id=${branchId}`).then((rr) => rr.json());
      setRegisters(Array.isArray(created) ? created : created.data ?? []);
      setOpenForm((f) => ({ ...f, register_id: j.id }));
      setShowRegister(false);
      setRegForm({ name: "", code: "" });
      blast("Cash register created", `${j.name} (${j.code})`);
    } catch (e: any) {
      failToast("Could not create register", e.message);
    } finally {
      setBusy(null);
    }
  };

  const closeSession = async () => {
    if (!current) return;
    if (!closeForm.closing_cash || Number(closeForm.closing_cash) < 0) {
      failToast("Closing cash amount is required");
      return;
    }
    setBusy("close");
    try {
      const r = await fetch("/api/cash/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          session_id: current.id,
          closing_cash: Number(closeForm.closing_cash),
          notes: closeForm.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to close session");
      setShowClose(false);
      setCloseForm({ closing_cash: "", notes: "" });
      if (j.needsApproval) {
        toast({
          title: "Session closed with variance",
          description: `Variance ${fmt(j.cash_variance)} exceeds the approval threshold — a manager must approve it.`,
          variant: "warning",
        });
      } else {
        blast("Cash session closed", `Closing cash ${fmt(Number(closeForm.closing_cash))} · variance ${fmt(j.cash_variance)}`);
      }
      refresh(branchId);
    } catch (e: any) {
      failToast("Could not close session", e.message);
    } finally {
      setBusy(null);
    }
  };

  const addMovement = async () => {
    if (!current) return;
    if (!moveForm.amount || Number(moveForm.amount) <= 0) {
      failToast("Amount is required");
      return;
    }
    setBusy("move");
    try {
      const r = await fetch("/api/cash/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "movement",
          session_id: current.id,
          type: moveType,
          amount: Number(moveForm.amount),
          direction: moveType === "CASH_IN" ? "IN" : "OUT",
          reason: moveForm.reason || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to record movement");
      setShowMove(false);
      setMoveForm({ amount: "", reason: "" });
      blast("Movement recorded", `${moveType} ${fmt(Number(moveForm.amount))}`);
      refresh(branchId);
    } catch (e: any) {
      failToast("Could not record movement", e.message);
    } finally {
      setBusy(null);
    }
  };

  const approveSession = async () => {
    if (!approveTarget) return;
    setBusy("approve");
    try {
      const r = await fetch("/api/cash/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", session_id: approveTarget.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to approve");
      blast(`Session ${approveTarget.id.slice(0, 8)} approved`);
      setApproveTarget(null);
      refresh(branchId);
    } catch (e: any) {
      failToast("Could not approve session", e.message);
    } finally {
      setBusy(null);
    }
  };

  const openBtnDisabled = busy !== null || !!current;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6" /> Cash Management
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />{" "}
            {branches.find((b) => b.id === branchId)?.name ?? "Select branch"} · Open a session, then take cash sales in POS.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-[220px]">
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={() => refresh(branchId)} disabled={!branchId}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" disabled={openBtnDisabled} onClick={() => setShowOpen(true)}>
            <LogIn className="h-4 w-4 mr-1" /> Open Cash Session
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : !current && !branches.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium">No branches available</p>
            <p className="text-sm">Set up a branch in Settings before opening a cash session.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current session */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b px-4 py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Current Session
              </CardTitle>
              {current ? (
                <Badge variant={STATUS_BADGE[current.status] as any}>{STATUS_LABEL[current.status]}</Badge>
              ) : (
                <Badge variant="destructive">No open session</Badge>
              )}
            </CardHeader>
            <CardContent className="p-4">
              {current ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="outline">{current.cash_registers?.name ?? "Register"}</Badge>
                    <span className="text-muted-foreground">Opened {new Date(current.opened_at).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Opening float</p>
                      <p className="text-lg font-bold">{fmt(summary?.opening ?? current.opening_float)}</p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Cash sales</p>
                      <p className="text-lg font-bold">{fmt(summary?.cashSales ?? 0)}</p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Expected cash now</p>
                      <p className="text-lg font-bold">{fmt(summary?.expected ?? 0)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Cash in</span><span className="font-medium">{fmt(summary?.cashIn ?? 0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cash out</span><span className="font-medium">{fmt(summary?.cashOut ?? 0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Refunds</span><span className="font-medium">{fmt(summary?.refunds ?? 0)}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setMoveType("CASH_IN"); setShowMove(true); }}>
                      <ArrowDownToLine className="h-4 w-4 mr-1" /> Cash In
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setMoveType("CASH_OUT"); setShowMove(true); }}>
                      <ArrowUpFromLine className="h-4 w-4 mr-1" /> Cash Out
                    </Button>
                    <Button className="flex-1 sm:flex-none" size="sm" variant="destructive" onClick={() => setShowClose(true)}>
                      Close Session
                    </Button>
                    <Link href="/pos" className="ml-auto">
                      <Button size="sm" variant="secondary">
                        <ShoppingCart className="h-4 w-4 mr-1" /> Go to POS
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-amber-700 flex items-center gap-2">
                    No active cash session for this branch. Open a session before cash sales.
                  </p>
                  <Button onClick={() => setShowOpen(true)}>
                    <LogIn className="h-4 w-4 mr-2" /> Open Cash Session
                  </Button>
                  {registers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No cash registers exist for this branch. You can create one when opening.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session history */}
          <Card>
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-base">Session History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.data.length === 0 ? (
                <div className="px-4 py-10 text-center text-muted-foreground">
                  <p>No cash sessions yet</p>
                  <p className="text-sm">Sessions you open and close will be listed here.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="p-3 font-medium">Opened</th>
                          <th className="p-3 font-medium">Register</th>
                          <th className="p-3 font-medium">Float</th>
                          <th className="p-3 font-medium">Expected</th>
                          <th className="p-3 font-medium">Closing</th>
                          <th className="p-3 font-medium">Variance</th>
                          <th className="p-3 font-medium">Status</th>
                          <th className="p-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.data.map((s) => (
                          <tr key={s.id} className="border-b">
                            <td className="p-3 text-xs">{new Date(s.opened_at).toLocaleString()}</td>
                            <td className="p-3">{s.cash_registers?.name ?? s.register_id.slice(0, 8)}</td>
                            <td className="p-3">{fmt(s.opening_float)}</td>
                            <td className="p-3">{s.status === "CLOSED" || s.status === "APPROVED" ? fmt(s.expected_cash) : "—"}</td>
                            <td className="p-3">{s.closing_cash != null ? fmt(s.closing_cash) : "—"}</td>
                            <td className="p-3">
                              {s.cash_variance != null ? (
                                <span className={Math.abs(s.cash_variance) > 0 ? "text-amber-600 font-medium" : ""}>{fmt(s.cash_variance)}</span>
                              ) : "—"}
                            </td>
                            <td className="p-3">
                              <Badge variant={STATUS_BADGE[s.status] as any}>{STATUS_LABEL[s.status]}</Badge>
                            </td>
                            <td className="p-3 text-right">
                              {s.status === "APPROVAL_REQUIRED" && (
                                <Button size="sm" variant="outline" onClick={() => setApproveTarget(s)}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {history.count > perPage && (
                    <div className="flex items-center justify-between border-t p-3">
                      <span className="text-sm text-muted-foreground">
                        {history.count} session{history.count !== 1 ? "s" : ""} · page {page}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                          Prev
                        </Button>
                        <Button variant="outline" size="sm" disabled={page * perPage >= history.count} onClick={() => setPage((p) => p + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Open session dialog */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Cash Session</DialogTitle>
            <DialogDescription>
              Cash sales require an active session. Enter the register and opening float.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="register">Cash Register</Label>
              {registers.length === 0 ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-amber-700 text-pretty">No registers yet — {branchId ? "create one" : "select a branch"} first.</p>
                  {branchId && (
                    <Button size="sm" variant="outline" onClick={() => setShowRegister(true)}>
                      <Plus className="h-4 w-4 mr-1" /> New Register
                    </Button>
                  )}
                </div>
              ) : (
                <Select id="register" value={openForm.register_id} onChange={(e) => setOpenForm((f) => ({ ...f, register_id: e.target.value }))}>
                  <option value="">Select register</option>
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="float">Opening Float (UGX)</Label>
              <Input
                id="float"
                type="number"
                placeholder="e.g. 100000"
                value={openForm.opening_float}
                onChange={(e) => setOpenForm((f) => ({ ...f, opening_float: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="open-notes">Notes (optional)</Label>
              <Input id="open-notes" placeholder="e.g. Morning shift" value={openForm.notes} onChange={(e) => setOpenForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpen(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button onClick={openSession} disabled={busy !== null || !openForm.register_id}>
              {busy === "open" ? "Opening..." : "Open Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create register dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Cash Register</DialogTitle>
            <DialogDescription>Add a register (e.g. POS 1) for {branches.find((b) => b.id === branchId)?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reg-name">Name</Label>
              <Input id="reg-name" placeholder="e.g. Main Counter" value={regForm.name} onChange={(e) => setRegForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-code">Code</Label>
              <Input id="reg-code" placeholder="e.g. MB01-CASH" value={regForm.code} onChange={(e) => setRegForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegister(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button onClick={createRegister} disabled={busy !== null}>
              {busy === "register" ? "Creating..." : "Create Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Cash Session</DialogTitle>
            <DialogDescription>
              Enter the actual cash counted. Variance above UGX 5,000 requires manager approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3 text-sm grid grid-cols-2 gap-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Expected</span><span className="font-medium">{fmt(summary?.expected ?? current?.expected_cash)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Float</span><span>{fmt(summary?.opening)}</span></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closing-cash">Closing Cash Counted (UGX)</Label>
              <Input id="closing-cash" type="number" placeholder="e.g. 284000" value={closeForm.closing_cash} onChange={(e) => setCloseForm((f) => ({ ...f, closing_cash: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-notes">Notes (optional)</Label>
              <Input id="close-notes" placeholder="Shift end" value={closeForm.notes} onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClose(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={closeSession} disabled={busy !== null || !closeForm.closing_cash}>
              {busy === "close" ? "Closing..." : "Close Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement dialog */}
      <Dialog open={showMove} onOpenChange={setShowMove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moveType === "CASH_IN" ? "Record Cash In" : "Record Cash Out"}</DialogTitle>
            <DialogDescription>Log money placed into or taken out of the till during this session.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="move-amount">Amount (UGX)</Label>
              <Input id="move-amount" type="number" value={moveForm.amount} onChange={(e) => setMoveForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="move-reason">Reason</Label>
              <Input id="move-reason" placeholder="e.g. Cash top-up / cash pick-up" value={moveForm.reason} onChange={(e) => setMoveForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMove(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              onClick={addMovement}
              disabled={busy !== null || !moveForm.amount || Number(moveForm.amount) <= 0}
              variant={moveType === "CASH_OUT" ? "destructive" : "default"}
            >
              {busy === "move" ? "Saving..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          {approveTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Approve cash session?</DialogTitle>
                <DialogDescription>
                  Session opened {new Date(approveTarget.opened_at).toLocaleString()} with variance{" "}
                  {fmt(approveTarget.cash_variance)}. This should be done by a manager.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border bg-muted/20 p-3 text-sm grid grid-cols-2 gap-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Opening float</span><span>{fmt(approveTarget.opening_float)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expected</span><span>{fmt(approveTarget.expected_cash)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Closing count</span><span>{fmt(approveTarget.closing_cash)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Variance</span><span className="font-medium">{fmt(approveTarget.cash_variance)}</span></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApproveTarget(null)} disabled={busy !== null}>
                  Cancel
                </Button>
                <Button onClick={approveSession} disabled={busy !== null}>
                  {busy === "approve" ? "Approving..." : "Approve Session"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}