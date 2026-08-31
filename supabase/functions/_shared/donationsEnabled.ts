/**
 * Studio Stripe checkout gate (create-checkout / create-token-checkout).
 * Switch: ENABLE_DONATIONS. Does not control Founder Runway.
 * Unset + sk_test_ → on (staging/local). Unset + sk_live_ or missing key → off.
 *
 * ENABLE_RUNWAY is a client/UI flag for personal runway. Runway is never
 * billed through these Stripe functions.
 */

export const DONATIONS_PAUSED_CODE = 'DONATIONS_PAUSED';

export const DONATIONS_PAUSED_ERROR =
  'Studio support is temporarily unavailable.';

export const RUNWAY_NOT_STRIPE_CODE = 'RUNWAY_NOT_STRIPE';

export const RUNWAY_NOT_STRIPE_ERROR =
  'Personal runway is not billed through studio checkout.';

export function parseEnableFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (!v) return null;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return null;
}

export function areDonationsEnabled(): boolean {
  const explicit = parseEnableFlag(Deno.env.get('ENABLE_DONATIONS'));
  if (explicit !== null) return explicit;
  const key = String(Deno.env.get('STRIPE_SECRET_KEY') || '').trim();
  if (key.startsWith('sk_test_')) return true;
  return false;
}
