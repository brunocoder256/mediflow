import { describe, it, expect } from 'vitest';
import { createTranslator } from '../i18n/translate';
import {
  normalizeLanguage,
  isSupportedLanguage,
  availableLanguages,
  DEFAULT_LANGUAGE,
} from '../i18n/config';

describe('i18n — translator', () => {
  it('resolves a dot-path key in the dictionary', () => {
    const t = createTranslator('en');
    expect(t('common.save')).toBe('Save');
    expect(t('nav.dashboard')).toBe('Dashboard');
  });

  it('interpolates {placeholder} variables', () => {
    const t = createTranslator('en');
    expect(t('topbar.operatingCountry', { country: 'Uganda' })).toBe(
      'Operating country: Uganda',
    );
  });

  it('leaves unknown placeholders untouched', () => {
    const t = createTranslator('en');
    expect(t('topbar.operatingCountry', {})).toBe('Operating country: {country}');
  });

  it('returns the key itself when it is missing everywhere', () => {
    const t = createTranslator('en');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('falls back to English for an unknown language', () => {
    const t = createTranslator('xx');
    expect(t('nav.dashboard')).toBe('Dashboard');
  });
});

describe('i18n — language config', () => {
  it('only marks fully-translated languages as supported', () => {
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('sw')).toBe(false);
    expect(isSupportedLanguage('fr')).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
    expect(isSupportedLanguage(42)).toBe(false);
  });

  it('normalizes unsupported languages to the default', () => {
    expect(normalizeLanguage('sw')).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage('fr')).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
  });

  it('only exposes available languages to the UI', () => {
    const available = availableLanguages();
    expect(available.length).toBeGreaterThan(0);
    expect(available.every((l) => l.available)).toBe(true);
    expect(available.some((l) => l.code === 'en')).toBe(true);
  });
});
