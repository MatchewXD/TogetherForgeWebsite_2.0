/**
 * Server-side AI token packs + hybrid charging constants.
 * Must stay aligned with src/constants/aiTokens.js
 *
 * Scale: exactly 50,000 tokens per $1.
 * Users buy packs; actions use hybrid base + post-call usage debit.
 * Real xAI cost is internal only.
 */

export type AiTokenPack = {
  id: string;
  label: string;
  priceCents: number;
  tokens: number;
};

/** Tokens per USD of pack price. */
export const AI_TOKENS_PER_USD = 50_000;

/** Micro-USD per token at list rate. */
export const AI_MICROS_PER_TOKEN = Math.floor(1_000_000 / AI_TOKENS_PER_USD); // 20

/** Healthy margin on provider cost when converting to studio tokens (internal). */
export const AI_MARGIN_MULTIPLIER = 2.5;

/** One-time packs (Stripe Checkout mode=payment). */
export const AI_TOKEN_PACKS: AiTokenPack[] = [
  { id: 'starter', label: 'Starter', priceCents: 500, tokens: 250_000 },
  { id: 'builder', label: 'Builder', priceCents: 1200, tokens: 600_000 },
  { id: 'studio', label: 'Studio', priceCents: 2500, tokens: 1_250_000 },
];

/**
 * Temporary base costs — retune after measuring Grok usage.
 * Checked before the call; debited first after a successful call.
 */
export const AI_ACTION_BASE_COSTS: Record<string, number> = {
  idea_structure: 5_000,
  gap_fill: 3_000,
};

/** Max additional hybrid debit beyond base (per action). */
export const AI_ACTION_ADDITIONAL_CEILING: Record<string, number> = {
  idea_structure: 20_000,
  gap_fill: 30_000,
};

/** @deprecated alias */
export const AI_ACTION_TOKEN_COSTS = AI_ACTION_BASE_COSTS;

export const AI_MAX_INPUT_CHARS = 16_000;
/** Completion budget for Edge Idea tools (keep modest for latency). */
export const AI_COMPLETION_MAX_TOKENS = 2_048;

/** Idea field character limits (match client Idea schema / UI). */
export const AI_IDEA_FIELD_LIMITS: Record<string, number> = {
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
  feature_name: 80,
  feature_description: 500,
  additional_note: 2000,
  tags_combined: 480,
};

/** Always en-US so Stripe line items match the Account cards (250,000 not 250). */
export function formatTokenCount(n: number): string {
  return Math.max(0, Math.round(Number(n) || 0)).toLocaleString('en-US');
}

export function stripePackProductName(pack: AiTokenPack): string {
  return `${pack.label}: ${formatTokenCount(pack.tokens)} AI tokens`;
}

export function stripePackProductDescription(pack: AiTokenPack): string {
  return `${formatTokenCount(pack.tokens)} AI tokens for Idea tools. One-time purchase. Never expires while the platform is active.`;
}

export function getTokenPack(packId: string | null | undefined): AiTokenPack | null {
  const id = String(packId || '').toLowerCase().trim();
  return AI_TOKEN_PACKS.find((p) => p.id === id) || null;
}

export function getActionBaseCost(actionKey: string): number {
  const n = AI_ACTION_BASE_COSTS[String(actionKey || '')];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getActionAdditionalCeiling(actionKey: string): number {
  const n = AI_ACTION_ADDITIONAL_CEILING[String(actionKey || '')];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** @deprecated use getActionBaseCost */
export function actionTokenCost(actionKey: string): number {
  return getActionBaseCost(actionKey);
}

/**
 * INTERNAL: provider micro-USD → chargeable studio tokens with margin.
 */
export function providerCostToChargeableTokens(
  apiCostUsdMicros: number,
  marginMult: number = AI_MARGIN_MULTIPLIER
): number {
  const cost = Math.max(0, Number(apiCostUsdMicros) || 0);
  const mult = Math.max(1, Number(marginMult) || AI_MARGIN_MULTIPLIER);
  if (cost <= 0) return 0;
  return Math.max(0, Math.ceil((cost / AI_MICROS_PER_TOKEN) * mult));
}

export function computeHybridDebitAmounts(opts: {
  actionKey: string;
  apiCostUsdMicros?: number;
  balanceAfterBase?: number;
}): { base: number; additional: number; chargeable: number } {
  const base = getActionBaseCost(opts.actionKey);
  const ceiling = getActionAdditionalCeiling(opts.actionKey);
  const chargeable = providerCostToChargeableTokens(opts.apiCostUsdMicros || 0);
  const idealAdditional = Math.max(0, chargeable - base);
  const capped = Math.min(idealAdditional, ceiling);
  const remaining = Math.max(0, Number(opts.balanceAfterBase) || 0);
  const additional = Math.min(capped, remaining);
  return { base, additional, chargeable };
}

export function packRevenueMicrosPerToken(pack: AiTokenPack): number {
  if (!pack.tokens) return 0;
  return Math.floor((pack.priceCents * 10_000) / pack.tokens);
}

export const AI_SERVICES_DISABLED_MESSAGE =
  'AI services are temporarily unavailable due to usage limits. Please try again later.';

export const AI_NEED_MORE_TOKENS_MESSAGE =
  'You need more tokens to use this AI feature. Buy a pack under Account → AI Tokens.';
