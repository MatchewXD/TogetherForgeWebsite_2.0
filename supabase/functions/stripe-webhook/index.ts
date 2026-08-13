/**
 * Supabase Edge Function: stripe-webhook
 *
 * Handles Stripe events, verifies signatures, records payments/subscriptions.
 * Returns 200 quickly after durable DB writes (idempotent upserts).
 *
 * ── Deploy (hosted Supabase) ────────────────────────────────────────────
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *
 *   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
 *   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *   # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are usually injected automatically
 *
 * ── Stripe Dashboard webhook URL ───────────────────────────────────────
 *   https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook
 *
 *   Find PROJECT_REF: Dashboard → Project Settings → General → Reference ID
 *   Or: supabase status / project URL host before .supabase.co
 *
 * ── Events to enable ───────────────────────────────────────────────────
 *   checkout.session.completed   → first payment + credit metadata
 *   invoice.paid                 → each subscription RENEWAL → new thank-you card
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   charge.refunded (optional)
 *
 * Monthly recognition: every successful renewal inserts a donations row with the
 * same public credit as checkout (user_id / is_anonymous). get_public_recent_donations
 * surfaces each payment as its own card on the Donate page thank-you section.
 *
 * ── Local test ─────────────────────────────────────────────────────────
 *   stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
 *   supabase functions serve stripe-webhook --env-file supabase/.env --no-verify-jwt
 *
 * Env (function only - never VITE_):
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import { fulfillTokenPurchase } from '../_shared/aiTokenEconomy.ts';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
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

/** Structured logs → Supabase Dashboard → Edge Functions → stripe-webhook → Logs */
function wlog(step: string, detail: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      tag: 'TF_STRIPE_WEBHOOK',
      step,
      ts: new Date().toISOString(),
      ...detail,
    })
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function admin() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function idOf(field: unknown): string | null {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field.id) return String(field.id);
  return null;
}

/** Map custom / missing tier by amount (matches src/constants/badges.js). */
function resolveDonationTierMeta(
  tierId: string | null | undefined,
  amountCents: number,
  interval: string = 'once',
  tierLabel?: string | null
) {
  const id = String(tierId || '').toLowerCase().trim();
  if (id === 'supporter' || id === 'member' || id === 'builder') {
    return {
      tierId: id,
      tierLabel:
        tierLabel ||
        (id === 'member'
          ? 'Forge Member'
          : id.charAt(0).toUpperCase() + id.slice(1)),
    };
  }
  const cents = Number(amountCents) || 0;
  const monthly = String(interval || 'once').toLowerCase() === 'month';
  if (monthly) {
    if (cents >= 4000) return { tierId: 'builder', tierLabel: tierLabel || 'Builder' };
    if (cents >= 1500) return { tierId: 'member', tierLabel: tierLabel || 'Forge Member' };
    if (cents >= 500) return { tierId: 'supporter', tierLabel: tierLabel || 'Supporter' };
  } else {
    if (cents >= 5000) return { tierId: 'builder', tierLabel: tierLabel || 'Builder' };
    if (cents >= 2000) return { tierId: 'member', tierLabel: tierLabel || 'Forge Member' };
    if (cents >= 500) return { tierId: 'supporter', tierLabel: tierLabel || 'Supporter' };
  }
  return {
    tierId: id || 'custom',
    tierLabel: tierLabel || 'Custom',
  };
}

/** Recompute badge grants (non-fatal). */
async function syncUserBadges(userId: string | null | undefined) {
  if (!userId) return;
  try {
    const { error } = await admin().rpc('sync_user_badges', {
      p_user_id: userId,
    });
    if (error) {
      console.warn('[stripe-webhook] sync_user_badges', error.message);
    }
  } catch (e) {
    console.warn('[stripe-webhook] sync_user_badges', e?.message || e);
  }
}

function fundTypeFromMeta(meta: Record<string, string> | null | undefined) {
  return meta?.fundType === 'runway' ? 'runway' : 'studio';
}

/**
 * Studio donations attach to the currently active In Development project.
 * Completed / planned projects receive nothing new.
 * Runway fund never attaches to a game project.
 */
async function resolveActiveProjectId(
  fundType: string
): Promise<string | null> {
  if (fundType === 'runway') return null;
  const sb = admin();
  try {
    const { data, error } = await sb.rpc('get_active_project_id_for_donations');
    if (!error && data) return String(data);
  } catch (e) {
    console.warn(
      '[stripe-webhook] get_active_project_id_for_donations',
      e?.message
    );
  }
  // Fallback if RPC not deployed yet: pick first Early + In Development row
  try {
    const { data: rows } = await sb
      .from('projects')
      .select('id, phase, status, completed_at, sort_order, created_at')
      .is('completed_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    const list = rows || [];
    const active = list.filter((p) => {
      if (p.completed_at) return false;
      const s = String(p.status || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ');
      if (
        [
          'completed',
          'complete',
          'shipped',
          'released',
          'done',
          'planning',
          'planned',
          'on hold',
          'hold',
          'queued',
          'upcoming',
          'concept',
          'vision',
        ].includes(s)
      ) {
        return false;
      }
      return !s || ['in development', 'development', 'active', 'live'].includes(s);
    });
    const early = active.filter((p) =>
      String(p.phase || '')
        .toLowerCase()
        .startsWith('early')
    );
    const pick = (early.length ? early : active)[0];
    return pick?.id ? String(pick.id) : null;
  } catch (e) {
    console.warn('[stripe-webhook] active project fallback', e?.message);
    return null;
  }
}

/** Mirror attributed studio gift into public credits table (best-effort). */
async function mirrorDonationContribution(row: Record<string, unknown>) {
  if (!row.project_id || row.fund_type === 'runway') return;
  try {
    await admin().from('project_contributions').insert({
      project_id: row.project_id,
      user_id: row.user_id || null,
      display_name: row.is_anonymous
        ? null
        : row.display_name || null,
      category: 'donations',
      is_anonymous: row.is_anonymous !== false,
      amount_cents: row.amount_cents || 0,
      sort_order: 0,
    });
  } catch (e) {
    console.warn(
      '[stripe-webhook] project_contributions mirror',
      e?.message || e
    );
  }
}

/** Idempotent: skip if this Stripe event was already processed */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  const sb = admin();
  const { data } = await sb
    .from('donations')
    .select('id')
    .eq('raw_event_id', eventId)
    .maybeSingle();
  if (data?.id) return true;
  // Also check stripe_webhook_events if table exists
  try {
    const { data: ev } = await sb
      .from('stripe_webhook_events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle();
    return !!ev?.id;
  } catch {
    return false;
  }
}

async function markEventProcessed(eventId: string, type: string) {
  try {
    const { error } = await admin().from('stripe_webhook_events').upsert({
      id: eventId,
      type,
      processed_at: new Date().toISOString(),
    });
    if (error) {
      // Supabase client does not throw — log so empty event table is diagnosable
      console.warn('[stripe-webhook] event log upsert failed', error.message);
    }
  } catch (e) {
    console.warn('[stripe-webhook] event log skip', e?.message);
  }
}

const OPTIONAL_DONATION_COLS = [
  'payment_kind',
  'project_id',
  'display_name',
  'is_anonymous',
  'tier_id',
  'tier_label',
  'stripe_customer_id',
  'stripe_subscription_id',
  'fund_type',
  'amount_cents',
  'currency',
  'interval',
  'status',
  'raw_event_id',
];

async function writeDonation(
  sb: ReturnType<typeof admin>,
  row: Record<string, unknown>,
  mode: 'insert' | 'update',
  id?: string
) {
  let payload = { ...row };
  for (let attempt = 0; attempt < 10; attempt++) {
    let error;
    if (mode === 'update' && id) {
      ({ error } = await sb.from('donations').update(payload).eq('id', id));
    } else {
      const res = await sb
        .from('donations')
        .insert([payload])
        .select('id')
        .maybeSingle();
      error = res.error;
      if (!error) return { inserted: true, id: res.data?.id };
    }
    if (!error) return { updated: true, id };
    const msg = String(error.message || '');
    console.warn('[stripe-webhook] donation write attempt', attempt, msg);
    // Strip optional / unknown columns if schema is behind
    let stripped = false;
    for (const col of OPTIONAL_DONATION_COLS) {
      if (new RegExp(col, 'i').test(msg) && col in payload) {
        delete payload[col];
        stripped = true;
      }
    }
    // amount may be NOT NULL on some schemas — derive from cents
    if (/amount/i.test(msg) && payload.amount == null && payload.amount_cents) {
      payload.amount = Math.round(Number(payload.amount_cents) / 100);
      stripped = true;
    }
    if (!stripped) throw error;
  }
  throw new Error('Could not write donation');
}

async function upsertDonation(row: Record<string, unknown>) {
  const sb = admin();

  if (row.stripe_session_id) {
    const { data: existing } = await sb
      .from('donations')
      .select('id')
      .eq('stripe_session_id', row.stripe_session_id)
      .maybeSingle();
    if (existing?.id) {
      return writeDonation(sb, row, 'update', existing.id);
    }
  }

  if (row.stripe_payment_intent) {
    const { data: existing } = await sb
      .from('donations')
      .select('id')
      .eq('stripe_payment_intent', row.stripe_payment_intent)
      .maybeSingle();
    if (existing?.id) {
      return writeDonation(sb, row, 'update', existing.id);
    }
  }

  if (row.raw_event_id) {
    const { data: existing } = await sb
      .from('donations')
      .select('id')
      .eq('raw_event_id', row.raw_event_id)
      .maybeSingle();
    if (existing?.id) {
      return { duplicate: true, id: existing.id };
    }
  }

  return writeDonation(sb, row, 'insert');
}

/**
 * Credit identity for a subscription payment (public recognition feed).
 * Order: Stripe subscription metadata (set at checkout) → stripe_subscriptions
 * cache → earliest donation row for this subscription.
 * Each invoice.paid renewal gets its own donations row so the thank-you feed
 * shows a new card every month they pay.
 */
async function resolveSubscriptionCredit(
  subId: string | null,
  subMeta: Record<string, string> | null | undefined
): Promise<{
  userId: string | null;
  displayName: string | null;
  isAnonymous: boolean;
}> {
  const meta = subMeta || {};
  let userId =
    meta.userId ||
    meta.user_id ||
    meta.together_forge_user_id ||
    null;
  let displayName = meta.displayName || meta.display_name || null;
  let isAnonymous = true;

  if ('isAnonymous' in meta || 'anonymous' in meta) {
    isAnonymous =
      meta.isAnonymous === 'false' || meta.anonymous === 'false' ? false : true;
  } else if (userId || displayName) {
    // Metadata had a credited identity without an explicit flag
    isAnonymous = false;
  }

  const finish = () => ({
    userId: userId || null,
    displayName: isAnonymous ? null : displayName || null,
    isAnonymous: isAnonymous || !(userId || displayName),
  });

  if ((userId || displayName) && ('isAnonymous' in meta || !isAnonymous)) {
    return finish();
  }

  if (!subId) return finish();

  // Cache on stripe_subscriptions (optional columns)
  try {
    const { data: subRow } = await admin()
      .from('stripe_subscriptions')
      .select('user_id, display_name, is_anonymous')
      .eq('id', subId)
      .maybeSingle();
    if (subRow) {
      if (!userId && subRow.user_id) userId = subRow.user_id;
      if (subRow.is_anonymous === false) {
        isAnonymous = false;
        if (!displayName && subRow.display_name) {
          displayName = subRow.display_name;
        }
      } else if (subRow.is_anonymous === true && !('isAnonymous' in meta)) {
        isAnonymous = true;
      }
    }
  } catch {
    /* columns may not exist yet */
  }

  if (userId && !isAnonymous) return finish();

  // Fallback: copy credit from the original checkout donation
  try {
    const { data: prior } = await admin()
      .from('donations')
      .select('user_id, display_name, is_anonymous')
      .eq('stripe_subscription_id', subId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (prior) {
      if (!userId && prior.user_id) userId = prior.user_id;
      if (prior.is_anonymous === false) {
        isAnonymous = false;
        if (!displayName && prior.display_name) {
          displayName = prior.display_name;
        }
      } else if (prior.is_anonymous === true && !userId) {
        isAnonymous = true;
        displayName = null;
      }
    }
  } catch (e) {
    console.warn('[stripe-webhook] resolveSubscriptionCredit', e?.message);
  }

  return finish();
}

/** Stripe API 2024+ often puts period bounds on items, not subscription root. */
function unixToIso(sec: unknown): string | null {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Date(n * 1000).toISOString();
  } catch {
    return null;
  }
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
  const root = unixToIso(sub.current_period_end);
  if (root) return root;
  const item = sub.items?.data?.[0];
  return unixToIso(item?.current_period_end);
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const sb = admin();
  const item = sub.items?.data?.[0];
  const amountCents =
    item?.price?.unit_amount ??
    item?.plan?.amount ??
    (sub.metadata?.amountCents
      ? Number(sub.metadata.amountCents)
      : null);
  const meta = (sub.metadata || {}) as Record<string, string>;
  const fundType = fundTypeFromMeta(meta);
  const credit = await resolveSubscriptionCredit(sub.id, meta);

  wlog('upsert_subscription_start', {
    subId: sub.id,
    status: sub.status,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    creditUserId: credit.userId,
    metaUserId: meta.userId || meta.together_forge_user_id || null,
    amountCents,
    periodEnd: subscriptionPeriodEnd(sub),
  });

  // Prefer a row that always has user_id when metadata provides it
  const baseRow: Record<string, unknown> = {
    id: String(sub.id),
    status: String(sub.status || 'active'),
    fund_type: fundType,
    amount_cents: Number.isFinite(Number(amountCents))
      ? Number(amountCents)
      : null,
    currency: item?.price?.currency || item?.plan?.currency || 'usd',
    customer_id: idOf(sub.customer),
    tier_id: meta.tierId || null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    current_period_end: subscriptionPeriodEnd(sub),
    canceled_at: unixToIso(sub.canceled_at),
    updated_at: new Date().toISOString(),
  };

  if (credit.userId) baseRow.user_id = credit.userId;
  if (credit.displayName != null) baseRow.display_name = credit.displayName;
  if (typeof credit.isAnonymous === 'boolean') {
    baseRow.is_anonymous = credit.isAnonymous;
  }
  if (meta.label || meta.tierLabel) {
    baseRow.tier_label = meta.label || meta.tierLabel;
  }

  let row = { ...baseRow };
  let { error } = await sb.from('stripe_subscriptions').upsert(row, {
    onConflict: 'id',
  });

  // Progressive strip of optional columns (never drop id/status/user_id first)
  const stripOrder = [
    'display_name',
    'is_anonymous',
    'tier_label',
    'tier_id',
    'canceled_at',
    'current_period_end',
    'cancel_at_period_end',
    'fund_type',
    'amount_cents',
    'currency',
    'customer_id',
  ];
  let attempt = 0;
  while (error && attempt < stripOrder.length) {
    const col = stripOrder[attempt];
    attempt += 1;
    if (!(col in row)) continue;
    if (!new RegExp(col, 'i').test(String(error.message || ''))) {
      // still try stripping known-optional cols if message is generic
      if (!/column|schema|unknown/i.test(String(error.message || ''))) break;
    }
    wlog('upsert_subscription_retry_strip', {
      subId: sub.id,
      strip: col,
      error: error.message,
    });
    delete row[col];
    ({ error } = await sb.from('stripe_subscriptions').upsert(row, {
      onConflict: 'id',
    }));
  }

  // Last resort: absolute minimum row for My Plan
  if (error) {
    wlog('upsert_subscription_min_row', {
      subId: sub.id,
      error: error.message,
    });
    const minRow: Record<string, unknown> = {
      id: String(sub.id),
      status: String(sub.status || 'active'),
      updated_at: new Date().toISOString(),
    };
    if (credit.userId) minRow.user_id = credit.userId;
    if (Number.isFinite(Number(amountCents))) {
      minRow.amount_cents = Number(amountCents);
    }
    ({ error } = await sb.from('stripe_subscriptions').upsert(minRow, {
      onConflict: 'id',
    }));
  }

  if (error) {
    wlog('upsert_subscription_FAILED', {
      subId: sub.id,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`subscription_upsert_failed: ${error.message}`);
  }
  wlog('upsert_subscription_ok', {
    subId: sub.id,
    status: sub.status,
    userId: credit.userId,
    cancel_at_period_end: !!sub.cancel_at_period_end,
  });
  if (credit.userId) {
    await syncUserBadges(credit.userId);
  }
  return { ok: true, id: sub.id, status: sub.status, userId: credit.userId };
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  eventId: string
) {
  wlog('checkout_completed_start', {
    eventId,
    sessionId: session.id,
    mode: session.mode,
    payment_status: session.payment_status,
    status: session.status,
    amount_total: session.amount_total,
    client_reference_id: session.client_reference_id,
    metaUserId:
      session.metadata?.userId ||
      session.metadata?.together_forge_user_id ||
      null,
    checkoutKind: session.metadata?.checkoutKind || null,
    subscription: idOf(session.subscription),
    customer: idOf(session.customer),
  });

  // Unpaid/incomplete sessions: acknowledge without writing a success row
  if (
    session.payment_status &&
    session.payment_status !== 'paid' &&
    session.status !== 'complete'
  ) {
    wlog('checkout_skipped_not_paid', { sessionId: session.id });
    return { skipped: 'not_paid', sessionId: session.id };
  }

  // ── AI token packs (never write to donations) ───────────────────────────
  const checkoutKind = String(
    session.metadata?.checkoutKind || session.metadata?.checkout_kind || ''
  ).toLowerCase();
  if (checkoutKind === 'ai_tokens' || checkoutKind === 'ai_token') {
    const meta = (session.metadata || {}) as Record<string, string>;
    let userId =
      meta.userId ||
      meta.user_id ||
      meta.together_forge_user_id ||
      (typeof session.client_reference_id === 'string'
        ? session.client_reference_id
        : null) ||
      null;
    const customerId = idOf(session.customer);
    if (!userId && customerId && stripeKey) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if (c && !c.deleted) {
          const cm = (c.metadata || {}) as Record<string, string>;
          userId =
            cm.together_forge_user_id || cm.userId || cm.user_id || null;
        }
      } catch (e) {
        console.warn('[stripe-webhook] token customer identity', e?.message);
      }
    }
    if (!userId) {
      wlog('token_checkout_missing_user', { sessionId: session.id });
      return { skipped: 'ai_tokens_missing_user', sessionId: session.id };
    }
    const amountCents =
      session.amount_total ?? Number(meta.amountCents) ?? 0;
    const result = await fulfillTokenPurchase(admin(), {
      userId,
      packId: meta.packId || meta.pack_id,
      amountCents,
      stripeSessionId: session.id,
      stripePaymentIntent: idOf(session.payment_intent),
      stripeCustomerId: customerId,
    });
    wlog('token_checkout_fulfilled', {
      sessionId: session.id,
      userId,
      ok: result.ok,
      tokens: result.tokens,
      duplicate: result.duplicate || false,
      error: result.error || null,
    });
    return { kind: 'ai_tokens', ...result, sessionId: session.id };
  }

  const amountCents =
    session.amount_total ?? Number(session.metadata?.amountCents) ?? 0;
  if (!amountCents || amountCents < 100) {
    wlog('checkout_skipped_bad_amount', {
      sessionId: session.id,
      amountCents,
    });
    return { skipped: 'bad_amount', sessionId: session.id };
  }

  const fundType = fundTypeFromMeta(
    session.metadata as Record<string, string>
  );
  const interval =
    session.mode === 'subscription' ||
    session.metadata?.interval === 'month'
      ? 'month'
      : 'once';

  const meta = (session.metadata || {}) as Record<string, string>;
  const isAnonymous =
    meta.isAnonymous === 'false' || meta.anonymous === 'false'
      ? false
      : true;
  // Identity: session metadata → client_reference_id → Stripe Customer metadata
  let userId =
    meta.userId ||
    meta.user_id ||
    meta.together_forge_user_id ||
    (typeof session.client_reference_id === 'string'
      ? session.client_reference_id
      : null) ||
    null;
  let displayName = meta.displayName || meta.display_name || null;
  const customerIdEarly = idOf(session.customer);
  if ((!userId || !displayName) && customerIdEarly && stripeKey) {
    try {
      const c = await stripe.customers.retrieve(customerIdEarly);
      if (c && !c.deleted) {
        const cm = (c.metadata || {}) as Record<string, string>;
        if (!userId) {
          userId =
            cm.together_forge_user_id || cm.userId || cm.user_id || null;
        }
        if (!displayName && (cm.displayName || cm.display_name)) {
          displayName = cm.displayName || cm.display_name;
        }
      }
    } catch (e) {
      console.warn('[stripe-webhook] customer identity fallback', e?.message);
    }
  }
  // Attribute only while a project is In Development; released projects get nothing new
  const projectId = await resolveActiveProjectId(fundType);

  const tierResolved = resolveDonationTierMeta(
    session.metadata?.tierId || null,
    amountCents,
    interval,
    session.metadata?.label || session.metadata?.tierLabel || null
  );
  const tierId = tierResolved.tierId;
  const tierLabel = tierResolved.tierLabel;

  const row = {
    amount_cents: amountCents,
    amount: Math.round(amountCents / 100),
    currency: session.currency || 'usd',
    interval,
    // Clear separation: pure donation vs subscription charge
    payment_kind:
      interval === 'month' ? 'subscription_payment' : 'one_time',
    fund_type: fundType,
    tier_id: tierId,
    tier_label: tierLabel,
    status: 'completed',
    is_anonymous: isAnonymous,
    stripe_session_id: session.id,
    stripe_payment_intent: idOf(session.payment_intent),
    stripe_subscription_id: idOf(session.subscription),
    stripe_customer_id: idOf(session.customer),
    raw_event_id: eventId,
    user_id: userId,
    display_name: isAnonymous ? null : displayName,
    project_id: projectId,
  };

  wlog('checkout_identity_resolved', {
    sessionId: session.id,
    userId,
    displayName,
    isAnonymous,
    amountCents,
    interval,
  });

  const result = await upsertDonation(row);
  wlog('checkout_donation_write', {
    sessionId: session.id,
    userId,
    result,
  });
  // Never fail the webhook after money is recorded — badges/credits are best-effort
  if (result?.inserted || result?.updated) {
    try {
      await mirrorDonationContribution(row);
    } catch (e) {
      console.warn('[stripe-webhook] mirror contribution', e?.message);
    }
    try {
      await syncUserBadges(userId);
    } catch (e) {
      console.warn('[stripe-webhook] badges after checkout', e?.message);
    }
  }

  // Ensure Stripe Customer is tagged with TF user_id for future checkouts / My Plan
  const customerId = idOf(session.customer);
  if (customerId && userId && stripeKey) {
    try {
      const c = await stripe.customers.retrieve(customerId);
      if (c && !c.deleted) {
        const meta = c.metadata || {};
        if (
          meta.together_forge_user_id !== userId &&
          meta.userId !== userId
        ) {
          await stripe.customers.update(customerId, {
            metadata: {
              ...meta,
              together_forge_user_id: userId,
              userId,
            },
          });
        }
      }
    } catch (e) {
      console.warn('[stripe-webhook] tag customer', e?.message);
    }
  }

  // If subscription checkout, sync subscription row when expanded/id present
  const subId = idOf(session.subscription);
  if (subId && stripeKey) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      // Ensure subscription metadata carries TF user for My Plan / renewals
      const sm = (sub.metadata || {}) as Record<string, string>;
      if (userId && (sm.userId !== userId && sm.together_forge_user_id !== userId)) {
        try {
          await stripe.subscriptions.update(subId, {
            metadata: {
              ...sm,
              userId,
              together_forge_user_id: userId,
              ...(displayName ? { displayName } : {}),
              isAnonymous: isAnonymous ? 'true' : 'false',
            },
          });
        } catch (e) {
          console.warn('[stripe-webhook] sub metadata tag', e?.message);
        }
      }
      // Prefer session-resolved userId if Stripe sub metadata was empty
      if (userId && !sub.metadata?.userId) {
        sub.metadata = {
          ...(sub.metadata || {}),
          userId,
          together_forge_user_id: userId,
          isAnonymous: isAnonymous ? 'true' : 'false',
          ...(displayName ? { displayName } : {}),
        };
      }
      await upsertSubscription(sub);
    } catch (e) {
      console.warn('[stripe-webhook] sub fetch after checkout', e?.message);
      // Fallback: still write a minimal subscription row so My Plan works
      if (userId && subId) {
        try {
          await admin().from('stripe_subscriptions').upsert(
            {
              id: subId,
              status: 'active',
              fund_type: fundType,
              amount_cents: amountCents,
              currency: session.currency || 'usd',
              customer_id: idOf(session.customer),
              tier_id: tierId,
              tier_label: tierLabel,
              user_id: userId,
              is_anonymous: isAnonymous,
              display_name: displayName,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
        } catch (e2) {
          console.warn('[stripe-webhook] sub fallback upsert', e2?.message);
        }
      }
    }
  }

  return result;
}

async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string) {
  // First invoice is recorded via checkout.session.completed (with credit metadata).
  // Renewals use invoice.paid → each successful charge becomes its own recognition card.
  if (invoice.billing_reason === 'subscription_create') {
    return { skipped: 'subscription_create' };
  }

  const amountCents = invoice.amount_paid || 0;
  if (amountCents < 100) {
    return { skipped: 'bad_amount' };
  }

  let fundType = 'studio';
  let tierId: string | null = invoice.metadata?.tierId || null;
  const subId = idOf(invoice.subscription);
  let subMeta: Record<string, string> | null = null;

  if (subId && stripeKey) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      subMeta = (sub.metadata || {}) as Record<string, string>;
      fundType = fundTypeFromMeta(subMeta);
      tierId = subMeta.tierId || tierId;
      await upsertSubscription(sub);
    } catch (e) {
      console.warn('[stripe-webhook] sub on invoice', e?.message);
    }
  }
  if (invoice.metadata?.fundType === 'runway') fundType = 'runway';

  // Same public credit as the original subscribe (username every month they pay)
  const credit = await resolveSubscriptionCredit(subId, subMeta);
  const projectId = await resolveActiveProjectId(fundType);
  const tierResolved = resolveDonationTierMeta(
    tierId,
    amountCents,
    'month',
    (subMeta && (subMeta.label || subMeta.tierLabel)) || null
  );

  const row = {
    amount_cents: amountCents,
    amount: Math.round(amountCents / 100),
    currency: invoice.currency || 'usd',
    interval: 'month',
    payment_kind: 'subscription_payment',
    fund_type: fundType,
    tier_id: tierResolved.tierId,
    tier_label: tierResolved.tierLabel,
    status: 'completed',
    is_anonymous: credit.isAnonymous,
    stripe_session_id: null,
    // Unique per invoice charge → new feed card each renewal
    stripe_payment_intent: idOf(invoice.payment_intent),
    stripe_subscription_id: subId,
    stripe_customer_id: idOf(invoice.customer),
    raw_event_id: eventId,
    user_id: credit.userId,
    display_name: credit.displayName,
    project_id: projectId,
  };

  const result = await upsertDonation(row);
  if (result?.inserted || result?.updated) {
    await mirrorDonationContribution(row);
    await syncUserBadges(credit.userId);
  }
  return { ...result, recognition: true, is_anonymous: credit.isAnonymous };
}

Deno.serve(async (req) => {
  const started = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!stripeKey || !webhookSecret) {
    wlog('config_error', {
      hasStripeKey: !!stripeKey,
      hasWebhookSecret: !!webhookSecret,
    });
    return json({ error: 'Webhook not configured' }, 500);
  }
  if (!supabaseUrl || !serviceKey) {
    wlog('config_error', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
    });
    return json({ error: 'Database not configured' }, 500);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    wlog('missing_signature', {});
    return json({ error: 'Missing stripe-signature' }, 400);
  }

  // Must use raw body for signature verification
  const rawBody = await req.text();
  wlog('request_received', {
    bodyBytes: rawBody?.length || 0,
    hasSignature: true,
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    // Fallback for older stripe SDK shapes
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err2) {
      wlog('signature_FAILED', {
        error: String(err2?.message || err?.message || err2),
      });
      return json({ error: 'Invalid signature' }, 400);
    }
  }

  wlog('event_verified', { type: event.type, id: event.id });

  try {
    if (await alreadyProcessed(event.id)) {
      wlog('event_duplicate', { id: event.id, type: event.type });
      return json({ received: true, duplicate: true, id: event.id });
    }

    let result: unknown = { ignored: event.type };

    switch (event.type) {
      case 'checkout.session.completed': {
        result = await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          event.id
        );
        break;
      }
      case 'invoice.paid': {
        result = await handleInvoicePaid(
          event.data.object as Stripe.Invoice,
          event.id
        );
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        wlog('subscription_event', {
          type: event.type,
          subId: sub.id,
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
        });
        result = await upsertSubscription(sub);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const pi = idOf(charge.payment_intent);
        if (pi) {
          const sb = admin();
          const { data: donRows } = await sb
            .from('donations')
            .select('user_id')
            .eq('stripe_payment_intent', pi)
            .limit(5);
          await sb
            .from('donations')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent', pi);
          for (const d of donRows || []) {
            if (d?.user_id) await syncUserBadges(d.user_id);
          }
          // Mark token purchase refunded (ledger stays immutable; no auto clawback)
          await sb
            .from('ai_token_purchases')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent', pi);
          result = { refunded: true, payment_intent: pi };
        } else {
          result = { skipped: 'no_payment_intent' };
        }
        break;
      }
      default:
        result = { ignored: event.type };
    }

    await markEventProcessed(event.id, event.type);

    wlog('event_done', {
      type: event.type,
      id: event.id,
      ms: Date.now() - started,
      result,
    });

    // Always 200 after successful handling so Stripe does not retry forever
    return json({
      received: true,
      type: event.type,
      result,
      project: 'together-forge-stripe-webhook',
    });
  } catch (err) {
    wlog('handler_FAILED', {
      type: event?.type || null,
      id: event?.id || null,
      error: String(err?.message || err),
      ms: Date.now() - started,
    });
    // 500 → Stripe retries (good for transient DB failures)
    return json(
      {
        error: err?.message || 'Handler failed',
        type: event?.type || null,
        project: 'together-forge-stripe-webhook',
      },
      500
    );
  }
});
