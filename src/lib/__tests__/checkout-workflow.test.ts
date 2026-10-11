import { describe, it, expect } from 'vitest';
import {
  isCheckoutWorkflow,
  normalizeCheckoutWorkflow,
  planAllowsSeparateCheckout,
  isSeparateCheckout,
  requiresHandover,
  resolveCheckedWorkflow,
  DEFAULT_CHECKOUT_WORKFLOW,
  CHECKOUT_WORKFLOWS,
} from '@/lib/checkout-workflow';

describe('checkout workflow — types & normalization', () => {
  it('accepts only known workflow values', () => {
    expect(isCheckoutWorkflow('single_person')).toBe(true);
    expect(isCheckoutWorkflow('salesperson_cashier')).toBe(true);
    expect(isCheckoutWorkflow('three_stage')).toBe(true);
    expect(isCheckoutWorkflow('bogus')).toBe(false);
    expect(isCheckoutWorkflow(undefined)).toBe(false);
    expect(isCheckoutWorkflow(42)).toBe(false);
  });

  it('normalizes unknown/absent values to the single-person default', () => {
    expect(normalizeCheckoutWorkflow(undefined)).toBe(DEFAULT_CHECKOUT_WORKFLOW);
    expect(normalizeCheckoutWorkflow(null)).toBe(DEFAULT_CHECKOUT_WORKFLOW);
    expect(normalizeCheckoutWorkflow('garbage')).toBe(DEFAULT_CHECKOUT_WORKFLOW);
    expect(normalizeCheckoutWorkflow('three_stage')).toBe('three_stage');
  });

  it('exposes the expected catalogue', () => {
    expect(CHECKOUT_WORKFLOWS).toEqual(['single_person', 'salesperson_cashier', 'three_stage']);
  });
});

describe('checkout workflow — plan gating', () => {
  it('only Pharmacy (pro) and Enterprise may use separate checkout', () => {
    expect(planAllowsSeparateCheckout('pro')).toBe(true);
    expect(planAllowsSeparateCheckout('enterprise')).toBe(true);
    expect(planAllowsSeparateCheckout('starter')).toBe(false);
    expect(planAllowsSeparateCheckout(undefined)).toBe(false);
    expect(planAllowsSeparateCheckout('drug_shop')).toBe(false);
  });

  it('a starter org is never separate even if the setting says otherwise', () => {
    expect(isSeparateCheckout('salesperson_cashier', 'starter')).toBe(false);
    expect(isSeparateCheckout('three_stage', 'starter')).toBe(false);
    expect(isSeparateCheckout('salesperson_cashier', 'pro')).toBe(true);
  });

  it('the default workflow is not separate on any plan', () => {
    expect(isSeparateCheckout('single_person', 'pro')).toBe(false);
    expect(isSeparateCheckout('single_person', 'enterprise')).toBe(false);
    expect(isSeparateCheckout(undefined, 'enterprise')).toBe(false);
  });
});

describe('checkout workflow — handover (three-stage)', () => {
  it('requires handover only for three_stage on an eligible plan', () => {
    expect(requiresHandover('three_stage', 'pro')).toBe(true);
    expect(requiresHandover('three_stage', 'enterprise')).toBe(true);
    expect(requiresHandover('three_stage', 'starter')).toBe(false);
    expect(requiresHandover('salesperson_cashier', 'pro')).toBe(false);
    expect(requiresHandover('single_person', 'pro')).toBe(false);
  });
});

describe('checkout workflow — resolveCheckedWorkflow (API/DB gate)', () => {
  it('rejects invalid values', () => {
    const r = resolveCheckedWorkflow('nope', 'enterprise');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Invalid/);
  });

  it('allows the default on any plan', () => {
    expect(resolveCheckedWorkflow('single_person', 'starter')).toEqual({ ok: true, workflow: 'single_person' });
  });

  it('blocks a separate workflow on the starter plan', () => {
    const r = resolveCheckedWorkflow('salesperson_cashier', 'starter');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Pharmacy and Enterprise/);
  });

  it('accepts a separate workflow on pro/enterprise', () => {
    expect(resolveCheckedWorkflow('salesperson_cashier', 'pro')).toEqual({ ok: true, workflow: 'salesperson_cashier' });
    expect(resolveCheckedWorkflow('three_stage', 'enterprise')).toEqual({ ok: true, workflow: 'three_stage' });
  });
});

// Mirrors the BEFORE INSERT guard: a direct COMPLETED insertion must be blocked
// whenever a separate workflow is active (test 16 in docs/advancedpos.md).
function directCompletedSaleBlocked(workflow: unknown, planTier: unknown): boolean {
  return normalizeCheckoutWorkflow(workflow) !== 'single_person' && planAllowsSeparateCheckout(planTier);
}

describe('checkout workflow — direct POS bypass guard', () => {
  it('blocks a direct completed sale while a separate workflow is active', () => {
    expect(directCompletedSaleBlocked('salesperson_cashier', 'pro')).toBe(true);
    expect(directCompletedSaleBlocked('three_stage', 'enterprise')).toBe(true);
  });
  it('does not block the single-person workflow', () => {
    expect(directCompletedSaleBlocked('single_person', 'pro')).toBe(false);
    expect(directCompletedSaleBlocked(undefined, 'enterprise')).toBe(false);
  });
});
