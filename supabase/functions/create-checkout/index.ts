/**
 * Example Supabase Edge Function: Stripe Checkout Session
 *
 * Deploy: supabase functions deploy create-checkout
 * Secrets: stripe secret key as STRIPE_SECRET_KEY
 *
 * Client env:
 *   VITE_STRIPE_CHECKOUT_API_URL=https://<project>.supabase.co/functions/v1/create-checkout
 *
 * Body JSON:
 *   { amountCents, interval: "once"|"month", tierId, label, successUrl, cancelUrl }
 * Response:
 *   { url }
 *
 * This file is a reference template. Wire Stripe SDK in the Edge runtime before production use.
 */

// deno-lint-ignore-file
// @ts-nocheck — template for Deno Edge; not part of Vite build

import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json();
    const amountCents = Number(body.amountCents);
    const interval = body.interval === 'month' ? 'month' : 'once';
    const label = body.label || 'Together Forge Support';
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;

    if (!amountCents || amountCents < 100) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const mode = interval === 'month' ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        interval === 'month'
          ? {
              price_data: {
                currency: 'usd',
                unit_amount: amountCents,
                recurring: { interval: 'month' },
                product_data: { name: label },
              },
              quantity: 1,
            }
          : {
              price_data: {
                currency: 'usd',
                unit_amount: amountCents,
                product_data: { name: label },
              },
              quantity: 1,
            },
      ],
      metadata: {
        tierId: body.tierId || 'custom',
        source: 'together-forge-web',
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || 'Checkout failed' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
