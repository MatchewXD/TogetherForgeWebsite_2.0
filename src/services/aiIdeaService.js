/**
 * Client for Idea Structuring + Gap Filling Edge Functions.
 */

import { supabase } from '../lib/supabase';
import {
  AI_SERVICES_DISABLED_MESSAGE,
  AI_NEED_MORE_TOKENS_MESSAGE,
} from '../constants/aiTokens';

function functionsBase() {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (base && String(base).trim()) {
    return `${String(base).replace(/\/$/, '')}/functions/v1`;
  }
  return '';
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

function mapError(data, status) {
  const code = data?.code || (status === 429 ? 'RATE_LIMITED' : null);
  let message =
    data?.error ||
    data?.message ||
    (status === 401
      ? 'Sign in to use AI features.'
      : status === 503
        ? AI_SERVICES_DISABLED_MESSAGE
        : status === 402
          ? AI_NEED_MORE_TOKENS_MESSAGE
          : 'Request failed. Please try again.');
  if (code === 'INSUFFICIENT_TOKENS') message = AI_NEED_MORE_TOKENS_MESSAGE;
  if (code === 'AI_DISABLED' || code === 'RATE_LIMITED') {
    message = data?.error || AI_SERVICES_DISABLED_MESSAGE;
  }
  return {
    ok: false,
    error: message,
    code,
    retryable: Boolean(data?.retryable) || status >= 500 || status === 429,
  };
}

/**
 * @param {string} freeformText
 */
export async function runIdeaStructuring(freeformText) {
  const url = `${functionsBase()}/idea-structure`;
  if (!url || url.endsWith('/idea-structure') === false && !functionsBase()) {
    return { ok: false, error: 'AI service is not configured.' };
  }
  if (!functionsBase()) {
    return { ok: false, error: 'AI service is not configured.' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return {
      ok: false,
      error: 'Sign in to use Idea Structuring.',
      code: 'AUTH_REQUIRED',
    };
  }

  try {
    const res = await fetch(`${functionsBase()}/idea-structure`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        freeformText: String(freeformText || '').trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return mapError(data, res.status);
    return {
      ok: true,
      fields: data.fields || {},
      tokensCharged: data.tokensCharged,
      balanceAfter: data.balanceAfter,
    };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || 'Network error. Please try again.',
      retryable: true,
    };
  }
}

/**
 * Build idea payload for gap-fill from form state.
 */
export function ideaSnapshotFromForm(form = {}) {
  return {
    title: form.title || '',
    category: form.category || '',
    summary: form.summary || '',
    description: form.description || '',
    tags: form.tags || '',
    artStyle: form.artStyle,
    targetPlatforms: form.targetPlatforms,
    coreLoopLength: form.coreLoopLength,
    primaryInspiration: form.primaryInspiration,
    estimatedScope: form.estimatedScope,
    twitchIntegration: form.twitchIntegration,
    environmentalStorytelling: form.environmentalStorytelling,
    economySystem: form.economySystem,
    storyNarrative: form.storyNarrative,
    features: form.features,
    additionalNotes: form.additionalNotes,
  };
}

/**
 * @param {object} idea - form snapshot
 * @param {string[]} [sparseKeys]
 */
export async function runIdeaGapFill(idea, sparseKeys) {
  if (!functionsBase()) {
    return { ok: false, error: 'AI service is not configured.' };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return {
      ok: false,
      error: 'Sign in to use Gap Filling.',
      code: 'AUTH_REQUIRED',
    };
  }

  try {
    const res = await fetch(`${functionsBase()}/idea-gap-fill`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        idea: ideaSnapshotFromForm(idea),
        sparseKeys: Array.isArray(sparseKeys) ? sparseKeys : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return mapError(data, res.status);
    return {
      ok: true,
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      message: data.message || null,
      tokensCharged: data.tokensCharged,
      balanceAfter: data.balanceAfter,
    };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || 'Network error. Please try again.',
      retryable: true,
    };
  }
}

export const aiIdeaService = {
  runIdeaStructuring,
  runIdeaGapFill,
  ideaSnapshotFromForm,
};

export default aiIdeaService;
