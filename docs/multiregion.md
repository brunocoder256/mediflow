# MEDIFLOW IQ — INTERNATIONALIZATION, MULTI-REGION SETTINGS AND LOCALIZATION

Act as a senior Next.js architect working on my existing MediFlow IQ pharmacy and drug-shop management application.

Implement a comprehensive localization system that allows organizations and users to configure their country, interface language, currency, date and number formats, and relevant regional settings.

The application must adapt consistently to supported regional preferences without breaking existing functionality, financial records, offline operation, or database integrity.

## 1. INSPECT THE EXISTING CODEBASE FIRST

Inspect the existing Next.js App Router, TypeScript configuration, layouts, navigation, UI components, authentication, user profiles, organization settings, database schema, Supabase services, POS, inventory, reports, offline storage, and service worker.

Identify all hardcoded user-facing strings, date formatters, currency formatters, and assumptions about Uganda or UGX.

Determine the safest architecture for introducing localization into the existing application.

Do not replace the application architecture or rewrite existing pages unnecessarily.

## 2. LANGUAGE SELECTION

Implement a language preference system with a clear list of supported languages.

Begin with English and add other languages only when accurate translations are available.

Prepare the architecture for future languages, including Swahili and French, and other appropriate official languages for target markets.

Use structured translation dictionaries and a compatible Next.js App Router internationalization solution, such as next-intl, if appropriate for the existing version and routing architecture.

Translate all user-facing interface elements, including:

- Navigation and menus.
- Dashboard labels.
- Forms, field labels, and placeholders.
- Buttons and action menus.
- Validation messages.
- Success and error notifications.
- Empty states and loading messages.
- Tables and filters.
- Reports and export headings.
- Settings and account management.
- POS and checkout interface.
- Products, Inventory, Purchases, Returns, Expenses, Customers, and other existing modules.

Use translation keys rather than scattering hardcoded language conditions throughout components.

Preserve existing functionality and ensure missing translations have a predictable fallback to English.

Do not claim a language is fully supported while important interface strings remain untranslated.

Do not use an external AI API or automatic machine translation service.

## 3. COUNTRY AND REGIONAL PREFERENCES

Create a country and region selector using maintained ISO country codes.

For each supported country, define appropriate regional defaults such as:

- Country code.
- Default locale.
- Suggested official or supported interface languages.
- Default currency code.
- Time zone or regional time-zone selection where appropriate.
- Date and number formatting preferences.
- Relevant regional configuration capabilities.

Selecting a country should suggest appropriate defaults, but must not silently overwrite established business settings or financial data.

Do not infer a user's country from their IP address as the only source of truth.

Allow users and organizations to select their preferences explicitly.

Do not promise country-specific tax compliance unless the relevant rules have been properly implemented and verified.

## 4. USER PREFERENCES AND ORGANIZATION SETTINGS

Keep personal interface preferences separate from organization-wide business settings.

Personal preferences may include:

- Interface language.
- Preferred date and number display conventions, where supported.
- Time zone.
- Other suitable presentation preferences.

Organization settings should include:

- Country or operating region.
- Operating currency.
- Relevant business locale.
- Applicable configurable regional settings.

Use the existing profile and organization settings architecture wherever possible.

If the database needs changes, create minimal, backward-compatible migrations with sensible defaults for existing organizations.

Existing Uganda-based organizations must continue working correctly with their current settings.

Persist preferences securely and restore them on subsequent visits.

Apply appropriate preferences across the application without requiring users to configure every page separately.

## 5. CURRENCY AND FINANCIAL SAFETY

Implement consistent currency formatting throughout the application using ISO 4217 currency codes and JavaScript Intl APIs where appropriate.

Ensure currency formatting is consistent across:

- POS.
- Sales.
- Purchases.
- Expenses.
- Returns.
- Cash sessions.
- Inventory valuation.
- Reports.
- Receipts.
- Dashboard metrics.
- Relevant exports.

Critical rules:

1. Do not convert stored financial amounts simply because a display preference or country setting changes.
2. Preserve the operating currency of existing organizations.
3. Never silently change an existing organization's operating currency.
4. Never mix currencies in totals without explicit conversion logic.
5. Preserve accurate financial arithmetic and database precision.
6. Use appropriate decimal handling for financial calculations.
7. Ensure receipts and reports identify the correct currency.
8. Avoid unsafe conversions of precise monetary amounts into floating-point values.
9. Keep historical transactions associated with their original currency where applicable.
10. Do not change existing POS transaction logic merely to introduce formatting.

For the initial implementation, support one operating currency per organization unless multi-currency transactions already exist.

If multi-currency transactions are introduced later, they must have explicit transaction currencies, documented exchange-rate handling, and appropriate accounting behavior.

A user's language preference must never independently change an organization's financial currency.

## 6. DATES, TIMES AND NUMBERS

Use locale-aware formatting consistently for dates, times, decimal numbers, percentages, and quantities.

Respect time zones when displaying timestamps.

Keep canonical timestamps and stored data independent of display formatting.

Do not transform existing stored dates into locale-specific strings.

Review date filters, report periods, expiry-date displays, audit timestamps, and transaction timestamps.

Preserve correct date ordering and avoid ambiguity in expiry dates.

Do not change the underlying meaning of stored dates or invent missing time-zone information.

Ensure number parsing and validation correctly handle locale-specific input without confusing decimal separators and thousands separators.

Do not break existing database validation or financial calculations.

## 7. UNITS AND PHARMACY-SPECIFIC DATA

Keep medicine-selling units and physical quantities distinct from localization.

Support existing units such as tablets, packets, ampoules, vials, doses, pieces, tubes, and other units already implemented.

Translate their display labels where appropriate, but do not change stored unit identifiers, conversion factors, pack sizes, or inventory quantities when a language changes.

Preserve product names, brand names, generic names, strengths, batch identifiers, and expiry dates.

Do not automatically translate medicine names or clinical instructions.

## 8. OFFLINE SUPPORT

Integrate localization with the existing Dexie and service-worker architecture.

Ensure required translation dictionaries are available offline once cached or bundled.

Avoid introducing a second service worker or conflicting cache strategy.

Ensure language changes work without an internet connection when the required resources are available locally.

Preserve offline POS operations, synchronization, and existing database behavior.

Do not require a network request for every translated label.

## 9. RESPONSIVE LANGUAGE SELECTOR

Add an accessible language and regional preferences interface in the existing Settings area.

Provide an appropriate onboarding choice for new organizations where it fits the existing registration flow.

Include:

- Country or region.
- Interface language.
- Operating currency, restricted to authorized organization administrators.
- Time zone and relevant formatting preferences.
- A clear save action and confirmation.
- Predictable fallback behavior.

Do not force users through unnecessary configuration screens.

Do not redesign the existing dashboard or navigation unnecessarily.

Support long translated labels, different text lengths, keyboard navigation, and mobile layouts.

## 10. SECURITY AND BACKWARD COMPATIBILITY

Preserve existing authentication, organization isolation, RBAC, Supabase RLS, and offline architecture.

Only authorized organization administrators may change organization-wide financial settings.

Do not let an ordinary user's personal language setting modify business configuration.

Do not expose privileged credentials or bypass existing authorization checks.

Preserve existing records, routes, transactions, and integrations.

Avoid destructive schema changes and unrelated refactoring.

## 11. TESTING

Test:

- Language selection and persistence.
- Translation fallback.
- Translation coverage for existing pages.
- Organization defaults.
- Personal versus organization-level permissions.
- Currency formatting.
- Existing UGX transaction integrity.
- Date, time, and number formatting.
- Expiry-date display.
- POS receipts and reports.
- Offline localization.
- Existing organizations with no new preference values.
- Long translated labels and mobile layouts.

Run the existing TypeScript checks, lint command, relevant tests, and production build.

Fix regressions introduced by the implementation without hiding errors or disabling checks.

Do not claim tests passed unless they actually completed successfully.

## 12. FINAL DELIVERABLES

Complete the implementation, not just a mockup.

Report:

- Files created and modified.
- Languages actually supported.
- Country and currency configurations implemented.
- Translation coverage.
- Database changes.
- Offline behavior.
- Financial and permission safeguards.
- Tests and build results.
- Remaining untranslated areas or limitations.

Start by inspecting the existing codebase, then implement in small, safe steps. Preserve all existing MediFlow IQ functionality.