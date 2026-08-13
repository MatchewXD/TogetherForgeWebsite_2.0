/**
 * Shared browser security headers for Together Forge static hosting.
 * Used by Vite (dev/preview) and mirrored in public/_headers + vercel.json.
 *
 * CSP notes:
 * - 'unsafe-inline' for style/script: boot shell + theme snippet in index.html,
 *   and Tailwind runtime classes. Tighten with nonces later if desired.
 * - img-src https: covers YouTube thumbs, avatars, showcase OG images.
 * - connect-src allows Supabase (API + Realtime + Storage + Edge Functions),
 *   Microlink link previews, and Stripe API domains.
 * - frame-src is limited to YouTube (media player) + Stripe embed hosts.
 */

/** @type {Record<string, string>} */
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  // HSTS only meaningful over HTTPS; safe to send on preview/production hosts.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com https://*.stripe.com",
    // Boot script + Vite module graph. Avoid unsafe-eval in production builds.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    [
      "connect-src 'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://api.microlink.io',
      'https://*.stripe.com',
      'https://api.stripe.com',
    ].join(' '),
    [
      'frame-src',
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
      'https://checkout.stripe.com',
    ].join(' '),
    'upgrade-insecure-requests',
  ].join('; '),
};

/**
 * Dev-only CSP relaxes HMR / local websocket / eval used by Vite.
 * @type {Record<string, string>}
 */
export const devSecurityHeaders = {
  ...securityHeaders,
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com https://*.stripe.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    [
      "connect-src 'self'",
      'http://localhost:*',
      'ws://localhost:*',
      'wss://localhost:*',
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://api.microlink.io',
      'https://*.stripe.com',
      'https://api.stripe.com',
    ].join(' '),
    [
      'frame-src',
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
      'https://checkout.stripe.com',
    ].join(' '),
  ].join('; '),
};
