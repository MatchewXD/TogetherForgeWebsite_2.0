/**
 * Cloudflare Turnstile verification for anonymous Edge Function endpoints.
 *
 * Off unless the TURNSTILE_SECRET_KEY secret is set:
 *   supabase secrets set TURNSTILE_SECRET_KEY=...
 * The site must also have VITE_TURNSTILE_SITE_KEY set, or browsers will not
 * send a token and every request will be refused.
 */

// deno-lint-ignore-file
// @ts-nocheck

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function envValue(name) {
  try {
    return globalThis.Deno?.env?.get?.(name) ?? '';
  } catch {
    return '';
  }
}

/**
 * @param {Request} req
 * @param {unknown} token value of `captchaToken` from the request body
 * @param {{ secret?: string, fetchImpl?: typeof fetch }} [opts] for tests
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string }>}
 */
export async function verifyTurnstile(req, token, opts = {}) {
  const secret = String(opts.secret ?? envValue('TURNSTILE_SECRET_KEY')).trim();
  if (!secret) return { ok: true, skipped: true };

  const response = typeof token === 'string' ? token.trim() : '';
  if (!response || response.length > 2048) {
    return { ok: false, reason: 'missing-token' };
  }

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', response);
  const ip =
    req.headers.get('cf-connecting-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (ip) form.set('remoteip', ip);

  try {
    const res = await (opts.fetchImpl || fetch)(VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data && data.success === true) return { ok: true };
    return {
      ok: false,
      reason: Array.isArray(data?.['error-codes'])
        ? data['error-codes'].join(',')
        : 'rejected',
    };
  } catch {
    // Cloudflare unreachable: refuse rather than wave bots through
    return { ok: false, reason: 'verify-unreachable' };
  }
}

export const CAPTCHA_FAILED_ERROR =
  'Verification failed. Please reload the page and try again.';
