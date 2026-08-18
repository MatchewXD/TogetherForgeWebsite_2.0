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

  if (payload.website) return { ok: true };

  const base = functionsBase();
  let functionError = '';
  if (base) {
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
      if (res.status === 400 && data.error) {
        return { ok: false, error: data.error };
      }
      functionError = data.error || `Could not send report (${res.status}).`;
    } catch (e) {
      console.warn('[reportConcernService]', e?.message || e);
      functionError = 'Could not reach the report service.';
    }
  }

  const stored = await persistConcernLocally(payload);
  if (stored.ok) return { ok: true };

  return {
    ok: false,
    error:
      functionError ||
      stored.error ||
      'Could not send report. Please try again later.',
  };
}

async function persistConcernLocally(payload) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('concern_reports').insert({
      what_happened: payload.whatHappened,
      where_happened: payload.whereHappened,
      reference: payload.reference,
      contact: payload.contact,
      user_id: user?.id || null,
    });
    if (error) {
      if (/relation|does not exist|PGRST205|42P01|schema cache/i.test(
        String(error.message || error.code || '')
      )) {
        return { ok: false, error: 'Reporting is not set up on this database yet.' };
      }
      return { ok: false, error: error.message || 'Could not save report.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not save report.' };
  }
}

export default { submitConcernReport };
