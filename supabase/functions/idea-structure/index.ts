/**
 * Idea Structuring — free-form text → Together Forge Idea fields.
 *
 * POST JSON: { freeformText: string, idempotencyKey?: string }
 * Auth: Bearer user JWT required.
 *
 * Flow: preflightHybridAction → Grok → clamp → settleHybridCharge
 *
 * Deploy: supabase functions deploy idea-structure --no-verify-jwt
 * Secrets: XAI_API_KEY, SUPABASE_*
 */

// deno-lint-ignore-file
// @ts-nocheck
import { enforceRateLimit, RATE_LIMITS } from '../_shared/rateLimit.ts';
import {
  corsHeaders,
  jsonResponse,
  adminClient,
  userFromRequest,
  supabaseUrl,
  serviceKey,
} from '../_shared/edgeAuth.ts';
import { getAiProvider, getIdeaToolModel } from '../_shared/aiProvider.ts';
import {
  preflightHybridAction,
  settleHybridCharge,
} from '../_shared/aiHybridCharge.ts';
import {
  ideaSchemaSystemPrompt,
  ideaStructureUserPrompt,
  extractJsonObject,
  clampIdeaFields,
  summarizePrompt,
} from '../_shared/ideaAiSchema.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Database not configured.' }, 500);
  }

  try {
    const user = await userFromRequest(req);
    if (!user?.id) {
      return jsonResponse({ error: 'Sign in required.', code: 'AUTH_REQUIRED' }, 401);
    }
    const userId = String(user.id);

    const limited = enforceRateLimit(req, {
      ...RATE_LIMITS.aiGenerate,
      userId,
      cors: corsHeaders,
    });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const freeform = String(body.freeformText || body.text || '').trim();
    if (!freeform) {
      return jsonResponse(
        { error: 'Paste a short free-form idea first.', code: 'EMPTY_INPUT' },
        400
      );
    }

    const sb = adminClient();
    const pre = await preflightHybridAction(sb, {
      userId,
      actionKey: 'idea_structure',
      promptText: freeform,
      inputMode: 'reject',
    });
    if (!pre.ok) {
      const status =
        pre.code === 'INSUFFICIENT_TOKENS'
          ? 402
          : pre.code === 'AI_DISABLED'
            ? 503
            : pre.code === 'INPUT_TOO_LONG' || pre.code === 'FIELD_TOO_LONG'
              ? 400
              : 400;
      return jsonResponse(
        {
          error: pre.message,
          code: pre.code,
          enabled: pre.code !== 'AI_DISABLED',
        },
        status
      );
    }

    const provider = getAiProvider();
    const messages = [
      { role: 'system', content: ideaSchemaSystemPrompt() },
      { role: 'user', content: ideaStructureUserPrompt(freeform) },
    ];

    // Edge wall-clock is limited — use a fast model + short timeout so we
    // never get killed mid-request (that surfaces as Deno.core.runMicrotasks).
    const result = await provider.complete({
      messages,
      model: getIdeaToolModel(),
      maxTokens: Math.min(Number(pre.maxTokens) || 2048, 2048),
      temperature: 0.3,
      timeoutMs: 40_000,
    });

    const idempotencyKey =
      body.idempotencyKey ||
      `idea_structure:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

    if (!result.ok) {
      await settleHybridCharge(sb, {
        userId,
        actionKey: 'idea_structure',
        promptSummary: summarizePrompt(freeform, 80) || 'Idea Structuring',
        providerOk: false,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        requestId: result.requestId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        idempotencyKey,
      });
      const providerMsg = String(result.errorMessage || '');
      const isTimeout = result.errorCode === 'TIMEOUT' || /timeout/i.test(providerMsg);
      const userMsg = isTimeout
        ? providerMsg
        : /model|invalid|not found|400/i.test(providerMsg)
          ? `AI provider rejected the request (${result.model || 'model'}). ${providerMsg.slice(0, 200)}`
          : providerMsg || 'AI generation failed. Please try again.';
      return jsonResponse(
        {
          error: userMsg,
          code: result.errorCode || 'PROVIDER_FAILED',
          model: result.model || null,
          retryable: true,
        },
        isTimeout ? 504 : 502
      );
    }

    const parsed = extractJsonObject(result.text);
    if (!parsed) {
      await settleHybridCharge(sb, {
        userId,
        actionKey: 'idea_structure',
        promptSummary: summarizePrompt(freeform, 80) || 'Idea Structuring',
        providerOk: false,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        requestId: result.requestId,
        apiCostUsdMicros: result.apiCostUsdMicros || 0,
        errorCode: 'PARSE_FAILED',
        errorMessage: 'Could not parse structured idea from the model.',
        idempotencyKey,
      });
      return jsonResponse(
        {
          error:
            'The AI returned an unreadable result. Please try again.',
          code: 'PARSE_FAILED',
          retryable: true,
        },
        502
      );
    }

    const fields = clampIdeaFields(parsed);
    if (!fields.title && !fields.summary && !fields.description) {
      await settleHybridCharge(sb, {
        userId,
        actionKey: 'idea_structure',
        promptSummary: summarizePrompt(freeform, 80) || 'Idea Structuring',
        providerOk: false,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        requestId: result.requestId,
        apiCostUsdMicros: result.apiCostUsdMicros || 0,
        errorCode: 'EMPTY_RESULT',
        errorMessage: 'Structured result was empty.',
        idempotencyKey,
      });
      return jsonResponse(
        {
          error: 'No usable fields were generated. Please try again.',
          code: 'EMPTY_RESULT',
          retryable: true,
        },
        502
      );
    }

    const settled = await settleHybridCharge(sb, {
      userId,
      actionKey: 'idea_structure',
      promptSummary: summarizePrompt(freeform, 80) || 'Idea Structuring',
      providerOk: true,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      requestId: result.requestId,
      apiCostUsdMicros: result.apiCostUsdMicros || 0,
      idempotencyKey,
      meta: { field_keys: Object.keys(fields) },
    });

    if (!settled.ok && settled.code === 'INSUFFICIENT_TOKENS') {
      return jsonResponse(
        {
          error: settled.message,
          code: 'INSUFFICIENT_TOKENS',
        },
        402
      );
    }

    return jsonResponse({
      ok: true,
      fields,
      tokensCharged: settled.tokensCharged ?? null,
      balanceAfter: settled.balanceAfter ?? null,
      baseDebited: settled.baseDebited ?? null,
      additionalDebited: settled.additionalDebited ?? null,
    });
  } catch (err) {
    console.error('[idea-structure]', err?.message || err);
    return jsonResponse(
      { error: err?.message || 'Idea structuring failed.', retryable: true },
      500
    );
  }
});
