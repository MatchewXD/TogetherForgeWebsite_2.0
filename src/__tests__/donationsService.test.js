import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args) => rpc(...args),
    from: (...args) => from(...args),
  },
}));

import {
  getPublicSupportSummary,
  getPublicRecentDonations,
  formatTimeAgo,
  formatUsdFromCents,
} from '../services/donationsService';

describe('donationsService.getPublicSupportSummary', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    localStorage.clear();
  });

  it('maps RPC payload to studio totals and MRR', async () => {
    rpc.mockResolvedValue({
      data: {
        studio_total_cents: 5000,
        studio_payment_count: 2,
        studio_mrr_cents: 1500,
        studio_subscriber_count: 1,
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
    expect(summary.studioMrrCents).toBe(1500);
    expect(summary.studioSubscriberCount).toBe(1);
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

  it('maps recent donations RPC to anonymous items', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          amount_cents: 2000,
          created_at: new Date().toISOString(),
          is_recurring: true,
        },
      ],
      error: null,
    });

    const recent = await getPublicRecentDonations(10);
    expect(recent.source).toBe('supabase');
    expect(recent.items).toHaveLength(1);
    expect(recent.items[0].label).toBe('Anonymous Supporter');
    expect(recent.items[0].amountCents).toBe(2000);
    expect(recent.items[0].isRecurring).toBe(true);
  });
});

describe('donationsService format helpers', () => {
  it('formatUsdFromCents', () => {
    expect(formatUsdFromCents(500)).toMatch(/\$5/);
  });

  it('formatTimeAgo for recent', () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toMatch(/Just now|minute|hour/i);
  });
});
