/**
 * Ensure production security header bundle stays complete.
 */
import { describe, it, expect } from 'vitest';
import { securityHeaders, devSecurityHeaders } from '../../security-headers.mjs';

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
    expect(csp).toMatch(/fonts\.googleapis\.com/);
    expect(csp).toMatch(/fonts\.gstatic\.com/);
    expect(csp).toMatch(/\*\.supabase\.co/);
    expect(csp).toMatch(/youtube-nocookie\.com/);
    expect(csp).toMatch(/api\.microlink\.io/);
    expect(csp).not.toMatch(/script-src[^;]*https:/);
  });

  it('dev headers relax HMR requirements', () => {
    expect(devSecurityHeaders['Content-Security-Policy']).toMatch(/unsafe-eval/);
    expect(devSecurityHeaders['Content-Security-Policy']).toMatch(/ws:\/\/localhost/);
  });
});
