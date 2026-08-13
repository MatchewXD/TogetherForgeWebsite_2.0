import { describe, it, expect } from 'vitest';
import {
  ONCE_TIERS,
  MONTH_TIERS,
  planLabelFromTier,
  formatPlanAmount,
  describePlanStatus,
} from '../constants/supportPlans';

describe('supportPlans', () => {
  it('has one-time $5 / $20 / $50 and monthly $5 / $15 / $40', () => {
    expect(ONCE_TIERS.map((t) => t.amount)).toEqual([5, 20, 50]);
    expect(MONTH_TIERS.map((t) => t.amount)).toEqual([5, 15, 40]);
  });

  it('lists concrete perks without Everything above', () => {
    for (const t of [...ONCE_TIERS, ...MONTH_TIERS]) {
      expect(t.perks.length).toBeGreaterThan(0);
      for (const p of t.perks) {
        expect(p.toLowerCase()).not.toMatch(/everything above/);
        expect(p.toLowerCase()).not.toMatch(/discord role/);
        expect(p.toLowerCase()).not.toMatch(/prototype peek/);
        expect(p.toLowerCase()).not.toMatch(/game credits/);
      }
    }
  });

  it('formats plan labels and amounts', () => {
    expect(planLabelFromTier('member', 1500)).toBe('Forge Member');
    expect(formatPlanAmount(500, 'month')).toBe('$5/month');
    expect(formatPlanAmount(2000, 'once')).toBe('$20');
  });

  it('describes canceling status with expiry tone', () => {
    const d = describePlanStatus({
      status: 'active',
      cancel_at_period_end: true,
    });
    expect(d.label).toBe('Canceling');
    expect(d.tone).toBe('warning');
  });

  it('describes active, past_due, and canceled statuses', () => {
    expect(describePlanStatus({ status: 'active' })).toMatchObject({
      label: 'Active',
      tone: 'success',
    });
    expect(describePlanStatus({ status: 'trialing' }).label).toBe('Active');
    expect(describePlanStatus({ status: 'past_due' })).toMatchObject({
      label: 'Past due',
      tone: 'danger',
    });
    expect(describePlanStatus({ status: 'canceled' }).label).toBe('Canceled');
    expect(describePlanStatus(null).label).toMatch(/no active plan/i);
  });
});
