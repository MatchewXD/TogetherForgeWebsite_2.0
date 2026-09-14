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

export const OPEN_CONCERN_STATUSES = ['new', 'reviewing'];

export const CONCERN_STATUSES = ['new', 'reviewing', 'closed'];

export const CONCERN_STATUS_LABELS = {
  new: 'New',
  reviewing: 'Reviewing',
  closed: 'Closed',
};

export const CONCERN_WHERE_LABELS = {
  discord: 'Discord',
  website: 'Website',
  both: 'Both',
};

function mapConcern(row) {
  if (!row) return null;
  return {
    id: row.id,
    whatHappened: row.what_happened || '',
    whereHappened: row.where_happened || '',
    reference: row.reference || null,
    contact: row.contact || null,
    userId: row.user_id || null,
    status: row.status || 'new',
    createdAt: row.created_at || null,
  };
}

function isMissingTable(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /concern_reports|relation .* does not exist|schema cache/i.test(msg)
  );
}

/**
 * Founder: private concern reports. Not public. Not the Reports tab.
 * @param {{ status?: string, limit?: number }} [opts]
 */
export async function listConcernReports(opts = {}) {
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 80));
  let q = supabase
    .from('concern_reports')
    .select(
      'id, what_happened, where_happened, reference, contact, user_id, status, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts.status === 'open') {
    q = q.in('status', OPEN_CONCERN_STATUSES);
  } else if (opts.status && opts.status !== 'all') {
    q = q.eq('status', opts.status);
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) {
      const err = new Error(
        'Concern reports are not set up yet. Run supabase/sql/supabase_concern_reports.sql.'
      );
      err.code = 'MISSING_TABLE';
      throw err;
    }
    throw new Error(error.message || 'Could not load concern reports.');
  }
  return (data || []).map(mapConcern);
}

export async function updateConcernReportStatus(id, status) {
  if (!id) throw new Error('Report not found.');
  if (!CONCERN_STATUSES.includes(status)) {
    throw new Error('Invalid status.');
  }
  const { data, error } = await supabase
    .from('concern_reports')
    .update({ status })
    .eq('id', id)
    .select(
      'id, what_happened, where_happened, reference, contact, user_id, status, created_at'
    )
    .single();
  if (error) throw new Error(error.message || 'Could not update report.');
  return mapConcern(data);
}

export default { submitConcernReport };
