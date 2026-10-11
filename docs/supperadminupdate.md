# MEDIFLOW IQ — SUPER-ADMIN PLATFORM INTELLIGENCE, USER ACTIVITY ANALYTICS AND AUDIT CENTER

Act as a senior full-stack engineer working on my existing MediFlow IQ application.

Implement a comprehensive Platform Intelligence and Operations Center for the existing super-admin dashboard.

The goal is to help the platform owner understand account activity, user engagement, feature adoption, important business operations, errors, synchronization health, security events, and account lifecycle status.

## 1. INSPECT THE EXISTING PROJECT FIRST

Inspect the existing Next.js App Router, TypeScript, Supabase, PostgreSQL migrations, authentication, middleware, RBAC, organizations, branches, profiles, audit logs, notifications, subscriptions or account approval logic, POS services, Dexie offline storage, and synchronization queues.

Reuse existing structures and services where appropriate.

Do not assume that any route, table, role, or subscription feature exists until confirmed in the code.

Preserve all existing application behavior. Record the current Git state and protect existing user changes.

## 2. CREATE A SUPER-ADMIN OPERATIONS CENTER

Build a professional, responsive dashboard with these sections:

- Platform Overview.
- Organizations and Accounts.
- User Activity.
- Usage Analytics.
- Feature Adoption.
- Business Activity.
- Audit Trail.
- Security and Access Events.
- Application Errors.
- Offline Synchronization Health.
- Account Approval and Subscription Status, where already supported.
- Reports and Exports.

Use the existing MediFlow IQ design system and navigation. Do not redesign unrelated pages.

All dashboard metrics must come from real queries and recorded events. Never populate production analytics with hardcoded demonstration numbers.

Provide appropriate loading, empty, error, and no-permission states.

## 3. PLATFORM OVERVIEW

Display, where supported by the actual schema:

- Total organizations.
- Approved, pending, active, and suspended accounts.
- Registered users.
- Daily, weekly, and monthly active users.
- Recent successful and failed sign-in events where available.
- Completed business operations.
- Feature adoption.
- Recent errors and failed synchronization events.
- Account lifecycle and renewal indicators where the relevant features exist.

Support useful date filters and comparisons between periods.

Define each metric precisely. Do not confuse registered accounts with active users or active sessions.

## 4. USER AND ORGANIZATION INTELLIGENCE

Create searchable, filterable views of organizations and their authorized users.

For each organization, display appropriate metadata such as:

- Account status.
- Registration and approval dates.
- Last activity.
- Active days over selected periods.
- Session counts.
- Estimated active time.
- Modules used.
- Important completed operations.
- Error counts.
- Synchronization health.
- Onboarding progress where measurable.

Allow the super-admin to open an organization's activity timeline and inspect relevant events within the administrator's authorized scope.

Do not expose private information from one organization to another.

## 5. USAGE INTENSITY AND ENGAGEMENT

Implement an explicit, documented engagement model using meaningful metrics such as:

- Active days.
- Active sessions.
- Estimated foreground active time.
- Meaningful feature usage.
- Module adoption.
- Return frequency.
- Trends over time.

Do not calculate engagement solely from clicks or total page views.

Use a configurable inactivity threshold to estimate active time. Treat these measurements as estimates, not proof that a person was continuously working.

Account for offline usage and delayed event synchronization. Clearly distinguish recorded events from estimated or incomplete activity.

Use sensible aggregation so that analytics remain efficient as the platform grows.

## 6. STRUCTURED EVENT TRACKING

Implement a reusable, typed event-recording service.

Use a controlled event taxonomy, including relevant events such as:

- session_started
- session_ended
- page_viewed
- feature_used
- product_created
- product_updated
- sale_completed
- purchase_recorded
- return_recorded
- stock_adjusted
- report_generated
- user_invited
- role_changed
- account_status_changed
- operation_failed
- sync_failed
- sync_completed

Only emit events that correspond to actual implemented workflows.

For each suitable event, record:

- Unique event ID.
- Server timestamp where applicable.
- Authenticated actor ID.
- Organization ID.
- Branch ID where relevant.
- Event type.
- Target resource type and identifier where appropriate.
- Outcome.
- A small, validated metadata object.
- Correlation or idempotency identifier where useful.

Never trust client-supplied actor, organization, branch, role, or permission values. Derive identity from the authenticated server-side session and validate organization/branch membership.

Prevent duplicate event processing where retries are possible.

Do not send every mouse movement or keystroke to the server. Use lightweight, sampled or batched telemetry for high-volume engagement signals.

## 7. BUSINESS AUDIT TRAIL

Reuse and extend the existing audit log system rather than creating a competing system.

Record security- and business-critical events, including:

- Authentication and account lifecycle events where available.
- Product and batch changes.
- Completed sales and returns.
- Stock adjustments.
- Purchases and expenses.
- User invitations and role changes.
- Permission denials.
- Sensitive settings changes.
- Important report exports.
- Relevant administrative actions.

Record enough information to establish who performed an action, when it happened, what record was affected, and whether the operation succeeded.

For important business operations, record audit entries within the same transaction when appropriate, or use a reliable transactional event/outbox pattern.

Preserve existing transaction atomicity, idempotency, financial correctness, and audit behavior.

Make audit entries append-only for ordinary users. Restrict any administrative retention or maintenance operations to explicitly authorized server-side processes.

Do not log passwords, access tokens, payment credentials, or unnecessary sensitive customer/patient details. Minimize before/after snapshots to the fields needed for accountability.

## 8. SESSION AND ACTIVE-TIME ESTIMATION

Implement lightweight session tracking.

Use the existing authentication/session lifecycle where possible.

Track session starts and meaningful activity. Support inactivity timeouts, tab visibility changes, and session termination or expiry where detectable.

Do not treat an open tab as proof of active use.

Avoid continuously polling the server merely to calculate session duration.

Clearly document limitations, including browser crashes, offline periods, and sessions that end without an explicit logout.

## 9. FEATURE ADOPTION

Build per-module usage analytics for modules that actually exist, including POS, Products, Inventory, Purchases, Suppliers, Returns, Expenses, Customers, Reports, and Settings where applicable.

Show meaningful adoption indicators, activity trends, and the number of organizations using each feature.

Distinguish viewing a page from successfully completing an operation.

Do not expose one organization's private business data in another organization's analytics.

## 10. ERRORS AND OPERATIONAL HEALTH

Track appropriate application-level errors and failures, including:

- Failed operations.
- Repeated validation or permission errors.
- API failures.
- Offline synchronization failures.
- Retry counts.
- Relevant performance timings.
- Repeated incidents affecting the same workflow.

Avoid collecting raw request bodies, sensitive SQL parameters, or confidential application data.

Group repeated errors where possible. Show timestamps, affected modules, sanitized error categories, and relevant correlation IDs.

Do not label every failed validation as suspicious behavior.

## 11. OFFLINE AND SYNCHRONIZATION ANALYTICS

Integrate with the existing Dexie and offline synchronization system.

Where supported, record synchronization attempts, successes, failures, retries, and unresolved conflicts.

Queue appropriate telemetry events while offline and transmit them when connectivity returns.

Use unique event IDs and idempotent ingestion to prevent duplicate events.

Never let telemetry failure block POS sales or other essential offline operations.

Never treat missing telemetry as proof that a user performed no activity.

Do not replace the existing sync queue or introduce a second offline data architecture.

## 12. ALERTS AND OPERATIONAL INSIGHTS

Create configurable alerts for meaningful events, such as:

- Significant decline in organization activity.
- Repeated synchronization failures.
- Repeated authorization failures.
- Unusually high application error rates.
- Pending account approvals.
- Subscription or renewal events, if supported.

Show the reason, time, relevant scope, and recommended next action.

Use thresholds and explainable rules. Do not automatically accuse users of fraud or misconduct based on engagement scores.

Avoid noisy alerts, excessive polling, and unnecessary notifications.

## 13. DATABASE AND PERFORMANCE

Inspect existing migrations and database access patterns.

Use suitable indexes for common event filters, organization scope, actor ID, event type, and timestamp.

Paginate timelines and large result sets.

Use server-side aggregation for analytics rather than transferring all raw events to the browser.

Consider daily summary tables or materialized aggregates only when justified by actual volume and query performance.

Apply a suitable retention policy to high-volume engagement events while preserving required business audit records.

Do not add large numbers of indexes without examining existing indexes and query patterns.

Keep audit events and engagement telemetry logically separate.

## 14. SECURITY AND ACCESS CONTROL

Super-admin authorization must be enforced on the server and through the database access model where applicable.

Never rely on a hidden menu or client-side role check alone.

Preserve Supabase RLS, existing authentication, organization isolation, and branch permissions.

Do not give the super-admin interface unrestricted access to application tables through the browser.

Use authorized server-side queries and the existing secure service architecture.

Do not expose secrets, privileged keys, raw sensitive records, or cross-organization private data.

Do not add covert tracking, keystroke capture, screen recording, or unrelated browsing surveillance.

Provide appropriate transparency about usage data collection, restrict access to detailed individual timelines, and document retention and access rules.

## 15. TESTING AND VALIDATION

Test:

- Correct organization and user attribution.
- Server-side authorization.
- Cross-organization isolation.
- Append-only audit behavior.
- Duplicate event prevention.
- Correct usage aggregation.
- Inactivity timeout behavior.
- Offline event queuing and later delivery.
- Failed event ingestion without blocking business operations.
- Pagination and date filters.
- Permission denials.
- Sensitive metadata filtering.
- Analytics performance on larger event datasets.

Run the existing TypeScript checks, lint command, relevant tests, and production build.

Do not disable security checks or weaken existing policies to make tests pass.

Do not claim that tests passed unless they actually ran successfully.

## 16. STRICT NON-REGRESSION REQUIREMENTS

Do not rewrite the application.

Do not replace existing POS, inventory, authentication, subscription, or synchronization services.

Do not change unrelated database schemas or routes.

Do not remove existing functionality.

Keep modifications minimal, modular, and compatible with the existing architecture.

If a database migration is needed, explain the reason, keep it minimal, and ensure that it can be applied safely.

Protect uncommitted work and inspect the final Git diff for unrelated changes.

## 17. FINAL REPORT

Implement the feature and report:

1. Files created and modified.
2. Existing audit and analytics systems reused.
3. New event types recorded.
4. Metrics available in the dashboard.
5. How active time is estimated.
6. How offline events are handled.
7. How authorization and organization isolation are enforced.
8. Database migrations and indexes introduced.
9. Tests and build results.
10. Known limitations and recommended next steps.

Start by inspecting the existing codebase. Implement in small, safe steps. Deliver a functional super-admin intelligence center backed by real data, not a mockup. Preserve every existing MediFlow IQ workflow.