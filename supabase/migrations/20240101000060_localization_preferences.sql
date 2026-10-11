-- Migration: 00060_localization_preferences.sql
-- Internationalization / localization persistence.
--
-- Personal (per-user) interface preferences live on `profiles`; the
-- organization-wide business locale lives on `organizations`. All columns are
-- nullable with no destructive change, so existing organizations and users keep
-- working unchanged (they fall back to language 'en' and the organization's
-- existing currency/timezone).
--
-- These settings only affect *presentation*. They never change an
-- organization's operating currency or any stored financial value.

-- ---------------------------------------------------------------------------
-- 1) organizations: business locale (BCP-47, e.g. 'en-UG')
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS locale text;

-- ---------------------------------------------------------------------------
-- 2) profiles: personal interface preferences
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS language text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_format text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS number_format text;

-- Backfill existing users to English (the only fully-supported language today).
UPDATE profiles SET language = 'en' WHERE language IS NULL OR language = '';

-- Base language code shape check; extend the allow-list as translations ship.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_language_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_language_check
  CHECK (language IS NULL OR language ~ '^[a-z]{2}$');
