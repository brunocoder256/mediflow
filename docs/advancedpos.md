# MediFlow IQ — Implement Optional Separate Salesperson and Cashier Workflow

## 1. Project Context

MediFlow IQ is an existing pharmacy and drug-shop management system built with Next.js, TypeScript, Tailwind CSS, Supabase/PostgreSQL, and offline capabilities using Dexie.

**CRITICAL: An existing POS is already implemented.** Currently, one staff member can select products, complete a sale, process payment, and print the receipt immediately.

Do not replace, rebuild, duplicate, or damage the existing POS. Extend the current implementation to support an additional configurable workflow for pharmacies that separate sales duties from cashier duties.

Before changing anything, inspect the existing POS implementation, database schema, migrations, services, permissions, receipt components, offline synchronization, and relevant tests. Reuse the existing architecture and business logic.

## 2. Objective

Support two primary checkout workflows:

### Workflow A: Existing Single-Person POS

Preserve the current behavior exactly.

- A staff member selects medicines and quantities.
- The system calculates prices, discounts, and the total.
- The staff member selects the payment method and records payment.
- The sale is completed according to existing transaction rules.
- Stock movements, financial records, audit logs, and receipt generation work as they currently do.
- The receipt can be printed immediately.

Existing users must not be forced to change their workflow.

### Workflow B: Separate Salesperson and Cashier

Introduce an optional workflow for pharmacies where one employee prepares the bill and another employee receives payment.

**Salesperson workflow:**

1. The salesperson opens the existing POS.
2. Selects products, quantities, and any permitted discounts.
3. The existing pricing, batch-selection, expiry, and stock-validation logic remains in use.
4. The salesperson submits the bill to the cashier.
5. The system creates a persistent transaction with a unique sale reference and a clear status indicating that payment is pending.
6. The bill becomes visible in the cashier's queue.
7. The salesperson can view its status but cannot falsely mark it as paid or issue unauthorized refunds.

**Cashier workflow:**

1. The cashier opens a dedicated Cashier / Pending Payments screen.
2. Sees bills awaiting payment for their authorized branch.
3. Opens a bill and verifies the items, quantities, total, salesperson, and sale reference.
4. Selects the actual payment method.
5. Records the payment using the existing payment service and validation rules.
6. The system confirms the payment and completes the sale through the existing authoritative transaction service.
7. The system generates the final receipt, which the cashier can print or reprint.
8. The sale becomes visible in the relevant sales reports and cash-session records.

Do not create a second sale when the cashier processes a bill. The cashier must complete the original transaction.

## 3. Configurable Workflow Setting

Add a setting under the existing Settings area, preferably:

Settings → Sales & POS → Checkout Workflow

Provide these options:

- Single-Person POS — existing default behavior.
- Separate Salesperson and Cashier — salesperson prepares bills; cashier confirms payment.
- Three-Stage Workflow — salesperson prepares the bill, cashier receives payment, and authorized dispensing staff confirm handover, if this can be implemented safely within the existing architecture.

Use the existing organization and branch settings patterns. If necessary, introduce a properly scoped organization-level or branch-level configuration.

Requirements:

- Existing installations default to Single-Person POS.
- Existing users, data, and workflows continue to work after migration.
- Configuration changes must not silently alter sales that are already in progress.
- Only authorized administrators can change checkout workflow settings.
- A user must not bypass a configured workflow simply by accessing another screen or calling an API directly.

Do not introduce a complicated settings framework if a small extension to the existing settings model is sufficient.

## 4. Staff Roles and Permissions

Inspect the existing RBAC implementation and extend it rather than creating a parallel permission system.

Support the following responsibilities as applicable:

- Salesperson: prepare and submit bills; view permitted bill statuses.
- Cashier: view authorized pending bills, collect and record payment, print receipts, and reprint receipts according to policy.
- Dispenser / Handover Staff: complete the authorized handover stage if the three-stage workflow is enabled.
- Branch Manager: review transactions, approve permitted exceptions, and investigate discrepancies.
- Administrator: configure workflows and manage authorized roles.

Apply least-privilege access.

A salesperson must not be able to mark a bill paid simply by modifying frontend state or making a direct API request. The backend must validate the authenticated user, organization, branch, role, permissions, transaction status, and permitted actions.

Keep existing superadmin and organization-level access controls intact.

## 5. Transaction Lifecycle and Data Integrity

Inspect existing sale statuses and reuse them where appropriate. Avoid introducing duplicate or conflicting status systems.

The workflow should support clear states such as:

- Draft
- Awaiting Payment
- Paid / Completed
- Cancelled
- Refund or return states supported by the existing implementation

For the three-stage workflow, introduce a separate handover status only if the existing data model does not already provide an appropriate mechanism.

Important business rules:

1. Every bill has one stable transaction ID and unique sale reference.
2. A pending bill is not treated as a completed paid sale.
3. Payment cannot be recorded twice for the same payment attempt.
4. Repeated requests must be idempotent.
5. Only authorized users can transition a bill between states.
6. A completed sale cannot be silently edited or deleted.
7. Cancellation, voiding, refunds, and corrections must follow explicit permission and audit rules.
8. Pending bills must not appear as completed revenue or paid sales in financial reports.
9. Pending bills must remain distinguishable from completed sales in dashboards.
10. The cashier must see the exact server-calculated amount due, not an amount supplied without validation by the browser.

Use PostgreSQL transactions and the existing authoritative server-side sale service for operations that modify payment records, inventory, sale status, and financial records together. Where appropriate, use row-level locking, conditional updates, unique constraints, and idempotency keys to prevent concurrent processing.

Do not implement a frontend-only workflow that bypasses the existing atomic sale and inventory logic.

## 6. Stock Handling

Inspect the existing FEFO batch selection, expiry restrictions, stock reservation behavior, and `createSaleTransaction` implementation before changing stock logic.

Preserve the existing protection against selling expired medicines and consuming unavailable stock.

Determine how stock is currently handled between bill preparation and payment. Choose and document the safest approach that fits the existing implementation:

- Reserve eligible stock when a bill is submitted and release the reservation if it expires or is cancelled; or
- Revalidate stock atomically when the cashier completes payment.

If the application already has a reliable reservation mechanism, reuse it.

If no reservation mechanism exists, do not introduce an elaborate stock-reservation subsystem unnecessarily. At minimum, revalidate all relevant stock quantities and batch eligibility atomically before completing the sale.

If stock is no longer available when the cashier processes a bill, reject completion safely and return the transaction to an appropriate review state. Never permit negative stock merely to preserve a pending bill.

Ensure that reserved stock is not counted as available for other sales if reservation is implemented.

## 7. Cashier Interface and User Experience

Build a professional, responsive Cashier / Pending Payments interface using the existing MediFlow IQ design system.

Display useful information, including:

- Sale reference
- Submission date and time
- Salesperson
- Branch
- Number of items
- Total amount due
- Payment status
- Waiting duration, if supported by reliable timestamps

Provide:

- Search by sale reference
- Search by salesperson or customer where authorized
- Filters for pending, processing, completed, and cancelled transactions as appropriate
- Refresh and synchronization status
- Clear payment confirmation and error messages
- A detailed bill view
- A payment confirmation step before finalizing payment
- Receipt printing and authorized reprinting

Prevent duplicate clicks from triggering multiple payments.

Use appropriate loading states, empty states, error states, and mobile-friendly layouts. Follow the existing application's UI conventions instead of introducing a separate design system.

If realtime subscriptions already exist and are appropriate, reuse them. Otherwise, implement the simplest reliable refresh mechanism that does not overload Supabase or PostgreSQL. Avoid aggressive polling.

## 8. Receipts and Payment Records

Reuse the existing receipt component and printing functionality.

The final receipt should preserve the existing format and contain the information already supported by the application, including:

- Pharmacy and branch details
- Unique sale reference
- Sale date and time
- Item descriptions, quantities, unit prices, and line totals
- Discounts and applicable taxes
- Total payable
- Amount paid and change where applicable
- Payment method
- Receipt number
- Relevant cashier and salesperson references where appropriate

Do not expose sensitive patient information unnecessarily.

If a receipt is reprinted, do not create another sale or payment. Record the reprint event if supported by the existing audit system.

A bill awaiting payment must not be represented as a final paid receipt. If a preliminary bill is useful, label it clearly as unpaid or awaiting payment.

## 9. Cash Sessions and Financial Reconciliation

Integrate the cashier workflow with existing cash-session and financial services.

- Attribute payment collection to the authenticated cashier.
- Attribute sale creation to the salesperson.
- Attribute any authorized cancellation or refund to the responsible user.
- Record payment method and relevant cash-session references.
- Ensure pending bills do not inflate cash totals.
- Ensure payment is counted once and only once.
- Preserve the existing reconciliation and financial reporting logic.

If the salesperson and cashier belong to different cash sessions, use the existing cash-session rules to determine which session owns the payment. Document and test that decision.

Do not assume that creating a bill means money has been received.

## 10. Offline-First Compatibility

MediFlow IQ must preserve its existing offline-first architecture.

Inspect the current Dexie schema, offline POS behavior, operation IDs, sync queue, conflict handling, and synchronization services.

Do not claim that a separate cashier workflow is fully synchronized merely because the salesperson can save a bill locally.

Implement a safe, explicit policy for offline operation:

- Preserve the existing single-person offline POS behavior.
- Allow pending bills to be saved locally only if supported by the existing architecture.
- Clearly distinguish locally queued bills from server-confirmed bills.
- Never represent an unconfirmed offline payment as server-verified.
- Prevent duplicate transactions during synchronization.
- Handle retries and interrupted synchronization idempotently.
- Clearly communicate when the cashier cannot access a bill because it has not reached the server.
- Do not allow two offline devices to independently confirm the same payment without authoritative reconciliation.

For the separate cashier workflow, prefer server-confirmed pending bills and online payment confirmation unless a safe offline design already exists. Explain this limitation in the UI.

Do not weaken existing offline guarantees to implement this feature.

## 11. Database Migrations and Security

Inspect the current migrations before adding any schema changes.

Use new forward-only migrations following the existing migration naming and numbering conventions.

Potential changes may include workflow configuration, bill submission metadata, cashier attribution, payment status transitions, or reservation data, but add only what the inspected architecture actually requires.

Requirements:

- Preserve existing records.
- Add appropriate foreign keys, indexes, constraints, and uniqueness rules.
- Apply organization and branch isolation consistently.
- Review and maintain Row Level Security policies.
- Do not expose service-role credentials to the browser.
- Ensure payment and stock operations are authorized server-side.
- Avoid unnecessary tables, repeated data, and expensive realtime subscriptions.

Do not edit historical migrations that have already been applied to deployed environments unless the established project workflow explicitly requires it.

## 12. Testing Requirements

Add or update automated tests using the existing test framework.

Cover at least:

1. Existing single-person POS still completes sales and prints receipts.
2. Existing single-person POS remains the default after migration.
3. Authorized salesperson can submit a bill.
4. Unauthorized staff cannot submit or process bills outside their permissions.
5. Authorized cashier can see and process permitted pending bills.
6. Pending bills do not count as paid sales or collected cash.
7. Payment completion creates exactly one payment and one completed sale.
8. Repeated requests do not duplicate sales, stock movements, or payments.
9. Concurrent cashiers cannot complete the same bill twice.
10. Insufficient stock or an expired batch prevents unsafe completion.
11. Cancellation and stock reservation cleanup work correctly where reservations are used.
12. Cash-session attribution and financial reconciliation remain accurate.
13. Receipt printing and reprinting do not create financial transactions.
14. RLS prevents access to another organization's or unauthorized branch's bills.
15. Offline retries and synchronization preserve idempotency.
16. Workflow settings cannot be bypassed through direct API requests.
17. The three-stage handover flow works only when enabled and authorized.

Run the available lint, type-check, tests, and production build. Fix regressions caused by this implementation.

## 13. Implementation Approach

Proceed in this order:

1. Inspect and report the existing POS architecture and transaction lifecycle.
2. Identify the smallest safe changes required.
3. Document the proposed workflow states, permissions, and stock-handling decisions.
4. Implement the database migration if necessary.
5. Extend the existing services and API endpoints.
6. Add the configurable setting.
7. Implement the cashier queue and payment interface.
8. Integrate receipts, cash sessions, audit logs, and reports.
9. Verify offline compatibility and synchronization.
10. Add and run tests.
11. Run lint, type-check, and production build.
12. Summarize all changes and any remaining limitations.

Do not stop after producing a plan unless a genuine architectural blocker requires clarification. Implement the feature using the existing project conventions.

Do not refactor unrelated modules, redesign the entire application, or replace working components unnecessarily.

## 14. Final Report

When finished, report:

- Files created and modified.
- Database migrations added.
- How both checkout workflows work.
- How permissions and transaction integrity are enforced.
- How stock is handled between bill submission and payment.
- How receipts and cash sessions work.
- What happens during internet outages.
- Tests and build commands executed, with their actual results.
- Any incomplete items or known risks.

**Acceptance criterion:** A pharmacy can retain the existing one-person POS or enable a separate salesperson-and-cashier workflow, while both modes use the same reliable transaction, inventory, payment, receipt, audit, and reporting infrastructure wherever applicable.