/**
 * Supabase Edge Function: manage-subscription
 * Cancel (at period end) or renew (undo cancel) a monthly subscription.
 *
 * POST JSON:
 *   { action: "cancel" | "renew", subscriptionId: string }
 *
 * Returns updated subscription snapshot for immediate UI update.
 *
 * Deploy: supabase functions deploy manage-subscription --no-verify-jwt
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

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

async function userFromRequest(req) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || !supabaseUrl) return null;
  const client = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
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

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();
    const subscriptionId = String(body.subscriptionId || '').trim();

    if (!subscriptionId.startsWith('sub_')) {
      return json({ error: 'Valid subscriptionId is required.' }, 400);
    }
    if (action !== 'cancel' && action !== 'renew') {
      return json({ error: 'action must be cancel or renew.' }, 400);
    }

    // Ownership: subscription must belong to this user in our DB, or share customer
    const sb = admin();
    const { data: owned } = await sb
      .from('stripe_subscriptions')
      .select('id, user_id, customer_id')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (owned?.user_id && owned.user_id !== user.id) {
      return json({ error: 'That subscription is not on your account.' }, 403);
    }

    // If not linked yet, allow when customer matches a donation by this user
    if (!owned?.user_id) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const customerId =
        typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      if (customerId) {
        const { data: don } = await sb
          .from('donations')
          .select('id')
          .eq('user_id', user.id)
          .eq('stripe_customer_id', customerId)
          .limit(1)
          .maybeSingle();
        if (!don && sub.metadata?.userId && sub.metadata.userId !== user.id) {
          return json({ error: 'That subscription is not on your account.' }, 403);
        }
      }
    }

    let sub;
    if (action === 'cancel') {
      // Cancel at period end — access until current_period_end; UI updates immediately
      sub = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      // Renew: undo pending cancellation
      sub = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
    }

    const snap = snapshot(sub);
    await persistSub(user.id, snap);

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
