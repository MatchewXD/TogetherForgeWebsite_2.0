/**
 * Money flags — two independent switches.
 *
 * Studio (Together Forge LLC): VITE_ENABLE_DONATIONS / ENABLE_DONATIONS
 *   Studio Support, subscriptions, AI Tokens, Stripe checkout.
 *   Default when unset: on for pk_test_, off for pk_live_ or a missing key.
 *   Keep off in production until banking is ready.
 *
 * Founder Runway (personal): VITE_ENABLE_RUNWAY / ENABLE_RUNWAY
 *   Founder Runway page + compact card on Founders Thoughts.
 *   Does not use Stripe. Unset defaults on; set false for Coming Soon.
 *
 * Values: true/false, 1/0, on/off, yes/no.
 */

export const DONATIONS_PAUSED_CODE = 'DONATIONS_PAUSED';

export const DONATIONS_PAUSED_ERROR =
  'Studio support is temporarily unavailable.';

export const RUNWAY_PAUSED_CODE = 'RUNWAY_PAUSED';

export const RUNWAY_PAUSED_ERROR =
  'Founder Runway is temporarily unavailable.';

export const RUNWAY_NOT_STRIPE_CODE = 'RUNWAY_NOT_STRIPE';

export const RUNWAY_NOT_STRIPE_ERROR =
  'Personal runway is not billed through studio checkout.';

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
 * LLC / Stripe checkout only. Never gates Founder Runway.
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

/**
 * Personal Founder Runway only. Independent of ENABLE_DONATIONS.
 * @param {{ VITE_ENABLE_RUNWAY?: string }|undefined} env
 * @returns {boolean}
 */
export function areRunwayEnabled(env = import.meta.env) {
  const explicit = parseEnableFlag(env?.VITE_ENABLE_RUNWAY);
  if (explicit !== null) return explicit;
  return true;
}
