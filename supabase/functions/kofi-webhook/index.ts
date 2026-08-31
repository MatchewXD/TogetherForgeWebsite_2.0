/**
 * Ko-fi webhook for founder personal runway.
 * Separate from Stripe studio Support.
 *
 * Deploy (production):
 *   supabase link --project-ref <PRODUCTION_REF> --yes
 *   supabase secrets set KOFI_WEBHOOK_TOKEN=...
 *   supabase functions deploy kofi-webhook --no-verify-jwt
 *
 * Ko-fi dashboard webhook URL:
 *   https://<PROJECT_REF>.supabase.co/functions/v1/kofi-webhook
 */

// deno-lint-ignore-file
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const token = String(Deno.env.get('KOFI_WEBHOOK_TOKEN') || '').trim();
const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tokensEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i += 1) out |= aa[i] ^ bb[i];
  return out === 0;
}

function amountToCents(amount, currency) {
  const cur = String(currency || 'usd').trim().toLowerCase();
  if (cur && cur !== 'usd') return null;
  const n = Number(String(amount ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

async function parsePayload(req) {
  const ct = String(req.headers.get('content-type') || '').toLowerCase();
  const raw = await req.text();
  if (!raw) return null;

  if (ct.includes('application/json')) {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.data === 'string') {
      return JSON.parse(parsed.data);
    }
    return parsed;
  }

  const params = new URLSearchParams(raw);
  const data = params.get('data');
  if (data) return JSON.parse(data);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!token || !supabaseUrl || !serviceKey) {
    return json({ error: 'Webhook not configured' }, 500);
  }

  let payload;
  try {
    payload = await parsePayload(req);
  } catch {
    return json({ error: 'Invalid payload' }, 400);
  }
  if (!payload || typeof payload !== 'object') {
    return json({ error: 'Missing data' }, 400);
  }

  const provided = String(payload.verification_token || '').trim();
  if (!tokensEqual(provided, token)) {
    console.warn('[kofi-webhook] unauthorized');
    return json({ error: 'Unauthorized' }, 401);
  }

  const messageId = String(payload.message_id || '').trim();
  const cents = amountToCents(payload.amount, payload.currency);
  if (!messageId || !cents) {
    // Acknowledge so Ko-fi does not retry junk forever
    console.warn('[kofi-webhook] skipped incomplete payload');
    return json({ received: true, skipped: 'incomplete' });
  }

  const isPublic = payload.is_public === true || payload.is_public === 'true';
  const fromName = isPublic
    ? String(payload.from_name || '').trim() || null
    : null;
  const message = isPublic
    ? String(payload.message || '').trim() || null
    : null;

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const row = {
    message_id: messageId,
    kofi_transaction_id: payload.kofi_transaction_id
      ? String(payload.kofi_transaction_id)
      : null,
    type: payload.type ? String(payload.type).slice(0, 40) : null,
    amount_cents: cents,
    currency: 'usd',
    from_name: fromName ? fromName.slice(0, 120) : null,
    message: message ? message.slice(0, 2000) : null,
    is_public: isPublic,
    is_subscription_payment: Boolean(payload.is_subscription_payment),
    is_first_subscription_payment: Boolean(
      payload.is_first_subscription_payment
    ),
    tier_name: payload.tier_name
      ? String(payload.tier_name).slice(0, 120)
      : null,
    paid_at: payload.timestamp || new Date().toISOString(),
  };

  const { error } = await sb.from('kofi_runway_payments').upsert(row, {
    onConflict: 'message_id',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[kofi-webhook]', error.message);
    return json({ error: 'Could not record payment' }, 500);
  }

  console.log('[kofi-webhook] recorded', messageId, cents);
  return json({ received: true, message_id: messageId });
});
