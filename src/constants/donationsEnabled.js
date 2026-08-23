/**
 * Temporary live-checkout gate for Support, Runway, and other Stripe Checkout.
 *
 * Switch: VITE_ENABLE_DONATIONS (client) / ENABLE_DONATIONS (Edge Functions).
 * Values: true/false, 1/0, on/off, yes/no.
 *
 * Default when unset:
 *   - Test Stripe keys (pk_test_ / sk_test_) → on  (staging/local can test)
 *   - Live keys or missing key → off  (production stays paused)
 *
 * Re-enable production: set both flags to true, then verify checkout.
 * Do not delete Stripe, webhook, Marks, or donation services — this is a gate.
 */

export const DONATIONS_PAUSED_CODE = 'DONATIONS_PAUSED';

export const DONATIONS_PAUSED_ERROR =
  'Payment processing is temporarily unavailable while business banking is being set up.';

/** @param {unknown} raw */
export function parseEnableFlag(raw) {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (!v) return null;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return null;
}

/**
 * @param {{ VITE_ENABLE_DONATIONS?: string, VITE_STRIPE_PUBLISHABLE_KEY?: string }|undefined} env
 * @returns {boolean}
 */
export function areDonationsEnabled(env = import.meta.env) {
  const explicit = parseEnableFlag(env?.VITE_ENABLE_DONATIONS);
  if (explicit !== null) return explicit;
  const pk = String(env?.VITE_STRIPE_PUBLISHABLE_KEY || '').trim();
  if (pk.startsWith('pk_test_')) return true;
  return false;
}
