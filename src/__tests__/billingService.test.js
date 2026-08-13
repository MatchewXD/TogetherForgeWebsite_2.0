/**
 * Account billing mappers + critical service calls (My Plan / history / sync).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getUser = vi.fn();
const getSession = vi.fn();
const refreshSession = vi.fn();
const rpc = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...a) => getUser(...a),
      getSession: (...a) => getSession(...a),
      refreshSession: (...a) => refreshSession(...a),
    },
    rpc: (...a) => rpc(...a),
    from: vi.fn(),
  },
}));

import {
  billingService,
  mapPlan,
  mapHistoryRow,
} from '../services/billingService';

describe('mapPlan', () => {
  it('returns null for empty input', () => {
    expect(mapPlan(null)).toBeNull();
  });

  it('maps active subscription for My Plan UI', () => {
    const p = mapPlan({
      id: 'sub_abc',
      status: 'active',
      amount_cents: 1500,
      currency: 'usd',
      tier_id: 'member',
      tier_label: 'Forge Member',
      cancel_at_period_end: false,
      current_period_end: '2026-09-12T00:00:00.000Z',
      customer_id: 'cus_x',
    });
    expect(p.id).toBe('sub_abc');
    expect(p.statusLabel).toBe('Active');
    expect(p.statusTone).toBe('success');
    expect(p.amountCents).toBe(1500);
    expect(p.label).toBe('Forge Member');
    expect(p.amountLabel).toBe('$15/month');
    expect(p.cancelAtPeriodEnd).toBe(false);
    expect(p.expiryLine).toMatch(/Renews on/i);
  });

  it('maps canceling plan with expiry line', () => {
    const p = mapPlan({
      id: 'sub_c',
      status: 'active',
      amount_cents: 500,
      cancel_at_period_end: true,
      current_period_end: '2026-10-01T00:00:00.000Z',
    });
    expect(p.statusLabel).toBe('Canceling');
    expect(p.statusTone).toBe('warning');
    expect(p.cancelAtPeriodEnd).toBe(true);
    expect(p.expiryLine).toMatch(/expire/i);
  });
});

describe('mapHistoryRow', () => {
  it('labels one-time vs subscription charges', () => {
    const once = mapHistoryRow({
      id: 1,
      amount_cents: 2000,
      payment_kind: 'one_time',
      status: 'completed',
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(once.kindLabel).toBe('One-time');
    expect(once.paymentKind).toBe('one_time');

    const sub = mapHistoryRow({
      id: 2,
      amount_cents: 1500,
      payment_kind: 'subscription_payment',
      interval: 'month',
      status: 'completed',
    });
    expect(sub.kindLabel).toBe('Subscription');
    expect(sub.paymentKind).toBe('subscription_payment');
  });

  it('infers subscription charge from interval when payment_kind missing', () => {
    const row = mapHistoryRow({
      id: 3,
      amount_cents: 500,
      interval: 'month',
    });
    expect(row.paymentKind).toBe('subscription_payment');
  });
});

describe('billingService.getMyPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'a@b.com' } },
    });
    getSession.mockResolvedValue({
      data: { session: { access_token: 'jwt-token' } },
    });
    refreshSession.mockResolvedValue({ data: { session: null } });
  });

  it('returns mapped plan from RPC', async () => {
    rpc.mockResolvedValue({
      data: {
        id: 'sub_1',
        status: 'active',
        amount_cents: 1500,
        tier_id: 'member',
        cancel_at_period_end: false,
      },
      error: null,
    });
    const plan = await billingService.getMyPlan();
    expect(rpc).toHaveBeenCalledWith('get_my_subscription_plan');
    expect(plan?.id).toBe('sub_1');
    expect(plan?.statusLabel).toBe('Active');
  });

  it('returns null when RPC yields no plan', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await billingService.getMyPlan()).toBeNull();
  });
});

describe('billingService.syncCheckoutSession / refreshSubscription', () => {
  const env = import.meta.env;
  let fetchMock;

  beforeEach(() => {
    env.VITE_SUPABASE_URL = 'https://staging.example.supabase.co';
    env.VITE_SUPABASE_ANON_KEY = 'test-anon';
    getSession.mockResolvedValue({
      data: { session: { access_token: 'user-jwt' } },
    });
    refreshSession.mockResolvedValue({ data: { session: null } });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete env.VITE_SUPABASE_URL;
    delete env.VITE_SUPABASE_ANON_KEY;
  });

  it('syncCheckoutSession posts sessionId with user JWT', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ ok: true, sessionId: 'cs_test_1', subscription: { id: 'sub_x' } }),
    });
    const r = await billingService.syncCheckoutSession('cs_test_1');
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/sync-checkout$/);
    expect(JSON.parse(opts.body).sessionId).toBe('cs_test_1');
    expect(opts.headers.Authorization).toBe('Bearer user-jwt');
  });

  it('syncCheckoutSession rejects non-cs ids without fetch', async () => {
    const r = await billingService.syncCheckoutSession('not-a-session');
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshSubscription posts action refresh', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          action: 'refresh',
          subscription: {
            id: 'sub_1',
            status: 'active',
            amount_cents: 1500,
            cancel_at_period_end: false,
          },
        }),
    });
    const plan = await billingService.refreshSubscription('sub_1');
    expect(plan.id).toBe('sub_1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/manage-subscription$/);
    expect(JSON.parse(opts.body)).toEqual({
      action: 'refresh',
      subscriptionId: 'sub_1',
    });
  });
});
