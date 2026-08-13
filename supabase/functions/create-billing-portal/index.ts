/**
 * Supabase Edge Function: create-billing-portal
 * Opens Stripe Customer Portal for payment methods, invoices, and plan management.
 *
 * POST JSON: { returnUrl: string, flow?: "payment_method_update" }
 * Auth: Bearer user JWT (or anon + session).
 *
 * Deploy: supabase functions deploy create-billing-portal --no-verify-jwt
 * Secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import {
  enforceRateLimit,
  RATE_LIMITS,
} from '../_shared/rateLimit.ts';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

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

function admin() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const META_USER_KEY = 'together_forge_user_id';

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

function metaUserId(meta) {
  if (!meta || typeof meta !== 'object') return '';
  return String(
    meta[META_USER_KEY] || meta.userId || meta.user_id || ''
  ).trim();
}

/** Customer is usable for this user only if not owned by someone else. */
function customerAllowedForUser(customer, userId) {
  if (!customer || customer.deleted || !userId) return false;
  const owner = metaUserId(customer.metadata);
  if (owner && owner !== userId) return false;
  return true;
}

function customerOwnedByUser(customer, userId) {
  if (!customer || !userId) return false;
  return metaUserId(customer.metadata) === userId;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!stripeKey) {
    return json({ error: 'Stripe is not configured on the server.' }, 500);
  }
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Database not configured.' }, 500);
  }

  try {
    const user = await userFromRequest(req);
    if (!user?.id) {
      return json({ error: 'Sign in to manage billing.' }, 401);
    }

    const limited = enforceRateLimit(req, {
      ...RATE_LIMITS.billingPortal,
      userId: user.id,
      cors,
    });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    let returnUrl = String(body.returnUrl || '').trim();
    if (!returnUrl.startsWith('http')) {
      return json({ error: 'Valid returnUrl is required.' }, 400);
    }
    // Ensure we can refresh payment methods when the user returns from Stripe
    if (!/[?&]portal=/.test(returnUrl)) {
      returnUrl += returnUrl.includes('?') ? '&portal=return' : '?portal=return';
    }

    // Find the best Stripe customer for THIS TF user.
    // Prefer stored user_id / customer metadata over loose email matching.
    const sb = admin();
    let customerId = null;
    const uid = user.id;
    const candidateIds = [];
    const push = (id) => {
      if (id && !candidateIds.includes(id)) candidateIds.push(id);
    };

    try {
      const { data: subs } = await sb
        .from('stripe_subscriptions')
        .select('customer_id')
        .eq('user_id', uid)
        .not('customer_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(10);
      for (const row of subs || []) push(row.customer_id);
    } catch {
      /* ignore */
    }
    try {
      const { data: dons } = await sb
        .from('donations')
        .select('stripe_customer_id')
        .eq('user_id', uid)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);
      for (const row of dons || []) push(row.stripe_customer_id);
    } catch {
      /* ignore */
    }
    for (const key of [META_USER_KEY, 'userId']) {
      try {
        const found = await stripe.customers.search({
          query: `metadata['${key}']:'${uid}'`,
          limit: 10,
        });
        for (const c of found?.data || []) push(c.id);
      } catch {
        /* optional */
      }
    }
    // Email is a weak signal: only include customers already owned by this user
    // or unowned (no other TF user_id). Never open portal for another user's customer.
    if (user.email) {
      try {
        const listed = await stripe.customers.list({
          email: String(user.email).toLowerCase(),
          limit: 20,
        });
        for (const c of listed.data || []) {
          if (customerAllowedForUser(c, uid) && customerOwnedByUser(c, uid)) {
            push(c.id);
          }
        }
      } catch {
        /* ignore */
      }
    }

    let bestScore = -1;
    for (const id of candidateIds) {
      try {
        const c = await stripe.customers.retrieve(id);
        if (!customerAllowedForUser(c, uid)) continue;
        let cards = 0;
        let links = 0;
        try {
          const listed = await stripe.customers.listPaymentMethods(id, {
            type: 'card',
            limit: 30,
          });
          cards = (listed.data || []).length;
        } catch {
          /* ignore */
        }
        try {
          const listed = await stripe.customers.listPaymentMethods(id, {
            type: 'link',
            limit: 5,
          });
          links = (listed.data || []).length;
        } catch {
          /* ignore */
        }
        // Prefer customers explicitly owned via metadata; DB-linked still allowed
        const owned = customerOwnedByUser(c, uid) ? 5 : 1;
        const score = cards * 1000 + links * 10 + owned;
        if (score > bestScore) {
          bestScore = score;
          customerId = id;
        }
      } catch {
        /* stale */
      }
    }

    if (!customerId) {
      // Create a customer owned by this TF user so portal + methods stay isolated
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          userId: user.id,
          [META_USER_KEY]: user.id,
          source: 'together-forge-web',
        },
      });
      customerId = customer.id;
    }

    console.log('[create-billing-portal] customer', {
      uid,
      customerId,
      candidates: candidateIds.length,
      score: bestScore,
    });

    const flow = body.flow === 'payment_method_update' ? 'payment_method_update' : null;

    const sessionParams = {
      customer: customerId,
      return_url: returnUrl,
    };

    // Deep-link to payment method update when requested (Stripe Portal configs vary)
    if (flow === 'payment_method_update') {
      sessionParams.flow_data = {
        type: 'payment_method_update',
      };
    }

    let session;
    try {
      session = await stripe.billingPortal.sessions.create(sessionParams);
    } catch (e) {
      // flow_data may fail if portal config doesn't allow it — retry plain portal
      if (sessionParams.flow_data) {
        delete sessionParams.flow_data;
        session = await stripe.billingPortal.sessions.create(sessionParams);
      } else {
        throw e;
      }
    }

    if (!session?.url) {
      return json({ error: 'Portal session missing URL.' }, 500);
    }
    return json({ url: session.url });
  } catch (err) {
    console.error('[create-billing-portal]', err?.message || err);
    return json(
      {
        error:
          err?.message ||
          'Could not open billing portal. Ensure Stripe Customer Portal is enabled in the Stripe Dashboard.',
      },
      500
    );
  }
});
