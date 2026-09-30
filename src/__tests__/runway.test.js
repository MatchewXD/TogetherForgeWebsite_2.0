import { describe, it, expect } from 'vitest';
import {
  assumedRunwayGiftCount,
  estimateRunwayServiceFeesCents,
  formatRunwayCoverage,
  formatRunwayUsd,
  runwayCoverageMonths,
  runwayGoalProgress,
  runwayGoalTicks,
  runwayMoneyStack,
  RUNWAY_AFTER_FEES_GOAL_USD,
  RUNWAY_ASSUMED_GIFT_USD,
  RUNWAY_FEE_BUFFER_USD,
  RUNWAY_GOAL_TICK_USD,
  RUNWAY_KOFI_ONE_TIME_TIP_FEE_RATE,
  RUNWAY_LIVING_LINES,
  RUNWAY_LIVING_YEAR_USD,
  RUNWAY_MONTHLY_LIVING_USD,
  RUNWAY_RAISE_GOAL_CENTS,
  RUNWAY_NET_GOAL_USD,
  RUNWAY_RAISE_GOAL_USD,
  RUNWAY_TAX_RESERVE_PCT,
  RUNWAY_TAX_RESERVE_USD,
  RUNWAY_TOTALS_COPY,
} from '../constants/runway';

describe('published runway budget', () => {
  it('locks the $80,000 raise stack', () => {
    const monthly = RUNWAY_LIVING_LINES.reduce((n, line) => n + line.monthlyUsd, 0);
    expect(monthly).toBe(4338);
    expect(RUNWAY_MONTHLY_LIVING_USD).toBe(4338);
    expect(RUNWAY_LIVING_YEAR_USD).toBe(52056);
    expect(RUNWAY_NET_GOAL_USD).toBe(52056);
    expect(RUNWAY_TAX_RESERVE_USD).toBe(17352);
    expect(RUNWAY_AFTER_FEES_GOAL_USD).toBe(69408);
    expect(RUNWAY_FEE_BUFFER_USD).toBe(1000);
    expect(RUNWAY_RAISE_GOAL_USD).toBe(80000);
    expect(RUNWAY_ASSUMED_GIFT_USD).toBe(5);
    expect(RUNWAY_KOFI_ONE_TIME_TIP_FEE_RATE).toBe(0);
    expect(RUNWAY_MONTHLY_LIVING_USD * 12).toBe(RUNWAY_LIVING_YEAR_USD);
    expect(RUNWAY_TAX_RESERVE_USD).toBe(
      Math.round(RUNWAY_AFTER_FEES_GOAL_USD * RUNWAY_TAX_RESERVE_PCT)
    );
    expect(RUNWAY_NET_GOAL_USD + RUNWAY_TAX_RESERVE_USD).toBe(
      RUNWAY_AFTER_FEES_GOAL_USD
    );
    expect(RUNWAY_TOTALS_COPY.raise).toBe('Public raise goal: $80,000');
    expect(RUNWAY_TOTALS_COPY.grandNote).toMatch(/\$80,000/);
    expect(RUNWAY_TOTALS_COPY.grandNote).toMatch(/\$69,408/);
    expect(RUNWAY_TOTALS_COPY.grandNote).toMatch(/\$17,352/);
    expect(RUNWAY_TOTALS_COPY.grandNote).toMatch(/\$52,056/);
    expect(RUNWAY_TOTALS_COPY.grandNote).not.toMatch(/extra \$1,000/);
  });
});

describe('runwayMoneyStack', () => {
  it('estimates PayPal fees as $5 gifts until a stored net exists', () => {
    expect(assumedRunwayGiftCount(5 * 100)).toBe(1);
    expect(assumedRunwayGiftCount(80000 * 100)).toBe(16000);
    const five = estimateRunwayServiceFeesCents(5 * 100);
    expect(five).toBe(Math.round(500 * 0.0349 + 49));
    const goal = estimateRunwayServiceFeesCents(80000 * 100);
    expect(goal).toBe(Math.round(80000 * 100 * 0.0349 + 49 * 16000));
    const stack = runwayMoneyStack({
      raisedCents: 80000 * 100,
      paymentCount: 1,
    });
    expect(stack.feesEstimated).toBe(true);
    expect(stack.feeCents).toBe(goal);
    expect(stack.afterFeesCents).toBe(80000 * 100 - goal);
    expect(stack.taxReserveCents).toBe(Math.round((80000 * 100 - goal) * 0.25));
    expect(stack.runwayNetCents).toBe(
      stack.afterFeesCents - stack.taxReserveCents
    );
  });

  it('uses stored PayPal net when present', () => {
    const stack = runwayMoneyStack({
      raisedCents: 10000,
      paymentCount: 1,
      afterFeesCents: 9600,
    });
    expect(stack.feesEstimated).toBe(false);
    expect(stack.afterFeesCents).toBe(9600);
    expect(stack.taxReserveCents).toBe(2400);
    expect(stack.runwayNetCents).toBe(7200);
  });
});

describe('runwayCoverageMonths', () => {
  it('is zero when nothing is raised', () => {
    expect(runwayCoverageMonths(0)).toBe(0);
  });

  it('hits 12 months at the $80,000 raise goal', () => {
    expect(runwayCoverageMonths(RUNWAY_RAISE_GOAL_CENTS)).toBe(12);
    expect(runwayCoverageMonths(RUNWAY_RAISE_GOAL_CENTS / 2)).toBe(6);
  });

  it('is short of 12 months at $72,000', () => {
    const months = runwayCoverageMonths(72000 * 100);
    expect(months).toBeCloseTo((72000 / 80000) * 12);
    expect(months).toBeLessThan(12);
  });
});

describe('runwayGoalTicks', () => {
  it('places a mark every $1,000 up to the $80,000 raise goal', () => {
    const ticks = runwayGoalTicks();
    expect(RUNWAY_GOAL_TICK_USD).toBe(1000);
    expect(ticks).toHaveLength(79);
    expect(ticks[0]).toMatchObject({ usd: 1000, major: false });
    expect(ticks[4]).toMatchObject({ usd: 5000, major: true });
    expect(ticks[ticks.length - 1]).toMatchObject({ usd: 79000 });
    expect(ticks[ticks.length - 1].pct).toBeCloseTo((79000 / 80000) * 100);
  });
});

describe('runwayGoalProgress', () => {
  it('fills 0–100% before the raise goal and does not show a multiplier', () => {
    const mid = runwayGoalProgress(40000, 80000);
    expect(mid.showMultiplier).toBe(false);
    expect(mid.fillPct).toBe(50);
    expect(runwayGoalProgress(0, 80000).fillPct).toBe(0);
  });

  it('shows floor(times) and the leftover fraction after the goal', () => {
    const justOver = runwayGoalProgress(80000 * 1.01, 80000);
    expect(justOver.showMultiplier).toBe(true);
    expect(justOver.multiplier).toBe(1);
    expect(justOver.fillPct).toBeCloseTo(1);

    const triple = runwayGoalProgress(80000 * 3.3, 80000);
    expect(triple.multiplier).toBe(3);
    expect(triple.fillPct).toBeCloseTo(30);

    const exact = runwayGoalProgress(80000 * 2, 80000);
    expect(exact.multiplier).toBe(2);
    expect(exact.fillPct).toBe(100);
  });
});

describe('formatRunwayUsd', () => {
  it('floors whole dollars and keeps cents when asked', () => {
    expect(formatRunwayUsd(3.99)).toBe('$3');
    expect(formatRunwayUsd(3.01)).toBe('$3');
    expect(formatRunwayUsd(3)).toBe('$3');
    expect(formatRunwayUsd(3.99, { cents: true })).toBe('$3.99');
  });
});

describe('formatRunwayCoverage', () => {
  it('shows days, then months and days, and omits months when zero', () => {
    expect(formatRunwayCoverage(0)).toBe('0 days');
    expect(formatRunwayCoverage(1 / 60)).toBe('less than a day');
    expect(formatRunwayCoverage(1 / 30)).toBe('1 day');
    expect(formatRunwayCoverage(0.5)).toBe('15 days');
    expect(formatRunwayCoverage(1)).toBe('1 month');
    expect(formatRunwayCoverage(1 + 1 / 30)).toBe('1 month 1 day');
    expect(formatRunwayCoverage(1.5)).toBe('1 month 15 days');
    expect(formatRunwayCoverage(3)).toBe('3 months');
  });
});
