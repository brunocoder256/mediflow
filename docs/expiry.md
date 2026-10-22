# MediFlow IQ — Secure Batch Expiry-Date Correction Implementation

## OBJECTIVE

Implement a secure, auditable **Batch Expiry-Date Correction** feature in the existing MediFlow IQ pharmacy and drug-shop management system.

A user requested the ability to edit expiry dates from the product detail edit interface. Do NOT implement unrestricted expiry-date editing as an ordinary product field. Instead, implement a dedicated, permission-controlled batch correction workflow.

The feature must support legitimate data-entry corrections while preventing expiry manipulation, preserving FEFO (First Expiry, First Out), and maintaining inventory traceability.

**IMPORTANT:** This is an enhancement to the existing application. Do not rebuild the application, replace existing services, introduce unnecessary dependencies, or break existing functionality.

## PHASE 1 — INSPECT THE EXISTING IMPLEMENTATION

Before writing code:

1. Inspect the existing product details and product edit pages.
2. Locate the existing batch management and inventory services.
3. Identify how batch expiry dates are stored and retrieved in Supabase/PostgreSQL.
4. Inspect the existing FEFO selection logic used by the POS.
5. Inspect the existing authentication, organization and branch authorization, RBAC permissions, audit logs, notifications, and offline synchronization mechanisms.
6. Identify whether batch corrections must work with existing offline functionality.
7. Inspect relevant database migrations, constraints, triggers, RPCs, and transaction handling.
8. Reuse existing project conventions and components.

Produce a brief implementation plan based on the actual codebase, then implement the feature. Do not stop after providing the plan.

## PHASE 2 — SEPARATE PRODUCT DETAILS FROM BATCH DETAILS

Maintain a clear distinction between product-level information and batch-level information.

Product-level fields include:
- Product name, brand, generic name, strength, dosage form, category, units, and other existing product metadata.

Batch-level fields include:
- Batch number.
- Expiry date.
- Available quantity.
- Purchase cost and other existing batch-specific information.
- Supplier or goods-received references where available.

Do not add an unrestricted expiry-date field to the ordinary product edit form.

On the product details page, display the product's batches and their individual expiry dates using the existing UI design and responsive layout.

For each eligible batch, show a clearly labeled action such as **Correct Expiry Date**, subject to authorization.

A correction must affect only the selected batch. It must never overwrite the expiry dates of other batches belonging to the same product.

## PHASE 3 — IMPLEMENT THE SECURE CORRECTION WORKFLOW

When an authorized user selects "Correct Expiry Date", open a professional modal or dedicated form containing:

- Product name and identifier.
- Batch number.
- Current recorded expiry date, displayed as read-only.
- Proposed corrected expiry date.
- Mandatory correction reason.
- Confirmation of the correction.
- A clear warning that the change affects inventory expiry alerts, FEFO prioritization, and potentially stock eligibility.

Show a confirmation summary before committing the change.

After a successful correction:
- Display a success notification.
- Refresh the batch details and relevant inventory views.
- Recalculate or refresh FEFO ordering.
- Refresh relevant expiry notifications and reports.
- Update any applicable cached data safely.

If validation fails, explain the problem without changing the original batch data.

## PHASE 4 — ENFORCE ROLE-BASED AUTHORIZATION

Integrate with the existing RBAC system. Do not invent a parallel authorization mechanism.

Create or reuse a dedicated permission, for example:

`inventory.batch_expiry.correct`

Follow the application's existing permission naming and role conventions.

Requirements:

1. Ordinary cashiers and sales-only users must not be permitted to correct expiry dates unless explicitly granted the dedicated permission.
2. Authorized inventory managers or pharmacists may request corrections according to the configured permissions.
3. Where supported by the existing RBAC architecture, provide an optional separate approval permission for sensitive corrections.
4. Enforce authorization on the server or database layer, not only by hiding frontend buttons.
5. Verify the authenticated user, organization, branch access, and selected batch ownership before accepting a correction.
6. Prevent unauthorized cross-organization and cross-branch modifications.
7. Never trust organization IDs, branch IDs, user IDs, or permission claims supplied solely by the client.
8. Use the existing secure server-side authorization helpers and Supabase RLS policies.

If a dedicated permission requires a migration or seed update, implement it using the project's established migration conventions.

## PHASE 5 — VALIDATE CORRECTIONS AND PRESERVE TRACEABILITY

Implement strict server-side validation.

- Require a valid expiry date and a non-empty reason.
- Validate the date using the existing application's date conventions.
- Reject malformed dates and impossible values.
- Do not silently convert between local dates and UTC timestamps in ways that shift the expiry date.
- Do not automatically prohibit a correction merely because the proposed date is in the past: genuine historical data-entry corrections must remain reviewable. However, a past-dated batch must remain subject to the existing expired-stock controls.
- Flag suspicious or high-impact changes for additional review where appropriate.
- Do not allow the correction workflow to modify the product's identity, batch number, stock quantity, purchase cost, supplier history, or existing sales records.

Do not assume every date change is fraudulent. The goal is to preserve accurate records while preventing abuse.

### Audit history

Record every correction attempt that reaches the authoritative correction workflow, including rejected or failed attempts where feasible within the existing audit architecture.

For each attempt, capture:
- Batch ID and product ID.
- Organization and branch identifiers.
- Previous expiry date.
- Proposed expiry date.
- Outcome: approved, rejected, or failed.
- Mandatory reason.
- Authenticated actor.
- Timestamp.
- Approval actor and timestamp, when approval is required.
- Relevant request or operation ID for idempotency and troubleshooting.

Use the existing audit log schema where practical. If the current schema cannot represent expiry corrections adequately, introduce a properly indexed migration or dedicated append-only correction history table.

The audit record must not be editable or deletable through ordinary application permissions. Do not expose sensitive audit information to unauthorized users.

Preserve the previous expiry date before changing the batch record. Do not rely solely on frontend logging.

## PHASE 6 — DATABASE ATOMICITY AND CONCURRENCY

Expiry correction must be performed through the existing secure service or an appropriately secured PostgreSQL transaction/RPC.

The authoritative operation must:

1. Authenticate and authorize the actor.
2. Verify access to the target batch.
3. Read and validate the current batch state.
4. Validate the requested correction and any required approval.
5. Record the correction in the audit history.
6. Update the batch expiry date.
7. Commit all required changes atomically.

If any required database operation fails, roll back the entire correction so that the batch cannot be updated without its corresponding audit record.

Use appropriate row locking, optimistic concurrency checks, or another safe database mechanism to prevent simultaneous edits from silently overwriting one another.

Support an idempotency key or operation ID consistent with existing MediFlow IQ transaction conventions. A retry must not create duplicate successful corrections or produce inconsistent results.

Do not expose a privileged Supabase service-role key in browser code.

If an approval workflow is implemented, distinguish a correction request from an approved correction. A pending request must not alter the authoritative expiry date.

## PHASE 7 — PRESERVE FEFO AND EXPIRED-STOCK PROTECTION

Inspect and reuse the existing POS FEFO implementation. Do not create a second competing batch-selection algorithm.

After an approved correction:

- Ensure the authoritative batch expiry date is used for subsequent FEFO selection.
- Ensure eligible batches are ordered according to the existing FEFO rules.
- Revalidate batch eligibility at the authoritative sale-transaction boundary.
- Keep expired batches excluded from normal sales.
- Preserve existing stock-quantity checks, atomic stock decrements, branch authorization, idempotency, and sales audit records.
- Ensure the frontend cannot bypass expired-stock restrictions by submitting a manually selected batch.
- Ensure expired, quarantined, recalled, or otherwise ineligible batches remain blocked according to existing business rules, even if their expiry date is corrected.
- Never silently change expiry dates as a side effect of a sale, stock count, purchase, product edit, or synchronization process.

If the corrected date changes batch priority, the next eligible sale must use the updated FEFO ordering. Do not rewrite completed historical sales to pretend that a different batch was sold.

Do not weaken existing controls to make the correction feature work.

## PHASE 8 — NOTIFICATIONS, REPORTS, AND OFFLINE SAFETY

Refresh affected expiry-related alerts, inventory reports, and batch views after successful corrections.

Use the existing notification architecture and avoid generating unnecessary duplicate notifications.

Inspect the offline-first architecture before implementing synchronization behavior.

- Do not permit an offline client to silently overwrite an authoritative batch expiry date.
- If offline correction requests are supported, queue them as pending requests and require server-side authorization and validation before applying them.
- Preserve the original expiry date and reason in the queued request.
- Make retries idempotent.
- Handle conflicts when another authorized user changes the same batch before synchronization.
- Never let stale local data overwrite a newer authoritative batch record.
- Clearly indicate pending, rejected, failed, and completed synchronization states.

If the existing offline architecture cannot safely support this operation, disable expiry correction while offline and require a connection. Do not compromise inventory integrity merely to support offline editing.

## PHASE 9 — UI, SECURITY, AND REGRESSION TESTS

Implement responsive UI consistent with the existing MediFlow IQ design. Do not redesign unrelated pages.

Add or update tests covering at least these scenarios:

1. Authorized user corrects an incorrectly entered expiry date.
2. Unauthorized cashier attempts a correction.
3. User attempts to modify a batch belonging to another organization or unauthorized branch.
4. Missing correction reason.
5. Invalid or malformed expiry date.
6. Correction to a past date.
7. Correction of a batch that already has completed sales.
8. Two users attempt to correct the same batch concurrently.
9. Audit record creation fails and the batch update is rolled back.
10. Batch update fails and no successful correction is recorded.
11. Correction changes the expected FEFO order.
12. Expired stock remains excluded from normal POS sales.
13. A manually submitted expired batch is rejected by the authoritative sale service.
14. A quarantined or otherwise ineligible batch remains blocked.
15. An offline correction request is safely rejected, queued for approval, or handled according to the selected supported design.
16. Retrying the same operation does not duplicate the correction.
17. Existing purchases, returns, stock counts, sales, receipts, and inventory calculations continue to work.

Use the existing test framework and conventions. Add database-level tests for authorization and transaction behavior where the project supports them.

## PHASE 10 — ACCEPTANCE CRITERIA

The implementation is complete only when:

- Ordinary product editing cannot silently change batch expiry dates.
- Batch corrections require explicit permission and a mandatory reason.
- Each correction preserves a trustworthy audit trail.
- Database updates and required audit records are atomic.
- FEFO uses the corrected authoritative expiry date.
- Expired, quarantined, and otherwise ineligible batches remain blocked according to existing rules.
- Existing POS behavior, receipts, sales records, stock quantities, and financial calculations remain intact.
- Cross-tenant and unauthorized branch access is prevented.
- Offline synchronization cannot silently overwrite authoritative batch data.
- Relevant tests pass.
- Existing application structure, conventions, and unrelated functionality remain intact.

## IMPLEMENTATION RULES

- Inspect the existing code before making changes.
- Follow the existing MediFlow IQ architecture, Next.js, TypeScript, Supabase, PostgreSQL, RBAC, and offline-first conventions.
- Reuse existing services and shared components where appropriate.
- Avoid duplicate business logic, unnecessary dependencies, broad refactors, and destructive database migrations.
- Do not use mock data or frontend-only authorization.
- Do not claim a test passed unless you actually ran it and verified the result.
- Do not disable existing tests or security policies to make the implementation pass.
- Do not commit, push, or deploy changes unless explicitly instructed.

At completion, provide a concise implementation report containing:
1. Files changed and their purposes.
2. Database migrations or permissions added.
3. How the correction transaction and audit trail work.
4. How FEFO and expired-stock protection were preserved.
5. How offline requests and conflicts are handled.
6. Tests executed and their actual results.
7. Any unresolved risks or follow-up work.

Implement the feature in the existing repository, not as a standalone demonstration.