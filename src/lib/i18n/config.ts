// Internationalization configuration for MediFlow IQ.
//
// MediFlow ships with English as the fully-supported interface language. The
// architecture is language-agnostic: additional languages (Swahili, French, …)
// can be added by dropping a translation dictionary in
// `src/lib/i18n/dictionaries/` and flipping `available` to true below.
//
// IMPORTANT: a language must only be marked `available: true` once its
// dictionary covers all user-facing strings. Until then it stays listed as
// "coming soon" and the UI falls back to English.

export interface LanguageOption {
  /** BCP-47 base language code, e.g. "en". */
  code: string;
  /** English name of the language. */
  name: string;
  /** Endonym (the language's name in itself). */
  nativeName: string;
  /** Whether an accurate, complete dictionary exists yet. */
  available: boolean;
  /** Default date-format id for this language (see src/lib/format.ts). */
  defaultDateFormat: string;
  /** Default number-format id for this language (see src/lib/format.ts). */
  defaultNumberFormat: string;
}

export const DEFAULT_LANGUAGE = "en";

export const LANGUAGES: LanguageOption[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    available: true,
    defaultDateFormat: "dmy",
    defaultNumberFormat: "comma_dot",
  },
  // Prepared for future releases — dictionaries not yet complete, so disabled.
  {
    code: "sw",
    name: "Swahili",
    nativeName: "Kiswahili",
    available: false,
    defaultDateFormat: "dmy",
    defaultNumberFormat: "comma_dot",
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    available: false,
    defaultDateFormat: "dmy",
    defaultNumberFormat: "space_comma",
  },
];

export function isSupportedLanguage(code: unknown): code is string {
  return (
    typeof code === "string" &&
    LANGUAGES.some((l) => l.code === code && l.available)
  );
}

/** Normalize arbitrary input to a supported language code, else the default. */
export function normalizeLanguage(code: unknown): string {
  return isSupportedLanguage(code) ? (code as string) : DEFAULT_LANGUAGE;
}

export function getLanguage(code: unknown): LanguageOption {
  const normalized = normalizeLanguage(code);
  return (
    LANGUAGES.find((l) => l.code === normalized) ??
    (LANGUAGES[0] as LanguageOption)
  );
}

/** The selectable languages (available only). */
export function availableLanguages(): LanguageOption[] {
  return LANGUAGES.filter((l) => l.available);
}
