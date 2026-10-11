"use client";

import {
  AE, AO, AR, AU, BE, BI, BR, BW, CA, CD, CH, CI, CM, CN,
  DE, DK, EG, ES, ET, FR, GB, GH, IE, IN, IT, JP, KE, MA,
  MW, MX, MZ, NA, NG, NL, NO, NZ, PK, PL, PT, QA, RW, SA,
  SD, SE, SN, SO, SS, TR, TZ, UG, US, ZA, ZM, ZW,
} from "country-flag-icons/react/3x2";
import { normalizeCountryCode } from "@/lib/regions";

// Real, colour SVG flags bundled locally (no network, works offline and on
// Windows where regional-indicator emoji do NOT render as coloured flags).
// Only the countries MediFlow supports are imported so the rest tree-shake away.

type FlagComponent = typeof UG;

const FLAGS: Record<string, FlagComponent> = {
  AE, AO, AR, AU, BE, BI, BR, BW, CA, CD, CH, CI, CM, CN,
  DE, DK, EG, ES, ET, FR, GB, GH, IE, IN, IT, JP, KE, MA,
  MW, MX, MZ, NA, NG, NL, NO, NZ, PK, PL, PT, QA, RW, SA,
  SD, SE, SN, SO, SS, TR, TZ, UG, US, ZA, ZM, ZW,
};

export function CountryFlag({
  code,
  className,
  title,
}: {
  /** ISO 3166-1 alpha-2 code (case-insensitive). */
  code: unknown;
  className?: string;
  title?: string;
}) {
  const cc = normalizeCountryCode(code);
  const Flag = cc ? FLAGS[cc] : undefined;
  if (!Flag) return null;
  return <Flag className={className} title={title} />;
}
