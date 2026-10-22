/**
 * Pure helpers for the secure batch expiry-date correction workflow.
 *
 * Expiry dates are `date` values (no time, no timezone) in PostgreSQL. These
 * helpers deliberately compare the calendar components directly so a browser or
 * server timezone can never shift an expiry date by a day.
 */

export const EXPIRY_CORRECTION_PERMISSION = 'inventory.batch_expiry.correct';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function parseParts(value: string): [number, number, number] | null {
  const match = DATE_PREFIX_RE.exec(String(value ?? ''));
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Strict YYYY-MM-DD validation, including impossible calendar dates. */
export function isValidDateOnly(value: string): boolean {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) return false;
  const parts = parseParts(value);
  if (!parts) return false;
  const [year, month, day] = parts;
  if (year < 1900 || year > 2200) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** UTC midnight for a date-only value, used for calendar-safe comparisons. */
export function toUtcDay(value: string): number | null {
  const parts = parseParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  return Date.UTC(year, month - 1, day);
}

export function daysUntilExpiry(expiryDate: string, today: Date = new Date()): number | null {
  const target = toUtcDay(expiryDate);
  if (target === null) return null;
  // The database (CURRENT_DATE), POS and expiry reports all use the UTC
  // calendar day for date-only expiry values.
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - todayDay) / 86_400_000);
}

export function formatExpiryDate(value?: string | null): string {
  if (!value) return '—';
  const parts = parseParts(value);
  if (!parts) return String(value);
  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export type ExpiryCorrectionAssessment = {
  valid: boolean;
  daysShift: number;
  isPast: boolean;
  highImpact: boolean;
  unchanged: boolean;
};

export function assessExpiryCorrection(
  oldExpiryDate: string,
  newExpiryDate: string,
  today: Date = new Date(),
): ExpiryCorrectionAssessment {
  if (!isValidDateOnly(oldExpiryDate) || !isValidDateOnly(newExpiryDate)) {
    return { valid: false, daysShift: 0, isPast: false, highImpact: false, unchanged: false };
  }
  const oldDay = toUtcDay(oldExpiryDate) as number;
  const newDay = toUtcDay(newExpiryDate) as number;
  const daysShift = Math.round((newDay - oldDay) / 86_400_000);
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  // The POS and expiry reports treat a batch as unusable on its expiry day
  // (`expiry_date > CURRENT_DATE`), so "today" is already an expired outcome.
  const isPast = newDay <= todayDay;
  return {
    valid: true,
    daysShift,
    isPast,
    highImpact: isPast || Math.abs(daysShift) > 180,
    unchanged: daysShift === 0,
  };
}

export type ExpiryCorrectionValidation =
  | { ok: true; assessment: ExpiryCorrectionAssessment }
  | { ok: false; error: string; assessment?: ExpiryCorrectionAssessment };

export function validateExpiryCorrection(input: {
  oldExpiryDate: string;
  newExpiryDate: string;
  reason: string;
  today?: Date;
}): ExpiryCorrectionValidation {
  const reason = (input.reason ?? '').trim();
  if (!isValidDateOnly(input.oldExpiryDate)) {
    return { ok: false, error: 'The current batch expiry date is invalid. Reload the batch before correcting it.' };
  }
  if (!isValidDateOnly(input.newExpiryDate)) {
    return { ok: false, error: 'Enter a valid expiry date (YYYY-MM-DD).' };
  }
  if (!reason) {
    return { ok: false, error: 'A correction reason is required.' };
  }
  if (reason.length < 5) {
    return { ok: false, error: 'A correction reason of at least 5 characters is required.' };
  }
  if (reason.length > 500) {
    return { ok: false, error: 'Correction reason must be 500 characters or fewer.' };
  }
  const assessment = assessExpiryCorrection(input.oldExpiryDate, input.newExpiryDate, input.today);
  if (!assessment.valid) {
    return { ok: false, error: 'Enter a valid expiry date.' };
  }
  if (assessment.unchanged) {
    return { ok: false, error: 'The proposed expiry date is identical to the current expiry date.', assessment };
  }
  return { ok: true, assessment };
}

/** FEFO preview: the earliest expiry is consumed first. */
export function orderBatchesByFefo<T extends { expiry_date: string }>(batches: T[]): T[] {
  return [...batches].sort((a, b) => {
    const aDay = toUtcDay(a.expiry_date);
    const bDay = toUtcDay(b.expiry_date);
    if (aDay === null && bDay === null) return 0;
    if (aDay === null) return 1;
    if (bDay === null) return -1;
    return aDay - bDay;
  });
}
