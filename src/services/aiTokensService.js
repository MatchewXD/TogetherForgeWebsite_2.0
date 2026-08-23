/**
 * AI Tokens client helpers (Phase 1 foundation).
 * Purchases use a dedicated Edge Function — never the donation checkout path
 * for token packs (though sync-checkout can fulfill either kind by metadata).
 *
 * User-facing data never includes API cost or margins.
 */

import { supabase } from '../lib/supabase';
import {
  AI_TOKEN_PACKS,
  AI_SERVICES_DISABLED_MESSAGE,
  AI_NEED_MORE_TOKENS_MESSAGE,
  getTokenPack,
  getActionBaseCost,
} from '../constants/aiTokens';
import {
  areDonationsEnabled,
  DONATIONS_PAUSED_CODE,
  DONATIONS_PAUSED_ERROR,
} from '../constants/donationsEnabled';

function functionsBase() {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (base && String(base).trim()) {
    return `${String(base).replace(/\/$/, '')}/functions/v1`;
  }
  return '';
}

export function getTokenCheckoutApiUrl() {
  const explicit = import.meta.env.VITE_AI_TOKEN_CHECKOUT_API_URL;
  if (explicit && String(explicit).trim()) {
    return String(explicit).replace(/\/$/, '');
  }
  const base = functionsBase();
  return base ? `${base}/create-token-checkout` : '';
}

export function getAiTokenStatusApiUrl() {
  const explicit = import.meta.env.VITE_AI_TOKEN_STATUS_API_URL;
  if (explicit && String(explicit).trim()) {
    return String(explicit).replace(/\/$/, '');
  }
  const base = functionsBase();
  return base ? `${base}/ai-token-status` : '';
}

async function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anon) headers.apikey = anon;
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

/**
 * @returns {Promise<{
 *   balance: number|null,
 *   servicesEnabled: boolean,
 *   platformEnabled: boolean,
 *   disabledMessage: string|null,
 *   packs: Array,
 *   tokensPerUsd: number,
 * }>}
 */
export async function fetchAiTokenStatus() {
  const url = getAiTokenStatusApiUrl();
  if (url) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const platformEnabled = data.platformEnabled !== false;
        return {
          balance: data.balance == null ? null : Number(data.balance) || 0,
          lifetime: data.lifetime || null,
          // Generation-ready (platform + provider). UI gating uses platformEnabled.
          servicesEnabled: data.servicesEnabled === true,
          platformEnabled,
          providerReady: data.providerReady !== false,
          disabledReason: platformEnabled ? null : data.disabledReason || null,
          disabledMessage: platformEnabled
            ? null
            : data.disabledMessage || AI_SERVICES_DISABLED_MESSAGE,
          // Always the published 50k/$1 packs — never a stale Edge list (250/700/1600)
          packs: AI_TOKEN_PACKS,
          tokensPerUsd: data.tokensPerUsd || 50_000,
          caps: data.caps || null,
          signedIn: Boolean(data.signedIn),
        };
      }
    } catch (e) {
      console.warn('[aiTokensService] status edge', e?.message || e);
    }
  }

  // Fallback: direct RPCs (balance + availability)
  let balance = null;
  let lifetime = null;
  try {
    const { data, error } = await supabase.rpc('get_my_ai_token_balance');
    if (!error && data) {
      balance = Number(data.balance) || 0;
      lifetime = {
        purchased: Number(data.lifetime_purchased) || 0,
        spent: Number(data.lifetime_spent) || 0,
        awarded: Number(data.lifetime_awarded) || 0,
        updatedAt: data.updated_at || null,
      };
    }
  } catch {
    /* guest */
  }

  let platformEnabled = true;
  let disabledMessage = null;
  let disabledReason = null;
  try {
    const { data, error } = await supabase.rpc('get_ai_service_availability');
    if (!error && data) {
      platformEnabled = data.enabled !== false;
      disabledReason = data.reason || null;
      disabledMessage = data.message || null;
    }
  } catch {
    /* ignore */
  }

  return {
    balance,
    lifetime,
    servicesEnabled: platformEnabled,
    platformEnabled,
    disabledReason,
    disabledMessage: platformEnabled
      ? null
      : disabledMessage || AI_SERVICES_DISABLED_MESSAGE,
    packs: AI_TOKEN_PACKS,
    tokensPerUsd: 50_000,
    caps: null,
    signedIn: balance != null,
  };
}

export async function fetchMyTokenBalance() {
  const { data, error } = await supabase.rpc('get_my_ai_token_balance');
  if (error) throw error;
  return {
    balance: Number(data?.balance) || 0,
    lifetimePurchased: Number(data?.lifetime_purchased) || 0,
    lifetimeSpent: Number(data?.lifetime_spent) || 0,
    lifetimeAwarded: Number(data?.lifetime_awarded) || 0,
    updatedAt: data?.updated_at || null,
  };
}

export async function fetchMyTokenLedger(limit = 50) {
  const { data, error } = await supabase.rpc('get_my_ai_token_ledger', {
    p_limit: limit,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchMyTokenPurchases(limit = 20) {
  const { data, error } = await supabase.rpc('get_my_ai_token_purchases', {
    p_limit: limit,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/**
 * Start Stripe Checkout for a token pack. Requires sign-in.
 * @param {{ packId: string, successUrl?: string, cancelUrl?: string }} opts
 */
export async function startTokenPackCheckout({
  packId,
  successUrl,
  cancelUrl,
}) {
  if (!areDonationsEnabled()) {
    return {
      ok: false,
      error: DONATIONS_PAUSED_ERROR,
      code: DONATIONS_PAUSED_CODE,
    };
  }
  const pack = getTokenPack(packId);
  if (!pack) {
    return { ok: false, error: 'Choose a valid token pack.' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return { ok: false, error: 'Sign in to buy AI tokens.' };
  }

  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const success =
    successUrl ||
    `${origin}/account/ai-tokens?tokens=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancel =
    cancelUrl || `${origin}/account/ai-tokens?tokens=cancelled`;

  const url = getTokenCheckoutApiUrl();
  if (!url) {
    return {
      ok: false,
      error:
        'Token checkout is not configured (missing VITE_SUPABASE_URL).',
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        packId: pack.id,
        successUrl: success,
        cancelUrl: cancel,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || `Checkout failed (${res.status})`,
        code: data.code || null,
      };
    }
    if (!data.url) {
      return { ok: false, error: 'Checkout did not return a URL.' };
    }
    if (data.sessionId && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem('tf_last_token_checkout_session', data.sessionId);
        sessionStorage.setItem('tf_last_checkout_session', data.sessionId);
      } catch {
        /* ignore */
      }
    }
    return {
      ok: true,
      url: data.url,
      sessionId: data.sessionId,
      packId: pack.id,
      tokens: data.tokens ?? pack.tokens,
    };
  } catch (e) {
    return { ok: false, error: e?.message || 'Checkout failed.' };
  }
}

/**
 * After returning from Stripe, attach/credit tokens if webhook lagged.
 */
export async function syncTokenCheckoutSession(sessionId) {
  const sid = String(sessionId || '').trim();
  if (!sid.startsWith('cs_')) return { ok: false, error: 'Invalid session.' };

  const base = functionsBase();
  if (!base) return { ok: false, error: 'Not configured.' };

  try {
    const res = await fetch(`${base}/sync-checkout`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ sessionId: sid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'Sync failed.' };
    }
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: e?.message || 'Sync failed.' };
  }
}

/**
 * Helper for future AI UI: whether the user may start an action.
 * Uses base cost when actionKey is provided. Does not reveal the base
 * price number to the user (hybrid rule: no token price before run).
 *
 * @param {object|null} status - from fetchAiTokenStatus
 * @param {number|string} [tokensRequiredOrActionKey] - base tokens or action key
 */
export function canUseAiAction(status, tokensRequiredOrActionKey) {
  if (!status) {
    return {
      ok: false,
      message: AI_SERVICES_DISABLED_MESSAGE,
      code: 'UNKNOWN',
    };
  }
  if (status.servicesEnabled === false || status.platformEnabled === false) {
    return {
      ok: false,
      message: status.disabledMessage || AI_SERVICES_DISABLED_MESSAGE,
      code: status.disabledReason || 'AI_DISABLED',
    };
  }

  let need = 0;
  if (typeof tokensRequiredOrActionKey === 'string') {
    need = getActionBaseCost(tokensRequiredOrActionKey);
  } else {
    need = Math.max(0, Number(tokensRequiredOrActionKey) || 0);
  }

  const bal = Number(status.balance);
  if (need > 0 && Number.isFinite(bal) && bal < need) {
    return {
      ok: false,
      message: AI_NEED_MORE_TOKENS_MESSAGE,
      code: 'INSUFFICIENT_TOKENS',
    };
  }
  return { ok: true, message: null, code: null };
}

export const aiTokensService = {
  fetchAiTokenStatus,
  fetchMyTokenBalance,
  fetchMyTokenLedger,
  fetchMyTokenPurchases,
  startTokenPackCheckout,
  syncTokenCheckoutSession,
  canUseAiAction,
  getTokenPack,
};

export default aiTokensService;
