/**
 * Staff Grant Credit: off-site help on the same public memorial ledger as tasks.
 * RPCs: search_members_for_credit, grant_staff_credit, update_staff_credit,
 * revoke_staff_credit. Does not complete tasks or touch donation ledgers.
 */

import { supabase } from '../lib/supabase';
import { asUserError, isMissingRpcError } from '../utils/abuseErrors';
import {
  STAFF_CREDIT_CATEGORIES,
  STAFF_CREDIT_NOTE_MAX,
  STAFF_CREDIT_PENDING_LABEL,
  STAFF_CREDIT_PUBLIC_MAX,
  STAFF_CREDIT_STUDIO_ID,
  looksLikeEmail,
  staffCreditCategoryById,
} from '../constants/staffCredit';
import { getBadgeDef } from '../constants/badges';
import { listContributorProjects } from './contributorsService';

export {
  STAFF_CREDIT_CATEGORIES,
  STAFF_CREDIT_NOTE_MAX,
  STAFF_CREDIT_PUBLIC_MAX,
  STAFF_CREDIT_STUDIO_ID,
};

const MISSING_SQL =
  'Grant Credit is not installed yet. Run supabase/sql/supabase_staff_credit.sql in the Supabase SQL Editor.';

function isMissingTable(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || error.details || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /does not exist|schema cache|could not find the table/i.test(msg)
  );
}

export function isStaffCreditMissing(error) {
  return isMissingTable(error) || isMissingRpcError(error);
}

function staffCreditError(error, fallback) {
  const raw = String(error?.message || error?.details || error?.hint || '');
  if (isStaffCreditMissing(error)) {
    const err = new Error(MISSING_SQL);
    err.code = 'MISSING_SQL';
    err.cause = error;
    return err;
  }
  if (/STAFF_ONLY/i.test(raw)) {
    return new Error('Only staff and moderators can grant credit.');
  }
  if (
    /Public credit line|Staff note|Pick a member|enter an email|not found|too long|revoke|3–160|3-160/i.test(
      raw
    )
  ) {
    return new Error(raw.replace(/^ERROR:\s*/i, '').split('\n')[0]);
  }
  return asUserError(error, fallback);
}

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parsePoints(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Points must be a whole number of 0 or more.');
  }
  const whole = Math.floor(n);
  return whole === 0 ? null : whole;
}

function parseBadgeKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  if (key === 'status_active_subscriber') {
    throw new Error(
      'Active Subscriber is tied to a live subscription. Pick another badge.'
    );
  }
  if (!getBadgeDef(key)) {
    throw new Error('Pick a badge from the current catalog.');
  }
  return key;
}

function mapMember(row) {
  if (!row) return null;
  const id = row.id;
  if (!id) return null;
  return {
    id,
    username: row.username || null,
    email: row.email || null,
    avatarUrl: row.avatarUrl || row.avatar_url || null,
    pinnedBadgeKey: row.pinnedBadgeKey || row.pinned_badge_key || null,
  };
}

function mapGrant(row) {
  if (!row) return null;
  const user = row.user || row.profiles || null;
  const project = row.project || row.projects || null;
  const granter = row.granter || null;
  const pending = !row.user_id;
  return {
    id: row.id,
    contributionId: row.contribution_id || null,
    projectId: row.project_id || null,
    projectTitle:
      project?.title ||
      (row.project_id ? 'Project' : 'Together Forge (studio)'),
    projectSlug: project?.slug || null,
    userId: row.user_id || null,
    username: user?.username || null,
    avatarUrl: user?.avatar_url || null,
    pinnedBadgeKey: user?.pinned_badge_key || null,
    pendingEmail: row.pending_email || null,
    pendingAccount: pending,
    grantCategory: row.grant_category,
    memorialCategory: row.memorial_category,
    memorialSubcategory: row.memorial_subcategory,
    publicLine: row.public_line,
    privateNote: row.private_note || null,
    points: row.points == null ? null : Number(row.points),
    badgeKey: row.badge_key || null,
    creditedOn: row.credited_on,
    allowDuplicate: Boolean(row.allow_duplicate),
    revokedAt: row.revoked_at || null,
    revokedBy: row.revoked_by || null,
    revokeReason: row.revoke_reason || null,
    createdAt: row.created_at,
    createdBy: row.created_by || null,
    createdByUsername: granter?.username || null,
    updatedAt: row.updated_at,
  };
}

export async function listCreditProjects() {
  let projects = [];
  try {
    projects = await listContributorProjects();
  } catch {
    projects = [];
  }
  return [
    {
      id: STAFF_CREDIT_STUDIO_ID,
      title: 'Together Forge (studio)',
      slug: null,
      studio: true,
    },
    ...projects.map((p) => ({
      id: p.id,
      title: p.title || p.slug || 'Project',
      slug: p.slug || null,
      studio: false,
    })),
  ];
}

export async function searchMembersForCredit(query, { limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  try {
    const { data, error } = await supabase.rpc('search_members_for_credit', {
      p_query: q,
      p_limit: Math.min(Math.max(limit, 1), 20),
    });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.map(mapMember).filter(Boolean);
  } catch (error) {
    throw staffCreditError(error, 'Could not search members.');
  }
}

export async function listStaffCreditGrants({
  projectId = null,
  includeRevoked = false,
  limit = 200,
} = {}) {
  try {
    let req = supabase
      .from('staff_credit_grants')
      .select(
        `
        id,
        project_id,
        contribution_id,
        user_id,
        pending_email,
        grant_category,
        memorial_category,
        memorial_subcategory,
        public_line,
        private_note,
        points,
        badge_key,
        credited_on,
        allow_duplicate,
        revoked_at,
        revoked_by,
        revoke_reason,
        created_at,
        created_by,
        updated_at,
        user:user_id ( id, username, avatar_url, pinned_badge_key ),
        granter:created_by ( username ),
        project:project_id ( id, title, slug )
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (projectId === STAFF_CREDIT_STUDIO_ID) {
      req = req.is('project_id', null);
    } else if (projectId) {
      req = req.eq('project_id', projectId);
    }
    if (!includeRevoked) {
      req = req.is('revoked_at', null);
    }

    const { data, error } = await req;
    if (error) throw error;
    return (data || []).map(mapGrant).filter(Boolean);
  } catch (error) {
    throw staffCreditError(error, 'Could not load credit grants.');
  }
}

function resolveProjectId(projectId) {
  if (!projectId || projectId === STAFF_CREDIT_STUDIO_ID) return null;
  return projectId;
}

export async function grantStaffCredit({
  userId = null,
  pendingEmail = null,
  projectId = null,
  grantCategory = 'other',
  publicLine = '',
  privateNote = null,
  points = null,
  badgeKey = null,
  creditedOn = null,
  allowDuplicate = false,
} = {}) {
  const line = String(publicLine || '').trim();
  if (line.length < 3 || line.length > STAFF_CREDIT_PUBLIC_MAX) {
    throw new Error(
      `Public credit line must be 3–${STAFF_CREDIT_PUBLIC_MAX} characters.`
    );
  }
  const note = String(privateNote || '').trim();
  if (note.length > STAFF_CREDIT_NOTE_MAX) {
    throw new Error('Staff note is too long.');
  }
  const cat = staffCreditCategoryById(grantCategory);
  const email = String(pendingEmail || '').trim().toLowerCase();
  if (!userId && !looksLikeEmail(email)) {
    throw new Error('Pick a member or enter an email.');
  }
  if (userId && email) {
    /* bound member wins */
  }

  try {
    const { data, error } = await supabase.rpc('grant_staff_credit', {
      p_user_id: userId || null,
      p_pending_email: userId ? null : email || null,
      p_project_id: resolveProjectId(projectId),
      p_grant_category: cat.id,
      p_public_line: line,
      p_private_note: note || null,
      p_points: parsePoints(points),
      p_badge_key: parseBadgeKey(badgeKey),
      p_credited_on: creditedOn || todayIsoDate(),
      p_allow_duplicate: Boolean(allowDuplicate),
    });
    if (error) throw error;
    if (data && data.ok === false && data.code === 'DUPLICATE') {
      return { ok: false, code: 'DUPLICATE', existingId: data.existingId };
    }
    if (!data || data.ok !== true) {
      throw new Error('Could not grant credit.');
    }
    return data;
  } catch (error) {
    if (error?.code === 'DUPLICATE') return error;
    throw staffCreditError(error, 'Could not grant credit.');
  }
}

export async function updateStaffCredit(
  id,
  {
    grantCategory = null,
    publicLine = null,
    privateNote = null,
    points = undefined,
    badgeKey = undefined,
    creditedOn = null,
  } = {}
) {
  const grantId = String(id || '').trim();
  if (!grantId) throw new Error('Credit grant not found.');
  const line =
    publicLine == null ? null : String(publicLine || '').trim();
  if (line != null && (line.length < 3 || line.length > STAFF_CREDIT_PUBLIC_MAX)) {
    throw new Error(
      `Public credit line must be 3–${STAFF_CREDIT_PUBLIC_MAX} characters.`
    );
  }
  const note =
    privateNote == null ? null : String(privateNote || '').trim();
  if (note != null && note.length > STAFF_CREDIT_NOTE_MAX) {
    throw new Error('Staff note is too long.');
  }

  try {
    const payload = {
      p_id: grantId,
      p_grant_category: grantCategory
        ? staffCreditCategoryById(grantCategory).id
        : null,
      p_public_line: line,
      p_private_note: privateNote == null ? null : note,
      p_credited_on: creditedOn || null,
    };
    if (points !== undefined) payload.p_points = parsePoints(points) ?? 0;
    if (badgeKey !== undefined) {
      payload.p_badge_key =
        badgeKey === '' || badgeKey == null ? '' : parseBadgeKey(badgeKey);
    }

    const { data, error } = await supabase.rpc('update_staff_credit', payload);
    if (error) throw error;
    if (!data || data.ok !== true) {
      throw new Error('Could not update credit.');
    }
    return data;
  } catch (error) {
    throw staffCreditError(error, 'Could not update credit.');
  }
}

export async function revokeStaffCredit(id, reason) {
  const grantId = String(id || '').trim();
  const why = String(reason || '').trim();
  if (!grantId) throw new Error('Credit grant not found.');
  if (why.length < 3) {
    throw new Error('Add a private reason for the revoke.');
  }
  try {
    const { data, error } = await supabase.rpc('revoke_staff_credit', {
      p_id: grantId,
      p_reason: why,
    });
    if (error) throw error;
    if (!data || data.ok !== true) {
      throw new Error('Could not revoke credit.');
    }
    return data;
  } catch (error) {
    throw staffCreditError(error, 'Could not revoke credit.');
  }
}

export { todayIsoDate, STAFF_CREDIT_PENDING_LABEL };
