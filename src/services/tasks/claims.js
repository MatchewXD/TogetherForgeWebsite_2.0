/**
 * tasksService: claims, join requests, quotas, returns, auto-release.
 * Part of the tasks service; import from '../tasksService' in app code.
 */

import { supabase } from '../../lib/supabase';
import { canonicalProjectSlug } from '../../utils/ideaStatus';
import { areClaimsEnabled, CLAIMS_PAUSED_CODE, CLAIMS_PAUSED_ERROR } from '../../constants/claimsEnabled';
import {
  MAX_ACTIVE_CLAIMS,
  NEW_USER_CLAIM_LIMIT,
  ESTABLISHED_CLAIM_LIMIT,
  CLAIM_LIMIT_UNLOCK_COMPLETIONS,
  TRUSTED_CLAIM_UNLOCK_COMPLETIONS,
  CLAIM_COOLDOWN_MINUTES,
  SUBMIT_COOLDOWN_MINUTES,
  CLAIM_IDLE_RELEASE_DAYS,
  CLAIM_MAX_DURATION_DAYS,
  BYPASS_CLAIM_LIMIT,
  BYPASS_SUBMIT_LIMIT_24H,
  profileBypassesTaskLimits,
  claimLimitForAcceptedCount,
  submitLimit24hForAcceptedCount,
  trustTierFromAccepted,
  userMeetsIdentityGate,
  identityGateBlockedReason,
} from './taskRules';
import {
  STAFF_ONLY_TASK_MESSAGE,
  STAGING_TASK_CLAIM_MESSAGE,
  isStagingTask,
  getTaskClaimBlockedReason,
  getTaskStaffOnlyBlockedReason,
} from './taskModel';
import { formatClaimHeldSince, formatAutoReleaseReason, formatClaimSplitNotice } from './claimAutoRelease';
import { OPEN_CLAIM_STATUSES } from './taskMappers';
import { fetchClaimPrivateDetails } from './claimDetails';

export const claimsMethods = {
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
   * @param {{ task?: object, isStaff?: boolean }} [opts] optional enriched task + staff viewer flag
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
      const hierarchyBlocked = getTaskClaimBlockedReason(opts.task, {
        isStaff: Boolean(opts.isStaff),
      });
      const staffOnlyBlocked = getTaskStaffOnlyBlockedReason(
        opts.task,
        Boolean(opts.isStaff)
      );
      const blocked = hierarchyBlocked || staffOnlyBlocked;
      if (blocked) {
        const err = new Error(blocked);
        err.code = isStagingTask(opts.task)
          ? 'STAGING_TASK'
          : hierarchyBlocked
            ? opts.task?.isLocked
              ? 'TASK_LOCKED'
              : 'CLAIM_HIERARCHY'
            : 'STAFF_ONLY';
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

    if (!areClaimsEnabled() && !opts.isStaff) {
      const err = new Error(CLAIMS_PAUSED_ERROR);
      err.code = CLAIMS_PAUSED_CODE;
      throw err;
    }

    let data;
    let error;
    const invoked = await supabase.functions.invoke('claim-task', {
      body: { taskId },
    });
    let payload = invoked.data || {};
    // On a non-2xx reply supabase-js leaves data empty and keeps the Response
    // on error.context. Read it so the user sees the server's actual reason
    // instead of "Edge Function returned a non-2xx status code".
    if (invoked.error && !invoked.data && typeof invoked.error.context?.json === 'function') {
      try {
        const body = await invoked.error.context.clone().json();
        if (body && typeof body === 'object') payload = body;
      } catch {
        /* not JSON */
      }
    }
    const invokeMsg = payload.error || invoked.error?.message || '';
    const invokeCode = payload.code || '';
    if (
      invokeCode === CLAIMS_PAUSED_CODE ||
      /CLAIMS_PAUSED/i.test(invokeMsg)
    ) {
      const err = new Error(CLAIMS_PAUSED_ERROR);
      err.code = CLAIMS_PAUSED_CODE;
      throw err;
    }
    // Fall back to the RPC when the function is missing or unreachable. An
    // undeployed function fails its CORS preflight, which supabase-js reports
    // as FunctionsFetchError ("Failed to send a request..."), not a 404.
    // The RPC is still guarded by the claims kill-switch trigger.
    const unreachable =
      invoked.error &&
      (/not found|404|FunctionsRelayError|FunctionsFetchError|Failed to send a request/i.test(
        invokeMsg
      ) ||
        invoked.error?.name === 'FunctionsFetchError');
    if (unreachable) {
      if (!areClaimsEnabled() && !opts.isStaff) {
        const err = new Error(CLAIMS_PAUSED_ERROR);
        err.code = CLAIMS_PAUSED_CODE;
        throw err;
      }
      const rpc = await supabase.rpc('claim_task', { p_task_id: taskId });
      data = rpc.data;
      error = rpc.error;
    } else if (invoked.error || payload.error) {
      error = { message: invokeMsg || 'Could not claim that task' };
    } else {
      data = payload.data ?? payload;
    }
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
      if (/STAFF_ONLY/i.test(msg)) {
        const err = new Error(
          msg.replace(/^STAFF_ONLY:\s*/i, '') || STAFF_ONLY_TASK_MESSAGE
        );
        err.code = 'STAFF_ONLY';
        throw err;
      }
      if (/STAGING_TASK/i.test(msg)) {
        const err = new Error(
          msg.replace(/^STAGING_TASK:\s*/i, '') || STAGING_TASK_CLAIM_MESSAGE
        );
        err.code = 'STAGING_TASK';
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
      if (/STAFF_ONLY/i.test(msg)) {
        const err = new Error(
          msg.replace(/^STAFF_ONLY:\s*/i, '') || STAFF_ONLY_TASK_MESSAGE
        );
        err.code = 'STAFF_ONLY';
        throw err;
      }
      if (/STAGING_TASK/i.test(msg)) {
        const err = new Error(
          msg.replace(/^STAGING_TASK:\s*/i, '') || STAGING_TASK_CLAIM_MESSAGE
        );
        err.code = 'STAGING_TASK';
        throw err;
      }
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

    // Own rows with metadata come from an RPC: activity_log.metadata is not
    // readable through the table API (supabase_claims_activity_lockdown.sql).
    const { data, error } = await supabase.rpc('list_my_activity', {
      p_actions: ['auto_released'],
      p_since: since.toISOString(),
      p_limit: limit,
    });

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
   * Notices when staff split a claimed Medium into Smalls (claim returned).
   */
  async listMyRecentClaimSplits({ days = 14, limit = 20 } = {}) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, days));

    const { data, error } = await supabase.rpc('list_my_activity', {
      p_actions: ['claim_split_to_smalls'],
      p_since: since.toISOString(),
      p_limit: limit,
    });

    if (error) {
      console.warn('[tasksService.listMyRecentClaimSplits]', error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      taskId: row.target_id,
      taskTitle: row.target_title || 'your task',
      message: formatClaimSplitNotice(row.target_title),
      createdAt: row.created_at,
      metadata: row.metadata || {},
    }));
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

    const claimsSelect = (withStaffOnly, withHoldClaim = withStaffOnly) => `
        id,
        task_id,
        claimed_at,
        submitted_at,
        progress_percent,
        last_activity_at,
        status,
        tasks (
          id,
          title,
          status,
          category,
          difficulty,
          ${withStaffOnly ? 'staff_only,' : ''}
          ${withHoldClaim ? 'hold_claim,' : ''}
          project_id,
          projects ( id, slug, title )
        )
      `;

    let { data, error } = await supabase
      .from('task_claims')
      .select(claimsSelect(true, true))
      .eq('user_id', user.id)
      .in('status', ['Active', 'PendingReview'])
      .order('claimed_at', { ascending: false });

    if (error && /hold_claim/i.test(error.message || '')) {
      const retry = await supabase
        .from('task_claims')
        .select(claimsSelect(true, false))
        .eq('user_id', user.id)
        .in('status', ['Active', 'PendingReview'])
        .order('claimed_at', { ascending: false });
      data = retry.data;
      error = retry.error;
    }

    if (error && /staff_only/i.test(error.message || '')) {
      const retry = await supabase
        .from('task_claims')
        .select(claimsSelect(false, false))
        .eq('user_id', user.id)
        .in('status', ['Active', 'PendingReview'])
        .order('claimed_at', { ascending: false });
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('[tasksService.listMyActiveClaims]', error);
      return [];
    }

    // notes is a private column: read it through the claimant/staff RPC.
    const details = await fetchClaimPrivateDetails(
      (data || []).map((row) => row.id)
    );
    const notesById = new Map(details.map((d) => [d.id, d.notes]));

    return (data || []).map((row) => {
      const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
      const project = task
        ? Array.isArray(task.projects)
          ? task.projects[0]
          : task.projects
        : null;
      const projectId = task?.project_id || project?.id || null;
      const projectSlug =
        canonicalProjectSlug(project?.slug) || project?.slug || null;
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
        staffOnly: Boolean(task?.staff_only || task?.staffOnly),
        holdClaim: Boolean(task?.hold_claim || task?.holdClaim),
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
        notes: notesById.get(row.id) || '',
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
      const projectSlug =
        canonicalProjectSlug(project?.slug) || project?.slug || null;
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
