/**
 * Temporary live-checkout gate for create-checkout / create-token-checkout.
 * Switch: ENABLE_DONATIONS (true/false, 1/0, on/off, yes/no).
 * Unset + sk_test_ → on (staging/local). Unset + sk_live_ or missing key → off.
 */

export const DONATIONS_PAUSED_CODE = 'DONATIONS_PAUSED';

export const DONATIONS_PAUSED_ERROR =
  'Support and Runway are temporarily unavailable.';

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
