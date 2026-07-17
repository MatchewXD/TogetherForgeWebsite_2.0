import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args) => rpc(...args),
    from: (...args) => from(...args),
  },
}));

import { getPublicSupportSummary } from '../services/donationsService';

describe('donationsService.getPublicSupportSummary', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    localStorage.clear();
  });

  it('maps RPC payload to studio totals', async () => {
    rpc.mockResolvedValue({
      data: {
        studio_total_cents: 5000,
        studio_payment_count: 2,
        runway_total_cents: 1000,
        runway_payment_count: 1,
        last_payment_at: '2026-07-15T00:00:00Z',
        currency: 'usd',
      },
      error: null,
    });

    const summary = await getPublicSupportSummary();
    expect(summary.source).toBe('supabase');
    expect(summary.studioTotalCents).toBe(5000);
    expect(summary.studioPaymentCount).toBe(2);
    expect(summary.runwayTotalCents).toBe(1000);
    expect(summary.error).toBeNull();
  });

  it('falls back to localStorage when RPC fails', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'function does not exist' },
    });
    from.mockReturnValue({
      select: () =>
        Promise.resolve({ data: null, error: { message: 'rls' } }),
    });

    localStorage.setItem(
      'tf_donations',
      JSON.stringify([{ amount: 25, amountCents: 2500 }])
    );

    const summary = await getPublicSupportSummary();
    expect(summary.studioTotalCents).toBe(2500);
    expect(summary.source).toBe('local');
  });
});
