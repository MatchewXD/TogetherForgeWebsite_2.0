/**
 * Supabase Edge Function: create Stripe Checkout Session
 *
 * Customer association (critical):
 * - Signed-in TF user → find/create Stripe Customer for THAT user_id only
 * - Guest → customer_email if provided, else Stripe creates a guest customer
 * - Never reuse one shared Customer across different TF accounts
 *
 * POST JSON:
 *   {
 *     amountCents, interval?, tierId?, label?, fundType?, productId?,
 *     successUrl, cancelUrl,
 *     userId?, email?, displayName?, isAnonymous?
 *   }
 *
 * Deploy:
 *   supabase functions deploy create-checkout --no-verify-jwt
 * Secrets: STRIPE_SECRET_KEY
 * Optional: STRIPE_PRODUCT_ID only if you created a real product in THIS Stripe account.
 * Dynamic $ amounts use inline product_data by default (no pre-created product needed).
 * Hosted also has SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for DB customer lookup.
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
// Only used when explicitly requested; never required for dynamic pricing
const envProductId = String(Deno.env.get('STRIPE_PRODUCT_ID') || '').trim();
const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';

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
const META_USER_KEY = 'together_forge_user_id';

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

function admin() {
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Build Checkout price_data.
 * Prefer inline product_data so any amount works without a pre-created Product.
 * Optional product id is only used when caller opts in AND it exists in this account.
 */
function buildPriceData({
  amountCents,
  interval,
  label,
  fundType,
  tierId,
  productId = null,
}) {
  const base = {
    currency: 'usd',
    unit_amount: amountCents,
    ...(interval === 'month' ? { recurring: { interval: 'month' } } : {}),
  };

  if (productId) {
    return { ...base, product: productId };
  }

  return {
    ...base,
    product_data: {
      name: label || 'Together Forge Support',
      metadata: {
        fundType: String(fundType || 'studio'),
        tierId: String(tierId || 'custom'),
        source: 'together-forge-web',
      },
    },
  };
}

function customerOwnedByUser(customer, userId) {
  if (!customer || !userId) return false;
  const meta = customer.metadata || {};
  return (
    meta[META_USER_KEY] === userId ||
    meta.userId === userId ||
    meta.user_id === userId
  );
}

/**
 * Find an existing Stripe Customer for this TF user, or create one.
 * Order: our DB → Stripe search by metadata → Stripe list by email + metadata check → create.
 */
async function resolveStripeCustomerForUser({
  userId,
  email,
  displayName,
}) {
  const uid = String(userId || '').trim();
  if (!uid) return null;

  const emailNorm =
    email && String(email).includes('@')
      ? String(email).trim().toLowerCase()
      : null;

  // 1) Prior customer id from our tables (subscriptions / donations)
  const sb = admin();
  if (sb) {
    try {
      const { data: sub } = await sb
        .from('stripe_subscriptions')
        .select('customer_id')
        .eq('user_id', uid)
        .not('customer_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub?.customer_id) {
        try {
          const c = await stripe.customers.retrieve(sub.customer_id);
          if (c && !c.deleted && customerOwnedByUser(c, uid)) {
            return c.id;
          }
          // Orphaned / wrong owner — do not reuse
        } catch {
          /* missing customer */
        }
      }
    } catch (e) {
      console.warn('[create-checkout] sub customer lookup', e?.message);
    }

    try {
      const { data: don } = await sb
        .from('donations')
        .select('stripe_customer_id')
        .eq('user_id', uid)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (don?.stripe_customer_id) {
        try {
          const c = await stripe.customers.retrieve(don.stripe_customer_id);
          // Only reuse if already owned by this TF user — never re-tag a shared customer
          if (c && !c.deleted && customerOwnedByUser(c, uid)) {
            return c.id;
          }
          // Untagged legacy customer: claim only if metadata has no other user id
          if (c && !c.deleted) {
            const meta = c.metadata || {};
            const otherOwner =
              meta[META_USER_KEY] || meta.userId || meta.user_id || '';
            if (!otherOwner) {
              await stripe.customers.update(c.id, {
                metadata: {
                  ...meta,
                  [META_USER_KEY]: uid,
                  userId: uid,
                },
              });
              return c.id;
            }
          }
        } catch {
          /* missing */
        }
      }
    } catch (e) {
      console.warn('[create-checkout] donation customer lookup', e?.message);
    }
  }

  // 2) Stripe Customer Search by stable TF user id (preferred)
  try {
    const found = await stripe.customers.search({
      query: `metadata['${META_USER_KEY}']:'${uid}'`,
      limit: 1,
    });
    if (found?.data?.[0]?.id) return found.data[0].id;
  } catch (e) {
    // Search may be unavailable on some accounts — fall through
    console.warn('[create-checkout] customer search', e?.message);
  }

  try {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${uid}'`,
      limit: 1,
    });
    if (found?.data?.[0]?.id) return found.data[0].id;
  } catch {
    /* ignore */
  }

  // 3) Same email only if metadata already ties to this user (never grab a random email match)
  if (emailNorm) {
    try {
      const listed = await stripe.customers.list({
        email: emailNorm,
        limit: 20,
      });
      const match = (listed.data || []).find((c) => customerOwnedByUser(c, uid));
      if (match?.id) return match.id;
    } catch (e) {
      console.warn('[create-checkout] customer list by email', e?.message);
    }
  }

  // 4) Create a dedicated Customer for this TF user
  const created = await stripe.customers.create({
    ...(emailNorm ? { email: emailNorm } : {}),
    name: displayName || undefined,
    metadata: {
      [META_USER_KEY]: uid,
      userId: uid,
      source: 'together-forge-web',
    },
  });

  console.log('[create-checkout] created Stripe customer', {
    customerId: created.id,
    userId: uid,
    email: emailNorm || null,
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
    // Do not force a stale env product id — only use if body explicitly passes one,
    // or env is set AND body does not opt out (useProduct: false).
    const useProduct =
      body.useProduct === true ||
      body.useProduct === 'true' ||
      Boolean(body.productId);
    const productId = useProduct
      ? String(body.productId || envProductId || '').trim()
      : '';
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;
    const userId = body.userId ? String(body.userId).slice(0, 64) : '';
    const displayName = body.displayName
      ? String(body.displayName).slice(0, 64)
      : '';
    const email = body.email ? String(body.email).trim().slice(0, 254) : '';
    // Default anonymous unless client opts into public credit
    const isAnonymous =
      body.isAnonymous === false || body.isAnonymous === 'false' ? false : true;

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

    // ── Customer association ─────────────────────────────────────────────
    // Signed-in: always attach a Customer owned by this TF user_id.
    // Guest: optional customer_email only — never force a shared customer.
    let customerId = null;
    let customerEmail = null;

    if (userId) {
      customerId = await resolveStripeCustomerForUser({
        userId,
        email,
        displayName,
      });
    } else if (email && email.includes('@')) {
      customerEmail = email.toLowerCase();
    }

    const sharedMeta = {
      tierId,
      fundType,
      source: 'together-forge-web',
      amountCents: String(amountCents),
      interval,
      label,
      isAnonymous: isAnonymous ? 'true' : 'false',
      ...(userId
        ? { userId, [META_USER_KEY]: userId }
        : {}),
      ...(displayName ? { displayName } : {}),
    };

    const customerFields = customerId
      ? { customer: customerId }
      : customerEmail
        ? { customer_email: customerEmail }
        : {};

    async function createSession(withProductId) {
      const priceData = buildPriceData({
        amountCents,
        interval,
        label,
        fundType,
        tierId,
        productId: withProductId || null,
      });
      console.log('[create-checkout] creating session', {
        amountCents,
        interval,
        fundType,
        tierId,
        mode,
        userId: userId || null,
        customerId: customerId || null,
        guestEmail: customerEmail || null,
        productId: withProductId || '(inline product_data)',
      });
      return stripe.checkout.sessions.create({
        mode,
        success_url: successWithSession,
        cancel_url: cancelUrl,
        line_items: [{ price_data: priceData, quantity: 1 }],
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        metadata: sharedMeta,
        ...customerFields,
        ...(mode === 'subscription'
          ? {
              subscription_data: {
                metadata: sharedMeta,
              },
            }
          : {}),
      });
    }

    let session;
    try {
      session = await createSession(productId || null);
    } catch (err) {
      // Stale STRIPE_PRODUCT_ID / wrong account product → fall back to product_data
      const msg = String(err?.message || err || '');
      if (productId && /no such product|resource_missing/i.test(msg)) {
        console.warn(
          '[create-checkout] product missing, retrying with product_data',
          productId
        );
        session = await createSession(null);
      } else {
        throw err;
      }
    }

    if (!session.url) {
      console.error('[create-checkout] session missing url', session.id);
      return json({ error: 'Checkout session did not return a URL' }, 500);
    }

    return json({
      url: session.url,
      sessionId: session.id,
      customerId: customerId || session.customer || null,
    });
  } catch (err) {
    console.error('[create-checkout] failed', err?.message || err);
    return json({ error: err?.message || 'Checkout failed' }, 500);
  }
});
