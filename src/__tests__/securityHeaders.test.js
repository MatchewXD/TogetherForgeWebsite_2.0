/**
 * Ensure production security header bundle stays complete.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { securityHeaders, devSecurityHeaders } from '../../security-headers.mjs';

const root = resolve(__dirname, '../..');

describe('securityHeaders', () => {
  it('includes required browser security headers', () => {
    expect(securityHeaders['Content-Security-Policy']).toMatch(/default-src 'self'/);
    expect(securityHeaders['Content-Security-Policy']).toMatch(/frame-ancestors 'none'/);
    expect(securityHeaders['Strict-Transport-Security']).toMatch(/max-age=/);
    expect(securityHeaders['X-Frame-Options']).toBe('DENY');
    expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
    expect(securityHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(securityHeaders['Permissions-Policy']).toMatch(/camera=\(\)/);
  });

  it('allows required third parties without opening script to remote hosts', () => {
    const csp = securityHeaders['Content-Security-Policy'];
    expect(csp).toMatch(/\*\.supabase\.co/);
    expect(csp).toMatch(/youtube-nocookie\.com/);
    expect(csp).toMatch(/api\.microlink\.io/);
    expect(csp).not.toMatch(/script-src[^;]*https:/);
    expect(csp).toMatch(/script-src 'self'(;|$)/);
    expect(csp).not.toMatch(/fonts.g(oogleapis|static).com/);
  });

  it('keeps public/_headers and vercel.json in sync with the shared CSP', () => {
    const csp = securityHeaders['Content-Security-Policy'];
    const netlify = readFileSync(resolve(root, 'public/_headers'), 'utf8');
    const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
    const vercelCsp = vercel.headers[0].headers.find(
      (h) => h.key === 'Content-Security-Policy'
    ).value;
    expect(vercelCsp).toBe(csp);
    expect(netlify).toContain(`Content-Security-Policy: ${csp}`);
  });

  it('dev headers relax HMR requirements', () => {
    expect(devSecurityHeaders['Content-Security-Policy']).toMatch(/unsafe-eval/);
    expect(devSecurityHeaders['Content-Security-Policy']).toMatch(/ws:\/\/localhost/);
  });
});
