/**
 * Hybrid charging for AI actions (Phase 1 foundation).
 *
 * Flow:
 *  1. preflightHybridAction — platform enabled, balance ≥ base, input limits
 *  2. (caller runs provider with max_tokens = AI_COMPLETION_MAX_TOKENS)
 *  3. settleHybridCharge — debit base, then additional from real cost + margin
 *
 * Never exposes API cost/margin to clients.
 * Never lets balance go negative.
 */

// deno-lint-ignore-file
// @ts-nocheck
import {
  AI_COMPLETION_MAX_TOKENS,
  AI_NEED_MORE_TOKENS_MESSAGE,
  AI_SERVICES_DISABLED_MESSAGE,
  computeHybridDebitAmounts,
  getActionBaseCost,
} from './aiTokenPacks.ts';
import {
  enforceIdeaFields,
  enforceMaxInputChars,
  getCompletionMaxTokens,
} from './aiInputLimits.ts';
import {
  getAiServiceAvailability,
  logAiGeneration,
} from './aiTokenEconomy.ts';

/**
 * Load balance via service role (auth.uid RPCs do not work as service_role).
 */
async function getBalance(sb, userId) {
  await sb.rpc('ensure_ai_token_balance', { p_user_id: userId });
  const { data } = await sb
    .from('ai_token_balances')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();
  return Math.max(0, Number(data?.balance) || 0);
}

/**
 * Pre-call checks. Does not debit.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.actionKey
 * @param {string} [opts.promptText] - concatenated user content for max length
 * @param {Record<string, unknown>} [opts.ideaFields] - optional idea field bag
 * @param {'reject'|'truncate'} [opts.inputMode]
 */
export async function preflightHybridAction(sb, opts) {
  const userId = opts.userId;
  const actionKey = String(opts.actionKey || '');
  const base = getActionBaseCost(actionKey);

  if (!userId) {
    return {
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Sign in to use AI features.',
      baseCost: base,
      // never include baseCost in user-facing payloads from edge if we can help it
    };
  }

  if (!base) {
    return {
      ok: false,
      code: 'UNKNOWN_ACTION',
      message: 'Unknown AI action.',
    };
  }

  const availability = await getAiServiceAvailability(sb);
  if (!availability.enabled) {
    return {
      ok: false,
      code: 'AI_DISABLED',
      message: availability.message || AI_SERVICES_DISABLED_MESSAGE,
      reason: availability.reason,
    };
  }

  // Input limits
  if (opts.ideaFields) {
    const fields = enforceIdeaFields(opts.ideaFields, {
      mode: opts.inputMode || 'reject',
    });
    if (!fields.ok) {
      return {
        ok: false,
        code: 'FIELD_TOO_LONG',
        message: fields.message || 'One or more fields are too long.',
        errors: fields.errors,
      };
    }
  }

  if (opts.promptText != null) {
    const input = enforceMaxInputChars(opts.promptText, {
      mode: opts.inputMode || 'reject',
    });
    if (!input.ok) {
      return {
        ok: false,
        code: input.code || 'INPUT_TOO_LONG',
        message: input.message,
      };
    }
  }

  const balance = await getBalance(sb, userId);
  if (balance < base) {
    return {
      ok: false,
      code: 'INSUFFICIENT_TOKENS',
      // User-facing: no numeric pre-price
      message: AI_NEED_MORE_TOKENS_MESSAGE,
      balance,
    };
  }

  return {
    ok: true,
    balance,
    /** INTERNAL — for server debit only; do not send to client UI as a price tag */
    _baseCost: base,
    maxTokens: getCompletionMaxTokens() || AI_COMPLETION_MAX_TOKENS,
    availability,
  };
}

/**
 * Post-call hybrid settlement.
 * Debits base first (must succeed), then optional additional up to ceiling/balance.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.actionKey
 * @param {string} [opts.promptSummary] - short user-visible history label
 * @param {number} [opts.apiCostUsdMicros]
 * @param {string} [opts.provider]
 * @param {string} [opts.model]
 * @param {number} [opts.latencyMs]
 * @param {string} [opts.requestId]
 * @param {string} [opts.idempotencyKey] - base key; additional uses `${key}:additional`
 * @param {object} [opts.meta]
 * @param {boolean} [opts.providerOk] - if false, no debit; log failure only
 */
export async function settleHybridCharge(sb, opts) {
  const userId = opts.userId;
  const actionKey = String(opts.actionKey || '');
  const base = getActionBaseCost(actionKey);
  const label = opts.promptSummary || actionKey || 'AI usage';
  const providerOk = opts.providerOk !== false;

  if (!userId || !base) {
    return { ok: false, code: 'INVALID', message: 'Invalid settlement.' };
  }

  if (!providerOk) {
    await logAiGeneration(sb, {
      userId,
      actionKey,
      status: opts.errorCode === 'RATE_LIMITED' ? 'rate_limited' : 'failed',
      promptSummary: label,
      tokensCharged: 0,
      provider: opts.provider,
      model: opts.model,
      apiCostUsdMicros: 0,
      latencyMs: opts.latencyMs,
      errorCode: opts.errorCode || 'PROVIDER_FAILED',
      errorMessage: opts.errorMessage,
      requestId: opts.requestId,
      meta: { ...(opts.meta || {}), hybrid: true },
    });
    return {
      ok: false,
      code: opts.errorCode || 'PROVIDER_FAILED',
      message: opts.errorMessage || 'AI generation failed.',
      tokensCharged: 0,
      baseDebited: 0,
      additionalDebited: 0,
    };
  }

  const baseKey = opts.idempotencyKey
    ? `${opts.idempotencyKey}:base`
    : null;

  // 1) Base debit (full amount required)
  const { data: baseResult, error: baseErr } = await sb.rpc(
    'try_debit_ai_tokens',
    {
      p_user_id: userId,
      p_tokens: base,
      p_action_key: actionKey,
      p_prompt_summary: `${label} (base)`,
      p_provider: opts.provider || null,
      p_model: opts.model || null,
      p_api_cost_usd_micros: 0,
      p_margin_usd_micros: 0,
      p_idempotency_key: baseKey,
      p_meta: {
        ...(opts.meta || {}),
        hybrid_phase: 'base',
        hybrid: true,
      },
    }
  );

  if (baseErr) {
    console.error('[hybrid] base debit', baseErr.message);
    return {
      ok: false,
      code: 'DEBIT_FAILED',
      message: 'Could not charge tokens. Please try again.',
      tokensCharged: 0,
    };
  }

  if (!baseResult?.ok) {
    await logAiGeneration(sb, {
      userId,
      actionKey,
      status: 'insufficient_tokens',
      promptSummary: label,
      tokensCharged: 0,
      provider: opts.provider,
      model: opts.model,
      apiCostUsdMicros: opts.apiCostUsdMicros || 0,
      latencyMs: opts.latencyMs,
      errorCode: 'INSUFFICIENT_TOKENS',
      errorMessage: AI_NEED_MORE_TOKENS_MESSAGE,
      requestId: opts.requestId,
      meta: { hybrid: true, phase: 'base' },
    });
    return {
      ok: false,
      code: 'INSUFFICIENT_TOKENS',
      message: AI_NEED_MORE_TOKENS_MESSAGE,
      tokensCharged: 0,
      baseDebited: 0,
      additionalDebited: 0,
    };
  }

  const balanceAfterBase =
    baseResult.balance_after != null
      ? Number(baseResult.balance_after)
      : await getBalance(sb, userId);

  const { additional, chargeable } = computeHybridDebitAmounts({
    actionKey,
    apiCostUsdMicros: opts.apiCostUsdMicros || 0,
    balanceAfterBase,
  });

  let additionalDebited = 0;
  let additionalLedgerId = null;
  let balanceAfter = balanceAfterBase;

  // 2) Additional debit — partial allowed (never below zero)
  if (additional > 0) {
    const addKey = opts.idempotencyKey
      ? `${opts.idempotencyKey}:additional`
      : null;
    const { data: addResult, error: addErr } = await sb.rpc(
      'try_debit_ai_tokens_up_to',
      {
        p_user_id: userId,
        p_tokens: additional,
        p_action_key: actionKey,
        p_prompt_summary: `${label} (additional)`,
        p_provider: opts.provider || null,
        p_model: opts.model || null,
        p_api_cost_usd_micros: Math.max(0, Number(opts.apiCostUsdMicros) || 0),
        p_margin_usd_micros: 0,
        p_idempotency_key: addKey,
        p_meta: {
          ...(opts.meta || {}),
          hybrid_phase: 'additional',
          hybrid: true,
          chargeable_tokens_internal: chargeable,
        },
      }
    );
    if (addErr) {
      console.warn('[hybrid] additional debit', addErr.message);
    } else if (addResult?.ok) {
      additionalDebited = Number(addResult.tokens) || 0;
      additionalLedgerId = addResult.ledger_id || null;
      balanceAfter =
        addResult.balance_after != null
          ? Number(addResult.balance_after)
          : balanceAfterBase - additionalDebited;
    }
  } else if ((opts.apiCostUsdMicros || 0) > 0) {
    // Still attach cost metadata to base row is not possible (immutable).
    // Cost is recorded on generation log.
  }

  const tokensCharged = base + additionalDebited;

  // Attribute full API cost on generation log (internal)
  const marginMicros =
    tokensCharged * 20 - Math.max(0, Number(opts.apiCostUsdMicros) || 0);

  await logAiGeneration(sb, {
    userId,
    actionKey,
    status: 'success',
    promptSummary: label,
    tokensCharged,
    provider: opts.provider,
    model: opts.model,
    apiCostUsdMicros: opts.apiCostUsdMicros || 0,
    latencyMs: opts.latencyMs,
    requestId: opts.requestId,
    ledgerId: additionalLedgerId || baseResult.ledger_id || null,
    meta: {
      hybrid: true,
      base_tokens: base,
      additional_tokens: additionalDebited,
      chargeable_tokens_internal: chargeable,
      margin_usd_micros_est: marginMicros,
      ...(opts.meta || {}),
    },
  });

  return {
    ok: true,
    /** Safe to show after the action */
    tokensCharged,
    baseDebited: base,
    additionalDebited,
    balanceAfter,
    baseLedgerId: baseResult.ledger_id || null,
    additionalLedgerId,
  };
}

export { getCompletionMaxTokens, AI_COMPLETION_MAX_TOKENS };
