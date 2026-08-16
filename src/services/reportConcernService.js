/**
 * Private “Report a concern” submissions.
 * Edge Function emails staff only — nothing is stored publicly.
 */
import { supabase } from '../lib/supabase';

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
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || anon;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    if (anon) headers.Authorization = `Bearer ${anon}`;
  }
  return headers;
}

/**
 * @param {object} form
 * @param {string} form.whatHappened
 * @param {'discord'|'website'|'both'} form.whereHappened
 * @param {string} [form.reference]
 * @param {string} [form.contact]
 * @param {string} [form.honeypot] must stay empty
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function submitConcernReport(form) {
  const payload = {
    whatHappened: String(form.whatHappened || '').trim(),
    whereHappened: String(form.whereHappened || '').trim().toLowerCase(),
    reference: String(form.reference || '').trim() || null,
    contact: String(form.contact || '').trim() || null,
    // Honeypot — bots fill this; real users leave empty
    website: String(form.honeypot || form.website || '').trim(),
  };

  const base = functionsBase();
  if (!base) {
    return {
      ok: false,
      error:
        'Reporting is not available on this environment yet. Please try again later.',
    };
  }

  try {
    const res = await fetch(`${base}/submit-concern-report`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok !== false) {
      return { ok: true };
    }
    if (res.status === 429) {
      return {
        ok: false,
        error:
          data.error ||
          'Too many reports from this network. Please wait a bit and try again.',
      };
    }
    return {
      ok: false,
      error: data.error || 'Could not send report. Please try again later.',
    };
  } catch (e) {
    console.warn('[reportConcernService]', e?.message || e);
    return {
      ok: false,
      error: 'Could not send report. Please try again later.',
    };
  }
}

export default { submitConcernReport };
