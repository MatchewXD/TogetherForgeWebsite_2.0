/**
 * Support / Stripe checkout helpers.
 *
 * Configure one of:
 * 1) VITE_STRIPE_CHECKOUT_API_URL — POST { amountCents, interval, tierId, label }
 *    returns { url } (recommended: Supabase Edge Function creating Checkout Sessions)
 * 2) VITE_STRIPE_PAYMENT_LINKS — JSON map of payment-link URLs keyed by
 *    `${tierId}_${once|month}` e.g. supporter_once, builder_month, custom_once
 *
 * Never put secret Stripe keys in the Vite client. Use Payment Links or a server.
 */

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
 * @param {number} opts.amountCents — amount in cents (e.g. 2000 = $20)
 * @param {'once'|'month'} opts.interval
 * @param {string} [opts.tierId] — supporter | member | builder | custom
 * @param {string} [opts.label]
 * @param {string} [opts.successUrl]
 * @param {string} [opts.cancelUrl]
 */
export async function startStripeCheckout({
  amountCents,
  interval = 'once',
  tierId = 'custom',
  label = 'Support',
  successUrl,
  cancelUrl,
} = {}) {
  if (!amountCents || amountCents < 100) {
    throw new Error('Minimum support amount is $1.00.');
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const success =
    successUrl ||
    `${origin}/support?checkout=success&tier=${encodeURIComponent(tierId)}`;
  const cancel =
    cancelUrl ||
    `${origin}/support?checkout=cancel`;

  const apiUrl = import.meta.env.VITE_STRIPE_CHECKOUT_API_URL;

  // Preferred: server creates Checkout Session (one-time or subscription)
  if (apiUrl) {
    console.log('[support] creating checkout session via API', {
      amountCents,
      interval,
      tierId,
    });
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents,
        interval, // 'once' | 'month'
        mode: interval === 'month' ? 'subscription' : 'payment',
        tierId,
        label,
        successUrl: success,
        cancelUrl: cancel,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        text || `Checkout API failed (${res.status}). Check your Edge Function.`
      );
    }

    const data = await res.json();
    if (!data?.url) {
      throw new Error('Checkout API did not return a url.');
    }
    window.location.assign(data.url);
    return { redirected: true, mode: 'api' };
  }

  // Fallback: preconfigured Stripe Payment Links
  const links = parseLinkMap();
  const key = `${tierId}_${interval === 'month' ? 'month' : 'once'}`;
  const link = links[key] || links[`custom_${interval === 'month' ? 'month' : 'once'}`];

  if (link) {
    console.log('[support] redirecting to Payment Link', key);
    // Append success return when supported by link query params
    const url = new URL(link);
    window.location.assign(url.toString());
    return { redirected: true, mode: 'payment_link', key };
  }

  const err = new Error(
    'Stripe is not configured yet. Set VITE_STRIPE_CHECKOUT_API_URL or VITE_STRIPE_PAYMENT_LINKS.'
  );
  err.code = 'STRIPE_NOT_CONFIGURED';
  throw err;
}

export function isStripeConfigured() {
  if (import.meta.env.VITE_STRIPE_CHECKOUT_API_URL) return true;
  const links = parseLinkMap();
  return Object.keys(links).length > 0;
}

export default {
  startStripeCheckout,
  isStripeConfigured,
};
