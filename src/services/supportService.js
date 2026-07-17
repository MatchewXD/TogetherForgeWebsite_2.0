/**
 * Support / Stripe checkout helpers.
 *
 * Configure one of:
 * 1) VITE_STRIPE_CHECKOUT_API_URL - Supabase Edge Function create-checkout
 * 2) VITE_STRIPE_PAYMENT_LINKS - JSON map of Payment Link URLs
 *
 * Never put secret Stripe keys in the Vite client.
 */

const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;

/**
 * Validate and normalize amount in cents.
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
    return { ok: false, error: 'Maximum support amount is $10,000.00 per checkout.' };
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
 * @param {object} opts
 * @param {number} opts.amountCents
 * @param {'once'|'month'} [opts.interval]
 * @param {string} [opts.tierId]
 * @param {string} [opts.label]
 * @param {'studio'|'runway'} [opts.fundType]
 * @param {string} [opts.successUrl]
 * @param {string} [opts.cancelUrl]
 */
export async function startStripeCheckout({
  amountCents,
  interval = 'once',
  tierId = 'custom',
  label = 'Support',
  fundType = 'studio',
  successUrl,
  cancelUrl,
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
  const success =
    successUrl ||
    `${origin}/support?checkout=success&tier=${encodeURIComponent(safeTier)}&fund=${safeFund}`;
  const cancel =
    cancelUrl || `${origin}/support?checkout=cancel&fund=${safeFund}`;

  const apiUrl = import.meta.env.VITE_STRIPE_CHECKOUT_API_URL;

  if (apiUrl) {
    console.log('[support] creating checkout session via API', {
      amountCents: cents,
      interval: safeInterval,
      tierId: safeTier,
      fundType: safeFund,
    });

    let res;
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: cents,
          interval: safeInterval,
          mode: safeInterval === 'month' ? 'subscription' : 'payment',
          tierId: safeTier,
          label: safeLabel,
          fundType: safeFund,
          successUrl: success,
          cancelUrl: cancel,
        }),
      });
    } catch (networkErr) {
      console.error('[support] network error', networkErr);
      const err = new Error(
        'Could not reach checkout service. Check your connection and try again.'
      );
      err.code = 'NETWORK';
      throw err;
    }

    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = j?.error || j?.message || '';
      } catch {
        detail = await res.text().catch(() => '');
      }
      console.error('[support] checkout API error', res.status, detail);
      throw new Error(
        detail ||
          `Checkout API failed (${res.status}). Check Edge Function logs and STRIPE_SECRET_KEY.`
      );
    }

    const data = await res.json();
    if (!data?.url) {
      throw new Error('Checkout API did not return a url.');
    }
    window.location.assign(data.url);
    return { redirected: true, mode: 'api', sessionId: data.sessionId || null };
  }

  // Fallback: Payment Links
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
    'Stripe is not configured yet. Set VITE_STRIPE_CHECKOUT_API_URL or VITE_STRIPE_PAYMENT_LINKS.'
  );
  err.code = 'STRIPE_NOT_CONFIGURED';
  throw err;
}

export function isStripeConfigured() {
  if (import.meta.env.VITE_STRIPE_CHECKOUT_API_URL) return true;
  return Object.keys(parseLinkMap()).length > 0;
}

/** Local browser demo ledger (not source of truth when webhooks run). */
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
  MIN_CENTS,
  MAX_CENTS,
};
