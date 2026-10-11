"use client";

import * as React from "react";
import {
  flagEmoji,
  countryName,
  getCountry,
  normalizeCountryCode,
  type CountryRegion,
} from "@/lib/regions";

// Organization operating region (country) for the signed-in tenant.
//
// The authoritative value lives on `organizations.country` and is fetched from
// `/api/me`. It is also cached in localStorage so the flag renders instantly on
// load and while offline. Changing it is an organization-level action performed
// in Settings; this context only reflects it for presentation.

type RegionContextValue = {
  /** ISO 3166-1 alpha-2 code, or null when unknown. */
  countryCode: string | null;
  /** Flag emoji for the current country ("" when unknown). */
  flag: string;
  /** Human-readable country name ("" when unknown). */
  country: string;
  /** Suggested regional defaults for the current country, if supported. */
  region: CountryRegion | null;
  loading: boolean;
  /** Optimistically set the country locally (also updates the offline cache). */
  setCountryCode: (code: string | null) => void;
  /** Re-fetch the organization country from the server. */
  refresh: () => Promise<void>;
};

const RegionContext = React.createContext<RegionContextValue | null>(null);

const STORAGE_KEY = "mediflow.active_country";

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [countryCode, setCountryCodeState] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const setCountryCode = React.useCallback((code: string | null) => {
    const normalized = normalizeCountryCode(code);
    setCountryCodeState(normalized);
    try {
      if (normalized) window.localStorage.setItem(STORAGE_KEY, normalized);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore storage failures */
    }
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (!res.ok) return;
      const me = await res.json();
      const code = normalizeCountryCode(me?.country_code);
      if (code) setCountryCode(code);
    } catch {
      /* non-blocking — keep cached value */
    }
  }, [setCountryCode]);

  React.useEffect(() => {
    // Instant hydration from the offline cache.
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const cached = normalizeCountryCode(stored);
      if (cached) setCountryCodeState(cached);
    } catch {
      /* ignore */
    }
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const region = React.useMemo(() => getCountry(countryCode) ?? null, [countryCode]);
  const flag = React.useMemo(() => flagEmoji(countryCode), [countryCode]);
  const country = React.useMemo(() => countryName(countryCode), [countryCode]);

  const value = React.useMemo<RegionContextValue>(
    () => ({ countryCode, flag, country, region, loading, setCountryCode, refresh }),
    [countryCode, flag, country, region, loading, setCountryCode, refresh],
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion() {
  const ctx = React.useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within a RegionProvider");
  return ctx;
}
