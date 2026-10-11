-- Migration: 00059_org_country.sql
-- Add an explicit country / operating region to organizations.
--
-- This is a minimal, backward-compatible addition used to drive regional
-- presentation (e.g. the country flag in the app topbar) and to *suggest*
-- regional defaults. It must never silently change an organization's
-- operating currency or financial data.
--
-- Existing Uganda-based organizations keep working unchanged: the default is
-- 'UG'. Only the ISO 3166-1 alpha-2 code is stored; display names, flag emoji
-- and suggested locale/currency/timezone are resolved in the application.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS country text;

-- Backfill existing organizations to Uganda (the historical default market)
-- without touching any other business settings.
UPDATE organizations SET country = 'UG' WHERE country IS NULL OR country = '';

-- Enforce the ISO alpha-2 shape going forward, but keep it nullable so rows
-- created by older code paths continue to insert cleanly.
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_country_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_country_check
  CHECK (country IS NULL OR country ~ '^[A-Z]{2}$');
