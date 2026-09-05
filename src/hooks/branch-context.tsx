"use client";

import * as React from "react";

export type BranchOption = { id: string; name: string; code: string };

type BranchContextValue = {
  branches: BranchOption[];
  branchIds: string[];
  currentBranchId: string | null;
  defaultBranchId: string | null;
  loading: boolean;
  setCurrentBranch: (id: string) => void;
};

const BranchContext = React.createContext<BranchContextValue | null>(null);

const STORAGE_KEY = "mediflow.active_branch";

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = React.useState<BranchOption[]>([]);
  const [branchIds, setBranchIds] = React.useState<string[]>([]);
  const [defaultBranchId, setDefaultBranchId] = React.useState<string | null>(null);
  const [currentBranchId, setCurrentBranchId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const me = await res.json();
        if (cancelled) return;
        const allowed: BranchOption[] = Array.isArray(me.branches) ? me.branches : [];
        const ids: string[] = Array.isArray(me.branch_ids) ? me.branch_ids : [];
        setBranches(allowed);
        setBranchIds(ids);
        const def = me.default_branch_id ?? ids[0] ?? null;
        setDefaultBranchId(def);

        // Prefer a previously persisted (still-authorized) selection, else the default branch.
        const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        const validStored = stored && ids.includes(stored) ? stored : null;
        setCurrentBranchId(validStored ?? def);
      } catch {
        /* non-blocking */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrentBranch = React.useCallback(
    (id: string) => {
      if (branchIds.length && !branchIds.includes(id)) return;
      setCurrentBranchId(id);
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
    },
    [branchIds],
  );

  return (
    <BranchContext.Provider
      value={{ branches, branchIds, currentBranchId, defaultBranchId, loading, setCurrentBranch }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = React.useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within a BranchProvider");
  return ctx;
}
