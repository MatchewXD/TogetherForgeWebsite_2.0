import { supabase } from '../lib/supabase';
import { initialsFromName } from '../utils/avatarUtils';

/** Hard max active claims (experienced volunteers). New users use NEW_USER_CLAIM_LIMIT. */
export const MAX_ACTIVE_CLAIMS = 5;
/** Starting claim slots until 3 completions (Sybil soft defense). */
export const NEW_USER_CLAIM_LIMIT = 2;
/** Completions required before full claim limit unlocks. */
export const CLAIM_LIMIT_UNLOCK_COMPLETIONS = 3;
/** Minutes between claims. */
export const CLAIM_COOLDOWN_MINUTES = 30;
/** Days without progress before auto-release. */
export const CLAIM_STALE_DAYS = 14;

/**
 * Max nesting depth for hierarchical tasks (0 = top-level Epic).
 * Depth 0, 1, 2 = Epic → Medium → Small (3 levels).
 */
export const MAX_TASK_NESTING_DEPTH = 2;

/** Labels for nesting depth (volunteer-friendly). */
export const TASK_LEVEL_LABELS = ['Epic', 'Medium task', 'Small task'];

/** Short badges for cards / filters */
export const TASK_LEVEL_SHORT = ['Epic', 'Medium', 'Small'];

export function taskLevelLabel(depth) {
  const d = Math.min(
    Math.max(0, Number(depth) || 0),
    TASK_LEVEL_LABELS.length - 1
  );
  return TASK_LEVEL_LABELS[d];
}

export function taskLevelShort(depth) {
  const d = Math.min(
    Math.max(0, Number(depth) || 0),
    TASK_LEVEL_SHORT.length - 1
  );
  return TASK_LEVEL_SHORT[d];
}

/**
 * Normalize tasks.subtasks jsonb into a stable checklist array.
 * Handles array, JSON string, or empty/null.
 */
export function normalizeChecklist(raw) {
  if (raw == null || raw === '') return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s, i) => {
      if (s == null) return null;
      if (typeof s === 'string') {
        const label = s.trim();
        return label
          ? { id: `s${i + 1}`, label, done: false }
          : null;
      }
      const label = String(s.label || s.title || s.name || '').trim();
      if (!label) return null;
      return {
        id: s.id || `s${i + 1}`,
        label,
        done: Boolean(s.done ?? s.completed),
      };
    })
    .filter(Boolean);
}

/** Progress % from checklist completion (null if no items). */
export function progressFromChecklist(items) {
  const list = Array.isArray(items) ? items : normalizeChecklist(items);
  if (!list.length) return null;
  const done = list.filter((s) => s.done).length;
  return Math.round((100 * done) / list.length);
}

/**
 * Volunteer claim rules (client + server should agree):
 * - Epic (depth 0): never claimable
 * - Medium/Small with children: not claimable (progress from children)
 * - Medium/Small leaf: claimable
 */
export function getTaskClaimBlockedReason(task) {
  if (!task) return 'Task not found';
  if (task.dbStatus === 'Completed' || task.status === 'completed') {
    return 'This task is already completed';
  }
  const depth = Number(task.depth) || 0;
  if (depth === 0) {
    return 'Epics cannot be claimed. Open a Medium or Small task under this epic.';
  }
  if (task.hasChildren || (task.childCount || 0) > 0) {
    return 'This task has sub-tasks and is not claimable. Claim a Small (or leaf Medium) task instead.';
  }
  return null;
}

export function isVolunteerClaimable(task) {
  return !getTaskClaimBlockedReason(task);
}

/** Human-readable claim hold duration from claimed_at ISO. */
export function formatClaimHeldSince(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return 'held just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `held ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `held ${hr}h`;
  const day = Math.floor(hr / 24);
  return `held ${day}d`;
}

/** DB status → kanban key */
export const STATUS_TO_UI = {
  ToDo: 'todo',
  InProgress: 'in_progress',
  InReview: 'in_review',
  Completed: 'completed',
};

/** Kanban key → DB status */
export const STATUS_TO_DB = {
  todo: 'ToDo',
  in_progress: 'InProgress',
  in_review: 'InReview',
  completed: 'Completed',
};

/** Claim statuses that block re-claim / count toward claim limit */
export const OPEN_CLAIM_STATUSES = ['Active', 'PendingReview'];

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
  const pending = claims.find((c) => c.status === 'PendingReview');
  if (pending) return pending;
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
    claim &&
    (claim.status === 'Active' ||
      claim.status === 'PendingReview' ||
      row.status === 'Completed');
  const parentTaskId = row.parent_task_id || null;
  // jsonb checklist (not hierarchical child tasks)
  const subtasks = normalizeChecklist(row.subtasks);
  const checklistProgress = progressFromChecklist(subtasks);

  // Leaf progress: prefer checklist completion when present; else claim %
  let progressPercent = 0;
  if (row.status === 'Completed') {
    progressPercent = 100;
  } else if (
    claim?.status === 'Active' ||
    claim?.status === 'PendingReview'
  ) {
    if (claim.status === 'PendingReview') {
      progressPercent = Math.max(claim.progress_percent ?? 90, 90);
    } else if (checklistProgress != null) {
      // Cap under 100 - full complete only after lead accept
      progressPercent = Math.min(99, checklistProgress);
    } else {
      progressPercent = Math.min(99, claim.progress_percent ?? 0);
    }
  } else if (checklistProgress != null) {
    // Unclaimed but checklist exists - still useful on cards at 0%+
    progressPercent = checklistProgress;
  }

  return {
    id: row.id,
    projectId: row.project_id,
    parentTaskId,
    title: row.title,
    description: row.description || '',
    category: row.category || null,
    difficulty: row.difficulty || null,
    status: uiStatus,
    dbStatus: row.status,
    estimatedEffort: row.estimated_effort || null,
    subtasks,
    hasChecklist: subtasks.length > 0,
    checklistProgress,
    createdBy: row.created_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    // Filled by attachTaskHierarchy
    depth: 0,
    childCount: 0,
    completedChildCount: 0,
    hasChildren: false,
    childIds: [],
    hierarchyProgress: null,
    claim: claim
      ? {
          id: claim.id,
          // Normalize id for strict owner checks (join-request approve UI)
          userId: claim.user_id ?? claim.userId ?? null,
          user_id: claim.user_id ?? claim.userId ?? null,
          claimedAt: claim.claimed_at,
          progressPercent:
            checklistProgress != null
              ? checklistProgress
              : claim.progress_percent ?? 0,
          lastActivityAt: claim.last_activity_at,
          status: claim.status,
          helpers: Array.isArray(claim.helpers) ? claim.helpers : [],
          notes: claim.notes || '',
          username,
          avatarUrl,
          avatar_url: avatarUrl,
          heldLabel:
            claim.status === 'Active' || claim.status === 'PendingReview'
              ? formatClaimHeldSince(claim.claimed_at)
              : '',
          submissionEvidence: claim.submission_evidence || '',
          submittedAt: claim.submitted_at || null,
          reviewFeedback: claim.review_feedback || '',
          reviewedAt: claim.reviewed_at || null,
        }
      : null,
    claimedBy: showAssignee ? username : null,
    claimedByAvatarUrl: showAssignee ? avatarUrl : null,
    progressPercent,
  };
}

/**
 * Enrich mapped tasks with depth, child counts, and parent progress %.
 * Progress for parents = % of direct children with status Completed.
 */
export function attachTaskHierarchy(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return tasks || [];

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const childrenOf = new Map();

  for (const t of tasks) {
    if (t.parentTaskId && byId.has(t.parentTaskId)) {
      if (!childrenOf.has(t.parentTaskId)) childrenOf.set(t.parentTaskId, []);
      childrenOf.get(t.parentTaskId).push(t.id);
    }
  }

  const depthOf = (id, guard = 0) => {
    if (guard > 10) return 0;
    const t = byId.get(id);
    if (!t?.parentTaskId || !byId.has(t.parentTaskId)) return 0;
    return 1 + depthOf(t.parentTaskId, guard + 1);
  };

  return tasks.map((t) => {
    const childIds = childrenOf.get(t.id) || [];
    const completedChildCount = childIds.filter((cid) => {
      const c = byId.get(cid);
      return c && (c.dbStatus === 'Completed' || c.status === 'completed');
    }).length;
    const childCount = childIds.length;
    const hasChildren = childCount > 0;
    const hierarchyProgress = hasChildren
      ? Math.round((100 * completedChildCount) / childCount)
      : null;

    // Parents with children: progress is only from completed children.
    // Leaves keep claim/checklist progress from mapTaskRow.
    let progressPercent = t.progressPercent;
    if (hasChildren) {
      progressPercent =
        t.dbStatus === 'Completed' || t.status === 'completed'
          ? 100
          : hierarchyProgress ?? 0;
    } else if (
      Array.isArray(t.subtasks) &&
      t.subtasks.length > 0 &&
      t.dbStatus !== 'Completed' &&
      t.status !== 'completed'
    ) {
      const cp = progressFromChecklist(t.subtasks);
      if (cp != null) progressPercent = cp;
    }

    const depth = depthOf(t.id);
    // Clear invalid parent links if parent missing from project set
    const parentTaskId =
      t.parentTaskId && byId.has(t.parentTaskId) ? t.parentTaskId : null;

    const base = {
      ...t,
      parentTaskId,
      depth,
      levelLabel: taskLevelLabel(depth),
      levelShort: taskLevelShort(depth),
      isEpic: depth === 0,
      isMedium: depth === 1,
      isSmall: depth === 2,
      childIds,
      childCount,
      completedChildCount,
      hasChildren,
      progressFromChildren: hasChildren,
      hierarchyProgress,
      progressPercent,
      canAddChild: depth < MAX_TASK_NESTING_DEPTH,
    };

    const claimBlockedReason = getTaskClaimBlockedReason(base);
    return {
      ...base,
      claimBlockedReason,
      volunteerClaimable: !claimBlockedReason,
    };
  });
}

/** Direct children of a parent from an already-enriched list. */
export function getChildTasks(tasks, parentId) {
  if (!parentId || !Array.isArray(tasks)) return [];
  return tasks.filter((t) => t.parentTaskId === parentId);
}

/** Breadcrumb chain from root → task (inclusive). */
export function getTaskBreadcrumb(tasks, taskId) {
  const byId = new Map((tasks || []).map((t) => [t.id, t]));
  const chain = [];
  let cur = byId.get(taskId);
  let guard = 0;
  while (cur && guard < 10) {
    chain.unshift(cur);
    cur = cur.parentTaskId ? byId.get(cur.parentTaskId) : null;
    guard += 1;
  }
  return chain;
}

export function mapActivityRow(row) {
  const profile = pickProfile(row);
  const username = profile?.username || 'Someone';
  const avatarUrl = profileAvatarUrl(profile);
  return {
    id: row.id,
    user: username,
    username,
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
    notes,
    submission_evidence,
    submitted_at,
    review_feedback,
    reviewed_at,
    profiles!user_id (
      username,
      avatar_url
    )
  )
`;

/** Fallback select if parent_task_id column not migrated yet. */
const TASK_SELECT_LEGACY = `
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
    submission_evidence,
    submitted_at,
    review_feedback,
    reviewed_at,
    profiles!user_id (
      username,
      avatar_url
    )
  )
`;

export const tasksService = {
  /**
   * Resolve project by public slug or by primary key UUID
   * (dashboard/claim links may pass either).
   */
  async getProjectBySlug(slugOrId) {
    if (!slugOrId) return null;
    const key = String(slugOrId).trim();
    if (!key) return null;

    const selectFull =
      'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, updated_at';
    const selectBasic = 'id, slug, title, description, phase, status, created_at';
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key
      );

    const fetchOne = async (column, value) => {
      let { data, error } = await supabase
        .from('projects')
        .select(selectFull)
        .eq(column, value)
        .maybeSingle();
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
      return data;
    };

    if (isUuid) {
      const byId = await fetchOne('id', key);
      if (byId) return byId;
    }

    return fetchOne('slug', key);
  },

  async getTasksForProject(projectId) {
    if (!projectId) return [];
    let { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    // Graceful fallback before hierarchy migration is applied
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
    return attachTaskHierarchy((data || []).map(mapTaskRow));
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
   * Project Pulse metrics for workspace header:
   * - contributors: unique people from Contributors data (tasks, donations, credits)
   * - tasksCompleted: total Completed tasks on this project
   * - openTasks: tasks available to claim (ToDo)
   * Also returns activeWorkers for the optional “On the forge now” strip.
   */
  async getProjectPulse(projectId) {
    const empty = {
      contributors: 0,
      tasksCompleted: 0,
      openTasks: 0,
      activeWorkers: [],
      // legacy keys kept so older UI does not crash
      activePeople: 0,
      tasksThisWeek: 0,
      tasksThisMonth: 0,
      recentWins: 0,
    };
    if (!projectId) return empty;

    try {
      const {
        isDemoReleaseEnabled,
        isDemoReleaseKey,
        getDemoReleasePulse,
      } = await import('../data/demoReleasedGame');
      if (isDemoReleaseEnabled() && isDemoReleaseKey(projectId)) {
        return getDemoReleasePulse();
      }
    } catch {
      /* ignore */
    }

    // --- Task counts + active claimers ---
    const { data: taskRows, error: taskErr } = await supabase
      .from('tasks')
      .select(
        `
        id,
        status,
        task_claims (
          id,
          user_id,
          status,
          profiles!user_id ( username, avatar_url )
        )
      `
      )
      .eq('project_id', projectId);

    if (taskErr) throw taskErr;

    let tasksCompleted = 0;
    let openTasks = 0;
    const workerMap = new Map();
    const claimerIds = new Set();

    for (const t of taskRows || []) {
      const st = String(t.status || '');
      if (st === 'Completed') tasksCompleted += 1;
      if (st === 'ToDo') openTasks += 1;

      for (const c of t.task_claims || []) {
        if (!c.user_id) continue;
        claimerIds.add(c.user_id);
        const claimActive =
          c.status === 'Active' || c.status === 'PendingReview';
        const taskHot =
          st === 'InProgress' || st === 'InReview' || st === 'PendingReview';
        if (claimActive && taskHot && !workerMap.has(c.user_id)) {
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

    // --- Unique contributors (same sources as Contributors page) ---
    const people = new Set();
    for (const uid of claimerIds) {
      people.add(`u:${uid}`);
    }

    try {
      // Lazy require avoids circular import at module load if bundler reorders
      const { getProjectCredits } = await import('./contributorsService');
      const credits = await getProjectCredits(projectId);
      for (const d of credits?.donations?.namedDonors || []) {
        if (d.userId) people.add(`u:${d.userId}`);
        else if (d.displayName || d.username) {
          people.add(
            `n:${String(d.displayName || d.username)
              .trim()
              .toLowerCase()}`
          );
        }
      }
      for (const cat of ['development', 'marketing', 'community']) {
        for (const row of credits?.[cat] || []) {
          if (row.userId) people.add(`u:${row.userId}`);
          else if (row.displayName || row.username) {
            people.add(
              `n:${String(row.displayName || row.username)
                .trim()
                .toLowerCase()}`
            );
          }
        }
      }
    } catch (err) {
      console.warn('[tasksService.getProjectPulse] contributors', err);
    }

    // Manual credits table (covers rows not yet in getProjectCredits edge cases)
    try {
      const { data: contribRows } = await supabase
        .from('project_contributions')
        .select('user_id, display_name, is_anonymous, category')
        .eq('project_id', projectId);
      for (const r of contribRows || []) {
        if (r.is_anonymous) continue;
        if (r.user_id) people.add(`u:${r.user_id}`);
        else if (r.display_name) {
          people.add(`n:${String(r.display_name).trim().toLowerCase()}`);
        }
      }
    } catch {
      /* table may not exist */
    }

    const contributors = people.size;

    return {
      contributors,
      tasksCompleted,
      openTasks,
      activeWorkers: [...workerMap.values()],
      activePeople: contributors,
      tasksThisWeek: tasksCompleted,
      tasksThisMonth: tasksCompleted,
      recentWins: openTasks,
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
        note: `Shipped “${row.target_title || 'a task'}” - thanks for moving the forge forward!`,
        role: 'Contributor',
        time: relativeTime(row.created_at),
      };
    });
  },

  /**
   * Count Active claims for a user (site-wide).
   */
  async countActiveClaims(userId) {
    if (!userId) return 0;
    const { count, error } = await supabase
      .from('task_claims')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', OPEN_CLAIM_STATUSES);
    if (error) {
      console.warn('[tasksService.countActiveClaims]', error);
      return 0;
    }
    return typeof count === 'number' ? count : 0;
  },

  async countCompletedClaims(userId) {
    if (!userId) return 0;
    const { count, error } = await supabase
      .from('task_claims')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'Completed');
    if (error) {
      console.warn('[tasksService.countCompletedClaims]', error);
      return 0;
    }
    return typeof count === 'number' ? count : 0;
  },

  /**
   * Server quota snapshot (limit, cooldown, active count).
   * Falls back to client-side estimate if RPC missing.
   */
  async getMyClaimQuota() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { signedIn: false, canClaimNow: false };
    }

    const { data, error } = await supabase.rpc('get_my_claim_quota');
    if (!error && data) {
      return {
        signedIn: true,
        activeClaims: Number(data.active_claims) || 0,
        completedClaims: Number(data.completed_claims) || 0,
        claimLimit: Number(data.claim_limit) || NEW_USER_CLAIM_LIMIT,
        cooldownEndsAt: data.cooldown_ends_at || null,
        canClaimNow: Boolean(data.can_claim_now),
      };
    }

    // Client-side fallback
    const [active, completed] = await Promise.all([
      this.countActiveClaims(user.id),
      this.countCompletedClaims(user.id),
    ]);
    const claimLimit =
      completed >= CLAIM_LIMIT_UNLOCK_COMPLETIONS
        ? MAX_ACTIVE_CLAIMS
        : NEW_USER_CLAIM_LIMIT;

    const { data: lastRows } = await supabase
      .from('task_claims')
      .select('claimed_at')
      .eq('user_id', user.id)
      .order('claimed_at', { ascending: false })
      .limit(1);

    const lastAt = lastRows?.[0]?.claimed_at
      ? new Date(lastRows[0].claimed_at).getTime()
      : null;
    const cooldownEndsAt =
      lastAt != null
        ? new Date(lastAt + CLAIM_COOLDOWN_MINUTES * 60 * 1000).toISOString()
        : null;
    const canClaimNow =
      active < claimLimit &&
      (!cooldownEndsAt || new Date(cooldownEndsAt).getTime() <= Date.now());

    return {
      signedIn: true,
      activeClaims: active,
      completedClaims: completed,
      claimLimit,
      cooldownEndsAt,
      canClaimNow,
      fallback: true,
    };
  },

  /**
   * Claim a task. Client pre-checks + server claim_task (anti-hoarding SQL).
   * Volunteers may only claim Medium/Small leaf tasks (not Epics or parents with children).
   * @param {string} taskId
   * @param {{ task?: object }} [opts] optional enriched task for client-side claim rules
   */
  async claimTask(taskId, opts = {}) {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    if (!user) {
      throw new Error('You must be signed in to claim a task');
    }

    if (opts.task) {
      const blocked = getTaskClaimBlockedReason(opts.task);
      if (blocked) {
        const err = new Error(blocked);
        err.code = 'CLAIM_HIERARCHY';
        throw err;
      }
    }

    // Best-effort stale cleanup (no-op if RPC missing)
    try {
      await this.returnStaleClaims(CLAIM_STALE_DAYS);
    } catch {
      /* ignore */
    }

    const quota = await this.getMyClaimQuota();
    if (quota.signedIn && !quota.canClaimNow) {
      if (quota.activeClaims >= quota.claimLimit) {
        const err = new Error(
          `Claim limit reached (${quota.activeClaims}/${quota.claimLimit}). Complete or return a task first. New volunteers start at ${NEW_USER_CLAIM_LIMIT} slots; ${CLAIM_LIMIT_UNLOCK_COMPLETIONS}+ completions unlock ${MAX_ACTIVE_CLAIMS}.`
        );
        err.code = 'CLAIM_LIMIT';
        err.activeClaims = quota.activeClaims;
        err.limit = quota.claimLimit;
        throw err;
      }
      if (quota.cooldownEndsAt) {
        const mins = Math.max(
          1,
          Math.ceil(
            (new Date(quota.cooldownEndsAt).getTime() - Date.now()) / 60000
          )
        );
        const err = new Error(
          `Claim cooldown: wait about ${mins} more minute${mins === 1 ? '' : 's'} before claiming another task.`
        );
        err.code = 'CLAIM_COOLDOWN';
        throw err;
      }
    }

    const { data, error } = await supabase.rpc('claim_task', {
      p_task_id: taskId,
    });
    if (error) {
      const msg = error.message || '';
      if (/Epic|sub-task|cannot be claimed|hierarchy/i.test(msg)) {
        const err = new Error(msg);
        err.code = 'CLAIM_HIERARCHY';
        throw err;
      }
      if (/limit|cooldown|wait/i.test(msg)) {
        const err = new Error(msg);
        err.code = /cooldown|wait/i.test(msg) ? 'CLAIM_COOLDOWN' : 'CLAIM_LIMIT';
        throw err;
      }
      throw error;
    }
    return data;
  },

  async requestJoinClaim(taskId, message = '') {
    const { data, error } = await supabase.rpc('request_join_claim', {
      p_task_id: taskId,
      p_message: message || null,
    });
    if (error) {
      const msg = error.message || '';
      if (/already have a pending|already helping|already requested/i.test(msg)) {
        const err = new Error(msg);
        err.code = 'JOIN_ALREADY';
        throw err;
      }
      throw error;
    }
    if (data?.already_pending || data?.already_helping) {
      const err = new Error(
        data.already_helping
          ? 'You are already helping on this task.'
          : 'You already have a pending join request on this task.'
      );
      err.code = 'JOIN_ALREADY';
      err.alreadyPending = Boolean(data.already_pending);
      err.alreadyHelping = Boolean(data.already_helping);
      throw err;
    }
    return data;
  },

  /** Pending join requests for the current user (task ids they already requested). */
  async listMyPendingJoinTaskIds() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Set();

    const { data, error } = await supabase
      .from('claim_join_requests')
      .select('task_id')
      .eq('requester_id', user.id)
      .eq('status', 'pending');
    if (error) {
      console.warn('[tasksService.listMyPendingJoinTaskIds]', error);
      return new Set();
    }
    return new Set((data || []).map((r) => r.task_id).filter(Boolean));
  },

  async resolveJoinRequest(requestId, approve) {
    const { data, error } = await supabase.rpc('resolve_join_request', {
      p_request_id: requestId,
      p_approve: !!approve,
    });
    if (error) throw error;
    return data;
  },

  async listJoinRequestsForTask(taskId) {
    const { data, error } = await supabase
      .from('claim_join_requests')
      .select(
        `
        id, claim_id, task_id, requester_id, status, message, created_at,
        profiles:requester_id ( username, avatar_url )
      `
      )
      .eq('task_id', taskId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('[tasksService.listJoinRequestsForTask]', error);
      return [];
    }
    return (data || []).map((r) => ({
      id: r.id,
      claimId: r.claim_id,
      taskId: r.task_id,
      requesterId: r.requester_id,
      status: r.status,
      message: r.message,
      createdAt: r.created_at,
      username: r.profiles?.username || 'User',
      avatarUrl: r.profiles?.avatar_url || null,
    }));
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

  /**
   * Claimant: submit work for Project Lead / moderator review (not final complete).
   * @param {string} taskId
   * @param {string} evidence - required note / link / PR / file reference
   */
  async submitForReview(taskId, evidence) {
    const note = String(evidence || '').trim();
    if (note.length < 15) {
      const err = new Error(
        'Add a short evidence note (at least 15 characters): what you did, plus a link, PR, or file reference if you have one.'
      );
      err.code = 'EVIDENCE_REQUIRED';
      throw err;
    }
    const { data, error } = await supabase.rpc('submit_task_for_review', {
      p_task_id: taskId,
      p_evidence: note,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Staff: accept (Completed + credit) or reject (back to Active with feedback).
   */
  async reviewSubmission(taskId, { accept, feedback } = {}) {
    const { data, error } = await supabase.rpc('review_task_submission', {
      p_task_id: taskId,
      p_accept: !!accept,
      p_feedback: feedback || null,
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

    let { data, error } = await supabase
      .from('tasks')
      .insert([row])
      .select(TASK_SELECT)
      .single();

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
    return mapTaskRow(data);
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

    let { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', taskId)
      .select(TASK_SELECT)
      .single();

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

  /**
   * Active claims for the signed-in user (dashboard private hub).
   * Includes task + project title for deep links.
   */
  async listMyActiveClaims() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('task_claims')
      .select(
        `
        id,
        task_id,
        claimed_at,
        progress_percent,
        last_activity_at,
        status,
        notes,
        tasks (
          id,
          title,
          status,
          category,
          difficulty,
          project_id,
          projects ( id, slug, title )
        )
      `
      )
      .eq('user_id', user.id)
      .eq('status', 'Active')
      .order('claimed_at', { ascending: false });

    if (error) {
      console.warn('[tasksService.listMyActiveClaims]', error);
      return [];
    }

    return (data || []).map((row) => {
      const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
      const project = task
        ? Array.isArray(task.projects)
          ? task.projects[0]
          : task.projects
        : null;
      const projectId = task?.project_id || project?.id || null;
      const projectSlug = project?.slug || null;
      return {
        claimId: row.id,
        taskId: row.task_id || task?.id,
        taskTitle: task?.title || 'Task',
        taskStatus: task?.status || null,
        category: task?.category || null,
        difficulty: task?.difficulty || null,
        projectId,
        projectSlug,
        // Prefer slug for /projects/:id workspace routes
        projectPath: projectSlug || projectId,
        projectTitle: project?.title || 'Project',
        claimedAt: row.claimed_at,
        progressPercent: row.progress_percent ?? 0,
        lastActivityAt: row.last_activity_at,
        heldLabel: formatClaimHeldSince(row.claimed_at),
        notes: row.notes || '',
      };
    });
  },

  /**
   * Join requests the signed-in user has submitted (pending).
   */
  async listMyPendingJoinRequests() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('claim_join_requests')
      .select(
        `
        id,
        claim_id,
        task_id,
        status,
        message,
        created_at,
        tasks (
          id,
          title,
          project_id,
          projects ( id, slug, title )
        )
      `
      )
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[tasksService.listMyPendingJoinRequests]', error);
      return [];
    }

    return (data || []).map((row) => {
      const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
      const project = task
        ? Array.isArray(task.projects)
          ? task.projects[0]
          : task.projects
        : null;
      const projectId = task?.project_id || project?.id || null;
      const projectSlug = project?.slug || null;
      return {
        id: row.id,
        claimId: row.claim_id,
        taskId: row.task_id || task?.id,
        taskTitle: task?.title || 'Task',
        projectId,
        projectSlug,
        projectPath: projectSlug || projectId,
        projectTitle: project?.title || 'Project',
        status: row.status,
        message: row.message || '',
        createdAt: row.created_at,
      };
    });
  },
};

export default tasksService;
