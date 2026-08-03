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
 *   checkout.session.completed
 *   invoice.paid
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   charge.refunded (optional)
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
    await admin().from('stripe_webhook_events').upsert({
      id: eventId,
      type,
      processed_at: new Date().toISOString(),
    });
  } catch (e) {
    // Table optional
    console.warn('[stripe-webhook] event log skip', e?.message);
  }
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
      const { error } = await sb.from('donations').update(row).eq('id', existing.id);
      if (error) throw error;
      return { updated: true, id: existing.id };
    }
  }

  if (row.stripe_payment_intent) {
    const { data: existing } = await sb
      .from('donations')
      .select('id')
      .eq('stripe_payment_intent', row.stripe_payment_intent)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await sb.from('donations').update(row).eq('id', existing.id);
      if (error) throw error;
      return { updated: true, id: existing.id };
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

  const { data, error } = await sb
    .from('donations')
    .insert([row])
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return { inserted: true, id: data?.id };
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const sb = admin();
  const item = sub.items?.data?.[0];
  const amountCents =
    item?.price?.unit_amount ??
    item?.plan?.amount ??
    null;
  const fundType = fundTypeFromMeta(sub.metadata as Record<string, string>);

  const row = {
    id: sub.id,
    status: sub.status,
    fund_type: fundType,
    amount_cents: amountCents,
    currency: item?.price?.currency || 'usd',
    customer_id: idOf(sub.customer),
    tier_id: sub.metadata?.tierId || null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    canceled_at: sub.canceled_at
      ? new Date(sub.canceled_at * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from('stripe_subscriptions').upsert(row, {
    onConflict: 'id',
  });
  if (error) {
    // Table may not exist yet - log and continue so payment recording still works
    console.warn('[stripe-webhook] subscription upsert', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: sub.id, status: sub.status };
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  eventId: string
) {
  // Unpaid/incomplete sessions: acknowledge without writing a success row
  if (
    session.payment_status &&
    session.payment_status !== 'paid' &&
    session.status !== 'complete'
  ) {
    return { skipped: 'not_paid', sessionId: session.id };
  }

  const amountCents =
    session.amount_total ?? Number(session.metadata?.amountCents) ?? 0;
  if (!amountCents || amountCents < 100) {
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
  const userId = meta.userId || meta.user_id || null;
  const displayName = meta.displayName || meta.display_name || null;
  // Attribute only while a project is In Development; released projects get nothing new
  const projectId = await resolveActiveProjectId(fundType);

  const row = {
    amount_cents: amountCents,
    amount: Math.round(amountCents / 100),
    currency: session.currency || 'usd',
    interval,
    fund_type: fundType,
    tier_id: session.metadata?.tierId || null,
    tier_label: session.metadata?.tierId || session.metadata?.label || null,
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

  const result = await upsertDonation(row);
  if (result?.inserted || result?.updated) {
    await mirrorDonationContribution(row);
  }

  // If subscription checkout, sync subscription row when expanded/id present
  const subId = idOf(session.subscription);
  if (subId && stripeKey) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      await upsertSubscription(sub);
    } catch (e) {
      console.warn('[stripe-webhook] sub fetch after checkout', e?.message);
    }
  }

  return result;
}

async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string) {
  // First invoice usually already recorded via checkout.session.completed
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

  if (subId && stripeKey) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      fundType = fundTypeFromMeta(sub.metadata as Record<string, string>);
      tierId = sub.metadata?.tierId || tierId;
      await upsertSubscription(sub);
    } catch (e) {
      console.warn('[stripe-webhook] sub on invoice', e?.message);
    }
  }
  if (invoice.metadata?.fundType === 'runway') fundType = 'runway';

  const projectId = await resolveActiveProjectId(fundType);

  const row = {
    amount_cents: amountCents,
    amount: Math.round(amountCents / 100),
    currency: invoice.currency || 'usd',
    interval: 'month',
    fund_type: fundType,
    tier_id: tierId,
    tier_label: tierId,
    status: 'completed',
    is_anonymous: true,
    stripe_session_id: null,
    stripe_payment_intent: idOf(invoice.payment_intent),
    stripe_subscription_id: subId,
    stripe_customer_id: idOf(invoice.customer),
    raw_event_id: eventId,
    user_id: null,
    display_name: null,
    project_id: projectId,
  };

  const result = await upsertDonation(row);
  if (result?.inserted || result?.updated) {
    await mirrorDonationContribution(row);
  }
  return result;
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
    console.error('[stripe-webhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return json({ error: 'Webhook not configured' }, 500);
  }
  if (!supabaseUrl || !serviceKey) {
    console.error('[stripe-webhook] missing SUPABASE_URL or SERVICE_ROLE_KEY');
    return json({ error: 'Database not configured' }, 500);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return json({ error: 'Missing stripe-signature' }, 400);
  }

  // Must use raw body for signature verification
  const rawBody = await req.text();

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
      console.error(
        '[stripe-webhook] signature verify failed',
        err2?.message || err?.message
      );
      return json({ error: 'Invalid signature' }, 400);
    }
  }

  console.log('[stripe-webhook] event', event.type, event.id);

  try {
    if (await alreadyProcessed(event.id)) {
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
        result = await upsertSubscription(sub);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const pi = idOf(charge.payment_intent);
        if (pi) {
          await admin()
            .from('donations')
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

    console.log('[stripe-webhook] done', {
      type: event.type,
      ms: Date.now() - started,
      result,
    });

    // Always 200 after successful handling so Stripe does not retry forever
    return json({ received: true, type: event.type, result });
  } catch (err) {
    console.error('[stripe-webhook] handler error', err?.message || err);
    // 500 → Stripe retries (good for transient DB failures)
    return json({ error: err?.message || 'Handler failed' }, 500);
  }
});
