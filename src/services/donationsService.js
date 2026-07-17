/**
 * Public support / donation aggregates for Transparency Hub.
 * Source of truth: Supabase donations via get_public_support_summary() RPC
 * (written by Stripe webhook). Falls back to localStorage demo ledger.
 */

import { supabase } from '../lib/supabase';

/**
 * @returns {Promise<{
 *   studioTotalCents: number,
 *   studioPaymentCount: number,
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
      // RPC missing: try direct anonymized-friendly query (may fail RLS)
      console.warn('[donations] RPC failed, trying table fallback', error.message);
      const tableFallback = await sumFromDonationsTable();
      if (tableFallback) return tableFallback;

      const local = sumFromLocalStorage();
      return {
        ...local,
        source: local.studioTotalCents > 0 || local.runwayTotalCents > 0 ? 'local' : 'empty',
        error: error.message,
      };
    }

    const row = typeof data === 'object' && data ? data : {};
    return {
      studioTotalCents: Number(row.studio_total_cents) || 0,
      studioPaymentCount: Number(row.studio_payment_count) || 0,
      runwayTotalCents: Number(row.runway_total_cents) || 0,
      runwayPaymentCount: Number(row.runway_payment_count) || 0,
      lastPaymentAt: row.last_payment_at || null,
      currency: row.currency || 'usd',
      source: 'supabase',
      error: null,
    };
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

async function sumFromDonationsTable() {
  try {
    const { data, error } = await supabase
      .from('donations')
      .select('amount_cents, amount, fund_type, status, created_at');

    if (error || !data) return null;

    let studioTotalCents = 0;
    let studioPaymentCount = 0;
    let runwayTotalCents = 0;
    let runwayPaymentCount = 0;
    let lastPaymentAt = null;

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
      }
      if (
        row.created_at &&
        (!lastPaymentAt || row.created_at > lastPaymentAt)
      ) {
        lastPaymentAt = row.created_at;
      }
    }

    return {
      studioTotalCents,
      studioPaymentCount,
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

  return {
    studioTotalCents: sum(studio),
    studioPaymentCount: studio.length,
    runwayTotalCents: sum(runway),
    runwayPaymentCount: runway.length,
    lastPaymentAt: studio[0]?.timestamp || runway[0]?.timestamp || null,
    currency: 'usd',
  };
}

function readLocalList(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export default {
  getPublicSupportSummary,
};
