import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  daysLeftInAccess,
  cyclesLeftInAccess,
  AVG_MONTH_DAYS,
  type TrialGate,
} from '../trial-utils';

function makeGate(overrides: Partial<TrialGate> = {}): TrialGate {
  return {
    organization_id: 'org-1',
    organization_name: 'Test Org',
    status: 'active',
    plan: 'full',
    plan_tier: 'pro',
    blocked: false,
    reason: null,
    trial_ends_at: null,
    paid_cycles: 0,
    access_ends_at: null,
    trial_days: 3,
    contact_phone_1: '0746047086',
    contact_phone_2: '0768082948',
    ...overrides,
  };
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('daysLeftInAccess', () => {
  it('counts whole calendar days until access ends', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
    expect(daysLeftInAccess(makeGate({ access_ends_at: isoDaysFromNow(114) }))).toBe(114);
  });

  it('returns 0 once access has ended', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
    expect(daysLeftInAccess(makeGate({ access_ends_at: isoDaysFromNow(-1) }))).toBe(0);
  });
});

describe('cyclesLeftInAccess', () => {
  it('derives cycles from the live countdown, not the credited total (user scenario: 5 credited, 114 days left → 4)', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
    const gate = makeGate({ paid_cycles: 5, access_ends_at: isoDaysFromNow(114) });
    expect(cyclesLeftInAccess(gate)).toBe(4);
  });

  it('keeps the full credited count at the start of the period', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
    const gate = makeGate({ paid_cycles: 5, access_ends_at: isoDaysFromNow(Math.round(5 * AVG_MONTH_DAYS)) });
    expect(cyclesLeftInAccess(gate)).toBe(5);
  });

  it('still reports 1 cycle during the final partial cycle', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
    const gate = makeGate({ paid_cycles: 1, access_ends_at: isoDaysFromNow(1) });
    expect(cyclesLeftInAccess(gate)).toBe(1);
  });

  it('never shows more cycles than the super-admin credited', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
    const gate = makeGate({ paid_cycles: 2, access_ends_at: isoDaysFromNow(90) });
    expect(cyclesLeftInAccess(gate)).toBe(2);
  });

  it('returns 0 when access has ended or the account is blocked', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
    expect(cyclesLeftInAccess(makeGate({ paid_cycles: 3, access_ends_at: isoDaysFromNow(-1) }))).toBe(0);
    expect(
      cyclesLeftInAccess(makeGate({ paid_cycles: 3, blocked: true, access_ends_at: isoDaysFromNow(30) })),
    ).toBe(0);
  });

  it('returns 0 for trial plans and null gates', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
    expect(
      cyclesLeftInAccess(
        makeGate({ plan: 'trial', paid_cycles: 3, access_ends_at: isoDaysFromNow(30) }),
      ),
    ).toBe(0);
    expect(cyclesLeftInAccess(null)).toBe(0);
  });

  it('decrements as the countdown shrinks over time', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
    const end = isoDaysFromNow(100);
    const gate = makeGate({ paid_cycles: 4, access_ends_at: end });
    expect(cyclesLeftInAccess(gate)).toBe(Math.ceil(100 / AVG_MONTH_DAYS));

    vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0)); // 30 days later
    expect(cyclesLeftInAccess(gate)).toBe(Math.ceil(70 / AVG_MONTH_DAYS));

    vi.setSystemTime(new Date(2026, 11, 25, 12, 0, 0)); // 70 days later → 30 left
    expect(cyclesLeftInAccess(gate)).toBe(1);
  });
});
