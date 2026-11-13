/**
 * Task Board limits: claim / submit quotas, trust tiers, identity gate.
 * Part of the tasks service; import from '../tasksService' in app code.
 */

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
/** Shown on held cards instead of the 14/30-day countdown. */
export const HOLD_CLAIM_DETAIL_COPY =
  'Staff disabled auto-release on this card. The claim stays until it is returned or completed.';
/** Staff form / toggle help. */
export const HOLD_CLAIM_STAFF_HELP =
  'The claim on this card will not auto-release after 14 days idle or 30 days total. Use for long-running staff work such as palette lock until the game is done.';

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
