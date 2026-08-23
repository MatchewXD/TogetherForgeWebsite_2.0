/**
 * Support / Donate plans — one-time donations vs monthly subscriptions.
 * Keep labels and amounts in sync with Support page UI.
 */

import { formatForgeMarks } from '../utils/forgeMarks';

const ONCE_PUBLIC_PERKS = [
  'Public thank-you on the Donate page',
  'Visibility on the recent supporters list',
];

const MONTH_PUBLIC_PERKS = [
  'Public thank-you each month you support',
  'Visibility on the recent supporters list',
];

const ALWAYS_PERKS = [
  'Donor badge and donation milestones on your profile',
];

/** One-time pure donations */
export const ONCE_TIERS = [
  {
    id: 'supporter',
    amount: 5,
    label: 'Supporter',
    marks: 500,
    publicPerks: ONCE_PUBLIC_PERKS,
    alwaysPerks: ALWAYS_PERKS,
  },
  {
    id: 'member',
    amount: 20,
    label: 'Forge Member',
    marks: 2000,
    publicPerks: ONCE_PUBLIC_PERKS,
    alwaysPerks: ALWAYS_PERKS,
    featured: true,
  },
  {
    id: 'builder',
    amount: 50,
    label: 'Builder',
    marks: 6000,
    publicPerks: ONCE_PUBLIC_PERKS,
    alwaysPerks: ALWAYS_PERKS,
  },
];

/** Monthly Stripe subscriptions */
export const MONTH_TIERS = [
  {
    id: 'supporter',
    amount: 5,
    label: 'Supporter',
    marks: 500,
    publicPerks: MONTH_PUBLIC_PERKS,
    alwaysPerks: ALWAYS_PERKS,
  },
  {
    id: 'member',
    amount: 15,
    label: 'Forge Member',
    marks: 1500,
    publicPerks: MONTH_PUBLIC_PERKS,
    alwaysPerks: ALWAYS_PERKS,
    featured: true,
  },
  {
    id: 'builder',
    amount: 40,
    label: 'Builder',
    marks: 4800,
    publicPerks: MONTH_PUBLIC_PERKS,
    alwaysPerks: ALWAYS_PERKS,
  },
];

export function forgeMarksPerkText(marks, interval = 'once') {
  const n = formatForgeMarks(marks);
  if (interval === 'month') return `${n} Forge Marks per month`;
  return `${n} Forge Marks`;
}

/**
 * Thank-you lines for a Support card.
 * Public-credit perks hide when the donor chose anonymous.
 * Donor badge / milestones and Forge Marks always stay.
 *
 * @param {object} tier
 * @param {{ publicCredit?: boolean, interval?: 'once'|'month' }} [opts]
 * @returns {{ text: string, emphasize: boolean }[]}
 */
export function listVisibleSupportPerks(
  tier,
  { publicCredit = true, interval = 'once' } = {}
) {
  const items = [];
  if (publicCredit) {
    for (const text of tier?.publicPerks || []) {
      items.push({ text, emphasize: false });
    }
  }
  for (const text of tier?.alwaysPerks || []) {
    items.push({ text, emphasize: false });
  }
  const marks = Number(tier?.marks) || 0;
  if (marks > 0) {
    items.push({
      text: forgeMarksPerkText(marks, interval),
      emphasize: true,
    });
  }
  return items;
}

export function planLabelFromTier(tierId, amountCents) {
  const id = String(tierId || '').toLowerCase();
  const cents = Number(amountCents) || 0;
  const dollars = cents / 100;
  const match =
    MONTH_TIERS.find((t) => t.id === id) ||
    ONCE_TIERS.find((t) => t.id === id);
  if (match && id !== 'custom') return match.label;
  if (dollars > 0) return `Custom ($${dollars % 1 === 0 ? dollars : dollars.toFixed(2)})`;
  return 'Studio support';
}

export function formatPlanAmount(amountCents, interval = 'month') {
  const cents = Number(amountCents) || 0;
  const dollars = cents / 100;
  const n =
    dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  return interval === 'month' ? `${n}/month` : n;
}

/** Human status for My Plan */
export function describePlanStatus(sub) {
  if (!sub) return { label: 'No active plan', tone: 'muted' };
  const status = String(sub.status || '').toLowerCase();
  const canceling = Boolean(sub.cancel_at_period_end);

  if (status === 'active' || status === 'trialing') {
    if (canceling) {
      return { label: 'Canceling', tone: 'warning' };
    }
    return { label: 'Active', tone: 'success' };
  }
  if (status === 'past_due') {
    return { label: 'Past due', tone: 'danger' };
  }
  if (status === 'canceled' || status === 'unpaid') {
    return { label: 'Canceled', tone: 'muted' };
  }
  return { label: status || 'Unknown', tone: 'muted' };
}

export function formatBillingDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}
