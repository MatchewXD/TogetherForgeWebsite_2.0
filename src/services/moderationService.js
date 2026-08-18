/**
 * Basic moderation helpers for Moderator Dashboard.
 * Requires staff role (founder | moderator | admin | project_lead) and
 * supabase/sql/supabase_moderation.sql for full RLS + content_reports.
 * Role changes: supabase/sql/supabase_role_management.sql (Founder only).
 */

import { supabase } from '../lib/supabase';
import { WORKFLOW_STATUSES } from '../utils/ideaStatus';

export { WORKFLOW_STATUSES };
export const MODERATION_STATUSES = ['active', 'suspended', 'banned'];
export const REPORT_STATUSES = ['pending', 'reviewing', 'resolved', 'dismissed'];
/** Roles a Founder can assign from Role Management. Founder is SQL-only. */
export const ASSIGNABLE_ROLES = ['user', 'moderator'];

export function roleLabel(role) {
  switch (String(role || 'user').trim()) {
    case 'user':
      return 'User';
    case 'moderator':
      return 'Moderator';
    case 'founder':
      return 'Founder';
    case 'admin':
      return 'Admin';
    case 'project_lead':
      return 'Project lead';
    case 'contributor':
      return 'Contributor';
    default:
      return String(role || 'User');
  }
}

/** PostgREST / Postgres when a table was never migrated or not in schema cache */
function isMissingTableError(error, tableHint = '') {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || error.details || error.hint || '');
  if (code === '42P01' || code === 'PGRST205') return true;
  if (/schema cache|does not exist|could not find the table|relation .* does not exist/i.test(msg)) {
    return true;
  }
  if (tableHint && new RegExp(tableHint, 'i').test(msg) && /not find|does not exist|schema cache/i.test(msg)) {
    return true;
  }
  return false;
}

export const moderationService = {
  WORKFLOW_STATUSES,
  MODERATION_STATUSES,
  REPORT_STATUSES,
  ASSIGNABLE_ROLES,

  /**
   * List profiles for moderation (newest first).
   * Note: profiles use joined_at (not created_at) per supabase/sql/supabase_schema.sql.
   */
  async listUsers({ limit = 50 } = {}) {
    const selectFull =
      'id, username, role, avatar_url, joined_at, email, moderation_status, moderation_note, bio';
    const selectBasic = 'id, username, role, avatar_url, joined_at, email, bio';

    let { data, error } = await supabase
      .from('profiles')
      .select(selectFull)
      .order('joined_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      // Retry without moderation columns or email if missing
      const fallback = await supabase
        .from('profiles')
        .select(selectBasic)
        .order('joined_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (fallback.error) {
        // Last resort: no order, minimal columns
        const minimal = await supabase
          .from('profiles')
          .select('id, username, role, avatar_url, bio')
          .limit(limit);
        if (minimal.error) throw minimal.error;
        data = minimal.data;
      } else {
        data = fallback.data;
      }
    }

    return (data || []).map((p) => ({
      ...p,
      // Normalize for UI (joined_at is the schema field)
      joined_at: p.joined_at || p.created_at || null,
      moderation_status: p.moderation_status || 'active',
      moderation_note: p.moderation_note || null,
    }));
  },

  /**
   * Set user moderation_status: active | suspended | banned
   */
  async setUserModerationStatus(userId, status, note = null) {
    if (!userId) throw new Error('Missing user id');
    if (!MODERATION_STATUSES.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const payload = {
      moderation_status: status,
      moderation_note: note,
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select('id, username, moderation_status, moderation_note, role')
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Founder-only. Sets profiles.role via set_user_role() and writes the audit log.
   */
  async setUserRole(userId, role) {
    if (!userId) throw new Error('Missing user id');
    const next = String(role || '').trim();
    if (!ASSIGNABLE_ROLES.includes(next)) {
      throw new Error(`Invalid role: ${role}`);
    }

    const { data, error } = await supabase.rpc('set_user_role', {
      p_user_id: userId,
      p_new_role: next,
    });

    if (error) {
      if (isMissingTableError(error, 'role_change_log') || /set_user_role/i.test(error.message || '')) {
        const msg = String(error.message || '');
        if (/could not find the function|schema cache|does not exist/i.test(msg)) {
          throw new Error(
            'Role Management is not set up yet. Run supabase/sql/supabase_role_management.sql in the Supabase SQL Editor, then refresh.'
          );
        }
      }
      throw error;
    }
    return data;
  },

  /**
   * Founder-only audit of role changes.
   */
  async listRoleChanges({ limit = 40 } = {}) {
    const { data, error } = await supabase
      .from('role_change_log')
      .select(
        'id, user_id, changed_by, old_role, new_role, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTableError(error, 'role_change_log')) {
        return { entries: [], tableMissing: true };
      }
      throw error;
    }

    const rows = data || [];
    const ids = [
      ...new Set(
        rows.flatMap((r) => [r.user_id, r.changed_by].filter(Boolean))
      ),
    ];

    let names = {};
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ids);
      for (const p of profiles || []) {
        names[p.id] = p.username || null;
      }
    }

    return {
      tableMissing: false,
      entries: rows.map((r) => ({
        ...r,
        username: names[r.user_id] || null,
        changed_by_username: names[r.changed_by] || null,
      })),
    };
  },

  /**
   * List ideas for moderation.
   */
  async listIdeas({ limit = 40 } = {}) {
    const { data, error } = await supabase
      .from('ideas')
      .select('id, title, status, votes, user_id, created_at, category, summary')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async updateIdeaStatus(ideaId, status) {
    if (!ideaId) throw new Error('Missing idea id');
    if (!WORKFLOW_STATUSES.includes(status)) {
      throw new Error(`Invalid idea status: ${status}`);
    }

    const { data, error } = await supabase
      .from('ideas')
      .update({ status })
      .eq('id', ideaId)
      .select('id, title, status')
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async deleteIdea(ideaId) {
    if (!ideaId) throw new Error('Missing idea id');
    const { error } = await supabase.from('ideas').delete().eq('id', ideaId);
    if (error) throw error;
    return true;
  },

  /**
   * Pending / all reports (requires content_reports table).
   */
  async listReports({ status = 'pending', limit = 40 } = {}) {
    let query = supabase
      .from('content_reports')
      .select(
        'id, reporter_id, target_type, target_id, reason, details, status, created_at, resolved_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTableError(error, 'content_reports')) {
        console.warn(
          '[moderation] content_reports missing. Run supabase/sql/supabase_moderation.sql in Supabase.',
          error.message
        );
        return { reports: [], tableMissing: true };
      }
      throw error;
    }

    return { reports: data || [], tableMissing: false };
  },

  async resolveReport(reportId, status = 'resolved') {
    if (!reportId) throw new Error('Missing report id');
    if (!['resolved', 'dismissed', 'reviewing', 'pending'].includes(status)) {
      throw new Error(`Invalid report status: ${status}`);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      status,
      resolved_at:
        status === 'resolved' || status === 'dismissed'
          ? new Date().toISOString()
          : null,
      resolved_by: user?.id || null,
    };

    const { data, error } = await supabase
      .from('content_reports')
      .update(payload)
      .eq('id', reportId)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error, 'content_reports')) {
        throw new Error(
          'Reports table is not set up yet. Run supabase/sql/supabase_moderation.sql in the Supabase SQL Editor, then refresh the API schema if needed.'
        );
      }
      throw error;
    }
    return data;
  },

  /**
   * Staff can open a report (e.g. flag an idea from dashboard).
   */
  async createReport({ targetType, targetId, reason, details }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Sign in required');

    const { data, error } = await supabase
      .from('content_reports')
      .insert([
        {
          reporter_id: user.id,
          target_type: targetType,
          target_id: String(targetId),
          reason: reason || 'Staff flag',
          details: details || null,
          status: 'pending',
        },
      ])
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error, 'content_reports')) {
        throw new Error(
          'Reports table is not set up yet. Run supabase/sql/supabase_moderation.sql in the Supabase SQL Editor.'
        );
      }
      throw error;
    }
    return data;
  },
};

export default moderationService;
