import { supabase } from '../lib/supabase';
import { initialsFromName } from '../utils/avatarUtils';

/** DB status → kanban key */
export const STATUS_TO_UI = {
  ToDo: 'todo',
  InProgress: 'in_progress',
  Completed: 'completed',
};

/** Kanban key → DB status */
export const STATUS_TO_DB = {
  todo: 'ToDo',
  in_progress: 'InProgress',
  completed: 'Completed',
};

function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function pickActiveClaim(claims) {
  if (!Array.isArray(claims) || claims.length === 0) return null;
  const active = claims.find((c) => c.status === 'Active');
  if (active) return active;
  // Prefer most recent completed claim for display on completed tasks
  return [...claims].sort(
    (a, b) => new Date(b.claimed_at || 0) - new Date(a.claimed_at || 0)
  )[0];
}

/** Normalize nested profile embeds (object or single-element array). */
function pickProfile(source) {
  if (!source) return null;
  const raw = source.profiles ?? source.profile ?? source;
  if (Array.isArray(raw)) return raw[0] || null;
  if (raw && typeof raw === 'object' && (raw.username !== undefined || raw.avatar_url !== undefined)) {
    return raw;
  }
  return null;
}

function profileAvatarUrl(profile) {
  if (!profile) return null;
  const url = profile.avatar_url || profile.avatarUrl || null;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

/**
 * Normalize a task row (+ nested claims/profiles) for UI cards and modals.
 */
export function mapTaskRow(row) {
  if (!row) return null;
  const claim = pickActiveClaim(row.task_claims);
  const profile = pickProfile(claim);
  const username = profile?.username || null;
  const avatarUrl = profileAvatarUrl(profile);
  const uiStatus = STATUS_TO_UI[row.status] || 'todo';
  const showAssignee =
    claim && (claim.status === 'Active' || row.status === 'Completed');

  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description || '',
    category: row.category || null,
    difficulty: row.difficulty || null,
    status: uiStatus,
    dbStatus: row.status,
    estimatedEffort: row.estimated_effort || null,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
    createdBy: row.created_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    claim: claim
      ? {
          id: claim.id,
          userId: claim.user_id,
          claimedAt: claim.claimed_at,
          progressPercent: claim.progress_percent ?? 0,
          lastActivityAt: claim.last_activity_at,
          status: claim.status,
          helpers: Array.isArray(claim.helpers) ? claim.helpers : [],
          notes: claim.notes || '',
          username,
          avatarUrl,
          avatar_url: avatarUrl,
        }
      : null,
    claimedBy: showAssignee ? username : null,
    claimedByAvatarUrl: showAssignee ? avatarUrl : null,
    progressPercent:
      claim?.status === 'Active' || row.status === 'Completed'
        ? claim?.progress_percent ?? (row.status === 'Completed' ? 100 : 0)
        : 0,
  };
}

export function mapActivityRow(row) {
  const profile = pickProfile(row);
  const username = profile?.username || 'Someone';
  const avatarUrl = profileAvatarUrl(profile);
  return {
    id: row.id,
    user: username,
    userInitials: initialsFromName(username),
    avatarUrl,
    avatar_url: avatarUrl,
    action: row.action,
    target: row.target_title || 'a task',
    time: relativeTime(row.created_at),
    createdAt: row.created_at,
    userId: row.user_id,
    metadata: row.metadata || {},
  };
}

const TASK_SELECT = `
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
    notes,
    profiles (
      username,
      avatar_url
    )
  )
`;

export const tasksService = {
  async getProjectBySlug(slug) {
    if (!slug) return null;
    const { data, error } = await supabase
      .from('projects')
      .select('id, slug, title, description, phase, status, created_at')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getTasksForProject(projectId) {
    if (!projectId) return [];
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapTaskRow);
  },

  async getActivityForProject(projectId, { limit = 20 } = {}) {
    if (!projectId) return [];
    const { data, error } = await supabase
      .from('activity_log')
      .select(
        `
        id,
        project_id,
        user_id,
        action,
        target_type,
        target_id,
        target_title,
        metadata,
        created_at,
        profiles (
          username,
          avatar_url
        )
      `
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(mapActivityRow);
  },

  /**
   * Project Pulse: active workers, completions this week/month, recent wins.
   */
  async getProjectPulse(projectId) {
    const empty = {
      activePeople: 0,
      activeWorkers: [],
      tasksThisWeek: 0,
      tasksThisMonth: 0,
      recentWins: 0,
    };
    if (!projectId) return empty;

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const { data: inProgressTasks, error: taskErr } = await supabase
      .from('tasks')
      .select(
        `
        id,
        task_claims (
          id,
          user_id,
          status,
          profiles ( username, avatar_url )
        )
      `
      )
      .eq('project_id', projectId)
      .eq('status', 'InProgress');

    if (taskErr) throw taskErr;

    const workerMap = new Map();
    for (const t of inProgressTasks || []) {
      for (const c of t.task_claims || []) {
        if (c.status !== 'Active' || !c.user_id) continue;
        if (!workerMap.has(c.user_id)) {
          const profile = pickProfile(c);
          const username = profile?.username || 'Volunteer';
          const avatarUrl = profileAvatarUrl(profile);
          workerMap.set(c.user_id, {
            userId: c.user_id,
            username,
            avatarUrl,
            avatar_url: avatarUrl,
            initials: initialsFromName(username),
          });
        }
      }
    }

    const { data: completed, error: doneErr } = await supabase
      .from('tasks')
      .select('id, completed_at')
      .eq('project_id', projectId)
      .eq('status', 'Completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', monthAgo.toISOString());

    if (doneErr) throw doneErr;

    let tasksThisWeek = 0;
    let tasksThisMonth = 0;
    for (const t of completed || []) {
      const at = new Date(t.completed_at).getTime();
      if (at >= monthAgo.getTime()) tasksThisMonth += 1;
      if (at >= weekAgo.getTime()) tasksThisWeek += 1;
    }

    const { count: recentWins, error: winErr } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('action', 'completed')
      .gte('created_at', weekAgo.toISOString());

    if (winErr) throw winErr;

    return {
      activePeople: workerMap.size,
      activeWorkers: [...workerMap.values()],
      tasksThisWeek,
      tasksThisMonth,
      recentWins: recentWins ?? 0,
    };
  },

  /**
   * Completions for shoutouts (recent completed activity + claimer).
   */
  async getShoutouts(projectId, { limit = 6 } = {}) {
    if (!projectId) return [];
    const { data, error } = await supabase
      .from('activity_log')
      .select(
        `
        id,
        action,
        target_title,
        created_at,
        user_id,
        profiles ( username, avatar_url )
      `
      )
      .eq('project_id', projectId)
      .eq('action', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    return (data || []).map((row) => {
      const profile = pickProfile(row);
      const name = profile?.username || 'Volunteer';
      const avatarUrl = profileAvatarUrl(profile);
      return {
        id: row.id,
        name,
        initials: initialsFromName(name),
        avatarUrl,
        avatar_url: avatarUrl,
        note: `Shipped “${row.target_title || 'a task'}” — thanks for moving the forge forward!`,
        role: 'Contributor',
        time: relativeTime(row.created_at),
      };
    });
  },

  async claimTask(taskId) {
    const { data, error } = await supabase.rpc('claim_task', {
      p_task_id: taskId,
    });
    if (error) throw error;
    return data;
  },

  async updateProgress(taskId, { progressPercent, subtasks, notes, helpers } = {}) {
    const { data, error } = await supabase.rpc('update_task_progress', {
      p_task_id: taskId,
      p_progress_percent:
        typeof progressPercent === 'number' ? progressPercent : null,
      p_subtasks: subtasks ?? null,
      p_notes: notes ?? null,
      p_helpers: helpers ?? null,
    });
    if (error) throw error;
    return data;
  },

  async completeTask(taskId) {
    const { data, error } = await supabase.rpc('complete_task', {
      p_task_id: taskId,
    });
    if (error) throw error;
    return data;
  },

  async returnClaim(taskId) {
    const { data, error } = await supabase.rpc('return_task_claim', {
      p_task_id: taskId,
    });
    if (error) throw error;
    return data;
  },

  async returnStaleClaims(days = 14) {
    const { data, error } = await supabase.rpc('return_stale_claims', {
      p_days: days,
    });
    if (error) throw error;
    return data;
  },

  /** Staff: create a task on a project */
  async createTask(projectId, payload, userId) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          project_id: projectId,
          title: payload.title,
          description: payload.description || null,
          category: payload.category || null,
          difficulty: payload.difficulty || null,
          status: 'ToDo',
          estimated_effort: payload.estimatedEffort || null,
          subtasks: payload.subtasks || [],
          created_by: userId || null,
        },
      ])
      .select(TASK_SELECT)
      .single();
    if (error) throw error;
    return mapTaskRow(data);
  },

  /** Staff: update task fields (title, description, etc.) */
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

    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', taskId)
      .select(TASK_SELECT)
      .single();
    if (error) throw error;
    return mapTaskRow(data);
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

export default tasksService;
