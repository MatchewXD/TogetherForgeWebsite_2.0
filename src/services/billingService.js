/**
 * Account billing: My Plan + payment history + Stripe portal / cancel.
 * Requires supabase/sql/supabase_billing_account.sql and billing Edge Functions.
 */
import { supabase } from '../lib/supabase';
import {
  describePlanStatus,
  formatBillingDate,
  formatPlanAmount,
  planLabelFromTier,
} from '../constants/supportPlans';

function functionsBaseUrl() {
  const explicit = import.meta.env.VITE_STRIPE_BILLING_API_URL;
  if (explicit && String(explicit).trim()) {
    return String(explicit).replace(/\/$/, '');
  }
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (base && String(base).trim()) {
    return `${String(base).replace(/\/$/, '')}/functions/v1`;
  }
  return '';
}

/** Opt-in only: localStorage.setItem('tf_billing_debug','1') then refresh */
function billingDebugEnabled() {
  try {
    return localStorage.getItem('tf_billing_debug') === '1';
  } catch {
    return false;
  }
}

function blog(step, detail = {}) {
  if (!billingDebugEnabled()) return;
  console.log(`[TF billing] ${step}`, {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || null,
    functionsBase: functionsBaseUrl() || null,
    ...detail,
  });
}

async function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anon) {
    headers.apikey = anon;
  }
  try {
    let token = null;
    const { data: sess } = await supabase.auth.getSession();
    token = sess?.session?.access_token || null;
    if (!token) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      token = refreshed?.session?.access_token || null;
    }
    if (!token) token = anon || null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    if (anon) headers.Authorization = `Bearer ${anon}`;
  }
  return headers;
}

/** Exported for unit tests + stable plan UI shape */
export function mapPlan(raw) {
  if (!raw) return null;
  const amountCents = Number(raw.amount_cents ?? raw.amountCents) || 0;
  const tierId = raw.tier_id || raw.tierId || null;
  const label =
    raw.tier_label ||
    raw.tierLabel ||
    planLabelFromTier(tierId, amountCents);
  const statusInfo = describePlanStatus(raw);
  const periodEnd =
    raw.current_period_end || raw.currentPeriodEnd || null;
  const canceling = Boolean(
    raw.cancel_at_period_end ?? raw.cancelAtPeriodEnd
  );

  let expiryLine = null;
  const endLabel = formatBillingDate(periodEnd);
  const statusLower = String(raw.status || '').toLowerCase();
  if (statusLower === 'past_due') {
    expiryLine = endLabel
      ? `The last charge did not go through. Update your payment method in Billing. Stripe will retry until ${endLabel}.`
      : 'The last charge did not go through. Update your payment method in Billing.';
  } else if (endLabel) {
    if (canceling || statusLower === 'canceled') {
      expiryLine = `Your plan will expire on ${endLabel}.`;
    } else {
      expiryLine = `Renews on ${endLabel}.`;
    }
  }

  return {
    id: raw.id,
    status: raw.status,
    statusLabel: statusInfo.label,
    statusTone: statusInfo.tone,
    amountCents,
    currency: raw.currency || 'usd',
    tierId,
    label,
    amountLabel: formatPlanAmount(amountCents, 'month'),
    cancelAtPeriodEnd: canceling,
    currentPeriodEnd: periodEnd,
    canceledAt: raw.canceled_at || raw.canceledAt || null,
    customerId: raw.customer_id || raw.customerId || null,
    expiryLine,
    raw,
  };
}

/**
 * What the charge was for (studio vs runway vs tokens).
 * Exported for tests.
 */
export function purposeLabelFromPayment(row) {
  if (!row) return 'Studio Support';
  const fund = String(row.fund_type || row.fundType || '').toLowerCase();
  const tier = String(row.tier_id || row.tierId || '').toLowerCase();
  const label = String(
    row.tier_label || row.tierLabel || row.label || ''
  ).toLowerCase();
  const source = String(row.source || row.checkout_kind || '').toLowerCase();

  if (
    fund === 'runway' ||
    tier === 'runway' ||
    source === 'runway' ||
    /\brunway\b/.test(label)
  ) {
    return 'Runway Support';
  }
  if (
    fund === 'ai_tokens' ||
    fund === 'ai_token' ||
    source === 'ai_tokens' ||
    source === 'ai_token' ||
    /token/.test(tier) ||
    /ai\s*token|\btoken pack\b/.test(label)
  ) {
    return 'AI Tokens';
  }
  if (fund && fund !== 'studio') {
    return fund
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return 'Studio Support';
}

/** Exported for unit tests + transaction history shape */
export function mapHistoryRow(row) {
  if (!row) return null;
  const kind =
    row.payment_kind ||
    row.paymentKind ||
    (row.is_subscription_charge || row.interval === 'month'
      ? 'subscription_payment'
      : 'one_time');
  const amountCents = Number(row.amount_cents ?? row.amountCents) || 0;
  return {
    id: row.id,
    createdAt: row.created_at || row.createdAt,
    amountCents,
    amountLabel: formatPlanAmount(
      amountCents,
      kind === 'subscription_payment' ? 'once' : 'once'
    ),
    currency: row.currency || 'usd',
    paymentKind: kind,
    kindLabel:
      kind === 'subscription_payment' ? 'Subscription' : 'One-time',
    status: row.status || 'completed',
    tierLabel: row.tier_label || row.tierLabel || null,
    interval: row.interval || 'once',
    fundType: row.fund_type || row.fundType || 'studio',
    purposeLabel: purposeLabelFromPayment(row),
  };
}

function mapTokenPurchaseRow(p) {
  if (!p) return null;
  const status = String(p.status || '').toLowerCase();
  if (status === 'pending' || status === 'cancelled' || status === 'canceled') {
    return null;
  }
  const pack = String(p.pack_id || p.packId || '').trim();
  const packNote = pack
    ? pack.charAt(0).toUpperCase() + pack.slice(1)
    : '';
  return mapHistoryRow({
    id: `token-${p.id}`,
    created_at: p.completed_at || p.completedAt || p.created_at || p.createdAt,
    amount_cents: p.amount_cents ?? p.amountCents,
    currency: p.currency || 'usd',
    payment_kind: 'one_time',
    status: p.status || 'completed',
    fund_type: 'ai_tokens',
    tier_id: pack || 'ai_tokens',
    tier_label: p.label || (packNote ? `AI Tokens (${packNote})` : 'AI Tokens'),
    interval: 'once',
  });
}

async function mergeHistoryWithTokenPurchases(donations, limit = 30) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 100);
  let tokens = [];
  try {
    const { data, error } = await supabase.rpc('get_my_ai_token_purchases', {
      p_limit: cap,
    });
    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      tokens = rows.map(mapTokenPurchaseRow).filter(Boolean);
    }
  } catch {
    tokens = [];
  }
  const seen = new Set();
  const merged = [...(donations || []), ...tokens]
    .filter((row) => {
      if (!row?.id || seen.has(String(row.id))) return false;
      seen.add(String(row.id));
      return true;
    })
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt || '') || 0;
      const tb = Date.parse(b.createdAt || '') || 0;
      return tb - ta;
    });
  return merged.slice(0, cap);
}

/**
 * @param {object} raw
 */
function mapPaymentMethod(raw) {
  if (!raw?.id) return null;
  const brand = String(raw.brand || raw.type || 'card');
  const type = String(raw.type || brand || 'card').toLowerCase();
  // Accept several shapes from Edge Function / Stripe
  const last4Raw =
    raw.last4 ??
    raw.last_4 ??
    raw.card?.last4 ??
    raw.card?.last_4 ??
    null;
  const last4 =
    last4Raw != null && String(last4Raw).trim() !== ''
      ? String(last4Raw).replace(/\D/g, '').slice(-4)
      : null;
  const expMonth = raw.expMonth ?? raw.exp_month ?? raw.card?.exp_month ?? null;
  const expYear = raw.expYear ?? raw.exp_year ?? raw.card?.exp_year ?? null;
  const linkEmail =
    raw.linkEmail ||
    raw.link_email ||
    raw.link?.email ||
    null;
  let label = brand.charAt(0).toUpperCase() + brand.slice(1);
  if (last4) label += ` ending in ${last4}`;
  else if (type === 'link' && linkEmail) label = `Link · ${linkEmail}`;
  let expiry = null;
  if (expMonth && expYear) {
    const mm = String(expMonth).padStart(2, '0');
    const yy = String(expYear).slice(-2);
    expiry = `${mm}/${yy}`;
  }
  return {
    id: raw.id,
    type: raw.type || 'card',
    brand,
    last4,
    expMonth,
    expYear,
    expiry,
    label,
    linkEmail: linkEmail ? String(linkEmail) : null,
    isDefault: Boolean(raw.isDefault ?? raw.is_default),
    funding: raw.funding || null,
  };
}

export const billingService = {
  /**
   * Cards / payment methods on the user's Stripe Customer.
   * @returns {Promise<{
   *   customerId: string|null,
   *   paymentMethods: Array<object>,
   *   defaultPaymentMethodId: string|null,
   *   message?: string|null,
   *   error?: string|null,
   * }>}
   */
  async getPaymentMethods() {
    const base = functionsBaseUrl();
    const log = (...args) => console.log('[TF billing / cards]', ...args);
    const group = (label) => {
      try {
        console.groupCollapsed(`[TF billing / cards] ${label}`);
      } catch {
        console.log(`[TF billing / cards] ${label}`);
      }
    };
    const groupEnd = () => {
      try {
        console.groupEnd();
      } catch {
        /* ignore */
      }
    };

    group('getPaymentMethods start');
    log('functions base URL:', base || '(missing — check VITE_SUPABASE_URL)');

    if (!base) {
      log('ABORT: no functions base URL');
      groupEnd();
      return {
        customerId: null,
        paymentMethods: [],
        defaultPaymentMethodId: null,
        error: 'Billing is not configured.',
      };
    }
    try {
      const url = `${base}/get-billing-summary`;
      log('POST', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({}),
      });
      const text = await res.text();
      log('HTTP status:', res.status, res.statusText);
      log('raw response text (first 2000 chars):', String(text || '').slice(0, 2000));

      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        log('JSON parse failed:', parseErr?.message || parseErr);
        data = null;
      }

      if (!res.ok) {
        log('ERROR response body:', data || text);
        groupEnd();
        return {
          customerId: null,
          paymentMethods: [],
          defaultPaymentMethodId: null,
          error:
            data?.error ||
            data?.message ||
            text ||
            `Could not load payment methods (${res.status})`,
        };
      }

      const rawList = data?.paymentMethods || data?.payment_methods || [];
      log('customerId from edge:', data?.customerId || data?.customer_id || null);
      log('defaultPaymentMethodId from edge:', data?.defaultPaymentMethodId || data?.default_payment_method_id || null);
      log('edge _meta:', data?._meta || null);
      log('edge message:', data?.message || null);
      log(
        'raw paymentMethods count:',
        Array.isArray(rawList) ? rawList.length : 0
      );
      log(
        'raw paymentMethods (safe fields):',
        Array.isArray(rawList)
          ? rawList.map((r, i) => ({
              i,
              id: r?.id,
              type: r?.type,
              brand: r?.brand,
              last4: r?.last4 ?? r?.last_4 ?? r?.card?.last4 ?? null,
              expMonth: r?.expMonth ?? r?.exp_month ?? r?.card?.exp_month,
              expYear: r?.expYear ?? r?.exp_year ?? r?.card?.exp_year,
              isDefault: r?.isDefault ?? r?.is_default,
              // full nested card if present (no PAN — Stripe never sends full number)
              cardObject: r?.card
                ? {
                    brand: r.card.brand,
                    last4: r.card.last4,
                    exp_month: r.card.exp_month,
                    exp_year: r.card.exp_year,
                    funding: r.card.funding,
                  }
                : null,
              keys: r && typeof r === 'object' ? Object.keys(r) : [],
            }))
          : rawList
      );

      let methods = (Array.isArray(rawList) ? rawList : [])
        .map((raw, i) => {
          const mapped = mapPaymentMethod(raw);
          log(`mapPaymentMethod[${i}]`, {
            in: {
              id: raw?.id,
              type: raw?.type,
              brand: raw?.brand,
              last4: raw?.last4,
              cardLast4: raw?.card?.last4,
            },
            out: mapped
              ? {
                  id: mapped.id,
                  type: mapped.type,
                  brand: mapped.brand,
                  last4: mapped.last4,
                  label: mapped.label,
                  isDefault: mapped.isDefault,
                }
              : null,
          });
          return mapped;
        })
        .filter(Boolean);

      log(
        'after map (before filter):',
        methods.map((m) => ({
          brand: m.brand,
          last4: m.last4,
          type: m.type,
          isDefault: m.isDefault,
        }))
      );

      // Prefer real cards (any brand with last4). Drop bare Link when cards exist.
      const withDigits = methods.filter((m) => m.last4);
      log(
        'rows with last4:',
        withDigits.length,
        withDigits.map((m) => `${m.brand}:${m.last4}`)
      );

      if (withDigits.length) {
        methods = withDigits;
        log('filter path: KEEP cards with last4 only (drop bare Link)');
      } else {
        methods = methods.filter((m) => {
          const t = String(m.type || '').toLowerCase();
          const b = String(m.brand || '').toLowerCase();
          return t === 'link' || b === 'link';
        });
        log(
          'filter path: NO last4 found — keep Link-only rows if any',
          methods.map((m) => ({ brand: m.brand, type: m.type, last4: m.last4 }))
        );
      }
      if (methods.length && !methods.some((m) => m.isDefault)) {
        const prefer = methods.find((m) => m.last4) || methods[0];
        if (prefer) prefer.isDefault = true;
        log('forced default onto:', prefer?.id, prefer?.brand, prefer?.last4);
      }

      log(
        'FINAL paymentMethods for UI:',
        methods.map((m) => ({
          id: m.id,
          brand: m.brand,
          last4: m.last4,
          type: m.type,
          label: m.label,
          isDefault: m.isDefault,
        }))
      );
      groupEnd();

      return {
        customerId: data?.customerId || data?.customer_id || null,
        paymentMethods: methods,
        defaultPaymentMethodId:
          data?.defaultPaymentMethodId ||
          data?.default_payment_method_id ||
          null,
        message: data?.message || null,
        error: null,
        _meta: data?._meta || null,
      };
    } catch (e) {
      log('EXCEPTION', e?.message || e, e);
      groupEnd();
      console.warn('[billing] getPaymentMethods', e);
      return {
        customerId: null,
        paymentMethods: [],
        defaultPaymentMethodId: null,
        error: e?.message || 'Could not load payment methods.',
      };
    }
  },

  /**
   * Attach a completed Stripe Checkout session to the signed-in account.
   * Call after return from Checkout (?session_id=cs_…) so My Plan / history fill
   * even if the webhook lagged or metadata lacked userId.
   * @param {string} sessionId
   */
  async syncCheckoutSession(sessionId) {
    const id = String(sessionId || '').trim();
    blog('syncCheckoutSession:start', { sessionId: id });
    if (!id.startsWith('cs_')) {
      return { ok: false, error: 'Missing checkout session id.' };
    }
    const base = functionsBaseUrl();
    if (!base) {
      return { ok: false, error: 'Billing is not configured.' };
    }
    try {
      const res = await fetch(`${base}/sync-checkout`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ sessionId: id }),
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      blog('syncCheckoutSession:response', {
        status: res.status,
        ok: res.ok,
        data,
        text: String(text || '').slice(0, 500),
      });
      if (!res.ok) {
        return {
          ok: false,
          error:
            data?.error || data?.message || text || `Sync failed (${res.status})`,
          status: res.status,
        };
      }
      return { ok: true, ...(data || {}) };
    } catch (e) {
      console.warn('[billing] syncCheckoutSession', e);
      return { ok: false, error: e?.message || 'Sync failed' };
    }
  },

  /**
   * Current / most relevant plan for the signed-in user.
   */
  async getMyPlan() {
    blog('getMyPlan:start', {});
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      blog('getMyPlan:user', { userId: user?.id || null, email: user?.email || null });

      const { data, error } = await supabase.rpc('get_my_subscription_plan');
      blog('getMyPlan:rpc', { data, error: error?.message || null });
      if (error) throw error;
      const plan = mapPlan(data);
      blog('getMyPlan:mapped', { plan });
      return plan;
    } catch (err) {
      // Fallback: direct table if RPC missing
      if (/function|schema cache|does not exist/i.test(String(err?.message))) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) return null;
        const { data, error: e2 } = await supabase
          .from('stripe_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        blog('getMyPlan:table_fallback', {
          userId: user.id,
          data,
          error: e2?.message || null,
        });
        if (e2) {
          console.warn('[billing] getMyPlan', e2);
          return null;
        }
        return mapPlan(data);
      }
      console.warn('[billing] getMyPlan', err);
      blog('getMyPlan:error', { message: err?.message || String(err) });
      return null;
    }
  },

  async listMySubscriptions() {
    blog('listMySubscriptions:start', {});
    try {
      const { data, error } = await supabase.rpc('get_my_subscriptions');
      blog('listMySubscriptions:rpc', {
        count: Array.isArray(data) ? data.length : 0,
        data,
        error: error?.message || null,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map(mapPlan).filter(Boolean);
    } catch (err) {
      console.warn('[billing] listMySubscriptions', err);
      return [];
    }
  },

  async getMyHistory(limit = 30) {
    blog('getMyHistory:start', { limit });
    try {
      const { data, error } = await supabase.rpc('get_my_billing_history', {
        limit_n: limit,
      });
      blog('getMyHistory:rpc', {
        count: Array.isArray(data) ? data.length : 0,
        data,
        error: error?.message || null,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const donations = rows.map(mapHistoryRow).filter(Boolean);
      return mergeHistoryWithTokenPurchases(donations, limit);
    } catch (err) {
      if (/function|schema cache|does not exist/i.test(String(err?.message))) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) return [];
        const { data, error: e2 } = await supabase
          .from('donations')
          .select(
            'id, created_at, amount_cents, amount, currency, interval, status, tier_label, tier_id, fund_type, payment_kind, stripe_subscription_id'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);
        blog('getMyHistory:table_fallback', {
          userId: user.id,
          count: data?.length || 0,
          error: e2?.message || null,
        });
        if (e2) {
          console.warn('[billing] getMyHistory', e2);
          return [];
        }
        const donations = (data || []).map((r) =>
          mapHistoryRow({
            ...r,
            is_subscription_charge: Boolean(r.stripe_subscription_id),
          })
        );
        return mergeHistoryWithTokenPurchases(donations, limit);
      }
      console.warn('[billing] getMyHistory', err);
      return [];
    }
  },

  /**
   * Pull latest subscription state from Stripe into our DB (no charge).
   * Use after changing cancel/status in Stripe Dashboard.
   * @param {string} subscriptionId
   */
  async refreshSubscription(subscriptionId) {
    const base = functionsBaseUrl();
    blog('refreshSubscription:start', { subscriptionId });
    if (!base) throw new Error('Billing is not configured.');
    const res = await fetch(`${base}/manage-subscription`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        action: 'refresh',
        subscriptionId,
      }),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    blog('refreshSubscription:response', {
      status: res.status,
      data,
      text: String(text || '').slice(0, 500),
    });
    if (!res.ok) {
      throw new Error(
        data?.error || data?.message || text || `Refresh failed (${res.status})`
      );
    }
    return mapPlan(data?.subscription || data);
  },

  /**
   * Open Stripe Customer Portal (payment methods, invoices, cancel).
   * @param {{ returnUrl?: string, flow?: 'payment_method_update'|null }} [opts]
   */
  async openCustomerPortal(opts = {}) {
    const base = functionsBaseUrl();
    if (!base) {
      throw new Error(
        'Billing portal is not configured. Set VITE_SUPABASE_URL for Edge Functions.'
      );
    }
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const returnUrl =
      opts.returnUrl || `${origin}/account/billing`;

    const res = await fetch(`${base}/create-billing-portal`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        returnUrl,
        flow: opts.flow || null,
      }),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(
        data?.error || data?.message || text || `Portal failed (${res.status})`
      );
      err.code = data?.code || (res.status === 429 ? 'RATE_LIMITED' : 'PORTAL');
      err.status = res.status;
      throw err;
    }
    if (!data?.url) throw new Error('Portal did not return a URL.');
    window.location.assign(data.url);
    return { redirected: true, url: data.url };
  },

  /**
   * Cancel subscription at period end (status updates immediately in UI).
   * @param {string} subscriptionId
   */
  async cancelSubscription(subscriptionId) {
    const base = functionsBaseUrl();
    if (!base) {
      throw new Error('Billing is not configured.');
    }
    const res = await fetch(`${base}/manage-subscription`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        action: 'cancel',
        subscriptionId,
      }),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(
        data?.error || data?.message || text || `Cancel failed (${res.status})`
      );
      err.code = data?.code || (res.status === 429 ? 'RATE_LIMITED' : 'CANCEL');
      err.status = res.status;
      throw err;
    }
    return mapPlan(data?.subscription || data);
  },

  /**
   * Resume a plan that was set to cancel at period end.
   * @param {string} subscriptionId
   */
  async renewSubscription(subscriptionId) {
    const base = functionsBaseUrl();
    if (!base) {
      throw new Error('Billing is not configured.');
    }
    const res = await fetch(`${base}/manage-subscription`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        action: 'renew',
        subscriptionId,
      }),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(
        data?.error || data?.message || text || `Renew failed (${res.status})`
      );
      err.code = data?.code || (res.status === 429 ? 'RATE_LIMITED' : 'RENEW');
      err.status = res.status;
      throw err;
    }
    return mapPlan(data?.subscription || data);
  },
};

export default billingService;
