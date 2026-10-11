import { describe, it, expect } from 'vitest';
import {
  flagEmoji,
  normalizeCountryCode,
  getCountry,
  countryName,
  COUNTRIES,
} from '../regions';

describe('Regions — country codes and flags', () => {
  it('derives the Uganda flag from UG', () => {
    expect(flagEmoji('UG')).toBe('🇺🇬');
  });

  it('derives the Kenya flag from KE', () => {
    expect(flagEmoji('KE')).toBe('🇰🇪');
  });

  it('is case-insensitive', () => {
    expect(flagEmoji('ug')).toBe('🇺🇬');
    expect(normalizeCountryCode('ke')).toBe('KE');
  });

  it('normalizes surrounding whitespace', () => {
    expect(normalizeCountryCode('  tz  ')).toBe('TZ');
  });

  it('returns empty flag for invalid input', () => {
    expect(flagEmoji('')).toBe('');
    expect(flagEmoji('U')).toBe('');
    expect(flagEmoji('UGA')).toBe('');
    expect(flagEmoji('U1')).toBe('');
    expect(flagEmoji(null)).toBe('');
    expect(flagEmoji(undefined)).toBe('');
    expect(flagEmoji(42)).toBe('');
  });

  it('looks up a supported country', () => {
    expect(getCountry('UG')?.currency).toBe('UGX');
    expect(getCountry('UG')?.timezone).toBe('Africa/Kampala');
    expect(getCountry('US')?.currency).toBe('USD');
  });

  it('returns undefined for unsupported codes but still yields a name fallback', () => {
    expect(getCountry('ZZ')).toBeUndefined();
    expect(countryName('ZZ')).toBe('ZZ');
    expect(countryName('')).toBe('');
  });

  it('exposes unique, valid ISO alpha-2 codes for every supported country', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.currency).toMatch(/^[A-Z]{3}$/);
      expect(flagEmoji(c.code).length).toBeGreaterThan(0);
    }
  });

  it('keeps Uganda as a supported default region', () => {
    expect(COUNTRIES.some((c) => c.code === 'UG')).toBe(true);
  });
});
