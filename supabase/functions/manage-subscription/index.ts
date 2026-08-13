/**
 * Supabase Edge Function: manage-subscription
 * Cancel (at period end) or renew (undo cancel) a monthly subscription.
 *
 * POST JSON:
 *   { action: "cancel" | "renew" | "refresh", subscriptionId: string }
 *
 * refresh = pull latest state from Stripe API into stripe_subscriptions (no charge).
 * Auth: Bearer user JWT required.
 * Ownership: subscription must be proven to belong to the authenticated user
 * via stored user_id, Stripe metadata, or customer metadata (not email alone).
 *
 * Returns updated subscription snapshot for immediate UI update.
 *
 * Deploy: supabase functions deploy manage-subscription --no-verify-jwt
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

function admin() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

function metaUserId(meta) {
  if (!meta || typeof meta !== 'object') return '';
  return String(
    meta[META_USER_KEY] || meta.userId || meta.user_id || ''
  ).trim();
}

function snapshot(sub) {
  const item = sub.items?.data?.[0];
  const amountCents =
    item?.price?.unit_amount ?? item?.plan?.amount ?? null;
  return {
    id: sub.id,
    status: sub.status,
    amount_cents: amountCents,
    currency: item?.price?.currency || 'usd',
    tier_id: sub.metadata?.tierId || null,
    tier_label: sub.metadata?.tierLabel || sub.metadata?.label || null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    canceled_at: sub.canceled_at
      ? new Date(sub.canceled_at * 1000).toISOString()
      : null,
    customer_id:
      typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    fund_type: sub.metadata?.fundType === 'runway' ? 'runway' : 'studio',
    updated_at: new Date().toISOString(),
  };
}

async function persistSub(userId, snap) {
  const row = {
    ...snap,
    user_id: userId,
  };
  const { error } = await admin()
    .from('stripe_subscriptions')
    .upsert(row, { onConflict: 'id' });
  if (error) {
    console.warn('[manage-subscription] persist', error.message);
  }
}

/**
 * Require positive proof that this subscription belongs to the authenticated user.
 * Prefer stable links: stripe_subscriptions.user_id, subscription/customer metadata.
 * Deny by default — never allow cancel/renew based on email alone.
 */
async function assertSubscriptionOwnedByUser(user, subscriptionId) {
  const uid = user.id;
  const sb = admin();

  const { data: owned } = await sb
    .from('stripe_subscriptions')
    .select('id, user_id, customer_id')
    .eq('id', subscriptionId)
    .maybeSingle();

  // Explicit other-owner row → hard deny
  if (owned?.user_id && owned.user_id !== uid) {
    return {
      ok: false,
      status: 403,
      error: 'That subscription is not on your account.',
    };
  }

  // Proven owner in our DB
  if (owned?.user_id === uid) {
    return { ok: true, customerId: owned.customer_id || null };
  }

  // Not linked (or missing user_id): verify via Stripe metadata / customer / donations
  let sub;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return {
      ok: false,
      status: 404,
      error: 'Subscription not found.',
    };
  }

  const subMetaUid = metaUserId(sub.metadata);
  if (subMetaUid && subMetaUid === uid) {
    return {
      ok: true,
      customerId:
        typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    };
  }
  if (subMetaUid && subMetaUid !== uid) {
    return {
      ok: false,
      status: 403,
      error: 'That subscription is not on your account.',
    };
  }

  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) {
    return {
      ok: false,
      status: 403,
      error: 'That subscription is not on your account.',
    };
  }

  // Customer metadata ownership (stable link)
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !customer.deleted) {
      const custMetaUid = metaUserId(customer.metadata);
      if (custMetaUid && custMetaUid === uid) {
        return { ok: true, customerId };
      }
      if (custMetaUid && custMetaUid !== uid) {
        return {
          ok: false,
          status: 403,
          error: 'That subscription is not on your account.',
        };
      }
    }
  } catch {
    /* continue to donation check */
  }

  // Donation rows already scoped by this user's user_id + customer id
  const { data: don } = await sb
    .from('donations')
    .select('id')
    .eq('user_id', uid)
    .eq('stripe_customer_id', customerId)
    .limit(1)
    .maybeSingle();

  if (don?.id) {
    return { ok: true, customerId };
  }

  // No positive ownership proof
  return {
    ok: false,
    status: 403,
    error: 'That subscription is not on your account.',
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
    return json({ error: 'Stripe is not configured on the server.' }, 500);
  }

  try {
    const user = await userFromRequest(req);
    if (!user?.id) {
      return json({ error: 'Sign in to manage your plan.' }, 401);
    }

    const limited = enforceRateLimit(req, {
      ...RATE_LIMITS.manageSubscription,
      userId: user.id,
      cors,
    });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();
    const subscriptionId = String(body.subscriptionId || '').trim();

    if (!subscriptionId.startsWith('sub_')) {
      return json({ error: 'Valid subscriptionId is required.' }, 400);
    }
    if (action !== 'cancel' && action !== 'renew' && action !== 'refresh') {
      return json({ error: 'action must be cancel, renew, or refresh.' }, 400);
    }

    console.log(
      JSON.stringify({
        tag: 'TF_MANAGE_SUB',
        step: 'request',
        action,
        subscriptionId,
        userId: user.id,
      })
    );

    const ownership = await assertSubscriptionOwnedByUser(user, subscriptionId);
    if (!ownership.ok) {
      console.log(
        JSON.stringify({
          tag: 'TF_MANAGE_SUB',
          step: 'ownership_denied',
          action,
          subscriptionId,
          userId: user.id,
          error: ownership.error,
        })
      );
      return json(
        { error: ownership.error },
        ownership.status || 403
      );
    }

    let sub;
    if (action === 'cancel') {
      // Cancel at period end — access until current_period_end; UI updates immediately
      sub = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else if (action === 'renew') {
      // Renew: undo pending cancellation
      sub = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
    } else {
      // refresh: read-only pull from Stripe (Dashboard cancel / portal changes)
      sub = await stripe.subscriptions.retrieve(subscriptionId);
    }

    const snap = snapshot(sub);
    await persistSub(user.id, snap);

    console.log(
      JSON.stringify({
        tag: 'TF_MANAGE_SUB',
        step: 'ok',
        action,
        subscriptionId,
        userId: user.id,
        status: snap.status,
        cancel_at_period_end: snap.cancel_at_period_end,
      })
    );

    return json({
      ok: true,
      action,
      subscription: snap,
    });
  } catch (err) {
    console.error('[manage-subscription]', err?.message || err);
    return json({ error: err?.message || 'Could not update subscription.' }, 500);
  }
});
