/**
 * Checkout session creation: amount validation + credit metadata payload.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startStripeCheckout,
  validateAmountCents,
} from '../services/supportService';

describe('startStripeCheckout credit metadata', () => {
  const env = import.meta.env;
  let fetchMock;

  beforeEach(() => {
    env.VITE_STRIPE_CHECKOUT_API_URL = 'https://example.test/functions/v1/create-checkout';
    env.VITE_SUPABASE_ANON_KEY = 'test-anon';
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
    delete env.VITE_STRIPE_CHECKOUT_API_URL;
    delete env.VITE_SUPABASE_ANON_KEY;
  });

  it('rejects invalid amount before fetch', async () => {
    await expect(
      startStripeCheckout({ amountCents: 50 })
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts named public credit flags when not anonymous', async () => {
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
    expect(body.userId).toBe('user-1');
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
});

describe('validateAmountCents edge bounds', () => {
  it('accepts $1 and $10,000', () => {
    expect(validateAmountCents(100).ok).toBe(true);
    expect(validateAmountCents(1_000_000).ok).toBe(true);
  });
});
