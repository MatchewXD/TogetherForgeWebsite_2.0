/**
 * tasksService: scope-help requests on tasks.
 * Part of the tasks service; import from '../tasksService' in app code.
 */

import { supabase } from '../../lib/supabase';
import { canonicalProjectSlug } from '../../utils/ideaStatus';

export const scopeRequestsMethods = {
  /**
   * Claimant: flag Active claim as larger than expected (non-punitive scope help).
   * @param {string} taskId
   * @param {string} note - short discovery note (min 10 chars)
   */
  async requestScopeHelp(taskId, note) {
    const text = String(note || '').trim();
    if (text.length < 10) {
      const err = new Error(
        'Add a short note (at least 10 characters) about what is larger than expected.'
      );
      err.code = 'SCOPE_NOTE_REQUIRED';
      throw err;
    }
    const { data, error } = await supabase.rpc('request_task_scope_help', {
      p_task_id: taskId,
      p_note: text,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Staff: close a scope request after breakdown / promote / adjust / keep.
   * @param {string} requestId
   * @param {'breakdown'|'promoted'|'adjusted'|'kept'|'other'} resolution
   * @param {string} [staffNote]
   */
  async resolveScopeRequest(requestId, resolution, staffNote = '') {
    const { data, error } = await supabase.rpc('resolve_task_scope_request', {
      p_request_id: requestId,
      p_resolution: resolution,
      p_staff_note: staffNote || null,
    });
    if (error) throw error;
    return data;
  },

  async cancelScopeRequest(requestId) {
    const { data, error } = await supabase.rpc('cancel_task_scope_request', {
      p_request_id: requestId,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Staff: list scope-help requests across projects (moderator dashboard).
   * Loads base rows first, then hydrates task / project / profile so missing
   * FK embed names do not empty the queue.
   * @param {{ status?: 'pending'|'resolved'|'cancelled'|'all', limit?: number }} [opts]
   */
  async listScopeRequests({ status = 'pending', limit = 100 } = {}) {
    let q = supabase
      .from('task_scope_requests')
      .select(
        'id, project_id, task_id, claim_id, requester_id, note, status, resolution, staff_note, created_at, resolved_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    const { data, error } = await q;
    if (error) {
      const msg = error.message || '';
      if (
        /does not exist|schema cache|Could not find the table/i.test(msg) &&
        !/permission denied/i.test(msg)
      ) {
        const err = new Error(
          'Scope requests are not set up yet. Run supabase/sql/supabase_task_scope_requests.sql in Supabase.'
        );
        err.code = 'SCOPE_TABLE_MISSING';
        throw err;
      }
      throw error;
    }

    const rows = data || [];
    if (!rows.length) return [];

    const taskIds = [...new Set(rows.map((r) => r.task_id).filter(Boolean))];
    const projectIds = [
      ...new Set(rows.map((r) => r.project_id).filter(Boolean)),
    ];
    const userIds = [
      ...new Set(rows.map((r) => r.requester_id).filter(Boolean)),
    ];

    const fetchScopeTasks = async () => {
      if (!taskIds.length) return { data: [] };
      const withFlag = await supabase
        .from('tasks')
        .select(
          'id, title, category, difficulty, status, project_id, staff_only'
        )
        .in('id', taskIds);
      if (withFlag.error && /staff_only/i.test(withFlag.error.message || '')) {
        return supabase
          .from('tasks')
          .select('id, title, category, difficulty, status, project_id')
          .in('id', taskIds);
      }
      return withFlag;
    };

    const [tasksRes, projectsRes, profilesRes] = await Promise.all([
      fetchScopeTasks(),
      projectIds.length
        ? supabase
            .from('projects')
            .select('id, slug, title')
            .in('id', projectIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabase
            .from('profiles')
            .select('id, username, avatar_url, pinned_badge_key')
            .in('id', userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const taskById = new Map((tasksRes.data || []).map((t) => [t.id, t]));
    const projectById = new Map(
      (projectsRes.data || []).map((p) => [p.id, p])
    );
    const profileById = new Map(
      (profilesRes.data || []).map((p) => [p.id, p])
    );

    return rows.map((r) => {
      const task = taskById.get(r.task_id) || {};
      const project = projectById.get(r.project_id) || {};
      const profile = profileById.get(r.requester_id) || {};
      const slug =
        canonicalProjectSlug(project.slug) ||
        project.slug ||
        project.id ||
        r.project_id;
      return {
        id: r.id,
        projectId: r.project_id,
        projectSlug: slug,
        projectTitle: project.title || slug || 'Project',
        taskId: r.task_id,
        taskTitle: task.title || 'Task',
        taskCategory: task.category || null,
        taskDifficulty: task.difficulty || null,
        taskStatus: task.status || null,
        staffOnly: Boolean(task.staff_only),
        claimId: r.claim_id,
        requesterId: r.requester_id,
        username: profile.username || 'Volunteer',
        avatarUrl: profile.avatar_url || null,
        note: r.note || '',
        status: r.status || 'pending',
        resolution: r.resolution || null,
        staffNote: r.staff_note || null,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        boardPath: slug ? `/projects/${slug}/board` : '/open-work',
        taskDeepLink: slug
          ? `/projects/${slug}/board#task-${r.task_id}`
          : null,
      };
    });
  },

  /** Pending count for dashboard badge (independent of status filter). */
  async countPendingScopeRequests() {
    const { count, error } = await supabase
      .from('task_scope_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) {
      if (
        /task_scope_requests|does not exist|schema cache|Could not find the table/i.test(
          error.message || ''
        )
      ) {
        return 0;
      }
      console.warn('[tasksService.countPendingScopeRequests]', error);
      return 0;
    }
    return typeof count === 'number' ? count : 0;
  },
};
