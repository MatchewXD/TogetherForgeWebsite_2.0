/**
 * Edge Function protection helpers: durable rate limit + Turnstile verify.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enforceRateLimitDurable,
  enforceRateLimit,
} from '../../supabase/functions/_shared/rateLimit.ts';
import { verifyTurnstile } from '../../supabase/functions/_shared/turnstile.ts';

const req = (headers = {}) =>
  new Request('https://fn.example/x', { method: 'POST', headers });

describe('enforceRateLimitDurable', () => {
  const env = {
    SUPABASE_URL: 'https://proj.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  };
  let fetchMock;

  beforeEach(() => {
    globalThis.Deno = { env: { get: (k) => env[k] } };
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    delete globalThis.Deno;
    vi.unstubAllGlobals();
  });

  const opts = (bucket) => ({ bucket, limit: 2, windowMs: 60_000, userId: 'user-1' });

  it('allows when the database says allowed, sending a hashed key', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true, remaining: 1 }), { status: 200 })
    );
    expect(await enforceRateLimitDurable(req(), opts('t-allow'))).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/rest/v1/rpc/edge_rate_limit_hit');
    expect(init.headers.Authorization).toBe('Bearer service-key');
    const body = JSON.parse(init.body);
    expect(body.p_bucket).toBe('t-allow');
    expect(body.p_limit).toBe(2);
    expect(body.p_window_seconds).toBe(60);
    expect(body.p_key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.p_key_hash).not.toContain('user-1');
  });

  it('returns 429 with Retry-After when the database says blocked', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ allowed: false, retry_after: 42 }), { status: 200 })
    );
    const res = await enforceRateLimitDurable(req(), { ...opts('t-block'), message: 'Slow down' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect((await res.json()).error).toBe('Slow down');
  });

  it('falls back to the in-memory limiter when the database call fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const o = opts('t-fallback-err');
    expect(await enforceRateLimitDurable(req(), o)).toBeNull();
    expect(await enforceRateLimitDurable(req(), o)).toBeNull();
    const third = await enforceRateLimitDurable(req(), o);
    expect(third.status).toBe(429);
  });

  it('falls back when the SQL is not applied yet (404)', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    const o = opts('t-fallback-404');
    expect(await enforceRateLimitDurable(req(), o)).toBeNull();
    expect(await enforceRateLimitDurable(req(), o)).toBeNull();
    expect((await enforceRateLimitDurable(req(), o)).status).toBe(429);
  });

  it('uses the in-memory limiter when no service key is configured', async () => {
    globalThis.Deno = { env: { get: () => '' } };
    const o = opts('t-noenv');
    expect(await enforceRateLimitDurable(req(), o)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(enforceRateLimit(req(), o)).toBeNull();
    expect(enforceRateLimit(req(), o).status).toBe(429);
  });
});

describe('verifyTurnstile', () => {
  const ok = () =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));

  it('is skipped when no secret is configured', async () => {
    const fetchImpl = vi.fn();
    expect(await verifyTurnstile(req(), 'tok', { secret: '', fetchImpl })).toEqual({
      ok: true,
      skipped: true,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a missing token without calling Cloudflare', async () => {
    const fetchImpl = vi.fn();
    const r = await verifyTurnstile(req(), undefined, { secret: 's', fetchImpl });
    expect(r).toEqual({ ok: false, reason: 'missing-token' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts a token Cloudflare confirms, forwarding the client IP', async () => {
    const fetchImpl = ok();
    const r = await verifyTurnstile(
      req({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }),
      ' tok ',
      { secret: 's3cret', fetchImpl }
    );
    expect(r).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify$/);
    expect(init.body.get('secret')).toBe('s3cret');
    expect(init.body.get('response')).toBe('tok');
    expect(init.body.get('remoteip')).toBe('203.0.113.9');
  });

  it('rejects a token Cloudflare refuses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }))
    );
    const r = await verifyTurnstile(req(), 'bad', { secret: 's', fetchImpl });
    expect(r).toEqual({ ok: false, reason: 'invalid-input-response' });
  });

  it('fails closed when Cloudflare cannot be reached', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('down'));
    const r = await verifyTurnstile(req(), 'tok', { secret: 's', fetchImpl });
    expect(r).toEqual({ ok: false, reason: 'verify-unreachable' });
  });
});
