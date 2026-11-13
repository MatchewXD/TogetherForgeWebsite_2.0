/**
 * Claim age + auto-release rules and copy.
 * Part of the tasks service; import from '../tasksService' in app code.
 */

import { CLAIM_IDLE_RELEASE_DAYS, CLAIM_MAX_DURATION_DAYS, HOLD_CLAIM_DETAIL_COPY } from './taskRules';

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
    held: false,
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
  if (opts.holdClaim) {
    return {
      ...empty,
      held: true,
      shortLabel: 'Held',
      detailLabel: HOLD_CLAIM_DETAIL_COPY,
    };
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
    held: false,
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

/** Dashboard copy when staff add Smalls under a claimed Medium. */
export function formatClaimSplitNotice(taskTitle) {
  const title = String(taskTitle || '').trim() || 'your task';
  return `Your task ${title} has been updated with small tasks and moved to the To Do list.`;
}
