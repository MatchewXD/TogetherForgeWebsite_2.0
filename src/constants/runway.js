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
/** Public amount supporters pay toward (Ko-fi ledger gross). */
export const RUNWAY_RAISE_GOAL_USD = 79000;
/** Target after estimated PayPal fees (Ko-fi one-time tip fee is 0%). */
export const RUNWAY_AFTER_FEES_GOAL_USD = 69408;
/** 25% of what landed after fees. */
export const RUNWAY_TAX_RESERVE_USD = 17352;
/** Living year after tax reserve. */
export const RUNWAY_NET_GOAL_USD = 52056;
export const RUNWAY_TAX_RESERVE_PCT = 0.25;
/** PayPal estimate until a stored net exists on the runway ledger. */
export const RUNWAY_PAYPAL_FEE_RATE = 0.0349;
export const RUNWAY_PAYPAL_FEE_FIXED_USD = 0.49;
export const RUNWAY_KOFI_ONE_TIME_TIP_FEE_RATE = 0;

/** @deprecated use RUNWAY_RAISE_GOAL_USD — public progress target */
export const RUNWAY_GRAND_TOTAL_USD = RUNWAY_RAISE_GOAL_USD;

export const RUNWAY_MONTHLY_COST_USD = RUNWAY_MONTHLY_LIVING_USD;
export const RUNWAY_MONTHLY_COST_CENTS = RUNWAY_MONTHLY_LIVING_USD * 100;
export const RUNWAY_YEAR_MONTHS = 12;
export const RUNWAY_RAISE_GOAL_CENTS = RUNWAY_RAISE_GOAL_USD * 100;
export const RUNWAY_GRAND_TOTAL_CENTS = RUNWAY_RAISE_GOAL_CENTS;
export const RUNWAY_GOAL_TICK_USD = 1000;

/**
 * Positions for $1,000 marks on the grand-total goal bar (0–100%).
 * @param {number} [goalUsd]
 * @param {number} [tickUsd]
 * @returns {{ usd: number, pct: number, major: boolean }[]}
 */
export function runwayGoalTicks(
  goalUsd = RUNWAY_RAISE_GOAL_USD,
  tickUsd = RUNWAY_GOAL_TICK_USD
) {
  const goal = Math.max(1, Number(goalUsd) || RUNWAY_RAISE_GOAL_USD);
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
  living: 'Runway net: $52,056 per year ($4,338 a month)',
  tax: 'Tax reserve (25%): $17,352',
  afterFees: 'After fees: $69,408',
  raise: 'Public raise goal: $79,000',
  grandNote:
    'The public raise goal is $79,000 so about $69,408 lands after estimated PayPal fees (about 3.49% + $0.49 per payment). Ko-fi one-time tip fee is 0%. $17,352 of what lands is a 25% tax reserve. $52,056 is a year of living costs. Studio support is not part of this fund. This is personal support for Matthew Seagren. It is not tax-deductible.',
};

/**
 * Estimated PayPal fees on Ko-fi runway payments.
 * @param {number} grossCents
 * @param {number} paymentCount
 */
export function estimateRunwayServiceFeesCents(grossCents, paymentCount) {
  const gross = Math.max(0, Number(grossCents) || 0);
  const n = Math.max(0, Math.floor(Number(paymentCount) || 0));
  if (gross <= 0 || n <= 0) return 0;
  return Math.round(
    gross * RUNWAY_PAYPAL_FEE_RATE + RUNWAY_PAYPAL_FEE_FIXED_USD * 100 * n
  );
}

/**
 * Live stack from the Ko-fi runway ledger (never studio Stripe).
 * @param {{
 *   raisedCents?: number,
 *   paymentCount?: number,
 *   feeCents?: number|null,
 *   afterFeesCents?: number|null,
 * }} [input]
 */
export function runwayMoneyStack({
  raisedCents = 0,
  paymentCount = 0,
  feeCents = null,
  afterFeesCents = null,
} = {}) {
  const raised = Math.max(0, Number(raisedCents) || 0);
  const count = Math.max(0, Math.floor(Number(paymentCount) || 0));
  const hasStoredNet = afterFeesCents != null && Number.isFinite(Number(afterFeesCents));
  const hasStoredFee = feeCents != null && Number.isFinite(Number(feeCents));
  const feesEstimated = !hasStoredNet && !hasStoredFee;
  const fees = feesEstimated
    ? estimateRunwayServiceFeesCents(raised, count)
    : Math.max(0, Number(hasStoredFee ? feeCents : raised - afterFeesCents) || 0);
  const after = hasStoredNet
    ? Math.max(0, Number(afterFeesCents) || 0)
    : Math.max(0, raised - fees);
  const tax = Math.round(after * RUNWAY_TAX_RESERVE_PCT);
  const net = Math.max(0, after - tax);
  return {
    raisedCents: raised,
    feeCents: fees,
    afterFeesCents: after,
    taxReserveCents: tax,
    runwayNetCents: net,
    feesEstimated,
    paymentCount: count,
  };
}

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

export function formatRunwayUsd(n, { cents = false } = {}) {
  const digits = cents ? 2 : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n || 0);
}
