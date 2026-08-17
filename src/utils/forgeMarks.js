/**
 * Forge Marks — donation grant rates and display helpers.
 * Whole-gift rate (not marginal): the donation's total picks one published tier.
 * $1 = 100 Marks at the base rate. No hidden multipliers.
 */

/** Published rate table. First matching minCents (descending) wins. */
export const FORGE_MARK_DONATION_TIERS = [
  { minCents: 50000, minLabel: '$500+', marksPerDollar: 150 },
  { minCents: 25000, minLabel: '$250–499', marksPerDollar: 140 },
  { minCents: 10000, minLabel: '$100–249', marksPerDollar: 130 },
  { minCents: 5000, minLabel: '$50–99', marksPerDollar: 120 },
  { minCents: 2500, minLabel: '$25–49', marksPerDollar: 110 },
  { minCents: 0, minLabel: '$1–24', marksPerDollar: 100 },
];

export const FORGE_MARKS_PER_USD_BASE = 100;

/** Short hover copy for profile, spend UI, and other Marks displays. */
export const FORGE_MARKS_HOVER_HINT =
  'Forge Marks are earned from completed donations. Use them to place permanent awards on posts (Spark, Hammer, Anvil, or Masterwork). Marks never expire and cannot be transferred or withdrawn.';

/**
 * Community Award catalog. Costs live here and in SQL — keep in sync.
 * Anvil and Masterwork may include an optional short message.
 */
export const FORGE_AWARD_MESSAGE_MAX = 140;

export const FORGE_AWARD_TIERS = [
  {
    id: 'spark',
    name: 'Spark',
    marksCost: 100,
    sortOrder: 10,
    allowsMessage: false,
    description: 'A small public thank-you on a post.',
  },
  {
    id: 'hammer',
    name: 'Hammer',
    marksCost: 200,
    sortOrder: 20,
    allowsMessage: false,
    description: 'A solid community award.',
  },
  {
    id: 'anvil',
    name: 'Anvil',
    marksCost: 500,
    sortOrder: 30,
    allowsMessage: true,
    description: 'A standout award. Optional short message.',
  },
  {
    id: 'masterwork',
    name: 'Masterwork',
    marksCost: 1000,
    sortOrder: 40,
    allowsMessage: true,
    description: 'The highest community award. Optional short message.',
  },
];

export function getForgeAwardTier(id) {
  const key = String(id || '').trim().toLowerCase();
  return FORGE_AWARD_TIERS.find((t) => t.id === key) || null;
}

/** Resolve a tier from an id, display name, or ledger note. */
export function resolveForgeAwardTier(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const fromId = getForgeAwardTier(raw);
  if (fromId) return fromId;
  const fromNote = raw.replace(/^community award:\s*/i, '').trim();
  const lower = fromNote.toLowerCase();
  return (
    FORGE_AWARD_TIERS.find(
      (t) => t.id === lower || t.name.toLowerCase() === lower
    ) || null
  );
}

export function awardAllowsMessage(id) {
  return Boolean(getForgeAwardTier(id)?.allowsMessage);
}

/** Anvil / Masterwork notes only. Spark and Hammer never appear. */
export function getAwardNotes(awards = []) {
  return (awards || []).filter((a) => {
    if (!awardAllowsMessage(a?.awardTier || a?.award_tier)) return false;
    return Boolean(String(a?.message || '').trim());
  });
}

/** Same giver cannot place the same tier on the same post twice. */
export function giverAlreadyPlacedTier(awards, giverId, tierId) {
  if (!giverId || !tierId) return false;
  return (awards || []).some(
    (a) =>
      String(a.giverId || '') === String(giverId) &&
      String(a.awardTier || '') === String(tierId)
  );
}

/** Spark → Hammer → Anvil → Masterwork, then any unknown tiers. */
export function sortAwardTotalsByTier(totals = []) {
  const order = new Map(FORGE_AWARD_TIERS.map((t, i) => [t.id, i]));
  return [...(totals || [])].sort((a, b) => {
    const ia = order.has(a?.awardTier) ? order.get(a.awardTier) : 99;
    const ib = order.has(b?.awardTier) ? order.get(b.awardTier) : 99;
    if (ia !== ib) return ia - ib;
    return String(a?.awardName || '').localeCompare(String(b?.awardName || ''));
  });
}

export function summarizeAwardsByTier(awards = []) {
  const byId = new Map();
  for (const tier of FORGE_AWARD_TIERS) {
    byId.set(tier.id, { ...tier, count: 0, items: [] });
  }
  for (const row of awards || []) {
    const id = String(row.awardTier || '').toLowerCase();
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name: row.awardName || id,
        marksCost: Number(row.marksSpent) || 0,
        count: 0,
        items: [],
      });
    }
    const bucket = byId.get(id);
    bucket.count += 1;
    bucket.items.push(row);
  }
  return [...byId.values()].filter((b) => b.count > 0);
}

/**
 * @param {number} amountCents
 * @returns {number} Marks per $1 for this gift size
 */
export function marksPerDollarForCents(amountCents) {
  const cents = Math.floor(Number(amountCents) || 0);
  if (cents <= 0) return FORGE_MARKS_PER_USD_BASE;
  for (const tier of FORGE_MARK_DONATION_TIERS) {
    if (cents >= tier.minCents) return tier.marksPerDollar;
  }
  return FORGE_MARKS_PER_USD_BASE;
}

/**
 * Marks granted for a completed donation. Floor of cents × rate / 100.
 * @param {number} amountCents
 * @returns {number}
 */
export function forgeMarksForDonationCents(amountCents) {
  const cents = Math.floor(Number(amountCents) || 0);
  if (cents <= 0) return 0;
  const rate = marksPerDollarForCents(cents);
  return Math.floor((cents * rate) / 100);
}

/**
 * @param {number} n
 * @returns {string}
 */
export function formatForgeMarks(n) {
  const v = Math.floor(Number(n) || 0);
  return v.toLocaleString();
}

/**
 * @param {string|null|undefined} entryType
 */
export function forgeMarkLedgerLabel(entryType) {
  const t = String(entryType || '').trim();
  if (t === 'donation_grant') return 'Donation';
  if (t === 'award_spend') return 'Community Award';
  if (t === 'refund_clawback') return 'Refund adjustment';
  if (t === 'adjustment') return 'Adjustment';
  return t || 'Marks';
}
