/**
 * AI token economy helpers for Edge Functions.
 * Credits purchases, checks platform availability / spend caps, logs generations.
 */

// deno-lint-ignore-file
// @ts-nocheck
import {
  AI_SERVICES_DISABLED_MESSAGE,
  getTokenPack,
} from './aiTokenPacks.ts';

export { AI_SERVICES_DISABLED_MESSAGE, getTokenPack };

/**
 * @param {import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient} sb
 */
export async function getAiServiceAvailability(sb) {
  const { data, error } = await sb.rpc('get_ai_service_availability');
  if (error) {
    console.warn('[aiTokenEconomy] availability', error.message);
    // Permission / missing-RPC should not brick AI UX with a "usage limits" lie.
    // Prefer reading config directly; only fail closed if we can prove caps are hit.
    try {
      const { data: cfg } = await sb
        .from('ai_platform_config')
        .select(
          'services_enabled, disabled_reason, daily_spend_cap_cents, monthly_spend_cap_cents, user_hourly_request_cap, user_daily_request_cap'
        )
        .eq('id', 1)
        .maybeSingle();
      if (cfg) {
        if (cfg.services_enabled === false) {
          return {
            enabled: false,
            reason: 'manually_disabled',
            message:
              cfg.disabled_reason ||
              'AI services are temporarily unavailable. Please try again later.',
            user_hourly_request_cap: Number(cfg.user_hourly_request_cap) || 30,
            user_daily_request_cap: Number(cfg.user_daily_request_cap) || 100,
          };
        }
        return {
          enabled: true,
          reason: null,
          message: null,
          user_hourly_request_cap: Number(cfg.user_hourly_request_cap) || 30,
          user_daily_request_cap: Number(cfg.user_daily_request_cap) || 100,
        };
      }
    } catch (e) {
      console.warn('[aiTokenEconomy] config fallback', e?.message || e);
    }
    // Last resort: allow (preflight still enforces balance/tokens)
    return {
      enabled: true,
      reason: 'availability_check_degraded',
      message: null,
      user_hourly_request_cap: 30,
      user_daily_request_cap: 100,
    };
  }
  const row = data && typeof data === 'object' ? data : {};
  return {
    enabled: row.enabled !== false,
    reason: row.reason || null,
    message: row.message || null,
    user_hourly_request_cap: Number(row.user_hourly_request_cap) || 30,
    user_daily_request_cap: Number(row.user_daily_request_cap) || 100,
  };
}

/**
 * Fulfill a paid token pack purchase (idempotent via stripe session / key).
 * @returns {{ ok: true, purchaseId?: string, tokens?: number, duplicate?: boolean } | { ok: false, error: string }}
 */
export async function fulfillTokenPurchase(sb, opts) {
  const userId = String(opts.userId || '').trim();
  const packId = String(opts.packId || '').trim().toLowerCase();
  const sessionId = opts.stripeSessionId
    ? String(opts.stripeSessionId)
    : null;
  const paymentIntent = opts.stripePaymentIntent
    ? String(opts.stripePaymentIntent)
    : null;
  const customerId = opts.stripeCustomerId
    ? String(opts.stripeCustomerId)
    : null;
  const amountCents = Math.round(Number(opts.amountCents) || 0);

  if (!userId) return { ok: false, error: 'userId required' };
  const pack = getTokenPack(packId);
  // Canonical published sizes — never grant the legacy 250 / 700 / 1600 scale.
  const CANONICAL_TOKENS: Record<string, number> = {
    starter: 250_000,
    builder: 600_000,
    studio: 1_250_000,
  };
  const tokensFromPack = pack?.tokens || 0;
  const tokensFromId = CANONICAL_TOKENS[packId] || 0;
  const tokensFromCents =
    amountCents >= 2500
      ? 1_250_000
      : amountCents >= 1200
        ? 600_000
        : amountCents >= 500
          ? 250_000
          : 0;
  const tokens = Math.max(tokensFromPack, tokensFromId, tokensFromCents);
  if (!tokens) {
    return { ok: false, error: pack ? 'Could not resolve pack size' : `Unknown pack: ${packId}` };
  }
  const packLabel = pack?.label || (packId ? packId : 'Token');
  const resolvedPackId = pack?.id || packId || 'starter';
  const priceCents =
    amountCents > 0 ? amountCents : pack?.priceCents || 0;
  const idempotencyKey = sessionId
    ? `purchase:session:${sessionId}`
    : paymentIntent
      ? `purchase:pi:${paymentIntent}`
      : null;
  const scaleFixKey = idempotencyKey
    ? `${idempotencyKey}:scale50k`
    : `purchase:scale50k:${userId}:${resolvedPackId}:${tokens}`;

  const purchasePayload = {
    user_id: userId,
    pack_id: resolvedPackId,
    tokens_granted: tokens,
    amount_cents: priceCents,
    currency: 'usd',
    status: 'completed',
    stripe_session_id: sessionId,
    stripe_payment_intent: paymentIntent,
    stripe_customer_id: customerId,
    label: `${packLabel} AI Tokens`,
    completed_at: new Date().toISOString(),
  };

  let purchaseId = null;
  if (sessionId) {
    const { data: existingRow } = await sb
      .from('ai_token_purchases')
      .select('id, status, tokens_granted')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();
    if (existingRow?.id) {
      purchaseId = existingRow.id;
      if (existingRow.status === 'completed') {
        // Still run credit with idempotency (no-op if already credited)
      } else {
        await sb
          .from('ai_token_purchases')
          .update(purchasePayload)
          .eq('id', existingRow.id);
      }
    } else {
      const { data: inserted, error: insErr } = await sb
        .from('ai_token_purchases')
        .insert(purchasePayload)
        .select('id')
        .maybeSingle();
      if (insErr) {
        const { data: again } = await sb
          .from('ai_token_purchases')
          .select('id, status, tokens_granted')
          .eq('stripe_session_id', sessionId)
          .maybeSingle();
        if (again?.id) {
          purchaseId = again.id;
        } else {
          console.error('[aiTokenEconomy] purchase insert', insErr.message);
          return { ok: false, error: insErr.message };
        }
      } else {
        purchaseId = inserted?.id || null;
      }
    }
  } else {
    const { data: inserted, error: insErr } = await sb
      .from('ai_token_purchases')
      .insert(purchasePayload)
      .select('id')
      .maybeSingle();
    if (insErr) {
      console.error('[aiTokenEconomy] purchase insert', insErr.message);
      return { ok: false, error: insErr.message };
    }
    purchaseId = inserted?.id || null;
  }

  // Ensure purchase row stores current pack size (fixes pending/completed rows written at old scale)
  if (purchaseId) {
    await sb
      .from('ai_token_purchases')
      .update({
        tokens_granted: tokens,
        amount_cents: priceCents,
        pack_id: resolvedPackId,
        status: 'completed',
        label: `${packLabel} AI Tokens`,
        completed_at: new Date().toISOString(),
        stripe_payment_intent: paymentIntent,
        stripe_customer_id: customerId,
      })
      .eq('id', purchaseId);
  }

  // Prefer SQL grant (canonical size + top-up if a prior credit was 250/700/1600)
  const { data: granted, error: grantErr } = await sb.rpc(
    'grant_ai_token_pack_purchase',
    {
      p_user_id: userId,
      p_pack_id: resolvedPackId,
      p_amount_cents: priceCents || null,
      p_stripe_session_id: sessionId,
      p_stripe_payment_intent: paymentIntent,
      p_stripe_customer_id: customerId,
      p_purchase_id: purchaseId,
    }
  );

  if (!grantErr && granted && granted.ok !== false) {
    return {
      ok: true,
      purchaseId,
      tokens: Number(granted.tokens) || tokens,
      ledgerId: granted.ledger_id || null,
      duplicate: Boolean(granted.duplicate),
    };
  }
  if (grantErr) {
    console.warn('[aiTokenEconomy] grant rpc', grantErr.message);
  }

  const { data: ledger, error: creditErr } = await sb.rpc('credit_ai_tokens', {
    p_user_id: userId,
    p_tokens: tokens,
    p_entry_type: 'purchase',
    p_status: 'success',
    p_prompt_summary: `${packLabel} pack purchase`,
    p_pack_id: resolvedPackId,
    p_purchase_id: purchaseId,
    p_source: 'stripe',
    p_source_ref: sessionId || paymentIntent || null,
    p_stripe_session_id: sessionId,
    p_stripe_payment_intent: paymentIntent,
    p_idempotency_key: idempotencyKey,
    p_meta: {
      pack_id: resolvedPackId,
      amount_cents: priceCents,
      tokens,
    },
  });

  if (creditErr) {
    console.error('[aiTokenEconomy] credit', creditErr.message);
    return { ok: false, error: creditErr.message };
  }

  let duplicate = false;
  const creditedDisplay = Number(ledger?.tokens_display) || 0;
  if (creditedDisplay > 0 && creditedDisplay < tokens) {
    const delta = tokens - creditedDisplay;
    const { error: fixErr } = await sb.rpc('credit_ai_tokens', {
      p_user_id: userId,
      p_tokens: delta,
      p_entry_type: 'adjustment',
      p_status: 'success',
      p_prompt_summary: `${packLabel} pack scale correction (+${delta.toLocaleString()} tokens)`,
      p_pack_id: resolvedPackId,
      p_purchase_id: purchaseId,
      p_source: 'scale_migration',
      p_source_ref: sessionId || paymentIntent || null,
      p_stripe_session_id: sessionId,
      p_stripe_payment_intent: paymentIntent,
      p_idempotency_key: scaleFixKey,
      p_meta: {
        pack_id: resolvedPackId,
        from_tokens: creditedDisplay,
        to_tokens: tokens,
        scale_migration: '50k_per_usd',
      },
    });
    if (fixErr) {
      console.warn('[aiTokenEconomy] scale top-up', fixErr.message);
    }
  } else if (idempotencyKey && ledger?.id && creditedDisplay === tokens) {
    duplicate = true;
  }

  return {
    ok: true,
    purchaseId,
    tokens,
    ledgerId: ledger?.id || null,
    duplicate,
  };
}

/**
 * Insert generation log row (success or failure). Internal only.
 */
export async function logAiGeneration(sb, row) {
  try {
    const { error } = await sb.from('ai_generation_log').insert({
      user_id: row.userId || null,
      action_key: row.actionKey || 'unknown',
      status: row.status || 'failed',
      prompt_summary: row.promptSummary
        ? String(row.promptSummary).slice(0, 280)
        : null,
      tokens_charged: Math.max(0, Number(row.tokensCharged) || 0),
      provider: row.provider || null,
      model: row.model || null,
      api_cost_usd_micros: Math.max(0, Number(row.apiCostUsdMicros) || 0),
      latency_ms: row.latencyMs != null ? Number(row.latencyMs) : null,
      error_code: row.errorCode || null,
      error_message: row.errorMessage
        ? String(row.errorMessage).slice(0, 500)
        : null,
      request_id: row.requestId || null,
      ledger_id: row.ledgerId || null,
      meta: row.meta || {},
    });
    if (error) console.warn('[aiTokenEconomy] log', error.message);
  } catch (e) {
    console.warn('[aiTokenEconomy] log', e?.message || e);
  }
}

/**
 * Preflight for future AI actions: platform enabled + user has tokens.
 * Does not debit. Returns user-safe payload only.
 */
export async function preflightAiAction(sb, opts) {
  const userId = opts.userId;
  const tokensRequired = Math.max(0, Number(opts.tokensRequired) || 0);
  const availability = await getAiServiceAvailability(sb);

  if (!availability.enabled) {
    return {
      ok: false,
      code: 'AI_DISABLED',
      message: availability.message || AI_SERVICES_DISABLED_MESSAGE,
      reason: availability.reason,
      balance: null,
      tokensRequired,
    };
  }

  if (!userId) {
    return {
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Sign in to use AI features.',
      balance: 0,
      tokensRequired,
    };
  }

  const { data: balRow, error } = await sb.rpc('get_my_ai_token_balance');
  // get_my_ai_token_balance uses auth.uid() — for service_role calls use table
  let balance = 0;
  if (error || balRow == null) {
    await sb.rpc('ensure_ai_token_balance', { p_user_id: userId }).catch(() => {});
    const { data: b } = await sb
      .from('ai_token_balances')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();
    balance = Number(b?.balance) || 0;
  } else {
    balance = Number(balRow.balance) || 0;
  }

  if (tokensRequired > 0 && balance < tokensRequired) {
    return {
      ok: false,
      code: 'INSUFFICIENT_TOKENS',
      message: `You need ${tokensRequired} tokens for this action. You have ${balance}.`,
      balance,
      tokensRequired,
    };
  }

  return {
    ok: true,
    code: null,
    message: null,
    balance,
    tokensRequired,
    availability,
  };
}
