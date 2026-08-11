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

async function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anon) {
    headers.apikey = anon;
  }
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || anon;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    if (anon) headers.Authorization = `Bearer ${anon}`;
  }
  return headers;
}

function mapPlan(raw) {
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
  if (endLabel) {
    if (canceling || String(raw.status).toLowerCase() === 'canceled') {
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

function mapHistoryRow(row) {
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
  };
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
   * Current / most relevant plan for the signed-in user.
   */
  async getMyPlan() {
    try {
      const { data, error } = await supabase.rpc('get_my_subscription_plan');
      if (error) throw error;
      return mapPlan(data);
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
        if (e2) {
          console.warn('[billing] getMyPlan', e2);
          return null;
        }
        return mapPlan(data);
      }
      console.warn('[billing] getMyPlan', err);
      return null;
    }
  },

  async listMySubscriptions() {
    try {
      const { data, error } = await supabase.rpc('get_my_subscriptions');
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map(mapPlan).filter(Boolean);
    } catch (err) {
      console.warn('[billing] listMySubscriptions', err);
      return [];
    }
  },

  async getMyHistory(limit = 30) {
    try {
      const { data, error } = await supabase.rpc('get_my_billing_history', {
        limit_n: limit,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map(mapHistoryRow).filter(Boolean);
    } catch (err) {
      if (/function|schema cache|does not exist/i.test(String(err?.message))) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) return [];
        const { data, error: e2 } = await supabase
          .from('donations')
          .select(
            'id, created_at, amount_cents, amount, currency, interval, status, tier_label, payment_kind, stripe_subscription_id'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (e2) {
          console.warn('[billing] getMyHistory', e2);
          return [];
        }
        return (data || []).map((r) =>
          mapHistoryRow({
            ...r,
            is_subscription_charge: Boolean(r.stripe_subscription_id),
          })
        );
      }
      console.warn('[billing] getMyHistory', err);
      return [];
    }
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
      throw new Error(
        data?.error || data?.message || text || `Portal failed (${res.status})`
      );
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
      throw new Error(
        data?.error || data?.message || text || `Cancel failed (${res.status})`
      );
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
      throw new Error(
        data?.error || data?.message || text || `Renew failed (${res.status})`
      );
    }
    return mapPlan(data?.subscription || data);
  },
};

export default billingService;
