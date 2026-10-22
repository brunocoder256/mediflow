"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CalendarClock, CheckCircle2, History, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  EXPIRY_CORRECTION_PERMISSION,
  assessExpiryCorrection,
  formatExpiryDate,
  validateExpiryCorrection,
} from "@/lib/batch-expiry";
import type { BatchExpiryCorrection } from "@/lib/services/batch-expiry";

const API_URL = "/api/batches/expiry-correction";

export type ExpiryBatch = {
  id: string;
  batch_number?: string | null;
  expiry_date: string;
  quantity_available?: number | null;
  branch_id?: string | null;
  branches?: { name?: string | null } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: ExpiryBatch | null;
  productName?: string;
  productIdentifier?: string;
  canCorrect: boolean;
  isOnline: boolean;
  onCorrected: () => void;
};

function newOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function statusVariant(status: BatchExpiryCorrection["status"]) {
  if (status === "APPLIED") return "success" as const;
  if (status === "FAILED") return "warning" as const;
  return "destructive" as const;
}

export function BatchExpiryCorrectionDialog({
  open,
  onOpenChange,
  batch,
  productName,
  productIdentifier,
  canCorrect,
  isOnline,
  onCorrected,
}: Props) {
  const { toast } = useToast();
  const [newExpiryDate, setNewExpiryDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [history, setHistory] = React.useState<BatchExpiryCorrection[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const operationIdRef = React.useRef<string | null>(null);
  const historyRequestRef = React.useRef(0);

  const currentExpiry = batch?.expiry_date ?? "";
  const assessment = React.useMemo(() => {
    if (!batch || !newExpiryDate) return null;
    return assessExpiryCorrection(batch.expiry_date, newExpiryDate);
  }, [batch, newExpiryDate]);

  React.useEffect(() => {
    if (!open) return;
    setNewExpiryDate("");
    setReason("");
    setError(null);
    setConfirming(false);
    setSaving(false);
    historyRequestRef.current += 1;
    setHistory([]);
    setHistoryLoading(false);
    operationIdRef.current = null;
  }, [open, batch?.id]);

  React.useEffect(() => {
    operationIdRef.current = null;
    setError(null);
    setConfirming(false);
  }, [newExpiryDate, reason]);

  const loadHistory = React.useCallback(async () => {
    const requestId = ++historyRequestRef.current;
    if (!open || !batch?.id || !canCorrect || !isOnline) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}?batch_id=${encodeURIComponent(batch.id)}`);
      const json = await res.json().catch(() => ({}));
      if (requestId !== historyRequestRef.current) return;
      if (res.ok) setHistory((json.data ?? []) as BatchExpiryCorrection[]);
    } catch {
      // History is advisory; a failure must not block the correction form.
    } finally {
      if (requestId === historyRequestRef.current) setHistoryLoading(false);
    }
  }, [open, batch?.id, canCorrect, isOnline]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const canSubmit = isOnline && canCorrect && !saving && !!batch;

  function review() {
    if (!batch) return;
    const check = validateExpiryCorrection({
      oldExpiryDate: batch.expiry_date,
      newExpiryDate,
      reason,
    });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function submit() {
    if (!batch) return;

    const check = validateExpiryCorrection({
      oldExpiryDate: batch.expiry_date,
      newExpiryDate,
      reason,
    });
    if (!check.ok) {
      setError(check.error);
      setConfirming(false);
      return;
    }

    setError(null);
    setSaving(true);
    if (!operationIdRef.current) {
      operationIdRef.current = newOperationId();
    }

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: batch.id,
          expected_expiry_date: batch.expiry_date,
          new_expiry_date: newExpiryDate,
          reason,
          operation_id: operationIdRef.current,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.success === false) {
        const message = json.message || json.error || "Expiry correction failed";
        if (json.error_code === "STALE_BATCH") {
          toast({
            title: "Batch changed",
            description: message,
            variant: "warning",
          });
          onOpenChange(false);
          onCorrected();
          return;
        }
        setError(message);
        void loadHistory();
        return;
      }

      toast({
        title: json.duplicate ? "Correction already applied" : "Expiry date corrected",
        description: `${productName ? `${productName} · ` : ""}Batch ${batch.batch_number ?? batch.id.slice(0, 8)}: ${formatExpiryDate(
          json.old_expiry_date ?? currentExpiry,
        )} → ${formatExpiryDate(json.new_expiry_date ?? newExpiryDate)}`,
        variant: "success",
      });
      onOpenChange(false);
      onCorrected();
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(
        message === "Failed to fetch"
          ? "The correction could not be confirmed. Check your connection before retrying; the same operation will not be applied twice."
          : message || "Expiry correction failed",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Correct Batch Expiry Date
          </DialogTitle>
          <DialogDescription>
            Expiry changes are permission-controlled, require a reason, and are permanently audited. Historical sales are
            never rewritten.
          </DialogDescription>
        </DialogHeader>

        {!batch ? null : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Product:</span> <strong>{productName || "—"}</strong>
                  {productIdentifier ? <span className="text-muted-foreground"> · {productIdentifier}</span> : null}
                </p>
                <p>
                  <span className="text-muted-foreground">Batch:</span>{" "}
                  <span className="font-mono">{batch.batch_number || batch.id.slice(0, 8)}</span>
                  {batch.branches?.name ? <span className="text-muted-foreground"> · {batch.branches.name}</span> : null}
                </p>
                <p>
                  <span className="text-muted-foreground">Current expiry:</span>{" "}
                  <strong>{formatExpiryDate(currentExpiry)}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Available:</span>{" "}
                  <strong>{Number(batch.quantity_available ?? 0).toLocaleString()}</strong> units
                </p>
              </CardContent>
            </Card>

            {!canCorrect ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                You do not have permission to correct batch expiry dates (
                <code className="text-xs">{EXPIRY_CORRECTION_PERMISSION}</code>).
              </div>
            ) : !isOnline ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Expiry corrections require a live connection so the batch, audit trail and notifications stay consistent.
                Reconnect and try again.
              </div>
            ) : null}

            {confirming ? (
              <Card className="border-primary/40">
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium">Confirm this correction</p>
                  <p>
                    <span className="text-muted-foreground">Batch:</span>{" "}
                    <span className="font-mono">{batch.batch_number || batch.id.slice(0, 8)}</span> ·{" "}
                    <span className="text-muted-foreground">Product:</span> <strong>{productName || "—"}</strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Expiry:</span>{" "}
                    <strong>{formatExpiryDate(currentExpiry)}</strong> →{" "}
                    <strong>{formatExpiryDate(newExpiryDate)}</strong>
                    {assessment ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({assessment.daysShift > 0 ? "+" : ""}
                        {assessment.daysShift} days)
                      </span>
                    ) : null}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Reason:</span> {reason.trim()}
                  </p>
                  {assessment?.highImpact ? (
                    <p className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="h-4 w-4" /> High-impact change — flagged in the audit trail.
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    This immediately changes FEFO priority and expiry alerts. Historical sales are not modified.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="batch-new-expiry">New expiry date *</Label>
                  <Input
                    id="batch-new-expiry"
                    type="date"
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                    disabled={!canSubmit}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the date printed on the physical pack. This changes FEFO order immediately.
                  </p>
                </div>

                {assessment?.valid && !assessment.unchanged ? (
                  <div
                    className={`rounded-md border p-3 text-sm ${
                      assessment.highImpact
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-sky-200 bg-sky-50 text-sky-900"
                    }`}
                  >
                    <p className="flex items-center gap-2 font-medium">
                      {assessment.highImpact ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {assessment.daysShift > 0
                        ? `Extends expiry by ${assessment.daysShift} day(s)`
                        : `Shortens expiry by ${Math.abs(assessment.daysShift)} day(s)`}
                    </p>
                    {assessment.isPast ? (
                      <p className="mt-1 text-xs">
                        The new date is today or in the past. This batch will be treated as expired and excluded from FEFO
                        sales.
                      </p>
                    ) : null}
                    {assessment.highImpact ? (
                      <p className="mt-1 text-xs">
                        High-impact correction (expired/immediately expired date or more than 180 days). It is flagged in the
                        audit trail.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="batch-expiry-reason">Reason for correction *</Label>
                  <Textarea
                    id="batch-expiry-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Supplier confirmed a printing error on the pack; invoice shows 2027-04-30."
                    maxLength={500}
                    disabled={!canSubmit}
                  />
                  <p className="text-xs text-muted-foreground text-right">{reason.trim().length}/500</p>
                </div>
              </>
            )}

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              {confirming ? (
                <>
                  <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
                    Back
                  </Button>
                  <Button onClick={submit} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? "Applying..." : "Confirm correction"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={review} disabled={!canSubmit || !newExpiryDate || !reason.trim()}>
                    Review correction
                  </Button>
                </>
              )}
            </div>

            <div className="border-t pt-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" /> Correction history
              </p>
              {historyLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No previous corrections for this batch.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {history.map((row) => (
                    <div key={row.id} className="rounded border p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                        <span className="text-muted-foreground">
                          {new Date(row.requested_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1">
                        {formatExpiryDate(row.old_expiry_date)} → <strong>{formatExpiryDate(row.new_expiry_date)}</strong>
                        {row.high_impact ? <Badge variant="warning" className="ml-2">High impact</Badge> : null}
                      </p>
                      <p className="text-muted-foreground">
                        {row.requested_by_name || "Unknown user"}
                        {row.reason ? ` · ${row.reason}` : ""}
                      </p>
                      {row.error_code ? (
                        <p className="text-destructive">
                          {row.error_code}: {row.error_message}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
