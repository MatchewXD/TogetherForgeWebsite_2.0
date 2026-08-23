import { supabase } from '../lib/supabase';
import { initialsFromName } from '../utils/avatarUtils';
import {
  validateReviewEvidencePackage,
  extractGithubUrlsFromEvidence,
} from '../constants/taskReviewEvidence';

/** Hard max active claims (trusted volunteers, 5+ accepted tasks). */
export const MAX_ACTIVE_CLAIMS = 5;
/** Starting claim slots (0 accepted tasks). */
export const NEW_USER_CLAIM_LIMIT = 2;
/** Mid-tier claim slots (2–4 accepted tasks). */
export const ESTABLISHED_CLAIM_LIMIT = 3;
/**
 * Accepted (Completed) claims required for mid tier (3 claims).
 * Full 5 slots unlock at TRUSTED_CLAIM_UNLOCK_COMPLETIONS.
 */
export const CLAIM_LIMIT_UNLOCK_COMPLETIONS = 2;
/** Accepted tasks required for full claim limit (5). */
export const TRUSTED_CLAIM_UNLOCK_COMPLETIONS = 5;
/** Minutes between claims. */
export const CLAIM_COOLDOWN_MINUTES = 30;
/** Minutes between successful submit-for-review actions. */
export const SUBMIT_COOLDOWN_MINUTES = 45;
/**
 * Days without meaningful progress before idle auto-release.
 * Meaningful progress = progress notes, checklist, status/submit (last_activity_at).
 * Viewing a task does not count.
 */
export const CLAIM_STALE_DAYS = 14;
/** Alias for idle rule (same value). */
export const CLAIM_IDLE_RELEASE_DAYS = CLAIM_STALE_DAYS;
/**
 * Hard maximum claim duration in days (from claimed_at), even with occasional updates.
 */
export const CLAIM_MAX_DURATION_DAYS = 30;

/** Submit-for-review caps per rolling 24h by trust tier. */
export const NEW_USER_SUBMIT_LIMIT_24H = 2;
export const ESTABLISHED_SUBMIT_LIMIT_24H = 4;
export const TRUSTED_SUBMIT_LIMIT_24H = 12;

/**
 * Roles that skip Task Board claim/submit velocity limits (server + client).
 * Keep in sync with public.user_bypasses_task_limits() / is_project_staff().
 */
export const TASK_LIMIT_BYPASS_ROLES = [
  'admin',
  'moderator',
  'project_lead',
  'founder',
];

/**
 * Soft claim ceiling used when staff/test bypass is active (not progressive trust).
 * Server uses the same idea via user_claim_limit().
 */
export const BYPASS_CLAIM_LIMIT = 50;
export const BYPASS_SUBMIT_LIMIT_24H = 500;

/**
 * Whether a profiles row should skip claim/submit rate limits.
 * @param {{ role?: string, task_limit_bypass?: boolean }|null|undefined} profile
 */
export function profileBypassesTaskLimits(profile) {
  if (!profile) return false;
  if (profile.task_limit_bypass === true) return true;
  const role = String(profile.role || 'user').trim();
  return TASK_LIMIT_BYPASS_ROLES.includes(role);
}

/**
 * Progressive claim limit from accepted (Completed) task count only.
 * 0 → 2, 2+ → 3, 5+ → 5
 */
export function claimLimitForAcceptedCount(acceptedCount) {
  const n = Math.max(0, Number(acceptedCount) || 0);
  if (n >= TRUSTED_CLAIM_UNLOCK_COMPLETIONS) return MAX_ACTIVE_CLAIMS;
  if (n >= CLAIM_LIMIT_UNLOCK_COMPLETIONS) return ESTABLISHED_CLAIM_LIMIT;
  return NEW_USER_CLAIM_LIMIT;
}

/**
 * Rolling 24h submit-for-review cap from accepted count.
 * 0 → 2, 2+ → 4, 5+ → 12 (soft high cap)
 */
export function submitLimit24hForAcceptedCount(acceptedCount) {
  const n = Math.max(0, Number(acceptedCount) || 0);
  if (n >= TRUSTED_CLAIM_UNLOCK_COMPLETIONS) return TRUSTED_SUBMIT_LIMIT_24H;
  if (n >= CLAIM_LIMIT_UNLOCK_COMPLETIONS) return ESTABLISHED_SUBMIT_LIMIT_24H;
  return NEW_USER_SUBMIT_LIMIT_24H;
}

/**
 * Trust tier label for reviewers (New / Established / Trusted).
 * @param {number} acceptedCount
 * @param {{ isRestricted?: boolean }} [opts]
 */
export function trustTierFromAccepted(acceptedCount, opts = {}) {
  if (opts.isRestricted) {
    return { tier: 'restricted', label: 'Restricted' };
  }
  const n = Math.max(0, Number(acceptedCount) || 0);
  if (n >= TRUSTED_CLAIM_UNLOCK_COMPLETIONS) {
    return { tier: 'trusted', label: 'Trusted' };
  }
  if (n >= CLAIM_LIMIT_UNLOCK_COMPLETIONS) {
    return { tier: 'established', label: 'Established' };
  }
  return { tier: 'new', label: 'New' };
}

/**
 * Light identity gate: verified email + Discord, Google, or GitHub identity.
 * Uses Supabase user object from auth.getUser().
 * @param {object|null|undefined} user
 */
export function userMeetsIdentityGate(user) {
  if (!user) return false;
  const emailOk = Boolean(user.email_confirmed_at || user.confirmed_at);
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const ssoOk = identities.some((i) => {
    const p = String(i?.provider || '').toLowerCase();
    return p === 'discord' || p === 'google' || p === 'github';
  });
  // Some sessions expose providers only via app_metadata
  const metaProviders = []
    .concat(user.app_metadata?.providers || [])
    .concat(user.app_metadata?.provider ? [user.app_metadata.provider] : [])
    .map((p) => String(p || '').toLowerCase());
  const metaSso =
    metaProviders.includes('discord') ||
    metaProviders.includes('google') ||
    metaProviders.includes('github');
  return emailOk && (ssoOk || metaSso);
}

/**
 * Human-readable identity gate failure (for toasts).
 * @param {object|null|undefined} user
 */
export function identityGateBlockedReason(user) {
  if (!user) return 'Sign in to claim tasks and submit work for review.';
  const emailOk = Boolean(user.email_confirmed_at || user.confirmed_at);
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const metaProviders = []
    .concat(user.app_metadata?.providers || [])
    .concat(user.app_metadata?.provider ? [user.app_metadata.provider] : [])
    .map((p) => String(p || '').toLowerCase());
  const ssoOk =
    identities.some((i) => {
      const p = String(i?.provider || '').toLowerCase();
      return p === 'discord' || p === 'google' || p === 'github';
    }) ||
    metaProviders.includes('discord') ||
    metaProviders.includes('google') ||
    metaProviders.includes('github');
  if (!emailOk && !ssoOk) {
    return 'Verify your email and link Discord, Google, or GitHub before claiming or submitting tasks.';
  }
  if (!emailOk) {
    return 'Verify your email address before claiming or submitting tasks.';
  }
  if (!ssoOk) {
    return 'Link Discord, Google, or GitHub to your account before claiming or submitting tasks.';
  }
  return null;
}

/**
 * Max nesting depth for hierarchical tasks (0 = top-level Epic).
 * Depth 0, 1, 2 = Epic → Medium → Small (3 levels).
 */
export const MAX_TASK_NESTING_DEPTH = 2;

/** Labels for nesting depth (volunteer-friendly). */
export const TASK_LEVEL_LABELS = ['Epic', 'Medium task', 'Small task'];

/**
 * Short hierarchy badges for cards / filters.
 * Use "Mid" (not "Medium") so hierarchy is never confused with difficulty
 * Easy / Medium / Hard.
 */
export const TASK_LEVEL_SHORT = ['Epic', 'Mid', 'Small'];

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

/**
 * True when every checklist item is done.
 * Empty checklist = no checklist requirement (complete for submit).
 */
export function isChecklistComplete(items) {
  const list = Array.isArray(items) ? items : normalizeChecklist(items);
  if (list.length === 0) return true;
  return list.every((s) => Boolean(s.done));
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
 * - Locked (incomplete "Blocked by" deps): not claimable until blockers Completed
 * - Medium/Small leaf (unlocked): claimable
 */
export function getTaskClaimBlockedReason(task) {
  if (!task) return 'Task not found';
  if (task.dbStatus === 'Completed' || task.status === 'completed') {
    return 'This task is already completed';
  }
  if (task.isLocked) {
    const names = (
      task.lockedWaitingOn ||
      (task.blockedByIncomplete || []).map((b) => b.title) ||
      []
    ).filter(Boolean);
    if (names.length) {
      return `Locked – waiting on: ${names.join(', ')}`;
    }
    return 'This task is locked until its blocking tasks are completed and accepted.';
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

/** True when a task row counts as completed/accepted for dependency unlock. */
export function isTaskCompletedAccepted(task) {
  if (!task) return false;
  return (
    task.dbStatus === 'Completed' ||
    task.status === 'completed' ||
    task.isFullyDone === true
  );
}

/**
 * Whether a task is dependency-locked (Blocked by incomplete work).
 * Defensive: uses isLocked when set, else incomplete blocker list.
 */
export function isTaskDependencyLocked(task) {
  if (!task) return false;
  if (isTaskCompletedAccepted(task)) return false;
  if (task.dependencyOverride) return false;
  if (task.isLocked === true) return true;
  if (task.isLocked === false) return false;
  const incomplete = task.blockedByIncomplete;
  return Array.isArray(incomplete) && incomplete.length > 0;
}

/**
 * Board / hierarchy visibility for locked tasks.
 * When showLocked is false (default), locked tasks are hidden everywhere.
 */
export function isTaskVisibleWithLockedToggle(task, showLocked = false) {
  if (!task) return false;
  if (showLocked) return true;
  return !isTaskDependencyLocked(task);
}

/**
 * Attach "Blocked by" edges and compute isLocked / lockedWaitingOn.
 * Call after attachTaskHierarchy so status/hierarchy fields are final.
 * Recomputes volunteerClaimable with the lock gate applied.
 *
 * @param {Array} tasks enriched mapped tasks
 * @param {Array<{task_id?:string,taskId?:string,blocks_on_task_id?:string,blocksOnTaskId?:string}>} dependencyRows
 */
export function attachTaskDependencies(tasks, dependencyRows = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) return tasks || [];

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const blockersOf = new Map();

  for (const row of dependencyRows || []) {
    const tid = row.task_id || row.taskId;
    const bid = row.blocks_on_task_id || row.blocksOnTaskId;
    if (!tid || !bid) continue;
    if (!blockersOf.has(tid)) blockersOf.set(tid, []);
    blockersOf.get(tid).push(bid);
  }

  return tasks.map((t) => {
    const blockerIds = [...new Set(blockersOf.get(t.id) || [])];
    const blockedBy = blockerIds.map((id) => {
      const b = byId.get(id);
      if (!b) {
        return {
          id,
          title: 'Unknown task',
          status: 'todo',
          dbStatus: 'ToDo',
          isComplete: false,
        };
      }
      const isComplete = isTaskCompletedAccepted(b);
      return {
        id: b.id,
        title: b.title || 'Untitled',
        status: b.status,
        dbStatus: b.dbStatus,
        isComplete,
      };
    });
    const blockedByIncomplete = blockedBy.filter((b) => !b.isComplete);
    const dependencyOverride = Boolean(t.dependencyOverride);
    const isDone = isTaskCompletedAccepted(t);
    const isLocked =
      !isDone && !dependencyOverride && blockedByIncomplete.length > 0;
    const lockedWaitingOn = blockedByIncomplete.map((b) => b.title);

    const base = {
      ...t,
      blockedBy,
      blockedByIds: blockerIds,
      blockedByIncomplete,
      dependencyOverride,
      isLocked,
      lockedWaitingOn,
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
 * Whether selecting blockerId as a dependency of taskId would form a cycle
 * (blocker already depends on taskId, directly or via other deps).
 */
export function wouldCreateDependencyCycle(taskId, blockerId, tasks) {
  if (!taskId || !blockerId || taskId === blockerId) return true;
  const byId = new Map((tasks || []).map((t) => [t.id, t]));
  const stack = [blockerId];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) continue;
    if (cur === taskId) return true;
    seen.add(cur);
    const row = byId.get(cur);
    const deps = row?.blockedByIds || [];
    for (const d of deps) stack.push(d);
  }
  return false;
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

/** Days elapsed since ISO timestamp (fractional). */
export function daysSinceIso(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, (Date.now() - then) / (1000 * 60 * 60 * 24));
}

/**
 * Auto-release risk for an Active claim (idle 14d / hard max 30d).
 * @returns {{
 *   reason: 'idle'|'max_duration'|null,
 *   warn: boolean,
 *   urgent: boolean,
 *   idleDays: number|null,
 *   heldDays: number|null,
 *   idleDaysLeft: number|null,
 *   maxDaysLeft: number|null,
 *   shortLabel: string,
 *   detailLabel: string,
 * }}
 */
export function getClaimAutoReleaseInfo(claim, opts = {}) {
  const idleLimit = opts.idleDays ?? CLAIM_IDLE_RELEASE_DAYS;
  const maxLimit = opts.maxDays ?? CLAIM_MAX_DURATION_DAYS;
  const empty = {
    reason: null,
    warn: false,
    urgent: false,
    idleDays: null,
    heldDays: null,
    idleDaysLeft: null,
    maxDaysLeft: null,
    shortLabel: '',
    detailLabel: '',
  };
  if (!claim || claim.status === 'Completed' || claim.status === 'Returned') {
    return empty;
  }
  // PendingReview waits on staff — do not show volunteer auto-release countdown
  if (claim.status === 'PendingReview') return empty;

  const activityIso =
    claim.lastActivityAt || claim.last_activity_at || claim.claimedAt || claim.claimed_at;
  const claimedIso = claim.claimedAt || claim.claimed_at || activityIso;
  const idleDays = daysSinceIso(activityIso);
  const heldDays = daysSinceIso(claimedIso);
  if (idleDays == null && heldDays == null) return empty;

  const idleLeft =
    idleDays == null ? null : Math.max(0, idleLimit - idleDays);
  const maxLeft =
    heldDays == null ? null : Math.max(0, maxLimit - heldDays);

  // Which limit is closer (or already overdue)?
  let reason = null;
  if (heldDays != null && heldDays >= maxLimit) reason = 'max_duration';
  else if (idleDays != null && idleDays >= idleLimit) reason = 'idle';
  else if (
    maxLeft != null &&
    idleLeft != null &&
    maxLeft <= idleLeft
  ) {
    reason = 'max_duration';
  } else if (idleLeft != null) {
    reason = 'idle';
  } else if (maxLeft != null) {
    reason = 'max_duration';
  }

  const daysLeft =
    reason === 'max_duration' ? maxLeft : reason === 'idle' ? idleLeft : null;
  // Warn when within half the idle window of either limit, or already past
  const warnIdle =
    idleDays != null && idleDays >= Math.max(3, Math.floor(idleLimit / 2));
  const warnMax =
    heldDays != null && heldDays >= Math.max(7, Math.floor(maxLimit * 0.7));
  const urgent =
    (daysLeft != null && daysLeft <= 3) ||
    (idleDays != null && idleDays >= idleLimit) ||
    (heldDays != null && heldDays >= maxLimit);
  const warn = warnIdle || warnMax || urgent;

  let shortLabel = '';
  let detailLabel = '';
  if (reason === 'max_duration') {
    if (heldDays != null && heldDays >= maxLimit) {
      shortLabel = 'Max claim time';
      detailLabel = `Claims auto-release after ${maxLimit} days even with updates.`;
    } else {
      shortLabel = `Max ${Math.ceil(maxLeft ?? 0)}d left`;
      detailLabel = `Hard maximum ${maxLimit} days per claim · ~${Math.ceil(maxLeft ?? 0)} day(s) left.`;
    }
  } else if (reason === 'idle') {
    if (idleDays != null && idleDays >= idleLimit) {
      shortLabel = 'Idle release due';
      detailLabel = `No meaningful progress for ${idleLimit}+ days (notes, checklist, or status).`;
    } else {
      shortLabel = `Idle ${Math.ceil(idleLeft ?? 0)}d left`;
      detailLabel = `Update progress within ~${Math.ceil(idleLeft ?? 0)} day(s) or the claim auto-releases (${idleLimit}-day idle rule).`;
    }
  }

  return {
    reason,
    warn,
    urgent,
    idleDays,
    heldDays,
    idleDaysLeft: idleLeft,
    maxDaysLeft: maxLeft,
    shortLabel,
    detailLabel,
  };
}

/** Short copy for claim UI: dual auto-release rules. */
export const CLAIM_AUTO_RELEASE_POLICY_COPY =
  `Claims auto-release after ${CLAIM_IDLE_RELEASE_DAYS} days with no meaningful progress, or after ${CLAIM_MAX_DURATION_DAYS} days total, whichever comes first. Notes, checklist updates, and status changes count as progress. Viewing a task does not.`;

export function formatAutoReleaseReason(reason, meta = {}) {
  const idle = meta.idle_days ?? meta.idleDays ?? CLAIM_IDLE_RELEASE_DAYS;
  const max = meta.max_claim_days ?? meta.maxClaimDays ?? CLAIM_MAX_DURATION_DAYS;
  if (reason === 'max_duration') {
    return `Your claim was auto-released: it reached the ${max}-day maximum claim duration. The task is open for others to claim.`;
  }
  if (reason === 'idle') {
    return `Your claim was auto-released: no meaningful progress for ${idle} days. The task is open for others to claim.`;
  }
  return 'Your claim was auto-released. The task is open for others to claim.';
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
    /** Filled by attachTaskDependencies */
    blockedBy: [],
    blockedByIds: [],
    blockedByIncomplete: [],
    isLocked: false,
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
    if (!t?.parentTaskId || !byId.has(t.parentTaskId)) return 0;
    return 1 + depthOf(t.parentTaskId, guard + 1);
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
  scope_help: 'flagged as larger than expected',
  scope_help_resolved: 'resolved scope help on',
  submitted_for_review: 'submitted for review',
  review_accepted: 'accepted',
  review_rejected: 'sent back',
  auto_released: 'was auto-released from',
};

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
  dependency_override,
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
      avatar_url,
      pinned_badge_key
    )
  )
`;

/** Fallback if dependency_override column not migrated yet. */
const TASK_SELECT_NO_DEP_OVERRIDE = `
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
      avatar_url,
      pinned_badge_key
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
      avatar_url,
      pinned_badge_key
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
      'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, github_url, contribution_meta, updated_at';
    const selectNoGithub =
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
    let mapped = attachTaskHierarchy((data || []).map(mapTaskRow));

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

    const [tasksRes, projectsRes, profilesRes] = await Promise.all([
      taskIds.length
        ? supabase
            .from('tasks')
            .select('id, title, category, difficulty, status, project_id')
            .in('id', taskIds)
        : Promise.resolve({ data: [] }),
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
      const slug = project.slug || project.id || r.project_id;
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
          avatar_url,
          pinned_badge_key
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
          profiles!user_id ( username, avatar_url, pinned_badge_key )
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
          const pinnedBadgeKey =
            profile?.pinned_badge_key || profile?.pinnedBadgeKey || null;
          workerMap.set(c.user_id, {
            userId: c.user_id,
            username,
            avatarUrl,
            avatar_url: avatarUrl,
            pinnedBadgeKey,
            pinned_badge_key: pinnedBadgeKey,
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
   * Public shoutouts for the project hub:
   * - Recent task completions (one card per completion event — same person can
   *   appear more than once for different tasks)
   * - Named donors + one Anonymous supporters card when anonymous credit
   *   exists (same attribution as Contributors / getProjectCredits — no amounts)
   *
   * @param {number} [opts.limit=8] - max task-completion shoutouts (donors append)
   */
  async getShoutouts(projectId, { limit = 8 } = {}) {
    if (!projectId) return [];

    const taskLimit = Math.max(1, Number(limit) || 8);

    let completionRows = [];
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select(
          `
          id,
          action,
          target_title,
          created_at,
          user_id,
          profiles ( username, avatar_url, pinned_badge_key )
        `
        )
        .eq('project_id', projectId)
        .eq('action', 'completed')
        .order('created_at', { ascending: false })
        .limit(taskLimit);
      if (error) throw error;
      completionRows = data || [];
    } catch (err) {
      console.warn('[tasksService.getShoutouts] activity', err);
    }

    // One shoutout per completion event (do not collapse by person)
    const shippers = completionRows.map((row) => {
      const profile = pickProfile(row);
      const name = profile?.username || 'Volunteer';
      const avatarUrl = profileAvatarUrl(profile);
      const pinnedBadgeKey =
        profile?.pinned_badge_key || profile?.pinnedBadgeKey || null;
      return {
        id: `task-${row.id}`,
        userId: row.user_id || null,
        username: profile?.username || null,
        name,
        initials: initialsFromName(name),
        avatarUrl,
        avatar_url: avatarUrl,
        pinnedBadgeKey,
        pinned_badge_key: pinnedBadgeKey,
        note: `Shipped “${row.target_title || 'a task'}” - thanks for moving the forge forward!`,
        role: 'Contributor',
        kind: 'task',
        time: relativeTime(row.created_at),
      };
    });

    let namedDonors = [];
    let anonymousCents = 0;
    try {
      const { getProjectCredits } = await import('./contributorsService');
      const credits = await getProjectCredits(projectId);
      namedDonors = credits?.donations?.namedDonors || [];
      anonymousCents = Number(credits?.donations?.anonymousCents) || 0;
    } catch (err) {
      console.warn('[tasksService.getShoutouts] donations', err);
    }

    // Unique named donors only (one supporter card each)
    const seenDonors = new Set();
    const donors = [];
    for (let i = 0; i < namedDonors.length; i += 1) {
      const d = namedDonors[i];
      const key = d.userId
        ? `u:${d.userId}`
        : `n:${String(d.username || d.displayName || '')
            .trim()
            .toLowerCase()}`;
      if (!key || key === 'n:' || seenDonors.has(key)) continue;
      seenDonors.add(key);

      const name = d.displayName || d.username || 'Supporter';
      const avatarUrl = d.avatarUrl || d.avatar_url || null;
      const pinnedBadgeKey =
        d.pinnedBadgeKey || d.pinned_badge_key || null;
      donors.push({
        id: `donor-${d.userId || d.username || d.displayName || i}`,
        userId: d.userId || null,
        username: d.username || null,
        name,
        initials: initialsFromName(name),
        avatarUrl,
        avatar_url: avatarUrl,
        pinnedBadgeKey,
        pinned_badge_key: pinnedBadgeKey,
        note: 'Supported this project. Thank you!',
        role: 'Supporter',
        kind: 'donation',
        time: null,
      });
    }

    // Single card for anonymous support (no names / no amounts)
    if (anonymousCents > 0) {
      donors.push({
        id: 'donor-anonymous',
        userId: null,
        username: null,
        name: 'Anonymous',
        initials: '?',
        avatarUrl: null,
        avatar_url: null,
        pinnedBadgeKey: null,
        pinned_badge_key: null,
        note: 'An anonymous supporter has supported this project. Thank you!',
        role: 'Supporter',
        kind: 'donation',
        time: null,
      });
    }

    const combined = [...shippers, ...donors];
    // Hydrate pinned badges for donors (RPC often omits pin) and any gaps
    try {
      const ids = [
        ...new Set(combined.map((p) => p.userId).filter(Boolean)),
      ];
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, pinned_badge_key')
          .in('id', ids);
        const pinById = new Map(
          (profiles || []).map((p) => [p.id, p.pinned_badge_key || null])
        );
        for (const person of combined) {
          if (!person.userId) continue;
          if (!person.pinnedBadgeKey && pinById.has(person.userId)) {
            const pin = pinById.get(person.userId);
            person.pinnedBadgeKey = pin;
            person.pinned_badge_key = pin;
          }
        }
      }
    } catch {
      /* optional column / RLS */
    }

    // Recent wins first, then supporters
    return combined;
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
   * Server quota snapshot (claim + submit limits, identity, restriction).
   * Falls back to client-side estimate if RPC missing / not yet migrated.
   */
  async getMyClaimQuota() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        signedIn: false,
        canClaimNow: false,
        canSubmitNow: false,
        meetsIdentityGate: false,
      };
    }

    const identityOk = userMeetsIdentityGate(user);
    const identityReason = identityGateBlockedReason(user);

    const { data, error } = await supabase.rpc('get_my_claim_quota');
    if (!error && data) {
      const identity = data.identity || {};
      const meetsGate =
        typeof identity.meets_gate === 'boolean'
          ? identity.meets_gate
          : identityOk;
      const rateLimitBypass = Boolean(data.rate_limit_bypass);
      return {
        signedIn: true,
        activeClaims: Number(data.active_claims) || 0,
        activeWorking: Number(data.active_working) || 0,
        pendingReview: Number(data.pending_review) || 0,
        completedClaims: Number(data.completed_claims) || 0,
        claimLimit: Number(data.claim_limit) || NEW_USER_CLAIM_LIMIT,
        submitLimit24h:
          Number(data.submit_limit_24h) ||
          submitLimit24hForAcceptedCount(data.completed_claims),
        submitsLast24h: Number(data.submits_last_24h) || 0,
        cooldownEndsAt: rateLimitBypass ? null : data.cooldown_ends_at || null,
        submitCooldownEndsAt: rateLimitBypass
          ? null
          : data.submit_cooldown_ends_at || null,
        canClaimNow: Boolean(data.can_claim_now),
        canSubmitNow: Boolean(data.can_submit_now),
        isRestricted: Boolean(data.is_restricted),
        restrictionPermanent: Boolean(data.restriction_permanent),
        restrictedUntil: data.restricted_until || null,
        restrictionReason: data.restriction_reason || null,
        fakeRejectionCount: Number(data.fake_rejection_count) || 0,
        meetsIdentityGate: meetsGate,
        identityReason: meetsGate ? null : identityReason,
        rateLimitBypass,
        trustTier:
          data.trust_tier ||
          (rateLimitBypass
            ? 'staff'
            : trustTierFromAccepted(data.completed_claims).tier),
        identity,
      };
    }

    // Client-side fallback (pre-migration / RPC missing)
    let rateLimitBypass = false;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, task_limit_bypass')
        .eq('id', user.id)
        .maybeSingle();
      rateLimitBypass = profileBypassesTaskLimits(profile);
    } catch {
      rateLimitBypass = false;
    }

    const [active, completed] = await Promise.all([
      this.countActiveClaims(user.id),
      this.countCompletedClaims(user.id),
    ]);
    const claimLimit = rateLimitBypass
      ? BYPASS_CLAIM_LIMIT
      : claimLimitForAcceptedCount(completed);
    const submitLimit24h = rateLimitBypass
      ? BYPASS_SUBMIT_LIMIT_24H
      : submitLimit24hForAcceptedCount(completed);

    const { data: lastRows } = await supabase
      .from('task_claims')
      .select('claimed_at, submitted_at')
      .eq('user_id', user.id)
      .order('claimed_at', { ascending: false })
      .limit(5);

    const lastAt = lastRows?.[0]?.claimed_at
      ? new Date(lastRows[0].claimed_at).getTime()
      : null;
    const cooldownEndsAt =
      !rateLimitBypass && lastAt != null
        ? new Date(lastAt + CLAIM_COOLDOWN_MINUTES * 60 * 1000).toISOString()
        : null;

    const lastSubmitTs = (lastRows || [])
      .map((r) => (r.submitted_at ? new Date(r.submitted_at).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    const submitCooldownEndsAt =
      !rateLimitBypass && lastSubmitTs > 0
        ? new Date(
            lastSubmitTs + SUBMIT_COOLDOWN_MINUTES * 60 * 1000
          ).toISOString()
        : null;

    const canClaimNow =
      identityOk &&
      active < claimLimit &&
      (!cooldownEndsAt || new Date(cooldownEndsAt).getTime() <= Date.now());
    const canSubmitNow =
      identityOk &&
      (rateLimitBypass ||
        ((!submitCooldownEndsAt ||
          new Date(submitCooldownEndsAt).getTime() <= Date.now()) &&
          true));

    return {
      signedIn: true,
      activeClaims: active,
      completedClaims: completed,
      claimLimit,
      submitLimit24h,
      submitsLast24h: 0,
      cooldownEndsAt,
      submitCooldownEndsAt,
      canClaimNow,
      canSubmitNow,
      isRestricted: false,
      meetsIdentityGate: identityOk,
      identityReason: identityOk ? null : identityReason,
      rateLimitBypass,
      trustTier: rateLimitBypass
        ? 'staff'
        : trustTierFromAccepted(completed).tier,
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

    const idReason = identityGateBlockedReason(user);
    if (idReason) {
      const err = new Error(idReason);
      err.code = 'IDENTITY_GATE';
      throw err;
    }

    if (opts.task) {
      const blocked = getTaskClaimBlockedReason(opts.task);
      if (blocked) {
        const err = new Error(blocked);
        err.code = opts.task?.isLocked ? 'TASK_LOCKED' : 'CLAIM_HIERARCHY';
        throw err;
      }
    }

    // Best-effort dual-rule auto-release (no-op if RPC missing)
    try {
      await this.runClaimAutoRelease();
    } catch {
      /* ignore */
    }

    const quota = await this.getMyClaimQuota();
    if (quota.signedIn) {
      if (quota.isRestricted) {
        const until = quota.restrictedUntil
          ? ` until ${new Date(quota.restrictedUntil).toLocaleDateString()}`
          : '';
        const err = new Error(
          quota.restrictionPermanent
            ? 'Your claim privileges are restricted. Contact a Project Lead on Discord to appeal.'
            : `Your claim privileges are temporarily limited${until}. Contact a Project Lead on Discord to appeal, or wait for the restriction to lift.`
        );
        err.code = 'CLAIM_RESTRICTED';
        throw err;
      }
      // Staff / test-account bypass: skip progressive claim limit + claim cooldown
      if (!quota.rateLimitBypass && !quota.canClaimNow) {
        if (quota.activeClaims >= quota.claimLimit) {
          const err = new Error(
            `Claim limit reached (${quota.activeClaims}/${quota.claimLimit}). Complete accepted work or return a task first. New accounts: ${NEW_USER_CLAIM_LIMIT} slots → ${ESTABLISHED_CLAIM_LIMIT} after ${CLAIM_LIMIT_UNLOCK_COMPLETIONS} accepted → ${MAX_ACTIVE_CLAIMS} after ${TRUSTED_CLAIM_UNLOCK_COMPLETIONS}.`
          );
          err.code = 'CLAIM_LIMIT';
          err.activeClaims = quota.activeClaims;
          err.limit = quota.claimLimit;
          throw err;
        }
        if (
          quota.cooldownEndsAt &&
          new Date(quota.cooldownEndsAt).getTime() > Date.now()
        ) {
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
        if (!quota.meetsIdentityGate && quota.identityReason) {
          const err = new Error(quota.identityReason);
          err.code = 'IDENTITY_GATE';
          throw err;
        }
      } else if (
        !quota.canClaimNow &&
        !quota.meetsIdentityGate &&
        quota.identityReason
      ) {
        // Bypass does not skip identity gate
        const err = new Error(quota.identityReason);
        err.code = 'IDENTITY_GATE';
        throw err;
      }
    }

    const { data, error } = await supabase.rpc('claim_task', {
      p_task_id: taskId,
    });
    if (error) {
      const msg = error.message || '';
      if (/IDENTITY_GATE/i.test(msg)) {
        const err = new Error(
          msg.replace(/^IDENTITY_GATE:\s*/i, '') ||
            identityGateBlockedReason(user)
        );
        err.code = 'IDENTITY_GATE';
        throw err;
      }
      if (/CLAIM_RESTRICTED/i.test(msg)) {
        const err = new Error(msg.replace(/^CLAIM_RESTRICTED:\s*/i, ''));
        err.code = 'CLAIM_RESTRICTED';
        throw err;
      }
      if (/TASK_LOCKED/i.test(msg) || /Locked – waiting on/i.test(msg)) {
        const err = new Error(
          msg.replace(/^TASK_LOCKED:\s*/i, '') ||
            'This task is locked until its blocking tasks are completed.'
        );
        err.code = 'TASK_LOCKED';
        throw err;
      }
      if (/Epic|sub-task|cannot be claimed|hierarchy/i.test(msg)) {
        const err = new Error(msg);
        err.code = 'CLAIM_HIERARCHY';
        throw err;
      }
      if (/RATE_LIMITED/i.test(msg)) {
        const err = new Error(
          "You're doing that too quickly. Please wait a moment and try again."
        );
        err.code = 'RATE_LIMITED';
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
   * Requires evidence note + at least one URL (enforced client + server).
   * @param {string} taskId
   * @param {string} evidence - composed evidence package
   * @param {{ subtasks?: array, links?: string[], note?: string }} [opts]
   */
  async submitForReview(taskId, evidence, { subtasks, links, note } = {}) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const err = new Error('You must be signed in to submit for review');
      err.code = 'AUTH';
      throw err;
    }

    const idReason = identityGateBlockedReason(user);
    if (idReason) {
      const err = new Error(idReason);
      err.code = 'IDENTITY_GATE';
      throw err;
    }

    const packageText = String(evidence || '').trim();
    // Prefer structured validation when note/links provided; else package text
    if (note != null || links != null) {
      const v = validateReviewEvidencePackage({
        note: note ?? packageText,
        links: links ?? [],
      });
      if (!v.ok) {
        const err = new Error(v.message);
        err.code = v.code;
        throw err;
      }
    } else {
      if (packageText.length < 15) {
        const err = new Error(
          'Add a short evidence note (at least 15 characters) describing what you delivered.'
        );
        err.code = 'EVIDENCE_REQUIRED';
        throw err;
      }
      if (!/https?:\/\/[^\s<>"{}|\\^`\[\]]+/i.test(packageText)) {
        const err = new Error(
          'Include at least one evidence link (URL) so reviewers can verify your work.'
        );
        err.code = 'EVIDENCE_LINK_REQUIRED';
        throw err;
      }
    }

    // Prefer latest draft checklist when provided; else rely on DB + RPC
    if (subtasks != null && !isChecklistComplete(subtasks)) {
      const err = new Error(
        'Complete every checklist item before submitting for review.'
      );
      err.code = 'CHECKLIST_INCOMPLETE';
      throw err;
    }

    // Soft client velocity check (server is authoritative)
    try {
      const quota = await this.getMyClaimQuota();
      if (quota.isRestricted) {
        const err = new Error(
          'Your claim privileges are limited, so you cannot submit for review right now. Contact a Project Lead on Discord to appeal.'
        );
        err.code = 'CLAIM_RESTRICTED';
        throw err;
      }
      // Staff / test accounts: skip submit cooldown + 24h cap
      if (!quota.rateLimitBypass) {
        if (
          quota.submitCooldownEndsAt &&
          new Date(quota.submitCooldownEndsAt).getTime() > Date.now()
        ) {
          const mins = Math.max(
            1,
            Math.ceil(
              (new Date(quota.submitCooldownEndsAt).getTime() - Date.now()) /
                60000
            )
          );
          const err = new Error(
            `Submit cooldown: wait about ${mins} more minute${mins === 1 ? '' : 's'} before submitting another task for review.`
          );
          err.code = 'SUBMIT_COOLDOWN';
          throw err;
        }
        if (
          typeof quota.submitsLast24h === 'number' &&
          typeof quota.submitLimit24h === 'number' &&
          quota.submitsLast24h >= quota.submitLimit24h
        ) {
          const err = new Error(
            `Review submission limit reached (${quota.submitsLast24h}/${quota.submitLimit24h} in 24 hours). Limits rise after your work is accepted.`
          );
          err.code = 'SUBMIT_LIMIT';
          throw err;
        }
      }
    } catch (e) {
      if (
        e?.code === 'SUBMIT_COOLDOWN' ||
        e?.code === 'SUBMIT_LIMIT' ||
        e?.code === 'CLAIM_RESTRICTED'
      ) {
        throw e;
      }
      /* quota optional */
    }

    const { data, error } = await supabase.rpc('submit_task_for_review', {
      p_task_id: taskId,
      p_evidence: packageText,
    });
    if (error) {
      const msg = error.message || '';
      if (/IDENTITY_GATE/i.test(msg)) {
        const err = new Error(msg.replace(/^IDENTITY_GATE:\s*/i, ''));
        err.code = 'IDENTITY_GATE';
        throw err;
      }
      if (/CLAIM_RESTRICTED/i.test(msg)) {
        const err = new Error(msg.replace(/^CLAIM_RESTRICTED:\s*/i, ''));
        err.code = 'CLAIM_RESTRICTED';
        throw err;
      }
      if (/EVIDENCE_LINK/i.test(msg)) {
        const err = new Error(msg.replace(/^EVIDENCE_LINK_REQUIRED:\s*/i, ''));
        err.code = 'EVIDENCE_LINK_REQUIRED';
        throw err;
      }
      if (/EVIDENCE_REQUIRED/i.test(msg)) {
        const err = new Error(msg.replace(/^EVIDENCE_REQUIRED:\s*/i, ''));
        err.code = 'EVIDENCE_REQUIRED';
        throw err;
      }
      if (/SUBMIT_LIMIT/i.test(msg)) {
        const err = new Error(msg.replace(/^SUBMIT_LIMIT:\s*/i, ''));
        err.code = 'SUBMIT_LIMIT';
        throw err;
      }
      if (/SUBMIT_COOLDOWN/i.test(msg)) {
        const err = new Error(msg.replace(/^SUBMIT_COOLDOWN:\s*/i, ''));
        err.code = 'SUBMIT_COOLDOWN';
        throw err;
      }
      if (/checklist/i.test(msg)) {
        const err = new Error(msg);
        err.code = 'CHECKLIST_INCOMPLETE';
        throw err;
      }
      throw error;
    }
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

  /**
   * Staff: reject pending submission as fake/no-real-work, release claim,
   * and escalate claim restrictions for the claimant.
   */
  async rejectAsFakeWork(taskId, feedback) {
    const { data, error } = await supabase.rpc('reject_task_as_fake_work', {
      p_task_id: taskId,
      p_feedback: feedback || null,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Staff/self: trust signal + current claimed / in-review load.
   * @param {string} userId
   */
  async getContributorTrust(userId) {
    if (!userId) return null;
    const { data, error } = await supabase.rpc('get_contributor_trust', {
      p_user_id: userId,
    });
    if (error) {
      console.warn('[tasksService.getContributorTrust]', error);
      return null;
    }
    if (!data || data.found === false) return null;
    return {
      userId: data.user_id,
      acceptedTasks: Number(data.accepted_tasks) || 0,
      activeClaims: Number(data.active_claims) || 0,
      pendingReview: Number(data.pending_review) || 0,
      boardLoad: Number(data.board_load) || 0,
      claimLimit: Number(data.claim_limit) || NEW_USER_CLAIM_LIMIT,
      accountAgeDays: Number(data.account_age_days) || 0,
      joinedAt: data.joined_at || null,
      trustTier: data.trust_tier || 'new',
      trustLabel: data.trust_label || 'New',
      isRestricted: Boolean(data.is_restricted),
      restrictionPermanent: Boolean(data.restriction_permanent),
      restrictedUntil: data.restricted_until || null,
      fakeRejectionCount: Number(data.fake_rejection_count) || 0,
    };
  },

  /**
   * Staff: recent claim restriction / fake-work audit events.
   * @param {number} [limit]
   */
  async listRestrictionEvents(limit = 50) {
    const { data, error } = await supabase.rpc(
      'list_recent_restriction_events',
      {
        p_limit: limit,
      }
    );
    if (error) {
      // Table/RPC may not be migrated yet
      if (
        /list_recent_restriction|task_restriction_events|schema cache|does not exist/i.test(
          error.message || ''
        )
      ) {
        const err = new Error(
          'Restriction audit is not set up yet. Run supabase/sql/supabase_task_anti_abuse.sql.'
        );
        err.code = 'RESTRICTION_TABLE_MISSING';
        throw err;
      }
      throw error;
    }
    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      actorId: row.actor_id,
      eventType: row.event_type,
      reason: row.reason,
      taskId: row.task_id,
      claimId: row.claim_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));
  },

  async returnClaim(taskId) {
    const { data, error } = await supabase.rpc('return_task_claim', {
      p_task_id: taskId,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Dual-rule auto-release: idle (default 14d) + hard max (default 30d).
   * Prefers run_claim_auto_release RPC; falls back to return_stale_claims count.
   * @returns {{ releasedCount: number, idleDays: number, maxClaimDays: number, released: Array, testForceIdle?: boolean }}
   */
  async runClaimAutoRelease({
    idleDays = CLAIM_IDLE_RELEASE_DAYS,
    maxClaimDays = CLAIM_MAX_DURATION_DAYS,
  } = {}) {
    const { data, error } = await supabase.rpc('run_claim_auto_release', {
      p_idle_days: idleDays,
      p_max_claim_days: maxClaimDays,
    });

    if (!error && data != null) {
      if (typeof data === 'number') {
        return {
          releasedCount: data,
          idleDays,
          maxClaimDays,
          released: [],
        };
      }
      return {
        releasedCount: Number(data.released_count ?? data.releasedCount ?? 0),
        idleDays: Number(data.idle_days ?? data.idleDays ?? idleDays),
        maxClaimDays: Number(
          data.max_claim_days ?? data.maxClaimDays ?? maxClaimDays
        ),
        released: Array.isArray(data.released) ? data.released : [],
        testForceIdle: Boolean(data.test_force_idle ?? data.testForceIdle),
        mode: data.mode || null,
        message: data.message || null,
      };
    }

    // Fallback: older return_stale_claims(integer) — idle only, no detail
    if (
      error &&
      /function|does not exist|PGRST202|Could not find/i.test(error.message || '')
    ) {
      const legacy = await supabase.rpc('return_stale_claims', {
        p_days: idleDays > 0 ? idleDays : CLAIM_IDLE_RELEASE_DAYS,
      });
      if (legacy.error) throw legacy.error;
      const n =
        typeof legacy.data === 'number'
          ? legacy.data
          : Number(legacy.data?.released_count ?? 0);
      return {
        releasedCount: n,
        idleDays,
        maxClaimDays,
        released: [],
        legacy: true,
      };
    }
    if (error) throw error;
    return {
      releasedCount: 0,
      idleDays,
      maxClaimDays,
      released: [],
    };
  },

  /**
   * Staff/test only: run auto-release as if every Active claim has been idle
   * for the full 14-day window (does not wait real time).
   */
  async runClaimAutoReleaseTest() {
    const { data, error } = await supabase.rpc('run_claim_auto_release_test');

    if (!error && data != null) {
      return {
        releasedCount: Number(data.released_count ?? data.releasedCount ?? 0),
        idleDays: Number(
          data.idle_days ?? data.idleDays ?? CLAIM_IDLE_RELEASE_DAYS
        ),
        maxClaimDays: Number(
          data.max_claim_days ?? data.maxClaimDays ?? CLAIM_MAX_DURATION_DAYS
        ),
        released: Array.isArray(data.released) ? data.released : [],
        testForceIdle: true,
        mode: data.mode || 'test_idle_14d',
        message:
          data.message ||
          'Test run: Active claims were evaluated as if idle for 14 days.',
      };
    }

    // Fallback if dedicated test RPC not migrated: idle_days = 0 on main RPC
    if (
      error &&
      /function|does not exist|PGRST202|Could not find/i.test(error.message || '')
    ) {
      return this.runClaimAutoRelease({
        idleDays: 0,
        maxClaimDays: CLAIM_MAX_DURATION_DAYS,
      });
    }
    if (error) throw error;
    return {
      releasedCount: 0,
      idleDays: CLAIM_IDLE_RELEASE_DAYS,
      maxClaimDays: CLAIM_MAX_DURATION_DAYS,
      released: [],
      testForceIdle: true,
    };
  },

  /** @deprecated Prefer runClaimAutoRelease — still used as thin wrapper. */
  async returnStaleClaims(days = CLAIM_IDLE_RELEASE_DAYS) {
    const result = await this.runClaimAutoRelease({
      idleDays: days,
      maxClaimDays: CLAIM_MAX_DURATION_DAYS,
    });
    return result.releasedCount;
  },

  /**
   * Recent auto-release notices for the signed-in user (last 14 days).
   * Used to clearly inform previous claimants.
   */
  async listMyRecentAutoReleases({ days = 14, limit = 20 } = {}) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, days));

    const { data, error } = await supabase
      .from('activity_log')
      .select(
        'id, project_id, user_id, action, target_id, target_title, metadata, created_at'
      )
      .eq('user_id', user.id)
      .eq('action', 'auto_released')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[tasksService.listMyRecentAutoReleases]', error.message);
      return [];
    }

    return (data || []).map((row) => {
      const meta = row.metadata || {};
      const reason = meta.reason || null;
      return {
        id: row.id,
        projectId: row.project_id,
        taskId: row.target_id,
        taskTitle: row.target_title || 'a task',
        reason,
        message: formatAutoReleaseReason(reason, meta),
        createdAt: row.created_at,
        metadata: meta,
      };
    });
  },

  /**
   * Staff: replace "Blocked by" set and optional dependency_override.
   * Uses set_task_dependencies RPC when available; falls back to table writes.
   */
  async setTaskDependencies(taskId, blockerIds = [], dependencyOverride = null) {
    if (!taskId) throw new Error('Task id is required');
    const ids = [...new Set((blockerIds || []).filter(Boolean))];

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

    let { data, error } = await supabase
      .from('tasks')
      .insert([row])
      .select(TASK_SELECT)
      .single();

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

    const mapped = mapTaskRow(data);
    const blockerIds = payload.blockedByTaskIds || payload.blockedByIds || [];
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

    let { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', taskId)
      .select(TASK_SELECT)
      .single();

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
  /**
   * Open claims for the signed-in user (Active + PendingReview).
   * Matches claim-limit accounting: both statuses occupy a claim slot.
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
        submitted_at,
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
      .in('status', ['Active', 'PendingReview'])
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
      const claimStatus = row.status || 'Active';
      const inReview =
        claimStatus === 'PendingReview' ||
        task?.status === 'InReview';
      const progressPercent = inReview
        ? Math.max(Number(row.progress_percent) || 0, 90)
        : Number(row.progress_percent) || 0;
      return {
        claimId: row.id,
        taskId: row.task_id || task?.id,
        taskTitle: task?.title || 'Task',
        taskStatus: task?.status || null,
        claimStatus,
        inReview,
        category: task?.category || null,
        difficulty: task?.difficulty || null,
        projectId,
        projectSlug,
        // Prefer slug for /projects/:id workspace routes
        projectPath: projectSlug || projectId,
        /** Deep link to task board when possible */
        boardPath: projectSlug
          ? `/projects/${projectSlug}/board`
          : projectId
            ? `/projects/${projectId}/board`
            : null,
        projectTitle: project?.title || 'Project',
        claimedAt: row.claimed_at,
        submittedAt: row.submitted_at || null,
        progressPercent,
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
