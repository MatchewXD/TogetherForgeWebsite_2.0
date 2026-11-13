/**
 * tasksService: project lookup, task loading, current user.
 * Part of the tasks service; import from '../tasksService' in app code.
 */

import { supabase } from '../../lib/supabase';
import { canonicalProjectSlug, displayProjectTitle, expandProjectSlugAliases } from '../../utils/ideaStatus';
import { BOARD_SCOPE_PUBLIC, BOARD_SCOPE_STAGING, attachTaskDependencies } from './taskModel';
import { mapTaskRow, attachScopeRequests, attachTaskHierarchy } from './taskMappers';
import { TASK_SELECT, TASK_SELECT_NO_DEP_OVERRIDE, TASK_SELECT_LEGACY } from './taskSelects';

export const projectQueriesMethods = {
  /**
   * Resolve project by public slug or by primary key UUID
   * (dashboard/claim links may pass either).
   */
  async getProjectBySlug(slugOrId) {
    if (!slugOrId) return null;
    const key = String(slugOrId).trim();
    if (!key) return null;

    const selectFull =
      'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, github_url, contribution_meta, updated_at';
    const selectNoGithub =
      'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, updated_at';
    const selectBasic = 'id, slug, title, description, phase, status, created_at';
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key
      );

    const normalizeRow = (row) => {
      if (!row) return row;
      const next = { ...row };
      next.slug = canonicalProjectSlug(next.slug) || next.slug;
      next.title = displayProjectTitle(next);
      return next;
    };

    const fetchOne = async (column, value) => {
      let { data, error } = await supabase
        .from('projects')
        .select(selectFull)
        .eq(column, value)
        .maybeSingle();
      if (
        error &&
        /github_url|contribution_meta/i.test(error.message || '')
      ) {
        const mid = await supabase
          .from('projects')
          .select(selectNoGithub)
          .eq(column, value)
          .maybeSingle();
        data = mid.data;
        error = mid.error;
      }
      if (
        error &&
        /column .* does not exist|completion_|summary|sort_order|updated_at/i.test(
          error.message || ''
        )
      ) {
        const retry = await supabase
          .from('projects')
          .select(selectBasic)
          .eq(column, value)
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      if (data) {
        data.githubUrl = data.github_url || null;
        data.contributionMeta = data.contribution_meta || {};
      }
      return normalizeRow(data);
    };

    if (isUuid) {
      const byId = await fetchOne('id', key);
      if (byId) return byId;
    }

    const slugKeys = expandProjectSlugAliases(key);
    for (const slug of slugKeys.length ? slugKeys : [key]) {
      const row = await fetchOne('slug', slug);
      if (row) return row;
    }
    return null;
  },

  async getTasksForProject(projectId, opts = {}) {
    if (!projectId) return [];
    const boardScope =
      opts.boardScope === BOARD_SCOPE_STAGING
        ? BOARD_SCOPE_STAGING
        : BOARD_SCOPE_PUBLIC;
    let query = supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('project_id', projectId)
      .eq('board_scope', boardScope)
      .is('archived_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    let { data, error } = await query;

    if (error && /hold_claim/i.test(error.message || '')) {
      const retry = await supabase
        .from('tasks')
        .select(TASK_SELECT.replace(/hold_claim,\s*/g, ''))
        .eq('project_id', projectId)
        .eq('board_scope', boardScope)
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      data = retry.data;
      error = retry.error;
    }

    if (
      error &&
      /archived_at|column .* does not exist/i.test(error.message || '')
    ) {
      const retry = await supabase
        .from('tasks')
        .select(TASK_SELECT.replace(/archived_at,\s*/g, ''))
        .eq('project_id', projectId)
        .eq('board_scope', boardScope)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      data = retry.data;
      error = retry.error;
    }

    if (
      error &&
      /board_scope|sort_order|published_task_id|published_at|column .* does not exist/i.test(
        error.message || ''
      )
    ) {
      const unscoped = await supabase
        .from('tasks')
        .select(TASK_SELECT.replace(/board_scope,\s*|sort_order,\s*|published_task_id,\s*|published_at,\s*/g, ''))
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      data = unscoped.data;
      error = unscoped.error;
      if (
        !error &&
        boardScope === BOARD_SCOPE_STAGING &&
        Array.isArray(data)
      ) {
        data = data.filter((row) => row.board_scope === BOARD_SCOPE_STAGING);
      } else if (!error && Array.isArray(data)) {
        data = data.filter((row) => row.board_scope !== BOARD_SCOPE_STAGING);
      }
    }

    // Graceful fallback before dependency_override / hierarchy migrations
    if (
      error &&
      /dependency_override|column .* does not exist/i.test(error.message || '')
    ) {
      const mid = await supabase
        .from('tasks')
        .select(TASK_SELECT_NO_DEP_OVERRIDE)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      data = mid.data;
      error = mid.error;
    }
    if (
      error &&
      /parent_task_id|column .* does not exist/i.test(error.message || '')
    ) {
      const legacy = await supabase
        .from('tasks')
        .select(TASK_SELECT_LEGACY)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      data = legacy.data;
      error = legacy.error;
    }
    if (error) throw error;
    const liveRows = (data || []).filter((row) => !row.archived_at);
    let mapped = attachTaskHierarchy(liveRows.map(mapTaskRow));

    // "Blocked by" edges (optional table — ignore if migration not run)
    try {
      const taskIds = mapped.map((t) => t.id).filter(Boolean);
      if (taskIds.length) {
        const { data: depRows, error: depErr } = await supabase
          .from('task_dependencies')
          .select('task_id, blocks_on_task_id')
          .in('task_id', taskIds);
        if (depErr) {
          console.warn(
            '[tasksService.getTasksForProject] dependencies',
            depErr.message
          );
        } else {
          mapped = attachTaskDependencies(mapped, depRows || []);
        }
      }
    } catch (e) {
      console.warn(
        '[tasksService.getTasksForProject] dependencies',
        e?.message || e
      );
    }

    // Pending scope-help flags (optional table — ignore if migration not run)
    try {
      const { data: scopeRows, error: scopeErr } = await supabase
        .from('task_scope_requests')
        .select(
          'id, project_id, task_id, claim_id, requester_id, note, status, created_at'
        )
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (scopeErr) {
        console.warn(
          '[tasksService.getTasksForProject] scope requests',
          scopeErr.message
        );
        return mapped;
      }
      if (!scopeRows?.length) return mapped;

      // Hydrate requester profiles separately (no embed dependency)
      const requesterIds = [
        ...new Set(scopeRows.map((r) => r.requester_id).filter(Boolean)),
      ];
      let profileById = new Map();
      if (requesterIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, pinned_badge_key')
          .in('id', requesterIds);
        profileById = new Map((profiles || []).map((p) => [p.id, p]));
      }
      const hydrated = scopeRows.map((r) => ({
        ...r,
        profiles: profileById.get(r.requester_id) || null,
      }));
      return attachScopeRequests(mapped, hydrated);
    } catch (e) {
      console.warn('[tasksService.getTasksForProject] scope requests', e);
    }
    return mapped;
  },

  async getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },
};
