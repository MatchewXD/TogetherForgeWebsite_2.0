/**
 * Support / Stripe checkout helpers (Vite client).
 *
 * SECURITY
 * - Never put STRIPE_SECRET_KEY (sk_...) in VITE_* env vars.
 * - Client may only use: publishable key (optional), Supabase URL/anon, checkout API URL.
 * - Checkout Sessions are created by Supabase Edge Function create-checkout.
 *
 * Local defaults (when VITE_STRIPE_CHECKOUT_API_URL is unset):
 *   {VITE_SUPABASE_URL}/functions/v1/create-checkout
 */

const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;

/**
 * @returns {{ ok: true, amountCents: number } | { ok: false, error: string }}
 */
export function validateAmountCents(raw) {
  const amountCents = Math.round(Number(raw));
  if (!Number.isFinite(amountCents)) {
    return { ok: false, error: 'Enter a valid amount.' };
  }
  if (amountCents < MIN_CENTS) {
    return { ok: false, error: 'Minimum support amount is $1.00.' };
  }
  if (amountCents > MAX_CENTS) {
    return {
      ok: false,
      error: 'Maximum support amount is $10,000.00 per checkout.',
    };
  }
  return { ok: true, amountCents };
}

function parseLinkMap() {
  const raw = import.meta.env.VITE_STRIPE_PAYMENT_LINKS;
  if (!raw || typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[supportService] VITE_STRIPE_PAYMENT_LINKS is not valid JSON');
    return {};
  }
}

/**
 * Resolve Edge Function URL for create-checkout.
 */
export function getCheckoutApiUrl() {
  const explicit = import.meta.env.VITE_STRIPE_CHECKOUT_API_URL;
  if (explicit && String(explicit).trim()) {
    return String(explicit).replace(/\/$/, '');
  }
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (base && String(base).trim()) {
    return `${String(base).replace(/\/$/, '')}/functions/v1/create-checkout`;
  }
  return '';
}

/**
 * Headers required by local + hosted Supabase Edge Functions.
 */
function checkoutHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anon) {
    headers.Authorization = `Bearer ${anon}`;
    headers.apikey = anon;
  }
  return headers;
}

/**
 * @param {object} opts
 * @param {number} opts.amountCents
 * @param {'once'|'month'} [opts.interval]
 * @param {string} [opts.tierId]
 * @param {string} [opts.label]
 * @param {'studio'|'runway'} [opts.fundType]
 * @param {string} [opts.successUrl]
 * @param {string} [opts.cancelUrl]
 * @param {string} [opts.productId] - optional Stripe product id override
 */
export async function startStripeCheckout({
  amountCents,
  interval = 'once',
  tierId = 'custom',
  label = 'Support',
  fundType = 'studio',
  successUrl,
  cancelUrl,
  productId,
} = {}) {
  const validated = validateAmountCents(amountCents);
  if (!validated.ok) {
    const err = new Error(validated.error);
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  const cents = validated.amountCents;
  const safeInterval = interval === 'month' ? 'month' : 'once';
  const safeFund = fundType === 'runway' ? 'runway' : 'studio';
  const safeTier = String(tierId || 'custom').slice(0, 64);
  const safeLabel = String(label || 'Support').slice(0, 120);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Local Vite default: http://localhost:5173
  const success =
    successUrl ||
    `${origin}/support?checkout=success&tier=${encodeURIComponent(safeTier)}&fund=${safeFund}`;
  const cancel =
    cancelUrl || `${origin}/support?checkout=cancel&fund=${safeFund}`;

  const apiUrl = getCheckoutApiUrl();

  if (apiUrl) {
    console.log('[support] creating checkout session via Edge Function', {
      apiUrl,
      amountCents: cents,
      interval: safeInterval,
      tierId: safeTier,
      fundType: safeFund,
    });

    let res;
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: checkoutHeaders(),
        body: JSON.stringify({
          amountCents: cents,
          interval: safeInterval,
          mode: safeInterval === 'month' ? 'subscription' : 'payment',
          tierId: safeTier,
          label: safeLabel,
          fundType: safeFund,
          successUrl: success,
          cancelUrl: cancel,
          ...(productId ? { productId } : {}),
        }),
      });
    } catch (networkErr) {
      console.error('[support] network error', networkErr);
      const err = new Error(
        'Could not reach checkout service. Is Supabase running and create-checkout served? (' +
          apiUrl +
          ')'
      );
      err.code = 'NETWORK';
      throw err;
    }

    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const detail =
        data?.error || data?.message || text || `HTTP ${res.status}`;
      console.error('[support] checkout API error', res.status, detail);
      throw new Error(
        typeof detail === 'string'
          ? detail
          : `Checkout API failed (${res.status}). Check Edge Function logs and STRIPE_SECRET_KEY.`
      );
    }

    if (!data?.url) {
      throw new Error('Checkout API did not return a url.');
    }

    window.location.assign(data.url);
    return {
      redirected: true,
      mode: 'api',
      sessionId: data.sessionId || null,
    };
  }

  // Fallback: Payment Links (no secret key)
  const links = parseLinkMap();
  const key = `${safeTier}_${safeInterval === 'month' ? 'month' : 'once'}`;
  const fundKey = `${safeFund}_${key}`;
  const link =
    links[fundKey] ||
    links[key] ||
    links[`custom_${safeInterval === 'month' ? 'month' : 'once'}`];

  if (link) {
    console.log('[support] redirecting to Payment Link', fundKey || key);
    window.location.assign(link);
    return { redirected: true, mode: 'payment_link', key: fundKey || key };
  }

  const err = new Error(
    'Stripe checkout is not configured. Set VITE_SUPABASE_URL (local functions) or VITE_STRIPE_CHECKOUT_API_URL, and ensure STRIPE_SECRET_KEY is set only on the Edge Function.'
  );
  err.code = 'STRIPE_NOT_CONFIGURED';
  throw err;
}

export function isStripeConfigured() {
  if (getCheckoutApiUrl()) return true;
  return Object.keys(parseLinkMap()).length > 0;
}

/** Optional publishable key (pk_test_...) — never required for Checkout redirect flow. */
export function getStripePublishableKey() {
  return import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
}

export function recordLocalSupportEvent({
  amountCents,
  label,
  fundType = 'studio',
  interval = 'once',
} = {}) {
  try {
    const key =
      fundType === 'runway' ? 'tf_runway_donations' : 'tf_donations';
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const entry = {
      amount: Math.round((amountCents || 0) / 100),
      amountCents: amountCents || 0,
      label: label || 'Support',
      fundType,
      interval,
      timestamp: new Date().toISOString(),
    };
    stored.unshift(entry);
    localStorage.setItem(key, JSON.stringify(stored.slice(0, 50)));
    return entry;
  } catch (e) {
    console.warn('[support] local ledger write failed', e);
    return null;
  }
}

export default {
  startStripeCheckout,
  isStripeConfigured,
  validateAmountCents,
  recordLocalSupportEvent,
  getCheckoutApiUrl,
  getStripePublishableKey,
  MIN_CENTS,
  MAX_CENTS,
};
