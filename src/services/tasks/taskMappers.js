/**
 * DB row → UI mappers, task hierarchy / forest helpers, activity mapping.
 * Part of the tasks service; import from '../tasksService' in app code.
 */

import { initialsFromName } from '../../utils/avatarUtils';
import { extractGithubUrlsFromEvidence } from '../../constants/taskReviewEvidence';
import {
  MAX_TASK_NESTING_DEPTH,
  taskLevelLabel,
  taskLevelShort,
  inferTaskBoardDepthFromTitle,
  normalizeChecklist,
  progressFromChecklist,
  BOARD_SCOPE_PUBLIC,
  BOARD_SCOPE_STAGING,
  compareTaskBoardOrder,
  getTaskClaimBlockedReason,
} from './taskModel';
import { formatClaimHeldSince } from './claimAutoRelease';

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

export function relativeTime(iso) {
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
export function pickProfile(source) {
  if (!source) return null;
  const raw = source.profiles ?? source.profile ?? source;
  if (Array.isArray(raw)) return raw[0] || null;
  if (raw && typeof raw === 'object' && (raw.username !== undefined || raw.avatar_url !== undefined)) {
    return raw;
  }
  return null;
}

export function profileAvatarUrl(profile) {
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
  const pinnedBadgeKey =
    profile?.pinned_badge_key || profile?.pinnedBadgeKey || null;
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
          pinnedBadgeKey,
          pinned_badge_key: pinnedBadgeKey,
          heldLabel:
            claim.status === 'Active' || claim.status === 'PendingReview'
              ? formatClaimHeldSince(claim.claimed_at)
              : '',
          submissionEvidence: claim.submission_evidence || '',
          submittedAt: claim.submitted_at || null,
          reviewFeedback: claim.review_feedback || '',
          reviewedAt: claim.reviewed_at || null,
          // Future: Discord notify + card badges can use these without re-parsing
          githubEvidenceUrls: extractGithubUrlsFromEvidence(
            claim.submission_evidence || ''
          ),
          primaryGithubUrl:
            extractGithubUrlsFromEvidence(claim.submission_evidence || '')[0] ||
            null,
        }
      : null,
    claimedBy: showAssignee ? username : null,
    claimedByAvatarUrl: showAssignee ? avatarUrl : null,
    progressPercent,
    /** Pending “bigger than expected” scope help (filled by attachScopeRequests) */
    scopeRequest: null,
    /** Staff override: ignore incomplete blockers when claiming */
    dependencyOverride: Boolean(row.dependency_override),
    /** Volunteers can view; only staff/founders can claim or join */
    staffOnly: Boolean(row.staff_only),
    /** Staff: skip 14/30-day claim auto-release on this card */
    holdClaim: Boolean(row.hold_claim),
    boardScope:
      row.board_scope === BOARD_SCOPE_STAGING
        ? BOARD_SCOPE_STAGING
        : BOARD_SCOPE_PUBLIC,
    sortOrder: Number(row.sort_order) || 0,
    publishedTaskId: row.published_task_id || null,
    publishedAt: row.published_at || null,
    archivedAt: row.archived_at || null,
    /** Filled by attachTaskDependencies */
    blockedBy: [],
    blockedByIds: [],
    blockedByIncomplete: [],
    isLocked: false,
    isBlockedGroup: false,
    isVisuallyBlocked: false,
    lockedWaitingOnBlockers: [],
    lockedWaitingOn: [],
  };
}

/** Attach pending task_scope_requests onto mapped tasks (by task id). */
export function attachScopeRequests(tasks, scopeRows = []) {
  if (!Array.isArray(tasks) || !tasks.length) return tasks || [];
  const byTask = new Map();
  for (const r of scopeRows || []) {
    if (!r?.task_id && !r?.taskId) continue;
    const tid = r.task_id || r.taskId;
    if (!byTask.has(tid)) byTask.set(tid, r);
  }
  return tasks.map((t) => {
    const raw = byTask.get(t.id);
    if (!raw) return { ...t, scopeRequest: null };
    const profile = raw.profiles || raw.requester || null;
    return {
      ...t,
      scopeRequest: {
        id: raw.id,
        taskId: raw.task_id || raw.taskId,
        claimId: raw.claim_id || raw.claimId,
        requesterId: raw.requester_id || raw.requesterId,
        note: raw.note || '',
        status: raw.status || 'pending',
        createdAt: raw.created_at || raw.createdAt,
        username: profile?.username || raw.username || 'Volunteer',
        avatarUrl: profile?.avatar_url || profile?.avatarUrl || null,
      },
    };
  });
}

/**
 * Enrich mapped tasks with depth, child counts, and parent progress %.
 *
 * Parent progress counts only direct children with status Completed
 * (staff-closed). When all children are Completed, the parent is
 * readyForParentReview (→ Ready for Review column) but isFullyDone
 * stays false until staff marks the parent Completed.
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
    if (!t) return 0;
    if (!t.parentTaskId) return 0;
    if (!byId.has(t.parentTaskId)) {
      const inferred = inferTaskBoardDepthFromTitle(t.title);
      return inferred == null ? 0 : inferred;
    }
    return Math.min(
      MAX_TASK_NESTING_DEPTH,
      1 + depthOf(t.parentTaskId, guard + 1)
    );
  };

  const isStatusCompleted = (t) =>
    Boolean(
      t && (t.dbStatus === 'Completed' || t.status === 'completed')
    );

  return tasks.map((t) => {
    const childIds = childrenOf.get(t.id) || [];
    const completedChildCount = childIds.filter((cid) =>
      isStatusCompleted(byId.get(cid))
    ).length;
    const childCount = childIds.length;
    const hasChildren = childCount > 0;
    const hierarchyProgress = hasChildren
      ? Math.round((100 * completedChildCount) / childCount)
      : null;
    const allChildrenCompleted =
      hasChildren && completedChildCount === childCount;
    const statusCompleted = isStatusCompleted(t);
    // Only staff-closed parents/leaves count as fully done — never auto from kids
    const fullyDone = statusCompleted;
    const readyForParentReview =
      allChildrenCompleted && !statusCompleted;

    // Parents with children: progress is only from status-Completed children.
    // Leaves keep claim/checklist progress from mapTaskRow.
    let progressPercent = t.progressPercent;
    if (hasChildren) {
      progressPercent = hierarchyProgress ?? 0;
    } else if (
      Array.isArray(t.subtasks) &&
      t.subtasks.length > 0 &&
      !statusCompleted
    ) {
      const cp = progressFromChecklist(t.subtasks);
      if (cp != null) progressPercent = cp;
    }

    const depth = depthOf(t.id);
    // Clear invalid parent links if parent missing from project set
    const parentTaskId =
      t.parentTaskId && byId.has(t.parentTaskId) ? t.parentTaskId : null;

    // UI status: parents with all children done surface as ready for review
    // until staff completes them (unless already Completed in DB).
    let status = t.status;
    let dbStatus = t.dbStatus;
    if (readyForParentReview && dbStatus !== 'InReview') {
      status = 'in_review';
      // Keep dbStatus as stored; board uses readyForParentReview + status
    }

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
      allChildrenCompleted,
      readyForParentReview,
      isFullyDone: fullyDone,
      status,
      dbStatus,
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

/**
 * Nest tasks under their parents (Epic → Medium → Small).
 * A task is a root when no ancestor is in the same list.
 * Pass `allTasks` so a Small can sit under its Epic when the Medium is
 * missing from this slice (other column, filter, etc.).
 */
export function groupTaskForest(tasks, opts = {}) {
  const list = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const ids = new Set(list.map((t) => t.id).filter(Boolean));
  const lookupSource =
    Array.isArray(opts.allTasks) && opts.allTasks.length > 0
      ? opts.allTasks
      : list;
  const lookup = new Map(
    lookupSource.filter((t) => t?.id).map((t) => [t.id, t])
  );

  const nearestParentId = (t) => {
    let pid = t?.parentTaskId || null;
    let guard = 0;
    while (pid && guard < 10) {
      guard += 1;
      if (pid === t.id) return null;
      if (ids.has(pid)) return pid;
      const parent = lookup.get(pid);
      pid = parent?.parentTaskId || null;
    }
    return null;
  };

  const childrenOf = new Map();
  for (const t of list) {
    const pid = nearestParentId(t);
    if (!pid) continue;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid).push(t);
  }
  for (const kids of childrenOf.values()) {
    kids.sort(compareTaskBoardOrder);
  }
  const roots = list
    .filter((t) => !nearestParentId(t))
    .sort(compareTaskBoardOrder);
  return { roots, childrenOf };
}

/** @deprecated use groupTaskForest */
export function groupCompletedTaskForest(completedTasks) {
  return groupTaskForest(completedTasks);
}

/** Depth-first board order: parent, then its nested work, then the next sibling. */
export function sortTasksAsForest(tasks, opts = {}) {
  const { roots, childrenOf } = groupTaskForest(tasks, opts);
  const out = [];
  const walk = (node) => {
    out.push(node);
    for (const child of childrenOf.get(node.id) || []) walk(child);
  };
  for (const root of roots) walk(root);
  return out;
}

export function countCompletedDescendants(taskId, childrenOf) {
  const kids = childrenOf?.get(taskId) || [];
  let n = kids.length;
  for (const child of kids) {
    n += countCompletedDescendants(child.id, childrenOf);
  }
  return n;
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

/**
 * Top-level Epic for a task (walk parents). If the task is already top-level,
 * returns that task. Orphan medium/small without a known parent is its own root.
 */
export function getEpicRootTask(tasks, taskId) {
  const chain = getTaskBreadcrumb(tasks, taskId);
  return chain[0] || null;
}

/** All ancestor ids including self (root → … → taskId). */
export function getTaskAncestorIds(tasks, taskId) {
  return getTaskBreadcrumb(tasks, taskId).map((t) => t.id);
}

const ACTIVITY_ACTION_LABELS = {
  claimed: 'claimed',
  completed: 'completed',
  returned: 'returned',
  progress: 'updated',
  'updated progress on': 'updated',
  scope_help: 'flagged as larger than expected',
  scope_help_resolved: 'resolved scope help on',
  submitted_for_review: 'submitted for review',
  review_accepted: 'accepted',
  review_rejected: 'sent back',
  auto_released: 'was auto-released from',
  claim_split_to_smalls: 'had a claim returned after Smalls were added to',
  published: 'published to the public board',
  moved_to_staging: 'moved to Staging',
  suggested_task: 'suggested a useful task',
};

/** Checklist ticks are logged, but they should not fill the project hub feed. */
const HIDDEN_PROJECT_HUB_ACTIVITY_ACTIONS = new Set([
  'updated progress on',
  'progress',
  'moved_to_staging',
  'claim_split_to_smalls',
]);

export function isVisibleProjectHubActivity(action) {
  return !HIDDEN_PROJECT_HUB_ACTIVITY_ACTIONS.has(String(action || '').trim());
}

export function mapActivityRow(row) {
  const profile = pickProfile(row);
  const username = profile?.username || 'Someone';
  const avatarUrl = profileAvatarUrl(profile);
  const pinnedBadgeKey =
    profile?.pinned_badge_key || profile?.pinnedBadgeKey || null;
  const rawAction = row.action || '';
  return {
    id: row.id,
    user: username,
    username,
    userInitials: initialsFromName(username),
    avatarUrl,
    avatar_url: avatarUrl,
    pinnedBadgeKey,
    pinned_badge_key: pinnedBadgeKey,
    action: ACTIVITY_ACTION_LABELS[rawAction] || rawAction,
    target: row.target_title || 'a task',
    time: relativeTime(row.created_at),
    createdAt: row.created_at,
    userId: row.user_id,
    metadata: row.metadata || {},
  };
}
