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

export default { submitVolunteerApplication };
