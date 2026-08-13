/**
 * AI Token economy — packs, hybrid charging bases, idea field limits.
 *
 * Scale: exactly 50,000 tokens per $1 (same ratio as RFab.ai).
 *
 * User-facing rules:
 * - Pack purchase prices + balance are fine to show.
 * - Do NOT show per-action token prices before the user runs an action.
 * - After a run, history shows exact tokens used (base + any additional).
 * - Real API cost / margins stay server-side only.
 *
 * Keep pack ids + token amounts in sync with:
 *   supabase/functions/_shared/aiTokenPacks.ts
 */

/** Tokens granted / valued per USD of pack price. */
export const AI_TOKENS_PER_USD = 50_000;

/** Micro-USD per studio token at list rate ($1 = 1e6 micros ÷ 50k tokens). */
export const AI_MICROS_PER_TOKEN = Math.floor(1_000_000 / AI_TOKENS_PER_USD); // 20

/**
 * Temporary base token costs (charged first after a successful call).
 * Easy to retune once we measure real Grok usage — do not treat as final.
 */
export const AI_ACTION_BASE_COSTS = {
  idea_structure: 5_000,
  gap_fill: 3_000,
};

/**
 * Max additional tokens that may be debited after the base (hybrid ceiling).
 * Additional = f(provider usage × margin) − base, clamped to this and balance.
 */
export const AI_ACTION_ADDITIONAL_CEILING = {
  idea_structure: 20_000,
  gap_fill: 30_000,
};

/**
 * Healthy margin multiplier on provider cost when converting to studio tokens.
 * chargeableTokens ≈ ceil(apiCostMicros / AI_MICROS_PER_TOKEN * AI_MARGIN_MULTIPLIER)
 * INTERNAL — never shown to users.
 */
export const AI_MARGIN_MULTIPLIER = 2.5;

/** @deprecated use AI_ACTION_BASE_COSTS — kept as alias for older imports */
export const AI_ACTION_TOKEN_COSTS = AI_ACTION_BASE_COSTS;

/** Do not surface this number in pre-action UI (hybrid: no price before run). */
export const AI_TYPICAL_ACTION_TOKENS = AI_ACTION_BASE_COSTS.idea_structure;

/**
 * Token packs (Stripe). $1 → 50,000 tokens.
 */
export const AI_TOKEN_PACKS = [
  {
    id: 'starter',
    label: 'Starter',
    priceCents: 500,
    tokens: 250_000,
    blurb: 'Solid runway for AI-assisted idea work.',
    perks: [
      '250,000 AI tokens',
      '$5 one-time (50,000 tokens per $1)',
      'Never expires while the platform is active',
    ],
  },
  {
    id: 'builder',
    label: 'Builder',
    priceCents: 1200,
    tokens: 600_000,
    featured: true,
    blurb: 'Best everyday value for regular contributors.',
    perks: [
      '600,000 AI tokens',
      '$12 one-time',
      'Same 50,000 tokens per $1 rate',
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    priceCents: 2500,
    tokens: 1_250_000,
    blurb: 'Deep bench for heavier AI-assisted workflows.',
    perks: [
      '1,250,000 AI tokens',
      '$25 one-time',
      'Same 50,000 tokens per $1 rate',
    ],
  },
];

// ── Hard limits (inputs / idea schema / completion) ──────────────────────────

/**
 * Max total characters of user prompt material sent into an AI action.
 * Extremely long payloads are rejected (prefer reject over silent junk).
 */
export const AI_MAX_INPUT_CHARS = 16_000;

/**
 * Character limits for fields the AI may read or fill — must match Idea UI.
 * (IdeaSubmit / IdeaWizard / optional sections)
 */
export const AI_IDEA_FIELD_LIMITS = {
  title: 100,
  summary: 300,
  description: 4000,
  category: 80,
  art_style: 1000,
  target_platforms: 1000,
  core_loop_length: 800,
  primary_inspiration: 1500,
  estimated_scope: 800,
  twitch_community: 2000,
  environmental_storytelling: 2000,
  economy_system: 2000,
  story_narrative: 2000,
  /** Multi-entry: feature name / description */
  feature_name: 80,
  feature_description: 500,
  /** Multi-entry: additional notes line */
  additional_note: 2000,
  tags_combined: 480, // TAG_MAX_LENGTH * reasonable count
};

/**
 * Provider completion budget — high enough for full structured answers,
 * not unlimited. Used as max_tokens on Grok calls.
 */
/** Completion budget for AI Idea tools (server may clamp lower for Edge latency). */
export const AI_COMPLETION_MAX_TOKENS = 2_048;

export const AI_NEED_MORE_TOKENS_MESSAGE =
  'You need more tokens to use this AI feature. Buy a pack under Account → AI Tokens.';

export function getTokenPack(packId) {
  const id = String(packId || '').toLowerCase();
  return AI_TOKEN_PACKS.find((p) => p.id === id) || null;
}

export function getActionBaseCost(actionKey) {
  const n = AI_ACTION_BASE_COSTS[String(actionKey || '')];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getActionAdditionalCeiling(actionKey) {
  const n = AI_ACTION_ADDITIONAL_CEILING[String(actionKey || '')];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * INTERNAL: convert provider cost (micro-USD) → studio tokens with margin.
 * Never expose raw API cost to users.
 */
export function providerCostToChargeableTokens(apiCostUsdMicros, marginMult = AI_MARGIN_MULTIPLIER) {
  const cost = Math.max(0, Number(apiCostUsdMicros) || 0);
  const mult = Math.max(1, Number(marginMult) || AI_MARGIN_MULTIPLIER);
  if (cost <= 0) return 0;
  const raw = (cost / AI_MICROS_PER_TOKEN) * mult;
  return Math.max(0, Math.ceil(raw));
}

/**
 * Hybrid split after a successful provider call.
 * @returns {{ base: number, additional: number, chargeable: number }}
 */
export function computeHybridDebitAmounts({
  actionKey,
  apiCostUsdMicros,
  balanceAfterBase,
}) {
  const base = getActionBaseCost(actionKey);
  const ceiling = getActionAdditionalCeiling(actionKey);
  const chargeable = providerCostToChargeableTokens(apiCostUsdMicros);
  const idealAdditional = Math.max(0, chargeable - base);
  const capped = Math.min(idealAdditional, ceiling);
  const remaining = Math.max(0, Number(balanceAfterBase) || 0);
  const additional = Math.min(capped, remaining);
  return { base, additional, chargeable };
}

export function formatTokenCount(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return v.toLocaleString();
}

export function formatPackPrice(priceCents) {
  const cents = Math.round(Number(priceCents) || 0);
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** User-safe default when AI is temporarily disabled by caps / kill-switch. */
export const AI_SERVICES_DISABLED_MESSAGE =
  'AI services are temporarily unavailable due to usage limits. Please try again later.';

/**
 * Map ledger entry_type → short label for history UI.
 */
export function ledgerEntryLabel(entry) {
  const type = String(entry?.entry_type || '');
  const hybrid = entry?.meta?.hybrid_phase || entry?.hybrid_phase;
  const summary = entry?.prompt_summary || '';

  if (type === 'purchase') {
    const pack = getTokenPack(entry?.pack_id);
    return pack ? `${pack.label} pack` : 'Token pack purchase';
  }
  if (type === 'award') return summary || 'Bonus tokens';
  if (type === 'refund') return summary || 'Refund';
  if (type === 'adjustment') return summary || 'Adjustment';
  if (type === 'spend') {
    if (hybrid === 'base' || /\(base\)/i.test(summary)) {
      return summary || 'AI usage (base)';
    }
    if (hybrid === 'additional' || /\(additional\)/i.test(summary)) {
      return summary || 'AI usage (additional)';
    }
    return summary || entry?.action_key || 'AI usage';
  }
  return summary || 'Token activity';
}

export function ledgerTokensLine(entry) {
  const n = Math.abs(Number(entry?.tokens) || 0);
  const type = String(entry?.entry_type || '');
  if (type === 'spend') return `${formatTokenCount(n)} tokens used`;
  if (type === 'purchase' || type === 'award' || type === 'refund') {
    return `+${formatTokenCount(n)} tokens`;
  }
  if (Number(entry?.tokens) < 0) return `${formatTokenCount(n)} tokens used`;
  return `+${formatTokenCount(n)} tokens`;
}
