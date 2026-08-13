/**
 * AI provider abstraction.
 * Primary implementation: Grok via xAI (OpenAI-compatible chat completions).
 *
 * Edge note: Supabase Edge wall-clock is limited (~60s). Keep timeouts under
 * that so the isolate is not killed mid-request (which surfaces as cryptic
 * Deno.core.runMicrotasks errors on shutdown).
 */

// deno-lint-ignore-file
// @ts-nocheck

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiCompleteOptions = {
  messages: AiChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Abort / timeout ms (capped for Edge) */
  timeoutMs?: number;
};

export type AiCompleteResult = {
  ok: boolean;
  text?: string;
  model?: string;
  provider: string;
  apiCostUsdMicros?: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  latencyMs?: number;
  requestId?: string;
  errorCode?: string;
  errorMessage?: string;
  raw?: unknown;
};

export interface AiProvider {
  readonly name: string;
  complete(opts: AiCompleteOptions): Promise<AiCompleteResult>;
}

/**
 * Prefer fast models for product AI tools so Edge Functions finish in time.
 * Override with XAI_MODEL / XAI_IDEA_MODEL secrets when needed.
 * Do NOT default to retired aliases like grok-2-latest (HTTP 400).
 */
const DEFAULT_GROK_MODEL =
  Deno.env.get('XAI_MODEL') ||
  Deno.env.get('GROK_MODEL') ||
  'grok-4-1-fast-non-reasoning';

/** Only used when primary model id is rejected (400/404) — not on timeouts. */
const MODEL_FALLBACKS = [
  'grok-4-1-fast-non-reasoning',
  'grok-4-1-fast-reasoning',
  'grok-3-mini',
  'grok-3',
  'grok-4.6',
];

/** Stay under typical Edge wall clock; hard cap attempts. */
const EDGE_MAX_TIMEOUT_MS = 45_000;
const DEFAULT_TIMEOUT_MS = 40_000;
const DEFAULT_MAX_TOKENS = Math.max(
  256,
  Number(Deno.env.get('AI_COMPLETION_MAX_TOKENS') || 2048)
);

function estimateCostMicros(usage: {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}): number {
  const total =
    usage.totalTokens ||
    (Number(usage.promptTokens) || 0) + (Number(usage.completionTokens) || 0);
  if (!total) return 0;
  const microsPerToken = Number(Deno.env.get('AI_EST_MICROS_PER_TOKEN') || 1);
  return Math.max(0, Math.round(total * microsPerToken));
}

function extractErrorMessage(raw: unknown, status: number): string {
  if (!raw || typeof raw !== 'object') {
    return `xAI request failed (${status})`;
  }
  const r = raw as Record<string, unknown>;
  const err = r.error;
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string' && e.message.trim()) return e.message.trim();
    if (typeof e.error === 'string' && e.error.trim()) return e.error.trim();
  }
  if (typeof r.message === 'string' && r.message.trim()) return r.message.trim();
  try {
    const s = JSON.stringify(raw);
    if (s && s !== '{}') return s.slice(0, 400);
  } catch {
    /* ignore */
  }
  return `xAI request failed (${status})`;
}

function isModelError(status: number, message: string): boolean {
  if (status !== 400 && status !== 404) return false;
  const m = String(message || '').toLowerCase();
  return (
    m.includes('model') ||
    m.includes('not found') ||
    m.includes('invalid') ||
    m.includes('does not exist') ||
    m.includes('unknown')
  );
}

function makeTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const timeoutMs = Math.min(
    EDGE_MAX_TIMEOUT_MS,
    Math.max(5_000, Number(ms) || DEFAULT_TIMEOUT_MS)
  );
  // Prefer native AbortSignal.timeout (no setTimeout / node polyfill path)
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return {
      signal: AbortSignal.timeout(timeoutMs),
      clear: () => {},
    };
  }
  const controller = new AbortController();
  const id = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      /* ignore */
    }
  }, timeoutMs);
  return {
    signal: controller.signal,
    clear: () => {
      try {
        clearTimeout(id);
      } catch {
        /* ignore */
      }
    },
  };
}

export class GrokProvider implements AiProvider {
  readonly name = 'xai';
  #apiKey: string;
  #baseUrl: string;
  #defaultModel: string;

  constructor(opts: { apiKey?: string; baseUrl?: string; model?: string } = {}) {
    this.#apiKey =
      opts.apiKey ||
      Deno.env.get('XAI_API_KEY') ||
      Deno.env.get('GROK_API_KEY') ||
      '';
    this.#baseUrl = (
      opts.baseUrl ||
      Deno.env.get('XAI_API_BASE') ||
      'https://api.x.ai/v1'
    ).replace(/\/$/, '');
    this.#defaultModel = opts.model || DEFAULT_GROK_MODEL;
  }

  get configured(): boolean {
    return Boolean(this.#apiKey);
  }

  async #requestOnce(
    model: string,
    opts: AiCompleteOptions,
    signal: AbortSignal
  ): Promise<{ res: Response; raw: unknown; model: string }> {
    const maxTokens = Math.min(
      4096,
      Math.max(256, Number(opts.maxTokens) || DEFAULT_MAX_TOKENS)
    );
    const body: Record<string, unknown> = {
      model,
      messages: opts.messages,
      max_tokens: maxTokens,
      stream: false,
    };
    const temp = opts.temperature ?? 0.35;
    if (Number.isFinite(temp)) {
      body.temperature = temp;
    }

    const res = await fetch(`${this.#baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify(body),
    });
    const raw = await res.json().catch(() => ({}));
    return { res, raw, model };
  }

  async complete(opts: AiCompleteOptions): Promise<AiCompleteResult> {
    const started = Date.now();
    if (!this.#apiKey) {
      return {
        ok: false,
        provider: this.name,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        errorMessage: 'XAI_API_KEY is not set on the server.',
        latencyMs: Date.now() - started,
      };
    }

    const primary = opts.model || this.#defaultModel;
    // On model-id rejection only — never chain long fallbacks after timeouts
    const modelCandidates = [
      primary,
      ...MODEL_FALLBACKS.filter((m) => m !== primary),
    ].slice(0, 3);

    const timeoutMs = Math.min(
      EDGE_MAX_TIMEOUT_MS,
      Math.max(5_000, Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS)
    );

    try {
      let lastFail: AiCompleteResult | null = null;

      for (let i = 0; i < modelCandidates.length; i++) {
        const model = modelCandidates[i];
        const { signal, clear } = makeTimeoutSignal(timeoutMs);
        try {
          const { res, raw } = await this.#requestOnce(model, opts, signal);
          const latencyMs = Date.now() - started;

          if (!res.ok) {
            const errorMessage = extractErrorMessage(raw, res.status);
            console.error(
              JSON.stringify({
                tag: 'TF_XAI',
                step: 'chat_completions_error',
                status: res.status,
                model,
                errorMessage,
                latencyMs,
              })
            );
            lastFail = {
              ok: false,
              provider: this.name,
              model,
              errorCode: `HTTP_${res.status}`,
              errorMessage,
              latencyMs,
              raw,
            };
            if (isModelError(res.status, errorMessage) && i < modelCandidates.length - 1) {
              continue;
            }
            return lastFail;
          }

          const r = raw as Record<string, unknown>;
          const choices = Array.isArray(r.choices) ? r.choices : [];
          const first = choices[0] as Record<string, unknown> | undefined;
          const message = first?.message as Record<string, unknown> | undefined;
          const text =
            (typeof message?.content === 'string' && message.content) ||
            (typeof first?.text === 'string' && first.text) ||
            '';
          const usageRaw = (r.usage || {}) as Record<string, unknown>;
          const usage = {
            promptTokens: Number(usageRaw.prompt_tokens) || undefined,
            completionTokens: Number(usageRaw.completion_tokens) || undefined,
            totalTokens: Number(usageRaw.total_tokens) || undefined,
          };

          if (i > 0) {
            console.warn(
              JSON.stringify({
                tag: 'TF_XAI',
                step: 'model_fallback_ok',
                requested: primary,
                used: model,
              })
            );
          }

          return {
            ok: true,
            text: String(text || ''),
            provider: this.name,
            model,
            usage,
            apiCostUsdMicros: estimateCostMicros(usage),
            latencyMs,
            requestId: typeof r.id === 'string' ? r.id : undefined,
            raw,
          };
        } catch (e) {
          const aborted =
            e?.name === 'AbortError' ||
            e?.name === 'TimeoutError' ||
            /abort|timeout/i.test(String(e?.message || ''));
          if (aborted) {
            return {
              ok: false,
              provider: this.name,
              model,
              errorCode: 'TIMEOUT',
              errorMessage:
                'AI provider request timed out. Please try a shorter idea text, or try again.',
              latencyMs: Date.now() - started,
            };
          }
          throw e;
        } finally {
          clear();
        }
      }

      return (
        lastFail || {
          ok: false,
          provider: this.name,
          errorCode: 'PROVIDER_FAILED',
          errorMessage: 'xAI request failed.',
          latencyMs: Date.now() - started,
        }
      );
    } catch (e) {
      const aborted =
        e?.name === 'AbortError' ||
        e?.name === 'TimeoutError' ||
        /abort|timeout/i.test(String(e?.message || ''));
      return {
        ok: false,
        provider: this.name,
        model: primary,
        errorCode: aborted ? 'TIMEOUT' : 'NETWORK',
        errorMessage: aborted
          ? 'AI provider request timed out. Please try a shorter idea text, or try again.'
          : e?.message || 'AI provider request failed.',
        latencyMs: Date.now() - started,
      };
    }
  }
}

export function getAiProvider(): AiProvider {
  return new GrokProvider();
}

/** Model id recommended for Idea Structuring / Gap Filling (fast). */
export function getIdeaToolModel(): string {
  return (
    Deno.env.get('XAI_IDEA_MODEL') ||
    Deno.env.get('XAI_MODEL') ||
    Deno.env.get('GROK_MODEL') ||
    'grok-4-1-fast-non-reasoning'
  );
}
