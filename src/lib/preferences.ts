// Personal (per-user) interface preferences.
//
// These are deliberately kept separate from organization-wide business settings
// (country, operating currency, business locale, timezone). A user's language
// or display preferences never modify business configuration or financial data.
//
// Preferences are persisted both to the user's profile (durable, cross-device)
// and to localStorage (instant, offline-friendly).

import { DEFAULT_LANGUAGE, normalizeLanguage } from "./i18n/config";
import {
  resolveDateFormatId,
  resolveNumberFormatId,
  type DateFormatId,
  type NumberFormatId,
} from "./format";

export interface UserPreferences {
  /** Interface language code. */
  language: string;
  /** IANA time zone override (null → organization / default). */
  timezone: string | null;
  /** Date-format preference id (null → language/region default). */
  date_format: string | null;
  /** Number-format preference id (null → language/region default). */
  number_format: string | null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: DEFAULT_LANGUAGE,
  timezone: null,
  date_format: null,
  number_format: null,
};

export const PREFERENCES_STORAGE_KEY = "mediflow.preferences";

/** Normalize arbitrary persisted/partial data into a valid preference object. */
export function normalizePreferences(
  input: Partial<UserPreferences> | null | undefined,
): UserPreferences {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  return {
    language: normalizeLanguage(input?.language),
    timezone: str(input?.timezone),
    date_format: str(input?.date_format),
    number_format: str(input?.number_format),
  };
}

export function readPreferences(): UserPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return null;
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writePreferences(prefs: Partial<UserPreferences>): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...(readPreferences() ?? DEFAULT_PREFERENCES), ...prefs };
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalizePreferences(next)));
  } catch {
    /* ignore */
  }
}

export function clearPreferences(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Organization-wide regional settings (read-only here). */
export interface OrgRegionalSettings {
  country?: string | null;
  currency?: string | null;
  locale?: string | null;
  timezone?: string | null;
}

/** Fully-resolved formatting configuration for the current session. */
export interface EffectiveRegionalSettings {
  language: string;
  /** Organization operating currency (never converted). */
  currency: string;
  timezone: string;
  dateFormat: DateFormatId;
  numberFormat: NumberFormatId;
  locale: string;
}

export const DEFAULT_TIMEZONE = "Africa/Kampala";
export const DEFAULT_CURRENCY = "UGX";

/** Merge personal preferences with organization settings into effective values. */
export function resolveEffective(
  prefs: UserPreferences,
  org: OrgRegionalSettings = {},
): EffectiveRegionalSettings {
  const language = normalizeLanguage(prefs.language);
  return {
    language,
    currency: (org.currency || DEFAULT_CURRENCY).toUpperCase(),
    timezone: prefs.timezone || org.timezone || DEFAULT_TIMEZONE,
    dateFormat: resolveDateFormatId(prefs.date_format, language),
    numberFormat: resolveNumberFormatId(prefs.number_format, language),
    locale: org.locale || language,
  };
}

// A curated list of common IANA time zones for the time-zone selector. The
// stored value remains a full IANA identifier; this list only drives the UI.
export const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Use organization default" },
  { value: "Africa/Kampala", label: "Kampala (EAT, UTC+3)" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT, UTC+3)" },
  { value: "Africa/Dar_es_Salaam", label: "Dar es Salaam (EAT, UTC+3)" },
  { value: "Africa/Kigali", label: "Kigali (CAT, UTC+2)" },
  { value: "Africa/Lagos", label: "Lagos (WAT, UTC+1)" },
  { value: "Africa/Accra", label: "Accra (GMT, UTC+0)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST, UTC+2)" },
  { value: "Africa/Cairo", label: "Cairo (EET, UTC+2)" },
  { value: "Africa/Casablanca", label: "Casablanca (UTC+1)" },
  { value: "Africa/Dakar", label: "Dakar (GMT, UTC+0)" },
  { value: "Africa/Addis_Ababa", label: "Addis Ababa (EAT, UTC+3)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET, UTC+1)" },
  { value: "Europe/Berlin", label: "Berlin (CET, UTC+1)" },
  { value: "Europe/Istanbul", label: "Istanbul (UTC+3)" },
  { value: "Asia/Dubai", label: "Dubai (GST, UTC+4)" },
  { value: "Asia/Kolkata", label: "Kolkata (IST, UTC+5:30)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST, UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST, UTC+9)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT, UTC-3)" },
  { value: "Australia/Sydney", label: "Sydney (AET)" },
  { value: "UTC", label: "UTC" },
];
