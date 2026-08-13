/**
 * Create Stripe Checkout Session for AI token packs.
 * Completely separate from donation create-checkout.
 *
 * POST JSON: { packId, successUrl, cancelUrl }
 * Auth: Bearer user JWT required (no guest token purchases).
 *
 * Deploy:
 *   supabase functions deploy create-token-checkout --no-verify-jwt
 * Secrets: STRIPE_SECRET_KEY
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import { enforceRateLimit, RATE_LIMITS } from '../_shared/rateLimit.ts';
import { getTokenPack } from '../_shared/aiTokenPacks.ts';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const META_USER_KEY = 'together_forge_user_id';

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

async function userFromRequest(req) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || !supabaseUrl) return null;
  if (anonKey && token === anonKey) return null;
  if (serviceKey && token === serviceKey) return null;
  const client = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function admin() {
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveCustomer(userId, email) {
  const sb = admin();
  if (!sb) return null;
  // Prefer existing donation/sub customer only as a Stripe customer id reuse —
  // token purchases still go to ai_token_purchases, never donations.
  try {
    const { data: sub } = await sb
      .from('stripe_subscriptions')
      .select('customer_id')
      .eq('user_id', userId)
      .not('customer_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (sub?.customer_id) {
      try {
        const c = await stripe.customers.retrieve(sub.customer_id);
        if (c && !c.deleted) return c.id;
      } catch {
        /* continue */
      }
    }
  } catch {
    /* continue */
  }
  try {
    const { data: purch } = await sb
      .from('ai_token_purchases')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (purch?.stripe_customer_id) {
      try {
        const c = await stripe.customers.retrieve(purch.stripe_customer_id);
        if (c && !c.deleted) return c.id;
      } catch {
        /* continue */
      }
    }
  } catch {
    /* continue */
  }

  if (email && email.includes('@')) {
    try {
      const found = await stripe.customers.search({
        query: `email:"${email.replace(/"/g, '')}"`,
        limit: 1,
      });
      if (found.data?.[0]?.id) return found.data[0].id;
    } catch {
      /* continue */
    }
  }

  const created = await stripe.customers.create({
    email: email || undefined,
    metadata: {
      userId,
      [META_USER_KEY]: userId,
      source: 'together-forge-ai-tokens',
    },
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!stripeKey) {
    return json(
      {
        error:
          'Stripe is not configured on the server. Set STRIPE_SECRET_KEY for Edge Functions.',
      },
      500
    );
  }

  try {
    const authUser = await userFromRequest(req);
    if (!authUser?.id) {
      return json({ error: 'Sign in required to buy AI tokens.' }, 401);
    }
    const userId = String(authUser.id);

    const limited = enforceRateLimit(req, {
      ...RATE_LIMITS.tokenCheckout,
      userId,
      cors,
    });
    if (limited) return limited;

    const body = await req.json();
    const pack = getTokenPack(body.packId);
    if (!pack) {
      return json(
        { error: 'Choose a valid token pack (starter, builder, or studio).' },
        400
      );
    }
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;
    if (!isHttpUrl(successUrl) || !isHttpUrl(cancelUrl)) {
      return json(
        { error: 'Valid successUrl and cancelUrl are required.' },
        400
      );
    }

    const successWithSession = successUrl.includes('{CHECKOUT_SESSION_ID}')
      ? successUrl
      : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;

    const email =
      authUser.email && String(authUser.email).includes('@')
        ? String(authUser.email).trim().slice(0, 254)
        : '';

    const customerId = await resolveCustomer(userId, email);

    const sharedMeta = {
      checkoutKind: 'ai_tokens',
      packId: pack.id,
      tokens: String(pack.tokens),
      amountCents: String(pack.priceCents),
      source: 'together-forge-ai-tokens',
      userId,
      [META_USER_KEY]: userId,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successWithSession,
      cancel_url: cancelUrl,
      customer: customerId || undefined,
      customer_email: !customerId && email ? email : undefined,
      client_reference_id: userId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pack.priceCents,
            product_data: {
              name: `Together Forge AI Tokens — ${pack.label}`,
              description: `${pack.tokens.toLocaleString()} AI tokens for Idea tools and related features.`,
              metadata: {
                checkoutKind: 'ai_tokens',
                packId: pack.id,
              },
            },
          },
        },
      ],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: sharedMeta,
      payment_intent_data: {
        metadata: sharedMeta,
      },
    });

    if (!session.url) {
      return json({ error: 'Checkout session did not return a URL' }, 500);
    }

    // Pending purchase row (fulfillment still via webhook / sync)
    const sb = admin();
    if (sb) {
      try {
        await sb.from('ai_token_purchases').insert({
          user_id: userId,
          pack_id: pack.id,
          tokens_granted: pack.tokens,
          amount_cents: pack.priceCents,
          currency: 'usd',
          status: 'pending',
          stripe_session_id: session.id,
          stripe_customer_id: customerId || null,
          label: `${pack.label} AI Tokens`,
        });
      } catch (e) {
        console.warn('[create-token-checkout] pending row', e?.message || e);
      }
    }

    return json({
      url: session.url,
      sessionId: session.id,
      packId: pack.id,
      tokens: pack.tokens,
      amountCents: pack.priceCents,
    });
  } catch (err) {
    console.error('[create-token-checkout] failed', err?.message || err);
    return json({ error: err?.message || 'Checkout failed' }, 500);
  }
});
