/**
 * Gap Filling / Content Expansion for existing Ideas.
 *
 * POST JSON: { idea: { title, summary, ... }, sparseKeys?: string[], idempotencyKey?: string }
 * Auth: Bearer user JWT required.
 *
 * Deploy: supabase functions deploy idea-gap-fill --no-verify-jwt
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
  ideaGapFillSystemPrompt,
  ideaGapFillUserPrompt,
  extractJsonObject,
  clampIdeaFields,
  findSparseFields,
  isIdeaTooEmptyForGapFill,
  fieldLabel,
  summarizePrompt,
  IDEA_FIELD_DEFS,
} from '../_shared/ideaAiSchema.ts';

function ideaToPromptBlob(idea) {
  try {
    return JSON.stringify(idea || {}).slice(0, 16_000);
  } catch {
    return '';
  }
}

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
    const idea = body.idea && typeof body.idea === 'object' ? body.idea : {};

    // Do not invent a full idea from a blank form (no token charge)
    if (isIdeaTooEmptyForGapFill(idea)) {
      return jsonResponse(
        {
          error:
            'Add a title, summary, or description first. Gap Filling expands an existing idea. It will not invent one from a blank form.',
          code: 'IDEA_TOO_EMPTY',
          tokensCharged: 0,
        },
        400
      );
    }

    let sparseKeys = Array.isArray(body.sparseKeys)
      ? body.sparseKeys.map(String)
      : findSparseFields(idea);

    // Only known field keys
    const allowed = new Set(IDEA_FIELD_DEFS.map((d) => d.key));
    sparseKeys = sparseKeys.filter((k) => allowed.has(k));

    // Never allow rewriting solid core fields unless truly empty/tiny
    sparseKeys = sparseKeys.filter((k) => {
      if (k === 'title' && String(idea.title || '').trim().length >= 8) return false;
      if (k === 'summary' && String(idea.summary || '').trim().length >= 40) {
        return false;
      }
      if (
        k === 'description' &&
        String(idea.description || '').trim().length >= 80
      ) {
        return false;
      }
      if (k === 'category' && String(idea.category || '').trim()) return false;
      return true;
    });

    if (sparseKeys.length === 0) {
      return jsonResponse({
        ok: true,
        suggestions: [],
        message:
          'No empty or under-developed fields to fill. Your idea already has solid content in the main fields.',
        tokensCharged: 0,
      });
    }

    const promptText = ideaToPromptBlob({ idea, sparseKeys });
    const sb = adminClient();
    const pre = await preflightHybridAction(sb, {
      userId,
      actionKey: 'gap_fill',
      promptText,
      ideaFields: idea,
      inputMode: 'truncate',
    });
    if (!pre.ok) {
      const status =
        pre.code === 'INSUFFICIENT_TOKENS'
          ? 402
          : pre.code === 'AI_DISABLED'
            ? 503
            : 400;
      return jsonResponse(
        {
          error: pre.message,
          code: pre.code,
        },
        status
      );
    }

    const provider = getAiProvider();
    const result = await provider.complete({
      messages: [
        { role: 'system', content: ideaGapFillSystemPrompt() },
        {
          role: 'user',
          content: ideaGapFillUserPrompt(idea, sparseKeys),
        },
      ],
      model: getIdeaToolModel(),
      maxTokens: Math.min(Number(pre.maxTokens) || 2048, 2048),
      temperature: 0.35,
      timeoutMs: 40_000,
    });

    const idempotencyKey =
      body.idempotencyKey ||
      `gap_fill:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

    const summary =
      summarizePrompt(idea.title || idea.summary || 'Gap Filling', 80) ||
      'Gap Filling';

    if (!result.ok) {
      await settleHybridCharge(sb, {
        userId,
        actionKey: 'gap_fill',
        promptSummary: summary,
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
        actionKey: 'gap_fill',
        promptSummary: summary,
        providerOk: false,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        requestId: result.requestId,
        apiCostUsdMicros: result.apiCostUsdMicros || 0,
        errorCode: 'PARSE_FAILED',
        errorMessage: 'Could not parse gap-fill result.',
        idempotencyKey,
      });
      return jsonResponse(
        {
          error: 'The AI returned an unreadable result. Please try again.',
          code: 'PARSE_FAILED',
          retryable: true,
        },
        502
      );
    }

    const clamped = clampIdeaFields(parsed);
    // Only return keys that were sparse
    const sparseSet = new Set(sparseKeys);
    const suggestions = [];
    for (const [key, value] of Object.entries(clamped)) {
      if (!sparseSet.has(key)) continue;
      if (value == null) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'string' && !value.trim()) continue;
      suggestions.push({
        key,
        label: fieldLabel(key),
        value,
      });
    }

    const settled = await settleHybridCharge(sb, {
      userId,
      actionKey: 'gap_fill',
      promptSummary: summary,
      providerOk: true,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      requestId: result.requestId,
      apiCostUsdMicros: result.apiCostUsdMicros || 0,
      idempotencyKey,
      meta: {
        sparse_keys: sparseKeys,
        suggestion_keys: suggestions.map((s) => s.key),
      },
    });

    if (!settled.ok && settled.code === 'INSUFFICIENT_TOKENS') {
      return jsonResponse(
        { error: settled.message, code: 'INSUFFICIENT_TOKENS' },
        402
      );
    }

    return jsonResponse({
      ok: true,
      suggestions,
      tokensCharged: settled.tokensCharged ?? null,
      balanceAfter: settled.balanceAfter ?? null,
      baseDebited: settled.baseDebited ?? null,
      additionalDebited: settled.additionalDebited ?? null,
    });
  } catch (err) {
    console.error('[idea-gap-fill]', err?.message || err);
    return jsonResponse(
      { error: err?.message || 'Gap filling failed.', retryable: true },
      500
    );
  }
});
