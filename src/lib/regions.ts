// Country / region metadata for MediFlow IQ.
//
// Supported countries use ISO 3166-1 alpha-2 codes. Flag emoji are derived
// directly from the code (regional indicator symbols), so any valid ISO code
// renders a flag without a lookup table. Regional defaults (currency, locale,
// timezone) are *suggestions* only — they must never silently overwrite an
// existing organization's stored business settings or financial data.

export interface CountryRegion {
  /** ISO 3166-1 alpha-2 country code, e.g. "UG". */
  code: string;
  /** Display name. */
  name: string;
  /** ISO 4217 default currency code, e.g. "UGX". */
  currency: string;
  /** BCP-47 default locale, e.g. "en-UG". */
  locale: string;
  /** IANA time zone, e.g. "Africa/Kampala". */
  timezone: string;
}

/** The default region for existing MediFlow IQ organizations. */
export const DEFAULT_COUNTRY_CODE = "UG";

export const COUNTRIES: CountryRegion[] = [
  // East & Central Africa
  { code: "UG", name: "Uganda", currency: "UGX", locale: "en-UG", timezone: "Africa/Kampala" },
  { code: "KE", name: "Kenya", currency: "KES", locale: "en-KE", timezone: "Africa/Nairobi" },
  { code: "TZ", name: "Tanzania", currency: "TZS", locale: "sw-TZ", timezone: "Africa/Dar_es_Salaam" },
  { code: "RW", name: "Rwanda", currency: "RWF", locale: "rw-RW", timezone: "Africa/Kigali" },
  { code: "BI", name: "Burundi", currency: "BIF", locale: "fr-BI", timezone: "Africa/Bujumbura" },
  { code: "SS", name: "South Sudan", currency: "SSP", locale: "en-SS", timezone: "Africa/Juba" },
  { code: "CD", name: "DR Congo", currency: "CDF", locale: "fr-CD", timezone: "Africa/Kinshasa" },
  { code: "ET", name: "Ethiopia", currency: "ETB", locale: "am-ET", timezone: "Africa/Addis_Ababa" },
  { code: "SO", name: "Somalia", currency: "SOS", locale: "so-SO", timezone: "Africa/Mogadishu" },
  { code: "SD", name: "Sudan", currency: "SDG", locale: "ar-SD", timezone: "Africa/Khartoum" },
  // West Africa
  { code: "NG", name: "Nigeria", currency: "NGN", locale: "en-NG", timezone: "Africa/Lagos" },
  { code: "GH", name: "Ghana", currency: "GHS", locale: "en-GH", timezone: "Africa/Accra" },
  { code: "SN", name: "Senegal", currency: "XOF", locale: "fr-SN", timezone: "Africa/Dakar" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", locale: "fr-CI", timezone: "Africa/Abidjan" },
  { code: "CM", name: "Cameroon", currency: "XAF", locale: "fr-CM", timezone: "Africa/Douala" },
  // Southern Africa
  { code: "ZA", name: "South Africa", currency: "ZAR", locale: "en-ZA", timezone: "Africa/Johannesburg" },
  { code: "ZM", name: "Zambia", currency: "ZMW", locale: "en-ZM", timezone: "Africa/Lusaka" },
  { code: "ZW", name: "Zimbabwe", currency: "ZWL", locale: "en-ZW", timezone: "Africa/Harare" },
  { code: "MW", name: "Malawi", currency: "MWK", locale: "en-MW", timezone: "Africa/Blantyre" },
  { code: "MZ", name: "Mozambique", currency: "MZN", locale: "pt-MZ", timezone: "Africa/Maputo" },
  { code: "AO", name: "Angola", currency: "AOA", locale: "pt-AO", timezone: "Africa/Luanda" },
  { code: "BW", name: "Botswana", currency: "BWP", locale: "en-BW", timezone: "Africa/Gaborone" },
  { code: "NA", name: "Namibia", currency: "NAD", locale: "en-NA", timezone: "Africa/Windhoek" },
  // North Africa & Middle East
  { code: "EG", name: "Egypt", currency: "EGP", locale: "ar-EG", timezone: "Africa/Cairo" },
  { code: "MA", name: "Morocco", currency: "MAD", locale: "ar-MA", timezone: "Africa/Casablanca" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", locale: "ar-AE", timezone: "Asia/Dubai" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", locale: "ar-SA", timezone: "Asia/Riyadh" },
  { code: "QA", name: "Qatar", currency: "QAR", locale: "ar-QA", timezone: "Asia/Qatar" },
  { code: "TR", name: "Türkiye", currency: "TRY", locale: "tr-TR", timezone: "Europe/Istanbul" },
  // Europe
  { code: "GB", name: "United Kingdom", currency: "GBP", locale: "en-GB", timezone: "Europe/London" },
  { code: "IE", name: "Ireland", currency: "EUR", locale: "en-IE", timezone: "Europe/Dublin" },
  { code: "FR", name: "France", currency: "EUR", locale: "fr-FR", timezone: "Europe/Paris" },
  { code: "DE", name: "Germany", currency: "EUR", locale: "de-DE", timezone: "Europe/Berlin" },
  { code: "ES", name: "Spain", currency: "EUR", locale: "es-ES", timezone: "Europe/Madrid" },
  { code: "IT", name: "Italy", currency: "EUR", locale: "it-IT", timezone: "Europe/Rome" },
  { code: "NL", name: "Netherlands", currency: "EUR", locale: "nl-NL", timezone: "Europe/Amsterdam" },
  { code: "PT", name: "Portugal", currency: "EUR", locale: "pt-PT", timezone: "Europe/Lisbon" },
  { code: "BE", name: "Belgium", currency: "EUR", locale: "nl-BE", timezone: "Europe/Brussels" },
  { code: "CH", name: "Switzerland", currency: "CHF", locale: "de-CH", timezone: "Europe/Zurich" },
  { code: "SE", name: "Sweden", currency: "SEK", locale: "sv-SE", timezone: "Europe/Stockholm" },
  { code: "NO", name: "Norway", currency: "NOK", locale: "nb-NO", timezone: "Europe/Oslo" },
  { code: "DK", name: "Denmark", currency: "DKK", locale: "da-DK", timezone: "Europe/Copenhagen" },
  { code: "PL", name: "Poland", currency: "PLN", locale: "pl-PL", timezone: "Europe/Warsaw" },
  // Americas
  { code: "US", name: "United States", currency: "USD", locale: "en-US", timezone: "America/New_York" },
  { code: "CA", name: "Canada", currency: "CAD", locale: "en-CA", timezone: "America/Toronto" },
  { code: "BR", name: "Brazil", currency: "BRL", locale: "pt-BR", timezone: "America/Sao_Paulo" },
  { code: "MX", name: "Mexico", currency: "MXN", locale: "es-MX", timezone: "America/Mexico_City" },
  { code: "AR", name: "Argentina", currency: "ARS", locale: "es-AR", timezone: "America/Argentina/Buenos_Aires" },
  // Asia & Pacific
  { code: "IN", name: "India", currency: "INR", locale: "en-IN", timezone: "Asia/Kolkata" },
  { code: "PK", name: "Pakistan", currency: "PKR", locale: "en-PK", timezone: "Asia/Karachi" },
  { code: "CN", name: "China", currency: "CNY", locale: "zh-CN", timezone: "Asia/Shanghai" },
  { code: "JP", name: "Japan", currency: "JPY", locale: "ja-JP", timezone: "Asia/Tokyo" },
  { code: "AU", name: "Australia", currency: "AUD", locale: "en-AU", timezone: "Australia/Sydney" },
  { code: "NZ", name: "New Zealand", currency: "NZD", locale: "en-NZ", timezone: "Pacific/Auckland" },
];

const COUNTRY_BY_CODE: Map<string, CountryRegion> = new Map(
  COUNTRIES.map((c) => [c.code, c]),
);

/** Normalize arbitrary input to a valid uppercase ISO alpha-2 code, else null. */
export function normalizeCountryCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * Derive the flag emoji for an ISO 3166-1 alpha-2 code by mapping each letter
 * to its regional indicator symbol. Returns "" for invalid input.
 */
export function flagEmoji(countryCode: unknown): string {
  const code = normalizeCountryCode(countryCode);
  if (!code) return "";
  return String.fromCodePoint(
    ...[...code].map((ch) => 0x1f1e6 + (ch.charCodeAt(0) - 65)),
  );
}

/** Look up a supported region by code (case-insensitive). */
export function getCountry(countryCode: unknown): CountryRegion | undefined {
  const code = normalizeCountryCode(countryCode);
  return code ? COUNTRY_BY_CODE.get(code) : undefined;
}

/** Human-readable country name, falling back to the raw code. */
export function countryName(countryCode: unknown): string {
  const code = normalizeCountryCode(countryCode);
  if (!code) return "";
  return COUNTRY_BY_CODE.get(code)?.name ?? code;
}
