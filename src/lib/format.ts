// Locale-aware formatting helpers.
//
// All user-facing dates, times, numbers and currency must be formatted through
// these helpers so the app consistently respects the organization's operating
// currency and the signed-in user's regional display preferences.
//
// Canonical values (ISO timestamps, stored amounts, quantities) are never
// transformed — only their *display* is localized. Currency is formatted in
// the organization's operating currency and is never converted here.

import { getLanguage } from "./i18n/config";

export type DateFormatId = "mdy" | "dmy" | "ymd" | "dmy_dot" | "long" | "medium";
export type NumberFormatId = "comma_dot" | "dot_comma" | "space_comma" | "indian";

export const DATE_FORMAT_OPTIONS: Array<{
  id: DateFormatId;
  label: string;
  sample: string;
}> = [
  { id: "dmy", label: "Day/Month/Year", sample: "31/12/2026" },
  { id: "mdy", label: "Month/Day/Year", sample: "12/31/2026" },
  { id: "ymd", label: "Year-Month-Day (ISO)", sample: "2026-12-31" },
  { id: "dmy_dot", label: "Day.Month.Year", sample: "31.12.2026" },
  { id: "long", label: "Day Month Year", sample: "31 December 2026" },
  { id: "medium", label: "Day Mon Year", sample: "31 Dec 2026" },
];

export const NUMBER_FORMAT_OPTIONS: Array<{
  id: NumberFormatId;
  label: string;
  sample: string;
}> = [
  { id: "comma_dot", label: "1,234.56", sample: "1,234.56" },
  { id: "dot_comma", label: "1.234,56", sample: "1.234,56" },
  { id: "space_comma", label: "1 234,56", sample: "1 234,56" },
  { id: "indian", label: "1,234.56 (Indian grouping)", sample: "1,23,456.78" },
];

const DATE_DEFS: Record<
  DateFormatId,
  { locale: string; options: Intl.DateTimeFormatOptions }
> = {
  mdy: { locale: "en-US", options: { day: "2-digit", month: "2-digit", year: "numeric" } },
  dmy: { locale: "en-GB", options: { day: "2-digit", month: "2-digit", year: "numeric" } },
  ymd: { locale: "sv-SE", options: { year: "numeric", month: "2-digit", day: "2-digit" } },
  dmy_dot: { locale: "de-DE", options: { day: "2-digit", month: "2-digit", year: "numeric" } },
  long: { locale: "en-GB", options: { day: "numeric", month: "long", year: "numeric" } },
  medium: { locale: "en-GB", options: { day: "numeric", month: "short", year: "numeric" } },
};

const NUMBER_LOCALES: Record<NumberFormatId, string> = {
  comma_dot: "en-US",
  dot_comma: "de-DE",
  space_comma: "fr-FR",
  indian: "en-IN",
};

export function isDateFormatId(value: unknown): value is DateFormatId {
  return typeof value === "string" && value in DATE_DEFS;
}

export function isNumberFormatId(value: unknown): value is NumberFormatId {
  return typeof value === "string" && value in NUMBER_LOCALES;
}

export function resolveDateFormatId(value: unknown, language?: string): DateFormatId {
  if (isDateFormatId(value)) return value;
  const lang = getLanguage(language ?? "en");
  return isDateFormatId(lang.defaultDateFormat) ? (lang.defaultDateFormat as DateFormatId) : "dmy";
}

export function resolveNumberFormatId(value: unknown, language?: string): NumberFormatId {
  if (isNumberFormatId(value)) return value;
  const lang = getLanguage(language ?? "en");
  return isNumberFormatId(lang.defaultNumberFormat)
    ? (lang.defaultNumberFormat as NumberFormatId)
    : "comma_dot";
}

/** All display options needed to format a value for the current user/org. */
export interface FormatContext {
  /** Interface language code (affects default format choice). */
  language?: string;
  /** Organization operating currency (ISO 4217). Never converted. */
  currency?: string;
  /** Effective IANA time zone for timestamps. */
  timezone?: string;
  /** Personal date-format preference. */
  dateFormat?: string | null;
  /** Personal number-format preference. */
  numberFormat?: string | null;
}

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | number | Date, ctx: FormatContext = {}): string {
  const d = toDate(value);
  if (!d) return "";
  const id = resolveDateFormatId(ctx.dateFormat, ctx.language);
  const { locale, options } = DATE_DEFS[id];
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: ctx.timezone || undefined }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatTime(value: string | number | Date, ctx: FormatContext = {}): string {
  const d = toDate(value);
  if (!d) return "";
  const id = resolveDateFormatId(ctx.dateFormat, ctx.language);
  const { locale } = DATE_DEFS[id];
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: ctx.timezone || undefined,
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

export function formatDateTime(value: string | number | Date, ctx: FormatContext = {}): string {
  const date = formatDate(value, ctx);
  const time = formatTime(value, ctx);
  return date && time ? `${date} ${time}` : date || time;
}

export function formatNumber(value: number, ctx: FormatContext = {}): string {
  const id = resolveNumberFormatId(ctx.numberFormat, ctx.language);
  const locale = NUMBER_LOCALES[id];
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/**
 * Format an amount in the organization's operating currency. The currency is
 * never converted — only its presentation (grouping, decimal separators,
 * symbol placement) follows the user's number-format preference.
 */
export function formatCurrency(
  amount: number,
  ctx: FormatContext = {},
): string {
  const id = resolveNumberFormatId(ctx.numberFormat, ctx.language);
  const locale = NUMBER_LOCALES[id];
  const currency = (ctx.currency || "UGX").toUpperCase();
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
    return `${currency} ${n}`;
  }
}

export function formatPercent(value: number, ctx: FormatContext = {}): string {
  const id = resolveNumberFormatId(ctx.numberFormat, ctx.language);
  const locale = NUMBER_LOCALES[id];
  if (!Number.isFinite(value)) return "";
  // Accept either 0–1 fractions or already-scaled percentages (0–100).
  const fraction = Math.abs(value) > 1 ? value / 100 : value;
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(fraction);
}

/** Format a physical quantity (tablets, vials, etc.) — never a currency. */
export function formatQuantity(value: number, ctx: FormatContext = {}): string {
  const id = resolveNumberFormatId(ctx.numberFormat, ctx.language);
  const locale = NUMBER_LOCALES[id];
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value);
}
