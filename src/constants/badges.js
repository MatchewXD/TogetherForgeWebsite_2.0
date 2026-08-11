/**
 * Badge / achievement catalog.
 * Keys must match public.sync_user_badges grants in supabase_badges.sql.
 */

/** @typedef {'status'|'donation'|'tasks'} BadgeCategory */

/**
 * @typedef {object} BadgeDef
 * @property {string} key
 * @property {BadgeCategory} category
 * @property {string} name
 * @property {string} description
 * @property {string} icon - lucide-style key used by BadgeIcon
 * @property {number|null} threshold - cents (donation) or count (tasks) or null
 */

export const DONATION_THRESHOLDS_DOLLARS = [
  10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000,
];

export const TASK_THRESHOLDS = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250];

/** One-time custom amount → support tier_id */
export function mapCustomDonationTier(amountCents) {
  const cents = Number(amountCents) || 0;
  if (cents >= 5000) {
    return { tierId: 'builder', tierLabel: 'Builder' };
  }
  if (cents >= 2000) {
    return { tierId: 'member', tierLabel: 'Forge Member' };
  }
  if (cents >= 500) {
    return { tierId: 'supporter', tierLabel: 'Supporter' };
  }
  return { tierId: 'custom', tierLabel: 'Custom' };
}

/**
 * Monthly custom amount → MONTH_TIERS style brackets ($5 / $15 / $40).
 */
export function mapCustomMonthlyTier(amountCents) {
  const cents = Number(amountCents) || 0;
  if (cents >= 4000) {
    return { tierId: 'builder', tierLabel: 'Builder' };
  }
  if (cents >= 1500) {
    return { tierId: 'member', tierLabel: 'Forge Member' };
  }
  if (cents >= 500) {
    return { tierId: 'supporter', tierLabel: 'Supporter' };
  }
  return { tierId: 'custom', tierLabel: 'Custom' };
}

/**
 * Normalize tier for webhook/checkout: keep explicit supporter|member|builder;
 * map custom / missing by amount.
 */
export function resolveDonationTierMeta({
  tierId,
  tierLabel,
  amountCents,
  interval = 'once',
} = {}) {
  const id = String(tierId || '').toLowerCase().trim();
  if (id === 'supporter' || id === 'member' || id === 'builder') {
    return {
      tierId: id,
      tierLabel:
        tierLabel ||
        (id === 'member' ? 'Forge Member' : id.charAt(0).toUpperCase() + id.slice(1)),
    };
  }
  const mapped =
    String(interval || 'once').toLowerCase() === 'month'
      ? mapCustomMonthlyTier(amountCents)
      : mapCustomDonationTier(amountCents);
  return {
    tierId: mapped.tierId,
    tierLabel: tierLabel || mapped.tierLabel,
  };
}

function formatDollar(n) {
  return n.toLocaleString('en-US');
}

/**
 * Custom art under public/images/Badges/.
 * Explicit map for current filenames (case varies).
 * Future donation art: prefer `{dollars}_donor.png` (e.g. 2500_donor.png).
 */
export const BADGE_IMAGE_DIR = '/images/Badges';

/** @type {Record<string, string>} key → filename in BADGE_IMAGE_DIR */
export const BADGE_IMAGE_FILES = {
  status_active_subscriber: 'Active_Subscriber.png',
  status_donor: 'Donator.png',
  donation_10: '10_donor.png',
  donation_50: '50_donor.png',
  donation_100: '100_donor.png',
  donation_250: '250_donor.png',
  donation_500: '500_donor.png',
  donation_1000: '1000_donor.png',
  // Add when art lands, e.g.:
  // donation_2500: '2500_donor.png',
  // status_game_shipper: 'Game_Shipper.png',
  // tasks_1: '1_tasks.png',
};

/**
 * Public URL for badge art, or null if we have no known asset yet.
 * Donation milestones without an explicit map try `{n}_donor.png` so new files
 * work once you drop them in the folder (onError falls back to Lucide).
 * @param {string|null|undefined} key
 * @returns {string|null}
 */
export function getBadgeImageSrc(key) {
  if (!key) return null;
  const k = String(key);
  const file = BADGE_IMAGE_FILES[k];
  if (file) return `${BADGE_IMAGE_DIR}/${file}`;

  const donationMatch = /^donation_(\d+)$/.exec(k);
  if (donationMatch) {
    return `${BADGE_IMAGE_DIR}/${donationMatch[1]}_donor.png`;
  }
  return null;
}

/** @type {BadgeDef[]} */
export const BADGE_CATALOG = [
  {
    key: 'status_active_subscriber',
    category: 'status',
    name: 'Active Subscriber',
    description: 'Hold an active monthly studio support subscription.',
    icon: 'spark',
    threshold: null,
  },
  {
    key: 'status_donor',
    category: 'status',
    name: 'Donor',
    description: 'Make at least one completed donation (one-time or subscription payment).',
    icon: 'heart',
    threshold: null,
  },
  {
    key: 'status_game_shipper',
    category: 'status',
    name: 'Game Shipper',
    description:
      'Be credited on a project when it reaches Released / Completed (task claims, contributions, or used ideas).',
    icon: 'ship',
    threshold: null,
  },
  ...DONATION_THRESHOLDS_DOLLARS.map((dollars) => ({
    key: `donation_${dollars}`,
    category: /** @type {BadgeCategory} */ ('donation'),
    name: `$${formatDollar(dollars)} Donor`,
    description: `Donate a lifetime total of $${formatDollar(dollars)} or more (all completed gifts).`,
    icon: dollars >= 10000 ? 'crown' : dollars >= 1000 ? 'gem' : 'coin',
    threshold: dollars * 100,
  })),
  ...TASK_THRESHOLDS.map((count) => ({
    key: `tasks_${count}`,
    category: /** @type {BadgeCategory} */ ('tasks'),
    name: count === 1 ? 'First Ship' : `${count} Tasks Shipped`,
    description:
      count === 1
        ? 'Complete your first accepted task claim.'
        : `Complete ${count} accepted task claims.`,
    icon: count >= 100 ? 'rocket' : count >= 25 ? 'flag' : 'check',
    threshold: count,
  })),
];

const BY_KEY = Object.fromEntries(BADGE_CATALOG.map((b) => [b.key, b]));

export function getBadgeDef(key) {
  if (!key) return null;
  return BY_KEY[String(key)] || null;
}

export function listCatalogByCategory() {
  const order = ['status', 'donation', 'tasks'];
  const labels = {
    status: 'Status',
    donation: 'Donation milestones',
    tasks: 'Tasks shipped',
  };
  return order.map((category) => ({
    category,
    label: labels[category],
    badges: BADGE_CATALOG.filter((b) => b.category === category),
  }));
}

/** Keys that sync_user_badges would grant for given totals (for tests). */
export function expectedBadgeKeys({
  totalCents = 0,
  tasksCompleted = 0,
  hasActiveSub = false,
  hasShippedGame = false,
} = {}) {
  const keys = [];
  if (totalCents > 0) keys.push('status_donor');
  if (hasActiveSub) keys.push('status_active_subscriber');
  if (hasShippedGame) keys.push('status_game_shipper');
  for (const d of DONATION_THRESHOLDS_DOLLARS) {
    if (totalCents >= d * 100) keys.push(`donation_${d}`);
  }
  for (const t of TASK_THRESHOLDS) {
    if (tasksCompleted >= t) keys.push(`tasks_${t}`);
  }
  return keys;
}
