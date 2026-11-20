/**
 * PostgREST select strings for tasks (current + legacy fallbacks).
 * Embedded task_claims list only the public columns; notes, submission
 * evidence and review feedback are merged in by claimDetails.js for the
 * claimant and staff (supabase_claims_activity_lockdown.sql).
 * Part of the tasks service; import from '../tasksService' in app code.
 */

export const TASK_SELECT = `
  id,
  project_id,
  parent_task_id,
  title,
  description,
  category,
  difficulty,
  status,
  estimated_effort,
  subtasks,
  created_by,
  completed_at,
  created_at,
  dependency_override,
  staff_only,
  hold_claim,
  board_scope,
  sort_order,
  published_task_id,
  published_at,
  archived_at,
  task_claims (
    id,
    user_id,
    claimed_at,
    progress_percent,
    last_activity_at,
    status,
    helpers,
    submitted_at,
    reviewed_at,
    profiles!user_id (
      username,
      avatar_url,
      pinned_badge_key
    )
  )
`;

/** Fallback if dependency_override column not migrated yet. */
export const TASK_SELECT_NO_DEP_OVERRIDE = `
  id,
  project_id,
  parent_task_id,
  title,
  description,
  category,
  difficulty,
  status,
  estimated_effort,
  subtasks,
  created_by,
  completed_at,
  created_at,
  task_claims (
    id,
    user_id,
    claimed_at,
    progress_percent,
    last_activity_at,
    status,
    helpers,
    submitted_at,
    reviewed_at,
    profiles!user_id (
      username,
      avatar_url,
      pinned_badge_key
    )
  )
`;

/** Fallback select if parent_task_id column not migrated yet. */
export const TASK_SELECT_LEGACY = `
  id,
  project_id,
  title,
  description,
  category,
  difficulty,
  status,
  estimated_effort,
  subtasks,
  created_by,
  completed_at,
  created_at,
  task_claims (
    id,
    user_id,
    claimed_at,
    progress_percent,
    last_activity_at,
    status,
    helpers,
    submitted_at,
    reviewed_at,
    profiles!user_id (
      username,
      avatar_url,
      pinned_badge_key
    )
  )
`;
