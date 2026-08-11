/**
 * Staff permission roles used for tasks, showcase, media, moderator tools.
 * Mirrors useIsModerator / is_project_staff SQL roles.
 */
import { describe, it, expect } from 'vitest';

/** Keep in sync with useIsModerator + public.is_project_staff() */
export function isStaffRole(role) {
  const r = String(role || 'user').trim();
  return r === 'moderator' || r === 'admin' || r === 'project_lead';
}

/** Keep in sync with profileBypassesTaskLimits / user_bypasses_task_limits */
export function staffBypassesTaskRateLimits(role, taskLimitBypass = false) {
  return isStaffRole(role) || taskLimitBypass === true;
}

describe('staff roles', () => {
  it('grants moderator tools to moderator, admin, project_lead', () => {
    expect(isStaffRole('moderator')).toBe(true);
    expect(isStaffRole('admin')).toBe(true);
    expect(isStaffRole('project_lead')).toBe(true);
  });

  it('denies regular users and guests', () => {
    expect(isStaffRole('user')).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole('')).toBe(false);
    expect(isStaffRole('volunteer')).toBe(false);
  });

  it('documents unauthorized actions fail closed (no staff)', () => {
    // Client gates: create/edit tasks, moderate showcase, media edit, /moderator
    const canAccessModeratorDashboard = isStaffRole('user');
    const canCreateTasks = isStaffRole('user');
    const canModerateShowcase = isStaffRole('user');
    expect(canAccessModeratorDashboard).toBe(false);
    expect(canCreateTasks).toBe(false);
    expect(canModerateShowcase).toBe(false);
  });

  it('bypasses Task Board rate limits for staff or test flag only', () => {
    expect(staffBypassesTaskRateLimits('admin')).toBe(true);
    expect(staffBypassesTaskRateLimits('project_lead')).toBe(true);
    expect(staffBypassesTaskRateLimits('moderator')).toBe(true);
    expect(staffBypassesTaskRateLimits('user')).toBe(false);
    expect(staffBypassesTaskRateLimits('user', true)).toBe(true);
  });
});

