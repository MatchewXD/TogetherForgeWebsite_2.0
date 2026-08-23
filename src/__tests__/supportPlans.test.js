import { describe, it, expect } from 'vitest';
import {
  ONCE_TIERS,
  MONTH_TIERS,
  planLabelFromTier,
  formatPlanAmount,
  describePlanStatus,
  listVisibleSupportPerks,
  forgeMarksPerkText,
} from '../constants/supportPlans';

describe('supportPlans', () => {
  it('has one-time $5 / $20 / $50 and monthly $5 / $15 / $40', () => {
    expect(ONCE_TIERS.map((t) => t.amount)).toEqual([5, 20, 50]);
    expect(MONTH_TIERS.map((t) => t.amount)).toEqual([5, 15, 40]);
  });

  it('lists published Forge Marks on each preset tier', () => {
    expect(ONCE_TIERS.map((t) => t.marks)).toEqual([500, 2000, 6000]);
    expect(MONTH_TIERS.map((t) => t.marks)).toEqual([500, 1500, 4800]);
    expect(forgeMarksPerkText(2000, 'once')).toBe('2,000 Forge Marks');
    expect(forgeMarksPerkText(1500, 'month')).toBe(
      '1,500 Forge Marks per month'
    );
  });

  it('lists concrete perks without Everything above or public-credit hedges', () => {
    const groups = [
      { tiers: ONCE_TIERS, interval: 'once' },
      { tiers: MONTH_TIERS, interval: 'month' },
    ];
    for (const { tiers, interval } of groups) {
      for (const t of tiers) {
        const all = listVisibleSupportPerks(t, {
          publicCredit: true,
          interval,
        }).map((p) => p.text);
        expect(all.length).toBeGreaterThan(0);
        for (const p of all) {
          expect(p.toLowerCase()).not.toMatch(/everything above/);
          expect(p.toLowerCase()).not.toMatch(/discord role/);
          expect(p.toLowerCase()).not.toMatch(/prototype peek/);
          expect(p.toLowerCase()).not.toMatch(/game credits/);
          expect(p.toLowerCase()).not.toMatch(/if you choose public credit/);
        }
      }
    }
  });

  it('hides public thank-you lines when credit is anonymous', () => {
    const once = listVisibleSupportPerks(ONCE_TIERS[0], {
      publicCredit: false,
      interval: 'once',
    });
    expect(once.map((p) => p.text)).toEqual([
      'Donor badge and donation milestones on your profile',
      '500 Forge Marks',
    ]);
    expect(once.some((p) => /thank-you|recent supporters/i.test(p.text))).toBe(
      false
    );

    const named = listVisibleSupportPerks(ONCE_TIERS[0], {
      publicCredit: true,
      interval: 'once',
    });
    expect(named.map((p) => p.text)).toEqual([
      'Public thank-you on the Donate page',
      'Visibility on the recent supporters list',
      'Donor badge and donation milestones on your profile',
      '500 Forge Marks',
    ]);
  });

  it('keeps donor badge and Marks on monthly tiers without repeating Active Subscriber', () => {
    for (const t of MONTH_TIERS) {
      const perks = listVisibleSupportPerks(t, {
        publicCredit: true,
        interval: 'month',
      });
      const texts = perks.map((p) => p.text);
      expect(texts).toContain(
        'Donor badge and donation milestones on your profile'
      );
      expect(texts.some((p) => /active subscriber/i.test(p))).toBe(false);
      expect(texts.some((p) => /if you choose public credit/i.test(p))).toBe(
        false
      );
      expect(perks.find((p) => p.emphasize)?.text).toMatch(
        /Forge Marks per month$/
      );
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
