/**
 * tasksService: progress, review submissions, contributor trust.
 * Part of the tasks service; import from '../tasksService' in app code.
 */

import { supabase } from '../../lib/supabase';
import { validateReviewEvidencePackage } from '../../constants/taskReviewEvidence';
import { NEW_USER_CLAIM_LIMIT, identityGateBlockedReason } from './taskRules';
import { isChecklistComplete } from './taskModel';

export const reviewMethods = {
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
};
