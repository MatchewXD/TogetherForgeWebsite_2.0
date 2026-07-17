/**
 * Supabase Edge Function: create Stripe Checkout Session
 *
 * Deploy:
 *   supabase functions deploy create-checkout --no-verify-jwt
 *   (or verify JWT if you only want signed-in checkout)
 *
 * Secrets:
 *   STRIPE_SECRET_KEY=sk_...
 *
 * Client:
 *   VITE_STRIPE_CHECKOUT_API_URL=https://<project>.supabase.co/functions/v1/create-checkout
 *
 * POST JSON:
 *   {
 *     amountCents: number (>= 100, <= 1_000_000),
 *     interval: "once" | "month",
 *     tierId?: string,
 *     label?: string,
 *     fundType?: "studio" | "runway",
 *     successUrl: string,
 *     cancelUrl: string
 *   }
 * Response: { url: string, sessionId: string }
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
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

const MIN_CENTS = 100; // $1
const MAX_CENTS = 1_000_000; // $10,000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function isHttpUrl(s: unknown) {
  if (typeof s !== 'string' || !s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!stripeKey) {
    console.error('[create-checkout] STRIPE_SECRET_KEY missing');
    return json({ error: 'Stripe is not configured on the server' }, 500);
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
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;

    if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS) {
      return json({ error: 'Minimum amount is $1.00' }, 400);
    }
    if (amountCents > MAX_CENTS) {
      return json({ error: 'Maximum amount is $10,000.00 per checkout' }, 400);
    }
    if (!isHttpUrl(successUrl) || !isHttpUrl(cancelUrl)) {
      return json({ error: 'Valid successUrl and cancelUrl are required' }, 400);
    }

    // Stripe expands {CHECKOUT_SESSION_ID} on redirect
    const successWithSession =
      successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? successUrl
        : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;

    const mode = interval === 'month' ? 'subscription' : 'payment';

    const lineItem =
      interval === 'month'
        ? {
            price_data: {
              currency: 'usd',
              unit_amount: amountCents,
              recurring: { interval: 'month' },
              product_data: {
                name: label,
                metadata: { fundType, tierId },
              },
            },
            quantity: 1,
          }
        : {
            price_data: {
              currency: 'usd',
              unit_amount: amountCents,
              product_data: {
                name: label,
                metadata: { fundType, tierId },
              },
            },
            quantity: 1,
          };

    console.log('[create-checkout] creating session', {
      amountCents,
      interval,
      fundType,
      tierId,
      mode,
    });

    const session = await stripe.checkout.sessions.create({
      mode,
      success_url: successWithSession,
      cancel_url: cancelUrl,
      line_items: [lineItem],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        tierId,
        fundType,
        source: 'together-forge-web',
        amountCents: String(amountCents),
        interval,
      },
      // Subscriptions: metadata on subscription for invoice events
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
    return json(
      { error: err?.message || 'Checkout failed' },
      500
    );
  }
});
