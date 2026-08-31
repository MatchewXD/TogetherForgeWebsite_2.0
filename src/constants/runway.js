/**
 * Founder personal runway (Ko-fi). Never Stripe / studio Support.
 * Published living-cost math for Matthew Seagren — not the LLC tax lockbox.
 */

export const KOFI_PAGE_ID = 'D1D019VNMR';
export const KOFI_PAGE_URL = `https://ko-fi.com/${KOFI_PAGE_ID}`;
export const KOFI_WIDGET_SCRIPT =
  'https://storage.ko-fi.com/cdn/widget/Widget_2.js';
/** Ko-fi widget brand color they provided. */
export const KOFI_WIDGET_COLOR = '#86198F';
export const KOFI_WIDGET_LABEL = 'Support my runway';

export const RUNWAY_LIVING_LINES = [
  { label: 'Housing', monthlyUsd: 1337 },
  { label: 'Transportation', monthlyUsd: 876 },
  { label: 'Food and household', monthlyUsd: 836 },
  { label: 'Utilities and bills', monthlyUsd: 428 },
  {
    label: 'Healthcare',
    monthlyUsd: 520,
    note: 'individual Washington marketplace estimate',
  },
  { label: 'Gym', monthlyUsd: 27 },
  { label: 'Subscriptions', monthlyUsd: 64 },
  {
    label: 'Buffer',
    monthlyUsd: 250,
    note:
      'Buffer is for irregular costs this list will miss: car repairs, replacements, a bad month.',
  },
];

export const RUNWAY_MONTHLY_LIVING_USD = 4338;
export const RUNWAY_LIVING_YEAR_USD = 52056;
/** 25% of the grand total so take-home living is what remains after tax. */
export const RUNWAY_TAX_RESERVE_USD = 17352;
export const RUNWAY_GRAND_TOTAL_USD = 69408;
export const RUNWAY_TAX_RESERVE_PCT = 0.25;

export const RUNWAY_MONTHLY_COST_USD = RUNWAY_MONTHLY_LIVING_USD;
export const RUNWAY_MONTHLY_COST_CENTS = RUNWAY_MONTHLY_LIVING_USD * 100;
export const RUNWAY_YEAR_MONTHS = 12;
export const RUNWAY_GRAND_TOTAL_CENTS = RUNWAY_GRAND_TOTAL_USD * 100;
export const RUNWAY_GOAL_TICK_USD = 1000;

/**
 * Positions for $1,000 marks on the grand-total goal bar (0–100%).
 * @param {number} [goalUsd]
 * @param {number} [tickUsd]
 * @returns {{ usd: number, pct: number, major: boolean }[]}
 */
export function runwayGoalTicks(
  goalUsd = RUNWAY_GRAND_TOTAL_USD,
  tickUsd = RUNWAY_GOAL_TICK_USD
) {
  const goal = Math.max(1, Number(goalUsd) || RUNWAY_GRAND_TOTAL_USD);
  const step = Math.max(1, Number(tickUsd) || RUNWAY_GOAL_TICK_USD);
  const ticks = [];
  for (let usd = step; usd < goal; usd += step) {
    ticks.push({
      usd,
      pct: (usd / goal) * 100,
      major: usd % (step * 5) === 0,
    });
  }
  return ticks;
}

export const RUNWAY_TOTALS_COPY = {
  living: 'Living total: $52,056 per year ($4,338 a month)',
  tax: 'Tax reserve (25%): $17,352',
  grand: 'Grand total: $69,408',
  grandNote:
    '$52,056 is a tight year of living costs. The rest of the goal is a 25% tax reserve, not a higher lifestyle. Studio donations are not part of this fund. This is personal support for Matthew Seagren.',
};

/**
 * @param {number} totalCents
 * @param {number} [monthlyCostCents]
 * @returns {number} fractional months of coverage
 */
export function runwayCoverageMonths(
  totalCents,
  monthlyCostCents = RUNWAY_MONTHLY_COST_CENTS
) {
  const monthly = Math.max(1, Number(monthlyCostCents) || RUNWAY_MONTHLY_COST_CENTS);
  const total = Math.max(0, Number(totalCents) || 0);
  return total / monthly;
}

/**
 * @param {number} months
 * @returns {string}
 */
export function formatRunwayCoverage(months) {
  const n = Number(months);
  if (!Number.isFinite(n) || n <= 0) return '0 months';
  if (n < 1 / 30) return 'less than a day';
  if (n < 1) {
    const days = Math.max(1, Math.round(n * 30));
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded} month${rounded === 1 ? '' : 's'}`;
  }
  return `${rounded.toFixed(1)} months`;
}

export function formatRunwayUsd(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0);
}
