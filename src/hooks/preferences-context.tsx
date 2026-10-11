"use client";

import * as React from "react";
import {
  flagEmoji,
  countryName,
  getCountry,
  normalizeCountryCode,
} from "@/lib/regions";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  readPreferences,
  resolveEffective,
  writePreferences,
  type EffectiveRegionalSettings,
  type OrgRegionalSettings,
  type UserPreferences,
} from "@/lib/preferences";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import {
  formatCurrency as fmtCurrency,
  formatDate as fmtDate,
  formatDateTime as fmtDateTime,
  formatNumber as fmtNumber,
  formatPercent as fmtPercent,
  formatQuantity as fmtQuantity,
  formatTime as fmtTime,
  type FormatContext,
} from "@/lib/format";
import type { CountryRegion } from "@/lib/regions";

// Single source of truth for the signed-in user's regional + language context.
//
// It merges three layers:
//   • organization settings (country, operating currency, business locale,
//     timezone) — authoritative for financial display, never converted;
//   • the user's personal preferences (language, timezone, date/number format),
//     persisted to their profile and cached in localStorage for offline use;
//   • sensible defaults.
//
// Nothing here mutates business data or financial records.

type OrgState = OrgRegionalSettings & { countryCode: string | null };

type PreferencesContextValue = {
  // Organization region
  countryCode: string | null;
  flag: string;
  country: string;
  region: CountryRegion | null;
  orgCurrency: string;
  orgLocale: string | null;
  orgTimezone: string | null;
  // Personal preferences
  preferences: UserPreferences;
  language: string;
  // Effective (merged) settings
  effective: EffectiveRegionalSettings;
  // Translation
  t: Translator;
  // Locale-aware, currency-safe formatters
  formatCurrency: (amount: number) => string;
  formatNumber: (value: number) => string;
  formatDate: (value: string | number | Date) => string;
  formatTime: (value: string | number | Date) => string;
  formatDateTime: (value: string | number | Date) => string;
  formatPercent: (value: number) => string;
  formatQuantity: (value: number) => string;
  loading: boolean;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const PreferencesContext = React.createContext<PreferencesContextValue | null>(null);

/** Server value wins only when set; otherwise keep the local (offline) value. */
function mergeServerPreferences(server: UserPreferences, local: UserPreferences): UserPreferences {
  return {
    language: server.language || local.language,
    timezone: server.timezone ?? local.timezone,
    date_format: server.date_format ?? local.date_format,
    number_format: server.number_format ?? local.number_format,
  };
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = React.useState<UserPreferences>(
    () => readPreferences() ?? DEFAULT_PREFERENCES,
  );
  const [org, setOrg] = React.useState<OrgState>({ countryCode: null });
  const [loading, setLoading] = React.useState(true);
  const prefsRef = React.useRef(preferences);
  prefsRef.current = preferences;

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (!res.ok) return;
      const me = await res.json();

      const serverPrefs = normalizePreferences(
        me?.preferences ?? {
          language: me?.language,
          timezone: me?.timezone,
          date_format: me?.date_format,
          number_format: me?.number_format,
        },
      );
      const merged = mergeServerPreferences(serverPrefs, prefsRef.current);
      setPreferences(merged);
      writePreferences(merged);

      setOrg({
        countryCode: normalizeCountryCode(me?.country_code),
        currency: me?.org_currency ?? null,
        locale: me?.org_locale ?? null,
        timezone: me?.org_timezone ?? null,
      });
    } catch {
      /* non-blocking — keep cached values */
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const updatePreferences = React.useCallback(
    async (patch: Partial<UserPreferences>): Promise<boolean> => {
      const next = normalizePreferences({ ...prefsRef.current, ...patch });
      setPreferences(next);
      writePreferences(next);
      try {
        const res = await fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: next.language,
            timezone: next.timezone,
            date_format: next.date_format,
            number_format: next.number_format,
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const effective = React.useMemo(
    () =>
      resolveEffective(preferences, {
        country: org.countryCode,
        currency: org.currency,
        locale: org.locale,
        timezone: org.timezone,
      }),
    [preferences, org],
  );

  const t = React.useMemo(() => createTranslator(effective.language), [effective.language]);

  const ctx: FormatContext = React.useMemo(
    () => ({
      language: effective.language,
      currency: effective.currency,
      timezone: effective.timezone,
      dateFormat: effective.dateFormat,
      numberFormat: effective.numberFormat,
    }),
    [effective],
  );

  const value = React.useMemo<PreferencesContextValue>(() => {
    const bound = {
      formatCurrency: (n: number) => fmtCurrency(n, ctx),
      formatNumber: (n: number) => fmtNumber(n, ctx),
      formatDate: (v: string | number | Date) => fmtDate(v, ctx),
      formatTime: (v: string | number | Date) => fmtTime(v, ctx),
      formatDateTime: (v: string | number | Date) => fmtDateTime(v, ctx),
      formatPercent: (n: number) => fmtPercent(n, ctx),
      formatQuantity: (n: number) => fmtQuantity(n, ctx),
    };
    return {
      countryCode: org.countryCode ?? null,
      flag: flagEmoji(org.countryCode),
      country: countryName(org.countryCode),
      region: getCountry(org.countryCode) ?? null,
      orgCurrency: effective.currency,
      orgLocale: org.locale ?? null,
      orgTimezone: org.timezone ?? null,
      preferences,
      language: effective.language,
      effective,
      t,
      loading,
      updatePreferences,
      refresh,
      ...bound,
    };
  }, [org, preferences, effective, t, loading, updatePreferences, refresh, ctx]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

function usePreferencesContext(): PreferencesContextValue {
  const ctx = React.useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within a PreferencesProvider");
  return ctx;
}

/** Full regional + language + formatting context. */
export function usePreferences() {
  return usePreferencesContext();
}

/** Organization region (country + flag) — used by the topbar. */
export function useRegion() {
  const { countryCode, flag, country, region } = usePreferencesContext();
  return { countryCode, flag, country, region };
}

/** Translator only. */
export function useT() {
  return usePreferencesContext().t;
}

/** Locale-aware, currency-safe formatters bound to the current session. */
export function useFormat() {
  const {
    formatCurrency,
    formatNumber,
    formatDate,
    formatTime,
    formatDateTime,
    formatPercent,
    formatQuantity,
  } = usePreferencesContext();
  return {
    formatCurrency,
    formatNumber,
    formatDate,
    formatTime,
    formatDateTime,
    formatPercent,
    formatQuantity,
  };
}
