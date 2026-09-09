import { supabase } from '../lib/supabase';

export const SUGGESTION_STRIKE_LIMIT = 3;
export const SUGGESTION_STAFF_NOTE_MIN = 8;
export const SUGGESTION_STAFF_NOTE_MAX = 500;
export const SUGGEST_LOCKED_MESSAGE =
  'You have three task board suggestion strikes and can no longer suggest new tasks.';
export const SUGGESTION_STRIKE_RULES_COPY =
  'Suggestions must be real work for this project. Troll, fake, or off-topic proposals can earn a strike. Three strikes and you can no longer suggest tasks.';
export const SUGGESTION_STRUCK_USER_COPY =
  'This suggestion was struck. Suggestions must be real, on-project work. Troll, fake, or off-topic proposals can earn a strike. Three strikes and you can no longer suggest tasks.';

export function isSuggestLockedError(err) {
  const msg = String(err?.message || err || '');
  return /SUGGEST_LOCKED/i.test(msg);
}

function mapSuggestion(row) {
  if (!row) return null;
  const profile = row.profiles || row.author || null;
  const project = Array.isArray(row.projects)
    ? row.projects[0]
    : row.projects || null;
  return {
    id: row.id,
    projectId: row.project_id,
    createdBy: row.created_by,
    authorName: profile?.username || null,
    authorAvatarUrl: profile?.avatar_url || null,
    title: row.title,
    description: row.description || '',
    category: row.category || null,
    difficulty: row.difficulty || null,
    estimatedEffort: row.estimated_effort || null,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
    parentTaskId: row.parent_task_id || null,
    status: row.status,
    rejectReason: row.reject_reason || null,
    staffNote: (() => {
      const notes = row.task_suggestion_staff_notes;
      const n = Array.isArray(notes) ? notes[0] : notes;
      return n?.note || null;
    })(),
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    acceptedTaskId: row.accepted_task_id || null,
    createdAt: row.created_at,
    projectSlug: project?.slug || null,
    projectTitle: project?.title || null,
  };
}

export function suggestionStatusLabel(status) {
  if (status === 'accepted') return 'Accepted';
  if (status === 'rejected') return 'Rejected';
  if (status === 'struck') return 'Struck';
  return 'Waiting';
}

export function suggestionStatusVariant(status) {
  if (status === 'accepted') return 'success';
  if (status === 'rejected') return 'warning';
  if (status === 'struck') return 'danger';
  return 'gold';
}

export const taskSuggestionsService = {
  async getMyAccount() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        signedIn: false,
        strikeCount: 0,
        locked: false,
        showNotice: false,
      };
    }
    const { data, error } = await supabase
      .from('task_suggestion_accounts')
      .select(
        'user_id, strike_count, locked_at, notice_seen_count, last_strike_at'
      )
      .eq('user_id', user.id)
      .maybeSingle();
    if (error && /task_suggestion_accounts|schema cache/i.test(error.message || '')) {
      return {
        signedIn: true,
        strikeCount: 0,
        locked: false,
        showNotice: false,
        unavailable: true,
      };
    }
    if (error) throw error;
    const strikeCount = Number(data?.strike_count) || 0;
    const locked = Boolean(data?.locked_at) || strikeCount >= SUGGESTION_STRIKE_LIMIT;
    const seen = Number(data?.notice_seen_count) || 0;
    return {
      signedIn: true,
      strikeCount,
      locked,
      showNotice: strikeCount > seen,
      lastStrikeAt: data?.last_strike_at || null,
    };
  },

  async dismissStrikeNotice() {
    const { error } = await supabase.rpc(
      'dismiss_task_suggestion_strike_notice'
    );
    if (error) throw error;
  },

  async submit(projectId, payload) {
    const { data, error } = await supabase.rpc('submit_task_suggestion', {
      p_project_id: projectId,
      p_title: payload.title,
      p_description: payload.description || null,
      p_category: payload.category || null,
      p_difficulty: payload.difficulty || null,
      p_estimated_effort: payload.estimatedEffort || null,
      p_subtasks: payload.subtasks || [],
      p_parent_task_id: payload.parentTaskId || null,
    });
    if (error) throw error;
    return data;
  },

  async listForProject(projectId, status = 'pending') {
    if (!projectId) return [];
    const applyStatus = (q) =>
      status && status !== 'all' ? q.eq('status', status) : q;
    const withAuthor = applyStatus(
      supabase
        .from('task_suggestions')
        .select(
          'id, project_id, created_by, title, description, category, difficulty, estimated_effort, subtasks, parent_task_id, status, reject_reason, reviewed_by, reviewed_at, accepted_task_id, created_at, profiles:created_by ( username, avatar_url ), task_suggestion_staff_notes ( note, created_at )'
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
    );
    let { data, error } = await withAuthor;
    if (error && /profiles|relationship/i.test(error.message || '')) {
      const retry = await applyStatus(
        supabase
          .from('task_suggestions')
          .select(
            'id, project_id, created_by, title, description, category, difficulty, estimated_effort, subtasks, parent_task_id, status, reject_reason, reviewed_by, reviewed_at, accepted_task_id, created_at'
          )
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
      );
      if (retry.error) throw retry.error;
      return (retry.data || []).map(mapSuggestion);
    }
    if (error) throw error;
    return (data || []).map(mapSuggestion);
  },

  async listMine() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const withProject = await supabase
      .from('task_suggestions')
      .select(
        'id, project_id, created_by, title, description, category, status, reject_reason, reviewed_at, accepted_task_id, created_at, projects ( slug, title )'
      )
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    let { data, error } = withProject;
    if (error && /projects|relationship/i.test(error.message || '')) {
      const retry = await supabase
        .from('task_suggestions')
        .select(
          'id, project_id, created_by, title, description, category, status, reject_reason, reviewed_at, accepted_task_id, created_at'
        )
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      if (/does not exist|schema cache|could not find the table/i.test(error.message || '')) {
        return [];
      }
      throw error;
    }
    return (data || []).map(mapSuggestion);
  },

  async countPending(projectId) {
    if (!projectId) return 0;
    const { count, error } = await supabase
      .from('task_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', 'pending');
    if (error) return 0;
    return Number(count) || 0;
  },

  async review(suggestionId, action, reason = null) {
    const { data, error } = await supabase.rpc('review_task_suggestion', {
      p_suggestion_id: suggestionId,
      p_action: action,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },
};

export default taskSuggestionsService;
