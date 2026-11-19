/**
 * Which task actions a viewer sees for one task.
 *
 * Shared by the board's TaskCard and the Task Map details panel so both views
 * always offer the same buttons for the same task and viewer.
 */

import {
  getUserTaskClaimBlockedReason,
  canMovePublicTaskToStaging,
  isTaskVisibleWithLockedToggle,
} from '../services/tasksService';
import { areClaimsEnabled } from '../constants/claimsEnabled';
import { taskMatchesCategoryFilter } from '../constants/taskCategories';

/**
 * @param {object} task mapped task (tasksService shape)
 * @param {{ currentUserId?: string|null, isStaff?: boolean, joinRequestPending?: boolean, claimsEnabled?: boolean }} [viewer]
 */
export function getTaskActionState(task, viewer = {}) {
  const isStaff = Boolean(viewer.isStaff);
  const currentUserId = viewer.currentUserId || null;
  const claimsEnabled =
    typeof viewer.claimsEnabled === 'boolean'
      ? viewer.claimsEnabled
      : areClaimsEnabled();

  const isCompleted =
    task.status === 'completed' || task.dbStatus === 'Completed';
  const isPendingReview =
    task.status === 'in_review' ||
    task.dbStatus === 'InReview' ||
    task.claim?.status === 'PendingReview' ||
    Boolean(task.readyForParentReview);
  const hasActiveClaim = Boolean(
    task.claim?.status === 'Active' ||
      task.claim?.status === 'PendingReview' ||
      (task.claimedBy && !isCompleted)
  );
  const hasChildren = Boolean(task.hasChildren || task.childCount > 0);
  const isStaffOnly = Boolean(task.staffOnly || task.staff_only);
  const claimBlocked = getUserTaskClaimBlockedReason(task, { isStaff });
  const structurallyClaimable =
    !claimBlocked && !hasActiveClaim && !isCompleted;

  const isMine = Boolean(
    currentUserId &&
      task.claim?.userId &&
      String(task.claim.userId) === String(currentUserId)
  );

  return {
    isCompleted,
    isPendingReview,
    hasActiveClaim,
    hasChildren,
    isStaffOnly,
    isMine,
    claimBlocked,
    showClaim:
      structurallyClaimable &&
      (!isStaffOnly || isStaff) &&
      (claimsEnabled || isStaff),
    showClaimsPausedLine:
      structurallyClaimable && !isStaffOnly && !claimsEnabled && !isStaff,
    showStaffOnlyInsteadOfClaim:
      structurallyClaimable && isStaffOnly && !isStaff,
    canRequestJoin:
      hasActiveClaim &&
      !isCompleted &&
      !hasChildren &&
      Boolean(currentUserId) &&
      !isMine &&
      !viewer.joinRequestPending &&
      (!isStaffOnly || isStaff),
    /** Claimant: progress and Submit for Review live in the task dialog. */
    canWorkOnClaim: isMine && task.claim?.status === 'Active' && !isCompleted,
    canMoveToStaging: isStaff && canMovePublicTaskToStaging(task),
  };
}

/**
 * "Unclaimed only" board filter: open, unclaimed and claimable right now.
 * The board and the Task Map both use this, so they agree.
 */
export function isTaskUnclaimedClaimable(t) {
  if (!t) return false;
  if (t.dbStatus === 'Completed' || t.status === 'completed') return false;
  if (!isTaskVisibleWithLockedToggle(t, false)) return false;
  if (t.claim?.status === 'Active' || t.claim?.status === 'PendingReview') {
    return false;
  }
  if (t.claimedBy) return false;
  if (t.volunteerClaimable === true) return true;
  if (t.volunteerClaimable === false) return false;
  if (t.hasChildren || t.isEpic || (t.depth || 0) === 0) return false;
  return true;
}

/** "Hide Blocked Tasks" board filter: the tasks it hides on the board. */
export function isTaskHiddenAsBlocked(t) {
  return !isTaskVisibleWithLockedToggle(t, false);
}

/**
 * Task Map highlight filter from the board's filters. The skill and
 * "Unclaimed only" filters combine (a task must pass both); "Hide Blocked
 * Tasks" greys blocked tasks. Returns {} when no filter is on.
 * @param {{ categoryFilter?: string[], unclaimedOnly?: boolean, hideBlocked?: boolean }} filters
 * @returns {{ matches?: (task: object) => boolean, blocked?: (task: object) => boolean }}
 */
export function boardMapFilter({ categoryFilter = [], unclaimedOnly = false, hideBlocked = false } = {}) {
  const out = {};
  if (categoryFilter.length || unclaimedOnly) {
    out.matches = (task) =>
      taskMatchesCategoryFilter(task, categoryFilter) &&
      (!unclaimedOnly || isTaskUnclaimedClaimable(task));
  }
  if (hideBlocked) out.blocked = isTaskHiddenAsBlocked;
  return out;
}
