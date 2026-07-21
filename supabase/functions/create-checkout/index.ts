/**
 * Supabase Edge Function: create Stripe Checkout Session
 *
 * ── Local test ──────────────────────────────────────────────────────────
 *   1. Put STRIPE_SECRET_KEY in supabase/.env (NOT in VITE_ client env)
 *   2. Optional: STRIPE_PRODUCT_ID=prod_UvB5nILGYFdPln
 *   3. supabase functions serve create-checkout --env-file supabase/.env
 *   4. Client: VITE_SUPABASE_URL=http://127.0.0.1:54321
 *              VITE_SUPABASE_ANON_KEY=...
 *              (API URL is auto-derived: {SUPABASE_URL}/functions/v1/create-checkout)
 *
 * ── Production ──────────────────────────────────────────────────────────
 *   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
 *   supabase secrets set STRIPE_PRODUCT_ID=prod_...
 *   supabase functions deploy create-checkout --no-verify-jwt
 *
 * POST JSON:
 *   {
 *     amountCents: number,          // required, 100..1_000_000
 *     interval?: "once"|"month",
 *     tierId?: string,
 *     label?: string,
 *     fundType?: "studio"|"runway",
 *     productId?: string,           // optional override of STRIPE_PRODUCT_ID
 *     successUrl: string,           // e.g. http://localhost:5173/support?checkout=success
 *     cancelUrl: string
 *   }
 * Response: { url, sessionId }
 *
 * SECURITY: Secret key lives only in Edge Function env. Never VITE_ prefix.
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const defaultProductId = Deno.env.get('STRIPE_PRODUCT_ID') ?? '';

const stripe = new Stripe(stripeKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function isHttpUrl(s) {
  if (typeof s !== 'string' || !s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function buildPriceData({
  amountCents,
  interval,
  label,
  fundType,
  tierId,
  productId,
}) {
  const base = {
    currency: 'usd',
    unit_amount: amountCents,
    ...(interval === 'month' ? { recurring: { interval: 'month' } } : {}),
  };

  // Prefer existing Stripe Product (your test prod_UvB5nILGYFdPln)
  if (productId) {
    return { ...base, product: productId };
  }

  return {
    ...base,
    product_data: {
      name: label,
      metadata: { fundType, tierId },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!stripeKey) {
    console.error('[create-checkout] STRIPE_SECRET_KEY missing on server');
    return json(
      {
        error:
          'Stripe is not configured on the server. Set STRIPE_SECRET_KEY for the Edge Function (never in VITE_ client env).',
      },
      500
    );
  }

  try {
    const body = await req.json();
    const amountCents = Math.round(Number(body.amountCents));
    const interval = body.interval === 'month' ? 'month' : 'once';
    const fundType = body.fundType === 'runway' ? 'runway' : 'studio';
    const tierId = String(body.tierId || 'custom').slice(0, 64);
    const label = String(
      body.label ||
        (fundType === 'runway'
          ? 'Together Forge Founder Runway'
          : 'Together Forge Support')
    ).slice(0, 120);
    const productId = String(
      body.productId || defaultProductId || ''
    ).trim();
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;

    if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS) {
      return json({ error: 'Minimum amount is $1.00' }, 400);
    }
    if (amountCents > MAX_CENTS) {
      return json({ error: 'Maximum amount is $10,000.00 per checkout' }, 400);
    }
    if (!isHttpUrl(successUrl) || !isHttpUrl(cancelUrl)) {
      return json(
        {
          error:
            'Valid successUrl and cancelUrl are required (use http://localhost:5173/... for local tests)',
        },
        400
      );
    }

    const successWithSession = successUrl.includes('{CHECKOUT_SESSION_ID}')
      ? successUrl
      : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;

    const mode = interval === 'month' ? 'subscription' : 'payment';
    const priceData = buildPriceData({
      amountCents,
      interval,
      label,
      fundType,
      tierId,
      productId: productId || null,
    });

    console.log('[create-checkout] creating session', {
      amountCents,
      interval,
      fundType,
      tierId,
      mode,
      productId: productId || '(inline product_data)',
    });

    const session = await stripe.checkout.sessions.create({
      mode,
      success_url: successWithSession,
      cancel_url: cancelUrl,
      line_items: [{ price_data: priceData, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        tierId,
        fundType,
        source: 'together-forge-web',
        amountCents: String(amountCents),
        interval,
      },
      ...(mode === 'subscription'
        ? {
            subscription_data: {
              metadata: {
                tierId,
                fundType,
                source: 'together-forge-web',
              },
            },
          }
        : {}),
    });

    if (!session.url) {
      console.error('[create-checkout] session missing url', session.id);
      return json({ error: 'Checkout session did not return a URL' }, 500);
    }

    return json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[create-checkout] failed', err?.message || err);
    return json({ error: err?.message || 'Checkout failed' }, 500);
  }
});
