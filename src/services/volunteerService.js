/**
 * Get Involved volunteer applications (private queue).
 * Prefers Edge Function (Discord webhook + service insert); falls back to direct insert.
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
 * @returns {Promise<{ ok: boolean, error?: string, id?: string }>}
 */
export async function submitVolunteerApplication(form) {
  const openNeedTitle = String(form.openNeedTitle || '').trim() || null;
  const openNeedId = form.openNeedId || null;
  // Prefix description for staff visibility when opened from an Open Need card
  let description = String(form.description || '').trim();
  if (openNeedTitle) {
    description = `[Related Open Need: ${openNeedTitle}]\n\n${description}`;
  }

  const payload = {
    applicationType: form.applicationType || 'skill_offer',
    handle: String(form.handle || '').trim(),
    email: String(form.email || '').trim() || null,
    discordUsername: String(form.discordUsername || '').trim() || null,
    skillAreas: Array.isArray(form.skillAreas) ? form.skillAreas : [],
    skillOther: String(form.skillOther || '').trim() || null,
    roleId: form.roleId || null,
    openNeedId,
    openNeedTitle,
    description,
    timeCommitment: form.timeCommitment || null,
    portfolioUrl: String(form.portfolioUrl || '').trim() || null,
  };

  // Prefer Edge Function (webhook + robust insert)
  const base = functionsBase();
  if (base) {
    try {
      const res = await fetch(`${base}/submit-volunteer-application`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) {
        return { ok: true, id: data.id || null, warning: data.warning || null };
      }
      if (res.status === 403 || /VOLUNTEER_APPLY_BLOCKED|cannot submit volunteer/i.test(data.error || '')) {
        return { ok: false, error: VOLUNTEER_APPLY_BLOCKED_LINE };
      }
      if (data.error) {
        // Fall through to direct insert only on transport/server config issues
        if (res.status === 400) {
          return { ok: false, error: data.error };
        }
      }
    } catch (e) {
      console.warn('[volunteerService] edge', e?.message || e);
    }
  }

  // Direct insert (works once SQL applied; no Discord notify)
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from('volunteer_applications')
      .insert({
        application_type: payload.applicationType,
        handle: payload.handle,
        email: payload.email,
        discord_username: payload.discordUsername,
        skill_areas: payload.skillAreas,
        skill_other: payload.skillOther,
        role_id: payload.roleId,
        open_need_id: payload.openNeedId,
        description: payload.description,
        time_commitment: payload.timeCommitment,
        portfolio_url: payload.portfolioUrl,
        user_id: session?.user?.id || null,
        status: 'new',
      })
      .select('id')
      .maybeSingle();

    if (error) {
      if (isVolunteerBlockedError(error)) {
        return { ok: false, error: VOLUNTEER_APPLY_BLOCKED_LINE };
      }
      if (/relation|does not exist|schema cache|permission/i.test(error.message || '')) {
        return {
          ok: false,
          error:
            'Volunteer applications are not set up on this environment yet. Please join Discord and message a coordinator, or try again later.',
        };
      }
      return { ok: false, error: error.message || 'Could not submit.' };
    }
    return { ok: true, id: data?.id || null };
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not submit.' };
  }
}

export const OPEN_VOLUNTEER_STATUSES = ['new', 'reviewing'];

export const VOLUNTEER_STATUSES = [
  'new',
  'reviewing',
  'contacted',
  'accepted',
  'declined',
  'archived',
];

export const VOLUNTEER_STATUS_LABELS = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  accepted: 'Accepted',
  declined: 'Declined',
  archived: 'Archived',
};

export const VOLUNTEER_APPLY_BLOCKED_LINE =
  'This contact cannot submit volunteer applications right now.';

export function normalizeVolunteerEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function normalizeVolunteerDiscord(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

export function applicationMatchesBlock(app, block) {
  if (!app || !block || block.active === false) return false;
  if (block.userId && app.userId && block.userId === app.userId) return true;
  const email = normalizeVolunteerEmail(app.email);
  if (block.email && email && block.email === email) return true;
  const discord = normalizeVolunteerDiscord(app.discordUsername);
  if (block.discordUsername && discord && block.discordUsername === discord) {
    return true;
  }
  return false;
}

function isVolunteerBlockedError(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  return (
    code === 'P0001' ||
    /VOLUNTEER_APPLY_BLOCKED/i.test(msg)
  );
}

function mapApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    applicationType: row.application_type,
    handle: row.handle || '',
    email: row.email || null,
    discordUsername: row.discord_username || null,
    skillAreas: Array.isArray(row.skill_areas) ? row.skill_areas : [],
    skillOther: row.skill_other || null,
    roleId: row.role_id || null,
    openNeedId: row.open_need_id || null,
    description: row.description || '',
    timeCommitment: row.time_commitment || null,
    portfolioUrl: row.portfolio_url || null,
    userId: row.user_id || null,
    status: row.status || 'new',
    staffNotes: row.staff_notes || '',
    createdAt: row.created_at || null,
  };
}

function isMissingTable(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /volunteer_applications|volunteer_apply_blocks|relation .* does not exist|schema cache/i.test(
      msg
    )
  );
}

/**
 * Staff: private Get Involved applications.
 * @param {{ status?: string, limit?: number }} [opts]
 */
export async function listVolunteerApplications(opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 80));
  let q = supabase
    .from('volunteer_applications')
    .select(
      'id, application_type, handle, email, discord_username, skill_areas, skill_other, role_id, open_need_id, description, time_commitment, portfolio_url, user_id, status, staff_notes, created_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts.status === 'open') {
    q = q.in('status', OPEN_VOLUNTEER_STATUSES);
  } else if (opts.status && opts.status !== 'all') {
    q = q.eq('status', opts.status);
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) {
      const err = new Error(
        'Volunteer applications are not set up yet. Run supabase/sql/supabase_volunteer_applications.sql.'
      );
      err.code = 'MISSING_TABLE';
      throw err;
    }
    throw new Error(error.message || 'Could not load volunteer applications.');
  }
  return (data || []).map(mapApplication);
}

export async function updateVolunteerApplicationStatus(id, status) {
  if (!id) throw new Error('Application not found.');
  if (!VOLUNTEER_STATUSES.includes(status)) {
    throw new Error('Invalid status.');
  }
  const { data, error } = await supabase
    .from('volunteer_applications')
    .update({ status })
    .eq('id', id)
    .select(
      'id, application_type, handle, email, discord_username, skill_areas, skill_other, role_id, open_need_id, description, time_commitment, portfolio_url, user_id, status, staff_notes, created_at, updated_at'
    )
    .single();
  if (error) throw new Error(error.message || 'Could not update application.');
  return mapApplication(data);
}

function mapBlock(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || null,
    email: row.email || null,
    discordUsername: row.discord_username || null,
    reason: row.reason || '',
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    active: row.active !== false,
  };
}

export async function listVolunteerApplyBlocks() {
  const { data, error } = await supabase
    .from('volunteer_apply_blocks')
    .select(
      'id, user_id, email, discord_username, reason, created_by, created_at, active'
    )
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message || 'Could not load application blocks.');
  }
  return (data || []).map(mapBlock);
}

export async function blockVolunteerApplicant(app, reason = '') {
  if (!app) throw new Error('Application not found.');
  const { data, error } = await supabase.rpc('staff_block_volunteer_applicant', {
    p_user_id: app.userId || null,
    p_email: app.email || null,
    p_discord: app.discordUsername || null,
    p_reason: reason || null,
  });
  if (error) {
    throw new Error(error.message || 'Could not block this applicant.');
  }
  return data;
}

export async function unblockVolunteerApplicant(blockId) {
  if (!blockId) throw new Error('Block not found.');
  const { error } = await supabase
    .from('volunteer_apply_blocks')
    .update({ active: false })
    .eq('id', blockId);
  if (error) throw new Error(error.message || 'Could not lift this block.');
  return true;
}

export default { submitVolunteerApplication };
