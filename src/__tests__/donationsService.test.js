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
  uniqueContributorsFromLocal,
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

  it('labels anonymous vs named recent supporters', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          amount_cents: 500,
          created_at: new Date().toISOString(),
          is_anonymous: true,
          username: null,
          display_name: null,
        },
        {
          amount_cents: 1500,
          created_at: new Date().toISOString(),
          is_anonymous: false,
          username: 'MatchewXD',
          display_name: 'MatchewXD',
        },
      ],
      error: null,
    });
    const recent = await getPublicRecentDonations(12);
    expect(recent.items[0].label).toBe('Anonymous Supporter');
    expect(recent.items[0].isAnonymous).toBe(true);
    expect(recent.items[1].label).toBe('MatchewXD');
    expect(recent.items[1].isAnonymous).toBe(false);
  });

  it('maps recent donations RPC (amounts kept in data, labels for display)', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          amount_cents: 2000,
          created_at: new Date().toISOString(),
          is_recurring: true,
          is_anonymous: true,
        },
        {
          amount_cents: 1500,
          created_at: new Date().toISOString(),
          is_recurring: false,
          is_anonymous: false,
          username: 'forge_dev',
          avatar_url: 'https://example.com/a.png',
          display_name: 'forge_dev',
        },
      ],
      error: null,
    });

    const recent = await getPublicRecentDonations(10);
    expect(recent.source).toBe('supabase');
    expect(recent.items).toHaveLength(2);
    expect(recent.items[0].label).toBe('Anonymous Supporter');
    expect(recent.items[0].isRecurring).toBe(true);
    expect(recent.items[1].username).toBe('forge_dev');
    expect(recent.items[1].avatarUrl).toBe('https://example.com/a.png');
    expect(recent.items[1].label).toBe('forge_dev');
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

describe('uniqueContributorsFromLocal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('dedupes named supporters and skips anonymous', () => {
    localStorage.setItem(
      'tf_runway_donations',
      JSON.stringify([
        { username: 'alice', isAnonymous: false, timestamp: '2026-01-01' },
        { username: 'Alice', isAnonymous: false, timestamp: '2026-02-01' },
        { username: 'bob', isAnonymous: true },
        { isAnonymous: true },
        { username: 'cara', isAnonymous: false },
      ])
    );
    const items = uniqueContributorsFromLocal('runway');
    expect(items.map((p) => p.username)).toEqual(['alice', 'cara']);
  });

  it('does not mix runway and studio ledgers', () => {
    localStorage.setItem(
      'tf_donations',
      JSON.stringify([{ username: 'studio_only', isAnonymous: false }])
    );
    expect(uniqueContributorsFromLocal('runway')).toEqual([]);
    expect(uniqueContributorsFromLocal('studio')[0].username).toBe(
      'studio_only'
    );
  });
});
