/**
 * Basic moderation helpers for Moderator Dashboard.
 * Requires staff role (moderator | admin | project_lead) and
 * supabase_moderation.sql for full RLS + content_reports.
 */

import { supabase } from '../lib/supabase';
import { WORKFLOW_STATUSES } from '../utils/ideaStatus';

export { WORKFLOW_STATUSES };
export const MODERATION_STATUSES = ['active', 'suspended', 'banned'];
export const REPORT_STATUSES = ['pending', 'reviewing', 'resolved', 'dismissed'];

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

  /**
   * List profiles for moderation (newest first).
   * Note: profiles use joined_at (not created_at) per supabase_schema.sql.
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
          '[moderation] content_reports missing. Run supabase_moderation.sql in Supabase.',
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
          'Reports table is not set up yet. Run supabase_moderation.sql in the Supabase SQL Editor, then refresh the API schema if needed.'
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
          'Reports table is not set up yet. Run supabase_moderation.sql in the Supabase SQL Editor.'
        );
      }
      throw error;
    }
    return data;
  },
};

export default moderationService;
