/**
 * Support / Donate plans — one-time donations vs monthly subscriptions.
 * Keep labels and amounts in sync with Support page UI.
 */

/** One-time pure donations */
export const ONCE_TIERS = [
  {
    id: 'supporter',
    amount: 5,
    label: 'Supporter',
    perks: [
      'Public thank-you on the Donate page',
      'Visibility on the recent supporters list',
      'Donor badge and donation milestones on your profile',
    ],
  },
  {
    id: 'member',
    amount: 20,
    label: 'Forge Member',
    perks: [
      'Public thank-you on the Donate page',
      'Visibility on the recent supporters list',
      'Donor badge and donation milestones on your profile',
    ],
    featured: true,
  },
  {
    id: 'builder',
    amount: 50,
    label: 'Builder',
    perks: [
      'Public thank-you on the Donate page',
      'Visibility on the recent supporters list',
      'Donor badge and donation milestones on your profile',
    ],
  },
];

/** Monthly Stripe subscriptions */
export const MONTH_TIERS = [
  {
    id: 'supporter',
    amount: 5,
    label: 'Supporter',
    perks: [
      'Public thank-you each month you support',
      'Visibility on the recent supporters list',
      'Active Subscriber badge while your plan is active',
      'Donor badge and donation milestones on your profile',
    ],
  },
  {
    id: 'member',
    amount: 15,
    label: 'Forge Member',
    perks: [
      'Public thank-you each month you support',
      'Visibility on the recent supporters list',
      'Active Subscriber badge while your plan is active',
      'Donor badge and donation milestones on your profile',
    ],
    featured: true,
  },
  {
    id: 'builder',
    amount: 40,
    label: 'Builder',
    perks: [
      'Public thank-you each month you support',
      'Visibility on the recent supporters list',
      'Active Subscriber badge while your plan is active',
      'Donor badge and donation milestones on your profile',
    ],
  },
];

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
