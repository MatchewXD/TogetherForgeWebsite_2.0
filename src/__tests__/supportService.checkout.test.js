/**
 * Checkout session creation: amount validation + credit metadata payload.
 * Account ownership is server-side (JWT); client must not send trusted userId.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startStripeCheckout,
  validateAmountCents,
} from '../services/supportService';

const getSession = vi.fn();
const refreshSession = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a) => getSession(...a),
      refreshSession: (...a) => refreshSession(...a),
    },
  },
}));

describe('startStripeCheckout credit metadata', () => {
  const env = import.meta.env;
  let fetchMock;

  beforeEach(() => {
    env.VITE_ENABLE_DONATIONS = 'true';
    env.VITE_STRIPE_CHECKOUT_API_URL = 'https://example.test/functions/v1/create-checkout';
    env.VITE_SUPABASE_ANON_KEY = 'test-anon';
    getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          url: 'https://checkout.stripe.com/test',
          sessionId: 'cs_test',
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete env.VITE_ENABLE_DONATIONS;
    delete env.VITE_STRIPE_CHECKOUT_API_URL;
    delete env.VITE_SUPABASE_ANON_KEY;
  });

  it('does not call checkout when donations are paused', async () => {
    env.VITE_ENABLE_DONATIONS = 'false';
    await expect(
      startStripeCheckout({ amountCents: 1000 })
    ).rejects.toMatchObject({ code: 'DONATIONS_PAUSED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid amount before fetch', async () => {
    await expect(
      startStripeCheckout({ amountCents: 50 })
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts named public credit flags when not anonymous (no trusted userId)', async () => {
    await startStripeCheckout({
      amountCents: 2500,
      fundType: 'studio',
      interval: 'once',
      userId: 'user-1',
      displayName: 'alice',
      isAnonymous: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.amountCents).toBe(2500);
    expect(body.fundType).toBe('studio');
    expect(body.mode).toBe('payment');
    expect(body.isAnonymous).toBe(false);
    // Identity is JWT-only on the Edge Function — body must not carry userId
    expect(body.userId).toBeUndefined();
    expect(body.displayName).toBe('alice');
    expect(body.successUrl).toMatch(/checkout=success/);
  });

  it('defaults isAnonymous true for public safety', async () => {
    await startStripeCheckout({
      amountCents: 1000,
      userId: 'user-1',
      displayName: 'bob',
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.isAnonymous).toBe(true);
    expect(body.userId).toBeUndefined();
  });

  it('uses subscription mode for monthly', async () => {
    await startStripeCheckout({
      amountCents: 1000,
      interval: 'month',
      fundType: 'runway',
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.mode).toBe('subscription');
    expect(body.fundType).toBe('runway');
    expect(body.interval).toBe('month');
  });

  it('sends user JWT when session exists (for server-side identity)', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'user-access-jwt' } },
      error: null,
    });
    await startStripeCheckout({ amountCents: 1000 });
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer user-access-jwt');
    expect(opts.headers.apikey).toBe('test-anon');
  });

  it('falls back to anon Authorization when logged out', async () => {
    await startStripeCheckout({ amountCents: 1000 });
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer test-anon');
  });

  it('surfaces RATE_LIMITED from Edge Function', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () =>
        JSON.stringify({
          error: 'Too many checkout attempts.',
          code: 'RATE_LIMITED',
        }),
    });
    await expect(startStripeCheckout({ amountCents: 1000 })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });
  });
});

describe('validateAmountCents edge bounds', () => {
  it('accepts $1 and $10,000', () => {
    expect(validateAmountCents(100).ok).toBe(true);
    expect(validateAmountCents(1_000_000).ok).toBe(true);
  });
});
