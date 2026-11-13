/**
 * Lightweight in-memory sliding-window rate limiter for Supabase Edge Functions.
 *
 * Good enough to slow spam/abuse without a shared store. Each isolate has its
 * own map (Deno Deploy multi-instance), so limits are per-instance soft caps.
 *
 * Usage:
 *   const limited = enforceRateLimit(req, { key: user?.id, ...LIMITS.checkout });
 *   if (limited) return limited;
 */

// deno-lint-ignore-file
// @ts-nocheck

/** @type {Map<string, { start: number, count: number }>} */
const buckets = new Map();

/** Opportunistic cleanup so long-lived isolates do not grow unbounded. */
const MAX_BUCKETS = 5_000;

/**
 * @param {Request} req
 * @param {string|null|undefined} userId
 * @returns {string}
 */
export function clientKey(req, userId) {
  const uid = userId ? String(userId).trim() : '';
  if (uid) return `u:${uid}`;

  const forwarded = req.headers.get('x-forwarded-for') || '';
  const firstHop = forwarded.split(',')[0]?.trim();
  const ip =
    firstHop ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  return `ip:${ip}`;
}

/**
 * @param {string} key
 * @param {{ limit: number, windowMs: number, bucket?: string }} opts
 * @returns {{ ok: true, remaining: number, limit: number, retryAfter: number } | { ok: false, remaining: number, limit: number, retryAfter: number }}
 */
export function checkRateLimit(key, opts) {
  const limit = Math.max(1, Number(opts.limit) || 30);
  const windowMs = Math.max(1_000, Number(opts.windowMs) || 60_000);
  const bucketKey = `${opts.bucket || 'default'}:${key}`;
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    // Drop oldest half of entries (Map insertion order)
    const drop = Math.floor(buckets.size / 2);
    let i = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++i >= drop) break;
    }
  }

  let entry = buckets.get(bucketKey);
  if (!entry || now - entry.start >= windowMs) {
    entry = { start: now, count: 0 };
    buckets.set(bucketKey, entry);
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const retryAfter = Math.max(
    1,
    Math.ceil((entry.start + windowMs - now) / 1000)
  );

  if (entry.count > limit) {
    return { ok: false, remaining: 0, limit, retryAfter };
  }
  return { ok: true, remaining, limit, retryAfter: 0 };
}

/**
 * Build a 429 JSON response with Retry-After + rate-limit headers.
 * @param {{ remaining: number, limit: number, retryAfter: number }} result
 * @param {Record<string, string>} [cors]
 * @param {string} [message]
 */
export function rateLimitResponse(
  result,
  cors = {},
  message = 'Too many requests. Please wait a moment and try again.'
) {
  const retryAfter = result.retryAfter || 60;
  return new Response(
    JSON.stringify({
      error: message,
      code: 'RATE_LIMITED',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit || 0),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

/**
 * One-shot helper: returns a Response if limited, otherwise null.
 *
 * @param {Request} req
 * @param {{
 *   limit: number,
 *   windowMs: number,
 *   bucket: string,
 *   userId?: string|null,
 *   cors?: Record<string, string>,
 *   message?: string,
 * }} opts
 * @returns {Response|null}
 */
export function enforceRateLimit(req, opts) {
  const key = clientKey(req, opts.userId);
  const result = checkRateLimit(key, {
    limit: opts.limit,
    windowMs: opts.windowMs,
    bucket: opts.bucket,
  });
  if (!result.ok) {
    return rateLimitResponse(result, opts.cors || {}, opts.message);
  }
  return null;
}

/** Sensible defaults for TF sensitive endpoints */
export const RATE_LIMITS = {
  /** Checkout / payments — a few attempts per window is normal */
  checkout: {
    limit: 10,
    windowMs: 10 * 60 * 1000, // 10 / 10 minutes
    bucket: 'create-checkout',
    message:
      'Too many checkout attempts. Please wait a few minutes and try again.',
  },
  /** MFA recovery status polls are cheap; still cap */
  mfaStatus: {
    limit: 30,
    windowMs: 5 * 60 * 1000, // 30 / 5 minutes
    bucket: 'mfa-recovery-status',
    message: 'Too many MFA status checks. Please wait a moment.',
  },
  /** Generate / clear recovery codes */
  mfaManage: {
    limit: 8,
    windowMs: 15 * 60 * 1000, // 8 / 15 minutes
    bucket: 'mfa-recovery-manage',
    message:
      'Too many MFA recovery-code requests. Please wait before trying again.',
  },
  /** Redeem recovery code (stricter — brute-force surface) */
  mfaRecover: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 5 / 15 minutes
    bucket: 'mfa-recovery-redeem',
    message:
      'Too many recovery attempts. Please wait 15 minutes before trying again.',
  },
  /** Cancel / renew subscription */
  manageSubscription: {
    limit: 15,
    windowMs: 10 * 60 * 1000, // 15 / 10 minutes
    bucket: 'manage-subscription',
    message:
      'Too many subscription changes. Please wait a few minutes and try again.',
  },
  /** Stripe Customer Portal open */
  billingPortal: {
    limit: 12,
    windowMs: 10 * 60 * 1000, // 12 / 10 minutes
    bucket: 'create-billing-portal',
    message:
      'Too many billing portal requests. Please wait a few minutes and try again.',
  },
  /** Payment methods summary (Account Billing loads often) */
  billingSummary: {
    limit: 40,
    windowMs: 5 * 60 * 1000, // 40 / 5 minutes
    bucket: 'get-billing-summary',
    message:
      'Too many billing summary requests. Please wait a moment and refresh.',
  },
  /** Post-checkout account attach */
  syncCheckout: {
    limit: 20,
    windowMs: 10 * 60 * 1000,
    bucket: 'sync-checkout',
    message: 'Too many checkout sync attempts. Please wait a few minutes.',
  },
  /** AI token pack checkout */
  tokenCheckout: {
    limit: 10,
    windowMs: 10 * 60 * 1000,
    bucket: 'create-token-checkout',
    message:
      'Too many token checkout attempts. Please wait a few minutes and try again.',
  },
  /** AI token balance / availability polls */
  aiTokenStatus: {
    limit: 60,
    windowMs: 5 * 60 * 1000,
    bucket: 'ai-token-status',
    message: 'Too many AI token status checks. Please wait a moment.',
  },
  /** Future AI generation endpoints (per-user soft cap) */
  aiGenerate: {
    limit: 20,
    windowMs: 60 * 60 * 1000, // 20 / hour
    bucket: 'ai-generate',
    message:
      'AI services are temporarily unavailable due to usage limits. Please try again later.',
  },
  /** Private concern reports (no account; soft IP cap) */
  concernReport: {
    limit: 5,
    windowMs: 15 * 60 * 1000,
    bucket: 'concern-report',
    message:
      'Too many reports from this network. Please wait a bit and try again.',
  },
  volunteerApplication: {
    limit: 4,
    windowMs: 15 * 60 * 1000,
    bucket: 'volunteer-application',
    message: 'Too many applications. Please wait a bit and try again.',
  },
};

// ---------------------------------------------------------------------------
// Durable limiter (database-backed)
// ---------------------------------------------------------------------------

function envValue(name) {
  try {
    return globalThis.Deno?.env?.get?.(name) ?? '';
  } catch {
    return '';
  }
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Same contract as enforceRateLimit, but counted in Postgres
 * (public.edge_rate_limit_hit, see supabase/sql/supabase_scale_prep.sql) so
 * the limit holds across function instances and cold starts.
 *
 * Falls back to the in-memory limiter when the database call fails or the
 * SQL has not been applied yet, so it is always safe to deploy.
 *
 * @param {Request} req
 * @param {Parameters<typeof enforceRateLimit>[1]} opts
 * @returns {Promise<Response|null>}
 */
export async function enforceRateLimitDurable(req, opts) {
  const url = envValue('SUPABASE_URL') || envValue('SB_URL');
  const serviceKey =
    envValue('SUPABASE_SERVICE_ROLE_KEY') || envValue('SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return enforceRateLimit(req, opts);

  const limit = Math.max(1, Number(opts.limit) || 30);
  const windowSeconds = Math.max(
    1,
    Math.ceil((Number(opts.windowMs) || 60_000) / 1000)
  );
  try {
    // Hash the key so raw IP addresses are never stored
    const keyHash = await sha256Hex(clientKey(req, opts.userId));
    const res = await fetch(`${url}/rest/v1/rpc/edge_rate_limit_hit`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_bucket: opts.bucket || 'default',
        p_key_hash: keyHash,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`rate limit rpc ${res.status}`);
    const data = await res.json();
    if (data && data.allowed === false) {
      return rateLimitResponse(
        { limit, remaining: 0, retryAfter: Number(data.retry_after) || 60 },
        opts.cors || {},
        opts.message
      );
    }
    if (data && data.allowed === true) return null;
    throw new Error('unexpected rate limit response');
  } catch {
    return enforceRateLimit(req, opts);
  }
}
