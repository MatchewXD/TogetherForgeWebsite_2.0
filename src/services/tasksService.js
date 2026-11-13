/**
 * Tasks service: public entry point.
 *
 * The implementation lives in ./tasks/*. This file keeps the original API:
 * every helper that used to be exported from here still is, and
 * `tasksService` exposes the same methods. Methods call each other through
 * `this`, so always call them on the object (tasksService.claimTask(...)).
 */

export {
  MAX_ACTIVE_CLAIMS,
  NEW_USER_CLAIM_LIMIT,
  ESTABLISHED_CLAIM_LIMIT,
  CLAIM_LIMIT_UNLOCK_COMPLETIONS,
  TRUSTED_CLAIM_UNLOCK_COMPLETIONS,
  CLAIM_COOLDOWN_MINUTES,
  SUBMIT_COOLDOWN_MINUTES,
  CLAIM_STALE_DAYS,
  CLAIM_IDLE_RELEASE_DAYS,
  CLAIM_MAX_DURATION_DAYS,
  HOLD_CLAIM_DETAIL_COPY,
  HOLD_CLAIM_STAFF_HELP,
  NEW_USER_SUBMIT_LIMIT_24H,
  ESTABLISHED_SUBMIT_LIMIT_24H,
  TRUSTED_SUBMIT_LIMIT_24H,
  TASK_LIMIT_BYPASS_ROLES,
  BYPASS_CLAIM_LIMIT,
  BYPASS_SUBMIT_LIMIT_24H,
  profileBypassesTaskLimits,
  claimLimitForAcceptedCount,
  submitLimit24hForAcceptedCount,
  trustTierFromAccepted,
  userMeetsIdentityGate,
  identityGateBlockedReason,
} from './tasks/taskRules';
export {
  MAX_TASK_NESTING_DEPTH,
  TASK_LEVEL_LABELS,
  TASK_LEVEL_SHORT,
  taskLevelLabel,
  taskLevelShort,
  inferTaskBoardDepthFromTitle,
  normalizeChecklist,
  isChecklistComplete,
  progressFromChecklist,
  STAFF_CONTACT_EMAIL,
  TASK_CANNOT_WAIT_ON_SELF,
  STAFF_ONLY_TASK_SNIPPET,
  STAFF_ONLY_TASK_MESSAGE,
  BOARD_SCOPE_PUBLIC,
  BOARD_SCOPE_STAGING,
  STAGING_TASK_CLAIM_MESSAGE,
  isStagingTask,
  canPublishStagingTask,
  canMovePublicTaskToStaging,
  compareTaskBoardOrder,
  isTaskStaffOnly,
  isTaskClaimHeld,
  waitingBlockersExcludingSelf,
  waitingNamesExcludingSelf,
  getTaskWaitingOnBlockers,
  isCommunityDecisionsEpic,
  isClaimAutoReleaseExempt,
  getTaskClaimBlockedReason,
  getTaskStaffOnlyBlockedReason,
  getUserTaskClaimBlockedReason,
  isTaskCompletedAccepted,
  isTaskDependencyLocked,
  isTaskVisibleWithLockedToggle,
  selectBoardTasks,
  isTaskVisuallyBlocked,
  attachTaskDependencies,
  wouldCreateDependencyCycle,
  isVolunteerClaimable,
} from './tasks/taskModel';
export {
  formatClaimHeldSince,
  daysSinceIso,
  getClaimAutoReleaseInfo,
  CLAIM_AUTO_RELEASE_POLICY_COPY,
  formatAutoReleaseReason,
  formatClaimSplitNotice,
} from './tasks/claimAutoRelease';
export {
  STATUS_TO_UI,
  STATUS_TO_DB,
  OPEN_CLAIM_STATUSES,
  mapTaskRow,
  attachScopeRequests,
  attachTaskHierarchy,
  groupTaskForest,
  groupCompletedTaskForest,
  sortTasksAsForest,
  countCompletedDescendants,
  getChildTasks,
  getTaskBreadcrumb,
  getEpicRootTask,
  getTaskAncestorIds,
  isVisibleProjectHubActivity,
  mapActivityRow,
} from './tasks/taskMappers';

import { projectQueriesMethods } from './tasks/projectQueries';
import { scopeRequestsMethods } from './tasks/scopeRequests';
import { projectActivityMethods } from './tasks/projectActivity';
import { claimsMethods } from './tasks/claims';
import { reviewMethods } from './tasks/review';
import { taskAdminMethods } from './tasks/taskAdmin';

export const tasksService = {
  ...projectQueriesMethods,
  ...scopeRequestsMethods,
  ...projectActivityMethods,
  ...claimsMethods,
  ...reviewMethods,
  ...taskAdminMethods,
};

export default tasksService;
