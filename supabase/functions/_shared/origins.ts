/**
 * Site origin allowlist for Edge Functions.
 *
 * Used for two things:
 *   1. CORS: only allowed origins get an Access-Control-Allow-Origin header.
 *   2. Redirects: Stripe success / cancel / portal return URLs supplied by the
 *      browser must point back at one of our own origins.
 *
 * Built-in: production site + localhost (any port).
 * Extra origins (staging site, Vercel previews): set the ALLOWED_ORIGINS secret
 * to a comma-separated list. One leading wildcard label is supported:
 *
 *   supabase secrets set ALLOWED_ORIGINS="https://staging.example.com,https://my-project-*.vercel.app"
 *
 * Pure module (no Deno imports) so the logic is unit tested from Vitest.
 */

// deno-lint-ignore-file
// @ts-nocheck

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://togetherforge.net',
  'https://www.togetherforge.net',
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function readEnv(name) {
  try {
    return globalThis.Deno?.env?.get?.(name) ?? '';
  } catch {
    return '';
  }
}

/** @param {string} [raw] comma / whitespace separated origins */
export function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `*` matches characters inside one host label only (never dots or slashes). */
function matchesPattern(origin, pattern) {
  if (!pattern.includes('*')) return origin === pattern;
  const re = new RegExp(
    `^${pattern.split('*').map(escapeRegex).join('[a-z0-9-]*')}$`
  );
  return re.test(origin);
}

/**
 * @param {string|null|undefined} origin e.g. "https://togetherforge.net"
 * @param {string[]} [extra] defaults to the ALLOWED_ORIGINS secret
 */
export function isAllowedOrigin(origin, extra) {
  const raw = String(origin || '').trim();
  if (!raw) return false;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  // URL.origin drops any path, credentials, and default port
  const normalized = url.origin.toLowerCase();
  if (LOCAL_HOSTS.has(url.hostname.toLowerCase())) return true;
  if (url.protocol !== 'https:') return false;
  const list = [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...(extra ?? parseAllowedOrigins(readEnv('ALLOWED_ORIGINS'))),
  ];
  return list.some((p) => matchesPattern(normalized, p));
}

/**
 * True when a browser-supplied redirect target points at one of our origins.
 * @param {unknown} value absolute URL
 * @param {string[]} [extra]
 */
export function isAllowedReturnUrl(value, extra) {
  if (typeof value !== 'string' || !value.trim()) return false;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  return isAllowedOrigin(url.origin, extra);
}

/**
 * Wrap a Deno.serve handler so Access-Control-Allow-Origin is only sent to
 * allowed origins (functions build their responses with a static "*").
 * Responses without CORS headers (webhooks) pass through untouched.
 *
 * @param {(req: Request) => Response | Promise<Response>} handler
 */
export function withCors(handler) {
  return async (req) => {
    const res = await handler(req);
    if (!res.headers.has('Access-Control-Allow-Origin')) return res;
    const headers = new Headers(res.headers);
    const origin = req.headers.get('Origin');
    if (origin && isAllowedOrigin(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    } else {
      headers.delete('Access-Control-Allow-Origin');
    }
    headers.append('Vary', 'Origin');
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}
