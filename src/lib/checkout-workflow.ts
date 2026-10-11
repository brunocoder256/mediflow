/**
 * Checkout workflow helpers (MediFlow IQ).
 *
 * Single source of truth for the optional "separate salesperson and cashier"
 * checkout workflow. The setting is stored on `organization_settings
 * .checkout_workflow` and may only be switched away from the default on the
 * Pharmacy (pro) and Enterprise plans.
 *
 * Workflow A — `single_person` (default, unchanged): one staff member prepares
 * and completes the sale at the POS.
 * Workflow B — `salesperson_cashier`: a salesperson submits a bill, a cashier
 * records payment.
 * Workflow B+ — `three_stage`: as above, plus an authorised handover stage.
 */

export type CheckoutWorkflow = "single_person" | "salesperson_cashier" | "three_stage";

export const DEFAULT_CHECKOUT_WORKFLOW: CheckoutWorkflow = "single_person";

export const CHECKOUT_WORKFLOWS: readonly CheckoutWorkflow[] = [
  "single_person",
  "salesperson_cashier",
  "three_stage",
] as const;

export const CHECKOUT_WORKFLOW_LABELS: Record<CheckoutWorkflow, { name: string; description: string }> = {
  single_person: {
    name: "Single-Person POS",
    description: "One staff member prepares the sale and records payment (current behaviour).",
  },
  salesperson_cashier: {
    name: "Separate Salesperson and Cashier",
    description: "A salesperson submits the bill; a cashier collects the payment and prints the receipt.",
  },
  three_stage: {
    name: "Three-Stage Workflow",
    description: "Salesperson prepares the bill, cashier takes payment, dispensing staff confirm handover.",
  },
};

export function isCheckoutWorkflow(value: unknown): value is CheckoutWorkflow {
  return typeof value === "string" && (CHECKOUT_WORKFLOWS as readonly string[]).includes(value);
}

export function normalizeCheckoutWorkflow(value: unknown): CheckoutWorkflow {
  return isCheckoutWorkflow(value) ? value : DEFAULT_CHECKOUT_WORKFLOW;
}

/** Only the Pharmacy (pro) and Enterprise tiers may use a multi-person checkout. */
export function planAllowsSeparateCheckout(planTier: unknown): boolean {
  return planTier === "pro" || planTier === "enterprise";
}

/**
 * True when the organization is actually running a separate salesperson/cashier
 * checkout. This requires BOTH a non-default workflow setting and an eligible
 * plan — a starter/drug-shop org can never activate it even if the row says so.
 */
export function isSeparateCheckout(workflow: unknown, planTier: unknown): boolean {
  return normalizeCheckoutWorkflow(workflow) !== DEFAULT_CHECKOUT_WORKFLOW && planAllowsSeparateCheckout(planTier);
}

/** True when a paid sale additionally requires a handover confirmation. */
export function requiresHandover(workflow: unknown, planTier: unknown): boolean {
  return isSeparateCheckout(workflow, planTier) && normalizeCheckoutWorkflow(workflow) === "three_stage";
}

/**
 * Decide the workflow to persist for a given organization. Setting the workflow
 * to a non-default value on a plan that does not include the feature is
 * rejected with a clear error so the API/settings UI can return 403.
 */
export function resolveCheckedWorkflow(
  requested: unknown,
  planTier: unknown,
): { ok: true; workflow: CheckoutWorkflow } | { ok: false; error: string } {
  if (!isCheckoutWorkflow(requested)) {
    return { ok: false, error: "Invalid checkout workflow" };
  }
  if (requested !== DEFAULT_CHECKOUT_WORKFLOW && !planAllowsSeparateCheckout(planTier)) {
    return {
      ok: false,
      error: "Separate salesperson/cashier checkout is available on the Pharmacy and Enterprise plans only",
    };
  }
  return { ok: true, workflow: requested };
}
