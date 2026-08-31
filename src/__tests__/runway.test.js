import { describe, it, expect } from 'vitest';
import {
  estimateRunwayServiceFeesCents,
  formatRunwayCoverage,
  runwayCoverageMonths,
  runwayGoalTicks,
  runwayMoneyStack,
  RUNWAY_AFTER_FEES_GOAL_USD,
  RUNWAY_GOAL_TICK_USD,
  RUNWAY_KOFI_ONE_TIME_TIP_FEE_RATE,
  RUNWAY_LIVING_LINES,
  RUNWAY_LIVING_YEAR_USD,
  RUNWAY_MONTHLY_COST_CENTS,
  RUNWAY_MONTHLY_LIVING_USD,
  RUNWAY_NET_GOAL_USD,
  RUNWAY_RAISE_GOAL_USD,
  RUNWAY_TAX_RESERVE_PCT,
  RUNWAY_TAX_RESERVE_USD,
} from '../constants/runway';

describe('published runway budget', () => {
  it('locks the $79,000 raise stack', () => {
    const monthly = RUNWAY_LIVING_LINES.reduce((n, line) => n + line.monthlyUsd, 0);
    expect(monthly).toBe(4338);
    expect(RUNWAY_MONTHLY_LIVING_USD).toBe(4338);
    expect(RUNWAY_LIVING_YEAR_USD).toBe(52056);
    expect(RUNWAY_NET_GOAL_USD).toBe(52056);
    expect(RUNWAY_TAX_RESERVE_USD).toBe(17352);
    expect(RUNWAY_AFTER_FEES_GOAL_USD).toBe(69408);
    expect(RUNWAY_RAISE_GOAL_USD).toBe(79000);
    expect(RUNWAY_KOFI_ONE_TIME_TIP_FEE_RATE).toBe(0);
    expect(RUNWAY_MONTHLY_LIVING_USD * 12).toBe(RUNWAY_LIVING_YEAR_USD);
    expect(RUNWAY_TAX_RESERVE_USD).toBe(
      Math.round(RUNWAY_AFTER_FEES_GOAL_USD * RUNWAY_TAX_RESERVE_PCT)
    );
    expect(RUNWAY_NET_GOAL_USD + RUNWAY_TAX_RESERVE_USD).toBe(
      RUNWAY_AFTER_FEES_GOAL_USD
    );
  });
});

describe('runwayMoneyStack', () => {
  it('estimates PayPal fees until a stored net exists', () => {
    const fees = estimateRunwayServiceFeesCents(300, 1);
    expect(fees).toBe(Math.round(300 * 0.0349 + 49));
    const stack = runwayMoneyStack({ raisedCents: 300, paymentCount: 1 });
    expect(stack.feesEstimated).toBe(true);
    expect(stack.feeCents).toBe(fees);
    expect(stack.afterFeesCents).toBe(300 - fees);
    expect(stack.taxReserveCents).toBe(Math.round((300 - fees) * 0.25));
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

  it('uses the $4,338 / month living total', () => {
    expect(runwayCoverageMonths(RUNWAY_MONTHLY_COST_CENTS)).toBe(1);
    expect(runwayCoverageMonths(RUNWAY_MONTHLY_COST_CENTS * 12)).toBe(12);
  });
});

describe('runwayGoalTicks', () => {
  it('places a mark every $1,000 up to the $79,000 raise goal', () => {
    const ticks = runwayGoalTicks();
    expect(RUNWAY_GOAL_TICK_USD).toBe(1000);
    expect(ticks).toHaveLength(78);
    expect(ticks[0]).toMatchObject({ usd: 1000, major: false });
    expect(ticks[4]).toMatchObject({ usd: 5000, major: true });
    expect(ticks[ticks.length - 1]).toMatchObject({ usd: 78000 });
    expect(ticks[ticks.length - 1].pct).toBeCloseTo((78000 / 79000) * 100);
  });
});

describe('formatRunwayCoverage', () => {
  it('formats months and short coverage', () => {
    expect(formatRunwayCoverage(0)).toBe('0 months');
    expect(formatRunwayCoverage(1)).toBe('1 month');
    expect(formatRunwayCoverage(3)).toBe('3 months');
    expect(formatRunwayCoverage(1.5)).toBe('1.5 months');
    expect(formatRunwayCoverage(0.5)).toMatch(/day/);
  });
});
