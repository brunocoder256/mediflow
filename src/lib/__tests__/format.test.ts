import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatQuantity,
  resolveDateFormatId,
  resolveNumberFormatId,
} from '../format';

// Noon UTC keeps the rendered calendar date stable regardless of the runtime
// time zone, except where we explicitly pass one.
const sampleDate = new Date(Date.UTC(2026, 11, 31, 12, 0, 0));

describe('format — dates', () => {
  it('uses the day/month/year default for English', () => {
    expect(formatDate(sampleDate, { language: 'en', timezone: 'UTC' })).toBe('31/12/2026');
  });

  it('honours an explicit ISO (ymd) date format', () => {
    expect(formatDate(sampleDate, { dateFormat: 'ymd', timezone: 'UTC' })).toBe('2026-12-31');
  });

  it('honours an explicit month/day/year date format', () => {
    expect(formatDate(sampleDate, { dateFormat: 'mdy', timezone: 'UTC' })).toBe('12/31/2026');
  });

  it('renders a long date format', () => {
    expect(formatDate(sampleDate, { dateFormat: 'long', timezone: 'UTC' })).toBe('31 December 2026');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('');
    expect(formatTime('not-a-date')).toBe('');
  });

  it('combines date and time', () => {
    const d = new Date(Date.UTC(2026, 0, 2, 9, 5, 0));
    const out = formatDateTime(d, { dateFormat: 'ymd', timezone: 'UTC' });
    expect(out.startsWith('2026-01-02')).toBe(true);
    expect(out).toContain('09:05');
  });
});

describe('format — numbers', () => {
  it('uses comma/dot grouping by default', () => {
    expect(formatNumber(1234.56, { language: 'en' })).toBe('1,234.56');
  });

  it('supports dot/comma grouping', () => {
    expect(formatNumber(1234.56, { numberFormat: 'dot_comma' })).toBe('1.234,56');
  });

  it('supports Indian grouping', () => {
    expect(formatNumber(123456.78, { numberFormat: 'indian' })).toBe('1,23,456.78');
  });

  it('returns an empty string for non-finite values', () => {
    expect(formatNumber(Number.NaN)).toBe('');
    expect(formatNumber(Infinity)).toBe('');
  });
});

describe('format — currency', () => {
  it('formats in the organization currency without converting', () => {
    const out = formatCurrency(1234.5, { currency: 'UGX', numberFormat: 'comma_dot' });
    expect(out).toContain('1,234.50');
    expect(out).toContain('UGX');
  });

  it('applies the number-format to currency presentation', () => {
    const out = formatCurrency(1234.5, { currency: 'EUR', numberFormat: 'dot_comma' });
    expect(out).toContain('1.234,50');
  });

  it('uppercases the currency code and defaults to UGX', () => {
    expect(formatCurrency(10, { currency: 'ugx' })).toContain('UGX');
    expect(formatCurrency(10, {})).toContain('UGX');
  });
});

describe('format — percent and quantity', () => {
  it('treats values above 1 as already-scaled percentages', () => {
    expect(formatPercent(0.5, { language: 'en' })).toBe('50%');
    expect(formatPercent(50, { language: 'en' })).toBe('50%');
  });

  it('formats quantities with up to three decimals and no currency symbol', () => {
    const out = formatQuantity(12.5, { language: 'en' });
    expect(out).toBe('12.5');
    expect(out).not.toMatch(/[A-Z]{3}/);
  });
});

describe('format — format resolution', () => {
  it('falls back to the language default when the stored id is invalid', () => {
    expect(resolveDateFormatId('nonsense', 'en')).toBe('dmy');
    expect(resolveNumberFormatId('nonsense', 'en')).toBe('comma_dot');
  });

  it('keeps a valid explicit id', () => {
    expect(resolveDateFormatId('ymd', 'en')).toBe('ymd');
    expect(resolveNumberFormatId('indian', 'en')).toBe('indian');
  });
});
