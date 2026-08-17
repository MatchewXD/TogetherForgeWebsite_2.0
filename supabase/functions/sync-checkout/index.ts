/**
 * Supabase Edge Function: sync-checkout
 * After Stripe Checkout success, attach the session to the signed-in TF user
 * so Account → My Plan / Billing history populate even if the webhook lagged
 * or checkout metadata lacked userId.
 *
 * POST JSON: { sessionId: "cs_..." }
 * Auth: Bearer user JWT required.
 *
 * Deploy: supabase functions deploy sync-checkout --no-verify-jwt
 * Secrets: STRIPE_SECRET_KEY (+ hosted SUPABASE_* )
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import {
  enforceRateLimit,
  RATE_LIMITS,
} from '../_shared/rateLimit.ts';
import { fulfillTokenPurchase } from '../_shared/aiTokenEconomy.ts';

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

function idOf(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  return v.id || null;
}

function metaUserId(meta) {
  if (!meta || typeof meta !== 'object') return '';
  return String(
    meta[META_USER_KEY] || meta.userId || meta.user_id || ''
  ).trim();
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
      return json({ error: 'Sign in to sync your purchase.' }, 401);
    }

    const limited = enforceRateLimit(req, {
      ...RATE_LIMITS.syncCheckout,
      userId: user.id,
      cors,
    });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.sessionId || body.session_id || '').trim();
    if (!sessionId.startsWith('cs_')) {
      return json({ error: 'Valid sessionId (cs_…) is required.' }, 400);
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (!session) {
      return json({ error: 'Checkout session not found.' }, 404);
    }

    const paid =
      session.payment_status === 'paid' ||
      session.status === 'complete' ||
      session.payment_status === 'no_payment_required';
    if (!paid) {
      return json(
        {
          error: 'Checkout is not paid yet.',
          payment_status: session.payment_status,
          status: session.status,
        },
        400
      );
    }

    const meta = session.metadata || {};
    const sessionOwner =
      metaUserId(meta) ||
      (typeof session.client_reference_id === 'string'
        ? session.client_reference_id.trim()
        : '');

    if (sessionOwner && sessionOwner !== user.id) {
      return json(
        { error: 'This checkout is linked to a different account.' },
        403
      );
    }

    const customerId = idOf(session.customer);
    if (customerId) {
      try {
        const c =
          typeof session.customer === 'object' && session.customer
            ? session.customer
            : await stripe.customers.retrieve(customerId);
        if (c && !c.deleted) {
          const owner = metaUserId(c.metadata);
          if (owner && owner !== user.id) {
            return json(
              { error: 'This payment customer belongs to another account.' },
              403
            );
          }
          // Tag customer for future portal / My Plan resolution
          if (owner !== user.id) {
            await stripe.customers.update(customerId, {
              metadata: {
                ...(c.metadata || {}),
                [META_USER_KEY]: user.id,
                userId: user.id,
              },
            });
          }
        }
      } catch (e) {
        console.warn('[sync-checkout] customer tag', e?.message);
      }
    }

    const sb = admin();
    const amountCents =
      session.amount_total ?? Number(meta.amountCents) ?? 0;
    const interval =
      session.mode === 'subscription' || meta.interval === 'month'
        ? 'month'
        : 'once';
    const fundType = meta.fundType === 'runway' ? 'runway' : 'studio';
    const isAnonymous =
      meta.isAnonymous === 'false' || meta.anonymous === 'false'
        ? false
        : true;
    const displayName = isAnonymous
      ? null
      : meta.displayName || meta.display_name || null;
    const subId = idOf(session.subscription);

    // AI token pack — never write donations
    const checkoutKind = String(
      meta.checkoutKind || meta.checkout_kind || ''
    ).toLowerCase();
    if (checkoutKind === 'ai_tokens' || checkoutKind === 'ai_token') {
      const result = await fulfillTokenPurchase(sb, {
        userId: user.id,
        packId: meta.packId || meta.pack_id,
        amountCents,
        stripeSessionId: session.id,
        stripePaymentIntent: idOf(session.payment_intent),
        stripeCustomerId: customerId,
      });
      if (!result.ok) {
        return json(
          { error: result.error || 'Could not credit AI tokens.' },
          500
        );
      }
      return json({
        ok: true,
        kind: 'ai_tokens',
        tokens: result.tokens,
        purchaseId: result.purchaseId,
        duplicate: result.duplicate || false,
        sessionId: session.id,
      });
    }

    // Block if donation already owned by someone else
    if (session.id) {
      const { data: existingDon } = await sb
        .from('donations')
        .select('id, user_id')
        .eq('stripe_session_id', session.id)
        .maybeSingle();
      if (
        existingDon?.user_id &&
        existingDon.user_id !== user.id
      ) {
        return json(
          { error: 'This payment is already on another account.' },
          403
        );
      }
    }
    if (subId) {
      const { data: existingSub } = await sb
        .from('stripe_subscriptions')
        .select('id, user_id')
        .eq('id', subId)
        .maybeSingle();
      if (
        existingSub?.user_id &&
        existingSub.user_id !== user.id
      ) {
        return json(
          { error: 'This subscription is already on another account.' },
          403
        );
      }
    }

    const donationRow = {
      amount_cents: amountCents || null,
      amount: amountCents ? Math.round(amountCents / 100) : null,
      currency: session.currency || 'usd',
      interval,
      payment_kind:
        interval === 'month' ? 'subscription_payment' : 'one_time',
      fund_type: fundType,
      tier_id: meta.tierId || null,
      tier_label: meta.label || meta.tierLabel || null,
      status: 'completed',
      is_anonymous: isAnonymous,
      stripe_session_id: session.id,
      stripe_payment_intent: idOf(session.payment_intent),
      stripe_subscription_id: subId,
      stripe_customer_id: customerId,
      user_id: user.id,
      display_name: displayName,
    };

    // Upsert donation by session id
    let donationId = null;
    const { data: prior } = await sb
      .from('donations')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle();

    if (prior?.id) {
      const { data: updated, error: uErr } = await sb
        .from('donations')
        .update(donationRow)
        .eq('id', prior.id)
        .select('id')
        .maybeSingle();
      if (uErr) {
        // Retry without optional columns
        const slim = { ...donationRow };
        delete slim.payment_kind;
        delete slim.display_name;
        const { data: u2, error: e2 } = await sb
          .from('donations')
          .update(slim)
          .eq('id', prior.id)
          .select('id')
          .maybeSingle();
        if (e2) throw e2;
        donationId = u2?.id || prior.id;
      } else {
        donationId = updated?.id || prior.id;
      }
    } else if (amountCents >= 100) {
      const { data: inserted, error: iErr } = await sb
        .from('donations')
        .insert([donationRow])
        .select('id')
        .maybeSingle();
      if (iErr) {
        const slim = { ...donationRow };
        delete slim.payment_kind;
        delete slim.display_name;
        const { data: i2, error: e2 } = await sb
          .from('donations')
          .insert([slim])
          .select('id')
          .maybeSingle();
        if (e2) throw e2;
        donationId = i2?.id;
      } else {
        donationId = inserted?.id;
      }
    }

    let subscriptionSnap = null;
    if (subId) {
      let sub =
        typeof session.subscription === 'object' && session.subscription
          ? session.subscription
          : await stripe.subscriptions.retrieve(subId);

      // Ensure sub metadata carries user for future renewals
      try {
        const sm = sub.metadata || {};
        if (metaUserId(sm) !== user.id) {
          sub = await stripe.subscriptions.update(subId, {
            metadata: {
              ...sm,
              userId: user.id,
              [META_USER_KEY]: user.id,
              ...(displayName ? { displayName } : {}),
              isAnonymous: isAnonymous ? 'true' : 'false',
            },
          });
        }
      } catch (e) {
        console.warn('[sync-checkout] sub metadata', e?.message);
      }

      const item = sub.items?.data?.[0];
      const subAmount =
        item?.price?.unit_amount ?? item?.plan?.amount ?? amountCents;
      const subRow = {
        id: sub.id,
        status: sub.status,
        fund_type: fundType,
        amount_cents: subAmount,
        currency: item?.price?.currency || session.currency || 'usd',
        customer_id: idOf(sub.customer) || customerId,
        tier_id: meta.tierId || smTier(sub) || null,
        tier_label: meta.label || meta.tierLabel || null,
        cancel_at_period_end: !!sub.cancel_at_period_end,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        canceled_at: sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
        user_id: user.id,
        is_anonymous: isAnonymous,
        display_name: displayName,
      };

      let { error: sErr } = await sb
        .from('stripe_subscriptions')
        .upsert(subRow, { onConflict: 'id' });
      if (
        sErr &&
        /user_id|is_anonymous|display_name|tier_label|column/i.test(
          String(sErr.message || '')
        )
      ) {
        const slim = { ...subRow };
        delete slim.user_id;
        delete slim.is_anonymous;
        delete slim.display_name;
        delete slim.tier_label;
        // Still need user_id for My Plan — try with only user_id essential fields
        ({ error: sErr } = await sb
          .from('stripe_subscriptions')
          .upsert(
            {
              id: subRow.id,
              status: subRow.status,
              fund_type: subRow.fund_type,
              amount_cents: subRow.amount_cents,
              currency: subRow.currency,
              customer_id: subRow.customer_id,
              tier_id: subRow.tier_id,
              cancel_at_period_end: subRow.cancel_at_period_end,
              current_period_end: subRow.current_period_end,
              canceled_at: subRow.canceled_at,
              updated_at: subRow.updated_at,
              user_id: user.id,
            },
            { onConflict: 'id' }
          ));
      }
      if (sErr) {
        console.warn('[sync-checkout] sub upsert', sErr.message);
      } else {
        subscriptionSnap = {
          id: sub.id,
          status: sub.status,
          amount_cents: subAmount,
          user_id: user.id,
        };
      }
    }

    // Marks + badges (SQL trigger also grants; unique donation_id makes this safe)
    if (donationId) {
      try {
        const { error: marksErr } = await sb.rpc(
          'grant_forge_marks_from_donation',
          { p_donation_id: donationId }
        );
        if (marksErr) {
          console.warn('[sync-checkout] forge marks', marksErr.message);
        }
      } catch (e) {
        console.warn('[sync-checkout] forge marks', e?.message || e);
      }
    }
    try {
      await sb.rpc('sync_user_badges', { p_user_id: user.id });
    } catch {
      /* optional */
    }

    console.log(
      JSON.stringify({
        tag: 'TF_SYNC_CHECKOUT',
        step: 'ok',
        userId: user.id,
        sessionId: session.id,
        donationId,
        subId,
        amountCents,
        interval,
      })
    );

    return json({
      ok: true,
      sessionId: session.id,
      donationId,
      subscription: subscriptionSnap,
      userId: user.id,
    });
  } catch (err) {
    console.error('[sync-checkout]', err?.message || err);
    return json(
      { error: err?.message || 'Could not sync checkout.' },
      500
    );
  }
});

function smTier(sub) {
  return sub?.metadata?.tierId || null;
}
