import { describe, it, expect } from 'vitest';
import {
  isAllowedOrigin,
  isAllowedReturnUrl,
  parseAllowedOrigins,
  withCors,
} from '../../supabase/functions/_shared/origins.ts';

describe('isAllowedOrigin', () => {
  it('allows the production site and localhost', () => {
    expect(isAllowedOrigin('https://togetherforge.net', [])).toBe(true);
    expect(isAllowedOrigin('https://www.togetherforge.net', [])).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173', [])).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:4173', [])).toBe(true);
  });

  it('rejects other sites and lookalikes', () => {
    expect(isAllowedOrigin('https://evil.example', [])).toBe(false);
    expect(isAllowedOrigin('https://togetherforge.net.evil.example', [])).toBe(false);
    expect(isAllowedOrigin('https://eviltogetherforge.net', [])).toBe(false);
    expect(isAllowedOrigin('http://togetherforge.net', [])).toBe(false);
    expect(isAllowedOrigin('javascript:alert(1)', [])).toBe(false);
    expect(isAllowedOrigin('', [])).toBe(false);
    expect(isAllowedOrigin(null, [])).toBe(false);
  });

  it('supports extra origins with a single-label wildcard', () => {
    const extra = parseAllowedOrigins(
      'https://staging.example.com/, https://tf-*.vercel.app'
    );
    expect(isAllowedOrigin('https://staging.example.com', extra)).toBe(true);
    expect(isAllowedOrigin('https://tf-git-main-abc.vercel.app', extra)).toBe(true);
    expect(isAllowedOrigin('https://other.vercel.app', extra)).toBe(false);
    expect(isAllowedOrigin('https://tf-x.evil.vercel.app', extra)).toBe(false);
    expect(isAllowedOrigin('https://tf-x.vercel.app.evil.example', extra)).toBe(false);
  });
});

describe('isAllowedReturnUrl', () => {
  it('accepts URLs on our own origins, including Stripe placeholders', () => {
    expect(
      isAllowedReturnUrl(
        'https://togetherforge.net/donate?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        []
      )
    ).toBe(true);
    expect(isAllowedReturnUrl('http://localhost:5173/account/billing', [])).toBe(true);
  });

  it('rejects foreign, credentialed, and malformed URLs', () => {
    expect(isAllowedReturnUrl('https://evil.example/donate', [])).toBe(false);
    expect(isAllowedReturnUrl('https://togetherforge.net@evil.example/', [])).toBe(false);
    expect(isAllowedReturnUrl('https://user:pw@togetherforge.net/', [])).toBe(false);
    expect(isAllowedReturnUrl('/donate', [])).toBe(false);
    expect(isAllowedReturnUrl('httpfoo', [])).toBe(false);
    expect(isAllowedReturnUrl(undefined, [])).toBe(false);
  });
});

describe('withCors', () => {
  const handler = withCors(
    async () =>
      new Response('{"ok":true}', {
        status: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      })
  );

  it('echoes an allowed origin', async () => {
    const res = await handler(
      new Request('https://fn.example/x', {
        headers: { Origin: 'https://togetherforge.net' },
      })
    );
    expect(res.status).toBe(201);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://togetherforge.net'
    );
    expect(res.headers.get('Vary')).toMatch(/Origin/);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('drops the header for other origins and for requests without one', async () => {
    const foreign = await handler(
      new Request('https://fn.example/x', {
        headers: { Origin: 'https://evil.example' },
      })
    );
    expect(foreign.headers.has('Access-Control-Allow-Origin')).toBe(false);
    const none = await handler(new Request('https://fn.example/x'));
    expect(none.headers.has('Access-Control-Allow-Origin')).toBe(false);
    expect(none.status).toBe(201);
  });

  it('leaves responses without CORS headers untouched', async () => {
    const plain = new Response('ok');
    const res = await withCors(async () => plain)(
      new Request('https://fn.example/x')
    );
    expect(res).toBe(plain);
  });
});
