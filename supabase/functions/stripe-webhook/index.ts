/**
 * Supabase Edge Function: Stripe webhooks → donations table
 *
 * Deploy:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *
 * Secrets:
 *   STRIPE_SECRET_KEY=sk_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   SUPABASE_URL=https://...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Stripe Dashboard → Webhooks → endpoint:
 *   https://<project>.supabase.co/functions/v1/stripe-webhook
 * Events:
 *   - checkout.session.completed
 *   - invoice.paid (recurring)
 *   - charge.refunded (optional status update)
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function supabaseAdmin() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function upsertDonation(row: Record<string, unknown>) {
  const sb = supabaseAdmin();
  // Prefer unique stripe_session_id or stripe_payment_intent
  if (row.stripe_session_id) {
    const { data: existing } = await sb
      .from('donations')
      .select('id')
      .eq('stripe_session_id', row.stripe_session_id)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await sb
        .from('donations')
        .update(row)
        .eq('id', existing.id);
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
      const { error } = await sb
        .from('donations')
        .update(row)
        .eq('id', existing.id);
      if (error) throw error;
      return { updated: true, id: existing.id };
    }
  }

  const { data, error } = await sb.from('donations').insert([row]).select('id').maybeSingle();
  if (error) throw error;
  return { inserted: true, id: data?.id };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!webhookSecret || !supabaseUrl || !serviceKey) {
    console.error('[stripe-webhook] missing secrets');
    return json({ error: 'Webhook not configured' }, 500);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return json({ error: 'Missing stripe-signature' }, 400);
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verify failed', err?.message);
    return json({ error: 'Invalid signature' }, 400);
  }

  console.log('[stripe-webhook] event', event.type, event.id);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        console.log('[stripe-webhook] session not paid, skip', session.id);
        return json({ received: true, skipped: true });
      }

      const amountCents =
        session.amount_total ??
        Number(session.metadata?.amountCents) ??
        0;
      const fundType =
        session.metadata?.fundType === 'runway' ? 'runway' : 'studio';
      const interval =
        session.mode === 'subscription' || session.metadata?.interval === 'month'
          ? 'month'
          : 'once';

      const row = {
        amount_cents: amountCents,
        amount: Math.round(amountCents / 100),
        currency: session.currency || 'usd',
        interval,
        fund_type: fundType,
        tier_id: session.metadata?.tierId || null,
        tier_label: session.metadata?.tierId || null,
        status: 'completed',
        is_anonymous: true,
        stripe_session_id: session.id,
        stripe_payment_intent:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null,
        stripe_subscription_id:
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id || null,
        stripe_customer_id:
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id || null,
        raw_event_id: event.id,
        user_id: null,
      };

      if (!amountCents || amountCents < 100) {
        console.warn('[stripe-webhook] invalid amount on session', session.id);
        return json({ received: true, skipped: 'bad_amount' });
      }

      const result = await upsertDonation(row);
      console.log('[stripe-webhook] donation recorded', result);
      return json({ received: true, ...result });
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      // First invoice often also covered by checkout.session.completed
      if (invoice.billing_reason === 'subscription_create') {
        return json({ received: true, skipped: 'subscription_create' });
      }

      const amountCents = invoice.amount_paid || 0;
      if (amountCents < 100) {
        return json({ received: true, skipped: 'bad_amount' });
      }

      const subMeta =
        typeof invoice.subscription === 'object' && invoice.subscription
          ? invoice.subscription.metadata
          : {};
      const fundType =
        subMeta?.fundType === 'runway' ||
        invoice.metadata?.fundType === 'runway'
          ? 'runway'
          : 'studio';

      const paymentIntent =
        typeof invoice.payment_intent === 'string'
          ? invoice.payment_intent
          : invoice.payment_intent?.id || null;

      const row = {
        amount_cents: amountCents,
        amount: Math.round(amountCents / 100),
        currency: invoice.currency || 'usd',
        interval: 'month',
        fund_type: fundType,
        tier_id: subMeta?.tierId || invoice.metadata?.tierId || null,
        tier_label: subMeta?.tierId || invoice.metadata?.tierId || null,
        status: 'completed',
        is_anonymous: true,
        stripe_session_id: null,
        stripe_payment_intent: paymentIntent,
        stripe_subscription_id:
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id || null,
        stripe_customer_id:
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id || null,
        raw_event_id: event.id,
        user_id: null,
      };

      const result = await upsertDonation(row);
      console.log('[stripe-webhook] recurring donation', result);
      return json({ received: true, ...result });
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const pi =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (pi) {
        const sb = supabaseAdmin();
        await sb
          .from('donations')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent', pi);
      }
      return json({ received: true, refunded: true });
    }

    return json({ received: true, ignored: event.type });
  } catch (err) {
    console.error('[stripe-webhook] handler error', err?.message || err);
    return json({ error: err?.message || 'Handler failed' }, 500);
  }
});
