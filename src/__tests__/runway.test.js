import { describe, it, expect } from 'vitest';
import {
  formatRunwayCoverage,
  runwayCoverageMonths,
  runwayGoalTicks,
  RUNWAY_GOAL_TICK_USD,
  RUNWAY_GRAND_TOTAL_USD,
  RUNWAY_LIVING_LINES,
  RUNWAY_LIVING_YEAR_USD,
  RUNWAY_MONTHLY_COST_CENTS,
  RUNWAY_MONTHLY_LIVING_USD,
  RUNWAY_TAX_RESERVE_PCT,
  RUNWAY_TAX_RESERVE_USD,
} from '../constants/runway';

describe('published runway budget', () => {
  it('sums monthly lines to $4,338 and a $69,408 year goal', () => {
    const monthly = RUNWAY_LIVING_LINES.reduce((n, line) => n + line.monthlyUsd, 0);
    expect(monthly).toBe(4338);
    expect(RUNWAY_MONTHLY_LIVING_USD).toBe(4338);
    expect(RUNWAY_LIVING_YEAR_USD).toBe(52056);
    expect(RUNWAY_TAX_RESERVE_USD).toBe(17352);
    expect(RUNWAY_GRAND_TOTAL_USD).toBe(69408);
    expect(RUNWAY_MONTHLY_LIVING_USD * 12).toBe(RUNWAY_LIVING_YEAR_USD);
    expect(RUNWAY_TAX_RESERVE_USD).toBe(
      Math.round(RUNWAY_GRAND_TOTAL_USD * RUNWAY_TAX_RESERVE_PCT)
    );
    expect(RUNWAY_LIVING_YEAR_USD + RUNWAY_TAX_RESERVE_USD).toBe(
      RUNWAY_GRAND_TOTAL_USD
    );
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
  it('places a mark every $1,000 up to the $69,408 goal', () => {
    const ticks = runwayGoalTicks();
    expect(RUNWAY_GOAL_TICK_USD).toBe(1000);
    expect(ticks).toHaveLength(69);
    expect(ticks[0]).toMatchObject({ usd: 1000, major: false });
    expect(ticks[4]).toMatchObject({ usd: 5000, major: true });
    expect(ticks[ticks.length - 1]).toMatchObject({ usd: 69000 });
    expect(ticks[ticks.length - 1].pct).toBeCloseTo((69000 / 69408) * 100);
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
