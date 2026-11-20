/**
 * tasksService: staff task management (create, edit, order, dependencies, staging).
 * Part of the tasks service; import from '../tasksService' in app code.
 */

import { supabase } from '../../lib/supabase';
import {
  TASK_CANNOT_WAIT_ON_SELF,
  BOARD_SCOPE_PUBLIC,
  BOARD_SCOPE_STAGING,
  compareTaskBoardOrder,
} from './taskModel';
import { mapTaskRow } from './taskMappers';
import { TASK_SELECT, TASK_SELECT_NO_DEP_OVERRIDE, TASK_SELECT_LEGACY } from './taskSelects';
import { attachClaimPrivateDetails } from './claimDetails';

export const taskAdminMethods = {
  /**
   * Staff: replace "Blocked by" set and optional dependency_override.
   * Uses set_task_dependencies RPC when available; falls back to table writes.
   */
  async setTaskDependencies(taskId, blockerIds = [], dependencyOverride = null) {
    if (!taskId) throw new Error('Task id is required');
    const ids = [...new Set((blockerIds || []).filter(Boolean))];
    if (ids.some((id) => String(id) === String(taskId))) {
      throw new Error(TASK_CANNOT_WAIT_ON_SELF);
    }

    const { data, error } = await supabase.rpc('set_task_dependencies', {
      p_task_id: taskId,
      p_blocker_ids: ids,
      p_override: dependencyOverride,
    });

    if (!error) return data;

    // Fallback if RPC not migrated yet
    if (!/function|does not exist|PGRST202/i.test(error.message || '')) {
      throw error;
    }

    if (dependencyOverride !== null && dependencyOverride !== undefined) {
      const { error: oErr } = await supabase
        .from('tasks')
        .update({ dependency_override: Boolean(dependencyOverride) })
        .eq('id', taskId);
      if (
        oErr &&
        !/dependency_override|column .* does not exist/i.test(oErr.message || '')
      ) {
        throw oErr;
      }
    }

    const { error: delErr } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('task_id', taskId);
    if (
      delErr &&
      /task_dependencies|does not exist|relation/i.test(delErr.message || '')
    ) {
      throw new Error(
        'Task dependencies are not set up yet. Run supabase/sql/supabase_task_dependencies.sql in Supabase.'
      );
    }
    if (delErr) throw delErr;

    if (ids.length) {
      const rows = ids.map((bid) => ({
        task_id: taskId,
        blocks_on_task_id: bid,
      }));
      const { error: insErr } = await supabase
        .from('task_dependencies')
        .insert(rows);
      if (insErr) throw insErr;
    }

    return {
      task_id: taskId,
      blocker_count: ids.length,
      dependency_override: dependencyOverride,
    };
  },

  /** Staff: create a task on a project (optional parentTaskId for hierarchy). */
  async createTask(projectId, payload, userId) {
    const row = {
      project_id: projectId,
      title: payload.title,
      description: payload.description || null,
      category: payload.category || null,
      difficulty: payload.difficulty || null,
      status: 'ToDo',
      estimated_effort: payload.estimatedEffort || null,
      subtasks: payload.subtasks || [],
      created_by: userId || null,
    };
    if (payload.parentTaskId) {
      row.parent_task_id = payload.parentTaskId;
    }
    if (payload.dependencyOverride != null) {
      row.dependency_override = Boolean(payload.dependencyOverride);
    }
    if (payload.staffOnly != null) {
      row.staff_only = Boolean(payload.staffOnly);
    }
    if (payload.holdClaim != null) {
      row.hold_claim = Boolean(payload.holdClaim);
    }
    row.board_scope =
      payload.boardScope === BOARD_SCOPE_STAGING
        ? BOARD_SCOPE_STAGING
        : BOARD_SCOPE_PUBLIC;
    if (payload.sortOrder != null) {
      row.sort_order = Number(payload.sortOrder) || 0;
    }

    let { data, error } = await supabase
      .from('tasks')
      .insert([row])
      .select(TASK_SELECT)
      .single();

    if (error && /staff_only/i.test(error.message || '')) {
      throw new Error(
        'Staff Only is not set up yet. Run supabase/sql/supabase_task_staff_only.sql in Supabase.'
      );
    }
    if (error && /hold_claim/i.test(error.message || '')) {
      throw new Error(
        'Hold claim is not set up yet. Run supabase/sql/supabase_task_hold_claim.sql in Supabase.'
      );
    }
    if (error && /board_scope|sort_order/i.test(error.message || '')) {
      throw new Error(
        'Staging boards are not set up yet. Run supabase/sql/supabase_task_board_scope.sql in Supabase.'
      );
    }

    if (
      error &&
      /dependency_override|column .* does not exist/i.test(error.message || '')
    ) {
      delete row.dependency_override;
      const mid = await supabase
        .from('tasks')
        .insert([row])
        .select(TASK_SELECT_NO_DEP_OVERRIDE)
        .single();
      data = mid.data;
      error = mid.error;
    }
    if (
      error &&
      /parent_task_id|column .* does not exist/i.test(error.message || '')
    ) {
      if (payload.parentTaskId) {
        throw new Error(
          'Task hierarchy is not set up yet. Run supabase/sql/supabase_task_hierarchy.sql in Supabase.'
        );
      }
      delete row.parent_task_id;
      const legacy = await supabase
        .from('tasks')
        .insert([row])
        .select(TASK_SELECT_LEGACY)
        .single();
      data = legacy.data;
      error = legacy.error;
    }
    if (error) throw error;

    const [withDetails] = await attachClaimPrivateDetails([data]);
    const mapped = mapTaskRow(withDetails);
    const blockerIds = (
      payload.blockedByTaskIds ||
      payload.blockedByIds ||
      []
    ).filter((id) => id && String(id) !== String(mapped?.id));
    // Only hit deps table when staff set blockers or enabled override
    if (
      mapped?.id &&
      (blockerIds.length > 0 || payload.dependencyOverride === true)
    ) {
      try {
        await this.setTaskDependencies(
          mapped.id,
          blockerIds,
          payload.dependencyOverride === true ? true : null
        );
      } catch (depErr) {
        console.warn(
          '[tasksService.createTask] dependencies',
          depErr?.message || depErr
        );
        throw depErr;
      }
    }
    return mapped;
  },

  /** Staff: update task fields (title, description, parent, etc.) */
  async updateTaskMeta(taskId, fields) {
    const patch = {};
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.category !== undefined) patch.category = fields.category;
    if (fields.difficulty !== undefined) patch.difficulty = fields.difficulty;
    if (fields.estimatedEffort !== undefined) {
      patch.estimated_effort = fields.estimatedEffort;
    }
    if (fields.subtasks !== undefined) patch.subtasks = fields.subtasks;
    if (fields.parentTaskId !== undefined) {
      patch.parent_task_id = fields.parentTaskId || null;
    }
    if (fields.dependencyOverride !== undefined) {
      patch.dependency_override = Boolean(fields.dependencyOverride);
    }
    if (fields.staffOnly !== undefined) {
      patch.staff_only = Boolean(fields.staffOnly);
    }
    if (fields.holdClaim !== undefined) {
      patch.hold_claim = Boolean(fields.holdClaim);
    }
    if (fields.sortOrder !== undefined) {
      patch.sort_order = Number(fields.sortOrder) || 0;
    }

    let { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', taskId)
      .select(TASK_SELECT)
      .single();

    if (error && /staff_only/i.test(error.message || '')) {
      throw new Error(
        'Staff Only is not set up yet. Run supabase/sql/supabase_task_staff_only.sql in Supabase.'
      );
    }
    if (error && /hold_claim/i.test(error.message || '')) {
      throw new Error(
        'Hold claim is not set up yet. Run supabase/sql/supabase_task_hold_claim.sql in Supabase.'
      );
    }
    if (error && /board_scope|sort_order/i.test(error.message || '')) {
      throw new Error(
        'Staging boards are not set up yet. Run supabase/sql/supabase_task_board_scope.sql in Supabase.'
      );
    }

    if (
      error &&
      /dependency_override|column .* does not exist/i.test(error.message || '')
    ) {
      delete patch.dependency_override;
      const mid = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', taskId)
        .select(TASK_SELECT_NO_DEP_OVERRIDE)
        .single();
      data = mid.data;
      error = mid.error;
    }
    if (
      error &&
      /parent_task_id|column .* does not exist/i.test(error.message || '')
    ) {
      delete patch.parent_task_id;
      const legacy = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', taskId)
        .select(TASK_SELECT_LEGACY)
        .single();
      data = legacy.data;
      error = legacy.error;
    }
    if (error) throw error;

    // Only replace edges when the form explicitly sends blockedByTaskIds
    if (
      fields.blockedByTaskIds !== undefined ||
      fields.blockedByIds !== undefined
    ) {
      await this.setTaskDependencies(
        taskId,
        fields.blockedByTaskIds ?? fields.blockedByIds ?? [],
        fields.dependencyOverride !== undefined
          ? Boolean(fields.dependencyOverride)
          : null
      );
    }

    const [withDetails] = await attachClaimPrivateDetails([data]);
    return mapTaskRow(withDetails);
  },

  /** Staff: delete a task from the current board (nested children cascade). */
  async deleteTask(taskId) {
    if (!taskId) throw new Error('Task not found');
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
    return { id: taskId };
  },

  /**
   * Staff: swap a task with the previous/next sibling (same parent).
   * @param {string} taskId
   * @param {'up'|'down'} direction
   * @param {Array} tasks enriched project tasks
   */
  async reorderTaskAmongSiblings(taskId, direction, tasks) {
    const list = Array.isArray(tasks) ? tasks : [];
    const current = list.find((t) => t.id === taskId);
    if (!current) throw new Error('Task not found');
    const parentId = current.parentTaskId || null;
    const siblings = list
      .filter((t) => (t.parentTaskId || null) === parentId)
      .slice()
      .sort(compareTaskBoardOrder);
    const idx = siblings.findIndex((t) => t.id === taskId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return current;

    const ordered = siblings.map((t, i) =>
      i === idx ? siblings[swapIdx] : i === swapIdx ? siblings[idx] : t
    );
    for (let i = 0; i < ordered.length; i += 1) {
      if ((Number(ordered[i].sortOrder) || 0) === i) continue;
      const { error } = await supabase
        .from('tasks')
        .update({ sort_order: i })
        .eq('id', ordered[i].id);
      if (error) throw error;
    }
    return { id: taskId, direction };
  },

  /**
   * Staff: copy a Staging Epic or Medium (and nested work) onto the public
   * board, then archive those Staging rows so they leave the staging board.
   */
  async publishStagingTask(taskId) {
    if (!taskId) throw new Error('Task not found');
    const { data, error } = await supabase.rpc('publish_staging_task', {
      p_task_id: taskId,
    });
    if (error) {
      const msg = error.message || '';
      if (/could not find the function|schema cache/i.test(msg)) {
        throw new Error(
          'Staging publish is not set up yet. Run supabase/sql/supabase_task_board_scope.sql in Supabase.'
        );
      }
      throw error;
    }
    return data;
  },

  /**
   * Staff: move a Public Epic or Medium (and nested work) back to Staging.
   */
  async movePublicTaskToStaging(taskId) {
    if (!taskId) throw new Error('Task not found');
    const { data, error } = await supabase.rpc('move_public_task_to_staging', {
      p_task_id: taskId,
    });
    if (error) {
      const msg = error.message || '';
      if (/could not find the function|schema cache/i.test(msg)) {
        throw new Error(
          'Move to Staging is not set up yet. Run supabase/sql/supabase_move_public_to_staging.sql in Supabase.'
        );
      }
      throw error;
    }
    return data;
  },
};
