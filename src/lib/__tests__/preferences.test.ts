import { describe, it, expect } from 'vitest';
import {
  normalizePreferences,
  resolveEffective,
  readPreferences,
  DEFAULT_PREFERENCES,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
} from '../preferences';

describe('preferences — normalization', () => {
  it('trims strings and drops empty values', () => {
    const out = normalizePreferences({
      language: 'en',
      timezone: '  ',
      date_format: '',
      number_format: '  indian  ',
    });
    expect(out.timezone).toBeNull();
    expect(out.date_format).toBeNull();
    expect(out.number_format).toBe('indian');
  });

  it('falls back to the default language for unsupported values', () => {
    expect(normalizePreferences({ language: 'sw' }).language).toBe('en');
    expect(normalizePreferences({ language: 42 as unknown as string }).language).toBe('en');
    expect(normalizePreferences(null).language).toBe('en');
  });

  it('exposes safe defaults', () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      language: 'en',
      timezone: null,
      date_format: null,
      number_format: null,
    });
  });
});

describe('preferences — effective resolution', () => {
  it('uses built-in defaults when nothing is provided', () => {
    const eff = resolveEffective(DEFAULT_PREFERENCES, {});
    expect(eff.currency).toBe(DEFAULT_CURRENCY);
    expect(eff.timezone).toBe(DEFAULT_TIMEZONE);
    expect(eff.dateFormat).toBe('dmy');
    expect(eff.numberFormat).toBe('comma_dot');
    expect(eff.locale).toBe('en');
  });

  it('uses the organization currency, uppercased, and never converts it', () => {
    const eff = resolveEffective(DEFAULT_PREFERENCES, { currency: 'kes' });
    expect(eff.currency).toBe('KES');
  });

  it('lets a personal time-zone override the organization time zone', () => {
    const org = { timezone: 'Africa/Kampala' };
    expect(resolveEffective(DEFAULT_PREFERENCES, org).timezone).toBe('Africa/Kampala');
    const personal = { ...DEFAULT_PREFERENCES, timezone: 'Europe/London' };
    expect(resolveEffective(personal, org).timezone).toBe('Europe/London');
  });

  it('prefers the organization locale, falling back to the language', () => {
    expect(resolveEffective(DEFAULT_PREFERENCES, { locale: 'en-UG' }).locale).toBe('en-UG');
    expect(resolveEffective(DEFAULT_PREFERENCES, {}).locale).toBe('en');
  });

  it('honours explicit personal format overrides', () => {
    const eff = resolveEffective(
      { ...DEFAULT_PREFERENCES, date_format: 'ymd', number_format: 'dot_comma' },
      {},
    );
    expect(eff.dateFormat).toBe('ymd');
    expect(eff.numberFormat).toBe('dot_comma');
  });
});

describe('preferences — offline cache', () => {
  it('returns null when there is no stored value (non-browser environment)', () => {
    expect(readPreferences()).toBeNull();
  });
});
