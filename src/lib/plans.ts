/**
 * MediFlow IQ subscription plans.
 *
 * Single source of truth for the three subscription tiers. The price is billed
 * per month (UGX). Each tier is positioned for a different kind of business and
 * lists the system features that matter most to it. Every plan currently unlocks
 * the full system; higher tiers build on the ones below them.
 */

export type PlanTier = "starter" | "pro" | "enterprise";

export type PlanDefinition = {
  tier: PlanTier;
  name: string;
  audience: string;
  price: number;
  tagline: string;
  recommended?: boolean;
  /** If set, this plan includes everything in the referenced plan. */
  inherits?: PlanTier;
  features: string[];
};

export const PLAN_TIERS: PlanTier[] = ["starter", "pro", "enterprise"];

export const PLANS: PlanDefinition[] = [
  {
    tier: "starter",
    name: "Starter",
    audience: "For Drug Shops",
    price: 20000,
    tagline: "The everyday essentials for a single-counter drug shop.",
    features: [
      "Sales & POS with barcode scanning",
      "Cash & mobile money payments",
      "Receipts & discounts",
      "Product catalog with SKUs & barcodes",
      "Stock levels with low-stock alerts",
      "Batch & expiry tracking",
      "Customer records",
      "Expense tracking",
      "Daily sales & stock reports",
      "Offline mode with auto-sync",
    ],
  },
  {
    tier: "pro",
    name: "Pharmacy Pro",
    audience: "For Retail Pharmacies",
    price: 50000,
    tagline: "Run a full retail pharmacy from counter to back office.",
    recommended: true,
    inherits: "starter",
    features: [
      "Purchasing: requests, purchase orders & approvals",
      "Goods received (GRN) with batch & expiry capture",
      "Suppliers with balances, payments & credit approvals",
      "Purchase returns & supplier statements",
      "Customer credit, balances & statements",
      "Customer returns & refunds",
      "Split payments (cash + mobile money + card)",
      "Expiry & disposal management",
      "Cash sessions with expected vs counted reconciliation",
      "Gross profit, inventory valuation & purchasing reports",
      "Multi-user roles & granular permissions",
    ],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    audience: "For Chains & Wholesalers",
    price: 100000,
    tagline: "Control multiple branches, teams and high volumes.",
    inherits: "pro",
    features: [
      "Multi-branch management & branch-level access",
      "Inter-branch stock transfers",
      "Stock takes / counts with reconciliation",
      "Approval workflows for adjustments & spending",
      "Cash variance approval",
      "Advanced cross-branch analytics",
      "Full audit trail (activity, transaction & approval history)",
      "Price history & supplier performance",
      "Documents, notes & richer exports (CSV, Excel, PDF)",
    ],
  },
];

export const DEFAULT_PLAN_TIER: PlanTier = "starter";

/** The lowest monthly price across all plans (used for "from UGX x" copy). */
export const MIN_PLAN_PRICE = Math.min(...PLANS.map((p) => p.price));

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && (PLAN_TIERS as string[]).includes(value);
}

/** Resolve a plan by tier, falling back to the default plan. */
export function getPlan(tier: string | null | undefined): PlanDefinition {
  return PLANS.find((p) => p.tier === tier) ?? PLANS.find((p) => p.tier === DEFAULT_PLAN_TIER)!;
}

export function planName(tier: string | null | undefined): string {
  return getPlan(tier).name;
}

export function planPrice(tier: string | null | undefined): number {
  return getPlan(tier).price;
}

/** Format an integer UGX amount with thousands separators (e.g. UGX 50,000). */
export function formatPlanPrice(amount: number): string {
  return `UGX ${amount.toLocaleString("en-UG")}`;
}
