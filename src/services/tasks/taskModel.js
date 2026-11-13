/**
 * Task Board model helpers: levels, checklists, board scope, blockers, visibility, dependencies.
 * Part of the tasks service; import from '../tasksService' in app code.
 */

import { taskMatchesCategoryFilter } from '../../constants/taskCategories';

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
 * When a parent row is missing from the live board (archived), do not
 * treat a nested title like Tether-P.3.2 as an Epic.
 * Tether-P → 0, Tether-4.1 → 1, Tether-P.3.2 → 2. Null if the title
 * is not a Tether-style ID.
 */
export function inferTaskBoardDepthFromTitle(title) {
  const head = String(title || '').trim().split(/\s+/)[0] || '';
  const match = head.match(/^Tether-(P|CD|\d+)((?:\.\d+)*)$/i);
  if (!match) return null;
  const extra = match[2] ? match[2].split('.').filter(Boolean).length : 0;
  return Math.min(MAX_TASK_NESTING_DEPTH, extra);
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

export const STAFF_CONTACT_EMAIL = 'contact@togetherforge.net';

/** Staff error when a task is set to wait on itself. */
export const TASK_CANNOT_WAIT_ON_SELF = 'A task cannot wait on itself.';

export const STAFF_ONLY_TASK_SNIPPET =
  'Only staff can claim and complete this task.';

export const STAFF_ONLY_TASK_MESSAGE =
  'Only staff can claim and complete this task. If your work is waiting on it, please be patient. If you need it sooner, email contact@togetherforge.net or reach us on Discord.';

export const BOARD_SCOPE_PUBLIC = 'public';
export const BOARD_SCOPE_STAGING = 'staging';
export const STAGING_TASK_CLAIM_MESSAGE =
  'Staging tasks cannot be claimed. Publish them to the public board first.';

export function isStagingTask(task) {
  const scope = task?.boardScope || task?.board_scope;
  return String(scope || BOARD_SCOPE_PUBLIC) === BOARD_SCOPE_STAGING;
}

/** Epic or Medium on Staging can be published (Smalls ride with their parent). */
export function canPublishStagingTask(task) {
  if (!isStagingTask(task)) return false;
  const depth = Number(task.depth) || 0;
  return depth === 0 || depth === 1;
}

/** Epic or Medium on the public board can be moved back to Staging. */
export function canMovePublicTaskToStaging(task) {
  if (!task?.id || isStagingTask(task)) return false;
  const depth = Number(task.depth) || 0;
  return depth === 0 || depth === 1;
}

export function compareTaskBoardOrder(a, b) {
  const so = (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0);
  if (so !== 0) return so;
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
}

/** True when the mapped task (or raw row) is flagged Staff Only. */
export function isTaskStaffOnly(task) {
  return Boolean(task?.staffOnly || task?.staff_only);
}

/** True when staff disabled 14/30-day auto-release on this card. */
export function isTaskClaimHeld(task) {
  return Boolean(task?.holdClaim || task?.hold_claim);
}

function normalizeWaitingBlocker(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string') {
    const title = entry.trim();
    return title ? { id: null, title, isComplete: false } : null;
  }
  const id = entry.id || entry.taskId || null;
  const title = String(entry.title || '').trim();
  if (!id && !title) return null;
  return {
    id,
    title: title || 'Untitled',
    isComplete: Boolean(entry.isComplete),
  };
}

/**
 * Drop wait-on blockers that refer to this task (self-block display).
 * Accepts {id, title} objects or title strings.
 */
export function waitingBlockersExcludingSelf(task, blockers) {
  const list = Array.isArray(blockers) ? blockers : [];
  const selfId = task?.id != null ? String(task.id) : '';
  const title = String(task?.title || '').trim();
  const code = title.split(/\s+/)[0] || '';
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const b = normalizeWaitingBlocker(raw);
    if (!b) continue;
    if (selfId && b.id && String(b.id) === selfId) continue;
    const name = b.title;
    if (title && name === title) continue;
    if (code && (name === code || name.startsWith(`${code} `))) continue;
    const key = b.id ? `id:${b.id}` : `t:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

/** Drop wait-on names that refer to this task (self-block display). */
export function waitingNamesExcludingSelf(task, names) {
  return waitingBlockersExcludingSelf(task, names).map((b) => b.title);
}

/**
 * Incomplete blockers for “Waiting on:” copy, with ids when known.
 * Prefers rolled-up lockedWaitingOnBlockers, then own blockedByIncomplete,
 * then title-only lockedWaitingOn.
 */
export function getTaskWaitingOnBlockers(task) {
  if (!task) return [];
  if (
    Array.isArray(task.lockedWaitingOnBlockers) &&
    task.lockedWaitingOnBlockers.length > 0
  ) {
    return waitingBlockersExcludingSelf(task, task.lockedWaitingOnBlockers);
  }
  if (
    Array.isArray(task.blockedByIncomplete) &&
    task.blockedByIncomplete.length > 0
  ) {
    return waitingBlockersExcludingSelf(task, task.blockedByIncomplete);
  }
  return waitingBlockersExcludingSelf(task, task.lockedWaitingOn);
}

/**
 * Ongoing Community Decisions epic (Tether-CD). Staff hold it in In Progress
 * until the game is done. Not a new board column.
 */
export function isCommunityDecisionsEpic(task) {
  if (!task || task.parentTaskId) return false;
  if (isTaskCompletedAccepted(task)) return false;
  const title = String(task.title || '').trim();
  return /^Tether-CD(?:\s|$)/i.test(title);
}

/**
 * Claims that run_claim_auto_release will not return.
 * Hold claim is the staff flag; Tether-CD epic is also skipped in SQL.
 */
export function isClaimAutoReleaseExempt(task) {
  return isTaskClaimHeld(task) || isCommunityDecisionsEpic(task);
}

/**
 * Volunteer claim rules (client + server should agree):
 * - Epic (depth 0): never claimable, except staff holding Tether-CD
 * - Medium/Small with children: not claimable (progress from children)
 * - Locked (incomplete "Blocked by" deps): not claimable until blockers Completed
 * - Medium/Small leaf (unlocked): claimable
 *
 * Staff Only is a separate gate — volunteers still see the task. Use
 * getUserTaskClaimBlockedReason when the viewer role is known.
 */
export function getTaskClaimBlockedReason(task, opts = {}) {
  if (!task) return 'Task not found';
  if (isStagingTask(task)) {
    return STAGING_TASK_CLAIM_MESSAGE;
  }
  if (task.dbStatus === 'Completed' || task.status === 'completed') {
    return 'This task is already completed';
  }
  const overrideOn = Boolean(task.dependencyOverride);
  if (task.isLocked && !overrideOn) {
    const names = waitingNamesExcludingSelf(
      task,
      task.lockedWaitingOn ||
        (task.blockedByIncomplete || []).map((b) => b.title) ||
        []
    );
    if (names.length) {
      return `Locked – waiting on: ${names.join(', ')}`;
    }
    return 'This task is locked until its blocking tasks are completed and accepted.';
  }
  const depth = Number(task.depth) || 0;
  if (depth === 0) {
    if (opts.isStaff && isCommunityDecisionsEpic(task)) return null;
    return 'Epics cannot be claimed. Open a Medium or Small task under this epic.';
  }
  if (
    !opts.isStaff &&
    (task.hasChildren || (task.childCount || 0) > 0)
  ) {
    return 'This task has sub-tasks and is not claimable. Claim a Small (or leaf Medium) task instead.';
  }
  return null;
}

/** Blocks volunteers from claiming/joining Staff Only tasks; staff pass through. */
export function getTaskStaffOnlyBlockedReason(task, isStaff = false) {
  if (!isTaskStaffOnly(task) || isStaff) return null;
  return STAFF_ONLY_TASK_MESSAGE;
}

/**
 * Hierarchy/lock rules plus Staff Only for the current viewer.
 * @param {object} task
 * @param {{ isStaff?: boolean }} [opts]
 */
export function getUserTaskClaimBlockedReason(task, opts = {}) {
  return (
    getTaskClaimBlockedReason(task, opts) ||
    getTaskStaffOnlyBlockedReason(task, Boolean(opts.isStaff))
  );
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
 * showLocked true = blocked tasks stay visible in place.
 * showLocked false = blocked tasks are hidden everywhere.
 */
export function isTaskVisibleWithLockedToggle(task, showLocked = false) {
  if (!task) return false;
  if (showLocked) return true;
  return !isTaskDependencyLocked(task);
}

function taskHasAncestorInSet(task, idSet, lookup) {
  let pid = task?.parentTaskId || null;
  let guard = 0;
  while (pid && guard < 10) {
    guard += 1;
    if (idSet.has(pid)) return true;
    const parent = lookup.get(pid);
    pid = parent?.parentTaskId || null;
  }
  return false;
}

function isBoardTopScopeTask(task) {
  if (!task?.parentTaskId) return true;
  if (task.dbStatus === 'Completed' || task.status === 'completed') return true;
  const claimStatus = task.claim?.status;
  if (claimStatus === 'Active' || claimStatus === 'PendingReview') return true;
  if (task.dbStatus === 'InReview' || task.status === 'in_review') return true;
  if (claimStatus === 'Completed') return true;
  return false;
}

/**
 * Kanban slice.
 * Top-level is epics / true roots (plus claimed or in-review leaves so
 * active work does not vanish). Nested blocked cards stay off this list —
 * they belong under the parent in Details or in All tasks.
 * Hide-blocked removes locked work from All tasks too.
 */
export function selectBoardTasks(tasks, opts = {}) {
  const list = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const boardScope = opts.boardScope === 'all' ? 'all' : 'top';
  const showLocked = opts.hideBlocked !== true;
  const categoryFilter = opts.categoryFilter || [];
  const unclaimedOnly = Boolean(opts.unclaimedOnly);
  const isUnclaimedClaimable = opts.isUnclaimedClaimable;

  const matchesFilters = (t) => {
    if (!isTaskVisibleWithLockedToggle(t, showLocked)) return false;
    if (!taskMatchesCategoryFilter(t, categoryFilter)) return false;
    if (unclaimedOnly && typeof isUnclaimedClaimable === 'function') {
      if (!isUnclaimedClaimable(t)) return false;
    }
    return true;
  };

  const passing = list.filter(matchesFilters);
  if (boardScope === 'all') return passing;

  const lookup = new Map(list.filter((t) => t?.id).map((t) => [t.id, t]));
  const topIds = new Set(
    passing.filter(isBoardTopScopeTask).map((t) => t.id).filter(Boolean)
  );
  const filtersActive = categoryFilter.length > 0 || unclaimedOnly;
  const seen = new Set();
  const out = [];
  for (const t of passing) {
    if (!t?.id || seen.has(t.id)) continue;
    if (isBoardTopScopeTask(t)) {
      seen.add(t.id);
      out.push(t);
      continue;
    }
    // Nested + blocked: never on Top-level, even to nest under the epic card.
    if (isTaskDependencyLocked(t)) continue;
    if (filtersActive && taskHasAncestorInSet(t, topIds, lookup)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

/**
 * Grey “Blocked” treatment on the board.
 * Own incomplete deps, or every incomplete child is blocked (Medium/Epic rollup).
 * Does not hide the parent — visibility still uses isTaskDependencyLocked.
 */
export function isTaskVisuallyBlocked(task) {
  if (!task || isTaskCompletedAccepted(task)) return false;
  if (task.dependencyOverride) return false;
  const wait = waitingNamesExcludingSelf(task, task.lockedWaitingOn);
  if (
    (task.isVisuallyBlocked === true || task.isBlockedGroup === true) &&
    wait.length === 0 &&
    !isTaskDependencyLocked(task)
  ) {
    return false;
  }
  if (task.isVisuallyBlocked === true || task.isBlockedGroup === true) {
    return true;
  }
  return isTaskDependencyLocked(task);
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
    if (!tid || !bid || tid === bid) continue;
    if (!blockersOf.has(tid)) blockersOf.set(tid, []);
    blockersOf.get(tid).push(bid);
  }

  const withOwnLocks = tasks.map((t) => {
    const blockerIds = [...new Set(blockersOf.get(t.id) || [])].filter(
      (id) => id !== t.id
    );
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
    const lockedWaitingOnBlockers = waitingBlockersExcludingSelf(
      t,
      blockedByIncomplete
    );
    const lockedWaitingOn = lockedWaitingOnBlockers.map((b) => b.title);

    const base = {
      ...t,
      blockedBy,
      blockedByIds: blockerIds,
      blockedByIncomplete,
      dependencyOverride,
      isLocked,
      lockedWaitingOnBlockers,
      lockedWaitingOn,
    };
    const claimBlockedReason = getTaskClaimBlockedReason(base);
    return {
      ...base,
      claimBlockedReason,
      volunteerClaimable: !claimBlockedReason,
    };
  });

  const lockedById = new Map(withOwnLocks.map((t) => [t.id, t]));
  const visualMemo = new Map();
  const groupWaiting = new Map();

  const computeVisual = (t) => {
    if (!t || visualMemo.has(t.id)) return Boolean(visualMemo.get(t.id));
    if (isTaskCompletedAccepted(t)) {
      visualMemo.set(t.id, false);
      return false;
    }
    if (t.isLocked) {
      visualMemo.set(t.id, true);
      groupWaiting.set(t.id, t.lockedWaitingOnBlockers || []);
      return true;
    }
    const childIds = Array.isArray(t.childIds) ? t.childIds : [];
    if (childIds.length === 0) {
      visualMemo.set(t.id, false);
      return false;
    }
    const incomplete = childIds
      .map((id) => lockedById.get(id))
      .filter((c) => c && !isTaskCompletedAccepted(c));
    if (incomplete.length === 0) {
      visualMemo.set(t.id, false);
      return false;
    }
    const allBlocked = incomplete.every((c) => computeVisual(c));
    if (!allBlocked) {
      visualMemo.set(t.id, false);
      return false;
    }
    const blockers = waitingBlockersExcludingSelf(
      t,
      incomplete.flatMap(
        (c) => groupWaiting.get(c.id) || c.lockedWaitingOnBlockers || []
      )
    );
    // Children waiting only on this parent does not make the parent Blocked.
    if (blockers.length === 0) {
      visualMemo.set(t.id, false);
      return false;
    }
    visualMemo.set(t.id, true);
    groupWaiting.set(t.id, blockers);
    return true;
  };

  return withOwnLocks.map((t) => {
    const visually = computeVisual(t);
    const isBlockedGroup = visually && !t.isLocked;
    const waitingBlockers = t.isLocked
      ? t.lockedWaitingOnBlockers
      : isBlockedGroup
        ? groupWaiting.get(t.id) || []
        : t.lockedWaitingOnBlockers;
    return {
      ...t,
      isBlockedGroup,
      isVisuallyBlocked: visually,
      lockedWaitingOnBlockers: waitingBlockers,
      lockedWaitingOn: (waitingBlockers || []).map((b) => b.title),
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
