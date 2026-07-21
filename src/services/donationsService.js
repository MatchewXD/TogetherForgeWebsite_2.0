/**
 * Public support / donation data for Support + Transparency pages.
 * Source of truth: Supabase RPCs (security definer, anonymized).
 * Fallback: localStorage demo ledger when RPCs are not deployed.
 */

import { supabase } from '../lib/supabase';

/**
 * @returns {Promise<{
 *   studioTotalCents: number,
 *   studioPaymentCount: number,
 *   studioMrrCents: number,
 *   studioSubscriberCount: number,
 *   runwayTotalCents: number,
 *   runwayPaymentCount: number,
 *   lastPaymentAt: string|null,
 *   currency: string,
 *   source: 'supabase'|'local'|'empty',
 *   error: string|null
 * }>}
 */
export async function getPublicSupportSummary() {
  try {
    const { data, error } = await supabase.rpc('get_public_support_summary');

    if (error) {
      console.warn('[donations] summary RPC failed', error.message);
      const tableFallback = await sumFromDonationsTable();
      if (tableFallback) return tableFallback;

      const local = sumFromLocalStorage();
      return {
        ...local,
        source:
          local.studioTotalCents > 0 || local.runwayTotalCents > 0
            ? 'local'
            : 'empty',
        error: error.message,
      };
    }

    const row = typeof data === 'object' && data ? data : {};
    const fromRpc = {
      studioTotalCents: Number(row.studio_total_cents) || 0,
      studioPaymentCount: Number(row.studio_payment_count) || 0,
      studioMrrCents: Number(row.studio_mrr_cents) || 0,
      studioSubscriberCount: Number(row.studio_subscriber_count) || 0,
      runwayTotalCents: Number(row.runway_total_cents) || 0,
      runwayPaymentCount: Number(row.runway_payment_count) || 0,
      lastPaymentAt: row.last_payment_at || null,
      currency: row.currency || 'usd',
      source: 'supabase',
      error: null,
    };

    // If DB is empty but this browser just recorded a successful checkout,
    // show local optimistic totals so the page does not stay at $0.
    if (fromRpc.studioTotalCents === 0) {
      const local = sumFromLocalStorage();
      if (local.studioTotalCents > 0) {
        return {
          ...local,
          source: 'local',
          error: null,
        };
      }
    }

    return fromRpc;
  } catch (e) {
    console.error('[donations] getPublicSupportSummary', e);
    const local = sumFromLocalStorage();
    return {
      ...local,
      source: local.studioTotalCents > 0 ? 'local' : 'empty',
      error: e?.message || 'Failed to load support totals',
    };
  }
}

/**
 * Recent anonymized studio donations for social proof.
 * @param {number} [limit=12]
 * @returns {Promise<{
 *   items: Array<{ amountCents: number, createdAt: string, isRecurring: boolean, label: string }>,
 *   source: 'supabase'|'local'|'empty',
 *   error: string|null
 * }>}
 */
export async function getPublicRecentDonations(limit = 12) {
  const lim = Math.min(Math.max(Number(limit) || 12, 1), 20);

  try {
    const { data, error } = await supabase.rpc('get_public_recent_donations', {
      limit_n: lim,
    });

    if (error) {
      console.warn('[donations] recent RPC failed', error.message);
      const local = recentFromLocalStorage(lim);
      return {
        items: local,
        source: local.length ? 'local' : 'empty',
        error: error.message,
      };
    }

    const rows = Array.isArray(data) ? data : [];
    const items = rows.map(mapRecentRow).filter(Boolean);

    if (items.length === 0) {
      const local = recentFromLocalStorage(lim);
      if (local.length) {
        return { items: local, source: 'local', error: null };
      }
    }

    return {
      items,
      source: 'supabase',
      error: null,
    };
  } catch (e) {
    console.error('[donations] getPublicRecentDonations', e);
    const local = recentFromLocalStorage(lim);
    return {
      items: local,
      source: local.length ? 'local' : 'empty',
      error: e?.message || 'Failed to load recent support',
    };
  }
}

function mapRecentRow(row) {
  if (!row) return null;
  const amountCents =
    Number(row.amount_cents) ||
    (row.amount != null ? Math.round(Number(row.amount) * 100) : 0);
  if (!amountCents) return null;
  return {
    amountCents,
    createdAt: row.created_at || row.createdAt || null,
    isRecurring: Boolean(row.is_recurring ?? row.interval === 'month'),
    label: 'Anonymous Supporter',
  };
}

async function sumFromDonationsTable() {
  try {
    const { data, error } = await supabase
      .from('donations')
      .select(
        'amount_cents, amount, fund_type, status, created_at, interval, stripe_subscription_id'
      );

    if (error || !data) return null;

    let studioTotalCents = 0;
    let studioPaymentCount = 0;
    let runwayTotalCents = 0;
    let runwayPaymentCount = 0;
    let lastPaymentAt = null;
    const subLatest = new Map();

    for (const row of data) {
      const st = row.status || 'completed';
      if (!['completed', 'paid', 'succeeded'].includes(st)) continue;
      const cents =
        Number(row.amount_cents) ||
        (row.amount != null ? Math.round(Number(row.amount) * 100) : 0);
      if (!cents) continue;

      if (row.fund_type === 'runway') {
        runwayTotalCents += cents;
        runwayPaymentCount += 1;
      } else {
        studioTotalCents += cents;
        studioPaymentCount += 1;
        if (
          row.interval === 'month' &&
          row.stripe_subscription_id
        ) {
          const prev = subLatest.get(row.stripe_subscription_id);
          if (!prev || (row.created_at && row.created_at > prev.at)) {
            subLatest.set(row.stripe_subscription_id, {
              cents,
              at: row.created_at || '',
            });
          }
        }
      }
      if (
        row.created_at &&
        (!lastPaymentAt || row.created_at > lastPaymentAt)
      ) {
        lastPaymentAt = row.created_at;
      }
    }

    let studioMrrCents = 0;
    for (const v of subLatest.values()) studioMrrCents += v.cents;

    return {
      studioTotalCents,
      studioPaymentCount,
      studioMrrCents,
      studioSubscriberCount: subLatest.size,
      runwayTotalCents,
      runwayPaymentCount,
      lastPaymentAt,
      currency: 'usd',
      source: 'supabase',
      error: null,
    };
  } catch {
    return null;
  }
}

function sumFromLocalStorage() {
  const studio = readLocalList('tf_donations');
  const runway = readLocalList('tf_runway_donations');

  const sum = (list) =>
    list.reduce((acc, d) => {
      if (d.amountCents) return acc + Number(d.amountCents);
      return acc + Math.round((Number(d.amount) || 0) * 100);
    }, 0);

  const mrr = studio
    .filter((d) => d.interval === 'month')
    .reduce((acc, d) => {
      if (d.amountCents) return acc + Number(d.amountCents);
      return acc + Math.round((Number(d.amount) || 0) * 100);
    }, 0);

  return {
    studioTotalCents: sum(studio),
    studioPaymentCount: studio.length,
    studioMrrCents: mrr,
    studioSubscriberCount: studio.filter((d) => d.interval === 'month').length,
    runwayTotalCents: sum(runway),
    runwayPaymentCount: runway.length,
    lastPaymentAt: studio[0]?.timestamp || runway[0]?.timestamp || null,
    currency: 'usd',
  };
}

function recentFromLocalStorage(limit) {
  const studio = readLocalList('tf_donations');
  return studio.slice(0, limit).map((d) => ({
    amountCents:
      Number(d.amountCents) || Math.round((Number(d.amount) || 0) * 100),
    createdAt: d.timestamp || null,
    isRecurring: d.interval === 'month',
    label: 'Anonymous Supporter',
  }));
}

function readLocalList(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/** Relative time for feed display */
export function formatTimeAgo(iso) {
  if (!iso) return 'Recently';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'Recently';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  const yr = Math.floor(day / 365);
  return `${yr} year${yr === 1 ? '' : 's'} ago`;
}

export function formatUsdFromCents(cents) {
  const n = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export default {
  getPublicSupportSummary,
  getPublicRecentDonations,
  formatTimeAgo,
  formatUsdFromCents,
};
