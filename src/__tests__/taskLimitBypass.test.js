/**
 * Staff / test-account Task Board rate-limit bypass.
 */
import { describe, it, expect } from 'vitest';
import {
  profileBypassesTaskLimits,
  TASK_LIMIT_BYPASS_ROLES,
  BYPASS_CLAIM_LIMIT,
  claimLimitForAcceptedCount,
  submitLimit24hForAcceptedCount,
  NEW_USER_CLAIM_LIMIT,
} from '../services/tasksService';

describe('profileBypassesTaskLimits', () => {
  it('grants bypass to admin, moderator, project_lead', () => {
    for (const role of TASK_LIMIT_BYPASS_ROLES) {
      expect(profileBypassesTaskLimits({ role })).toBe(true);
    }
  });

  it('grants bypass via task_limit_bypass flag for non-staff', () => {
    expect(
      profileBypassesTaskLimits({ role: 'user', task_limit_bypass: true })
    ).toBe(true);
  });

  it('denies normal users without flag', () => {
    expect(profileBypassesTaskLimits({ role: 'user' })).toBe(false);
    expect(profileBypassesTaskLimits({ role: 'contributor' })).toBe(false);
    expect(profileBypassesTaskLimits(null)).toBe(false);
    expect(
      profileBypassesTaskLimits({ role: 'user', task_limit_bypass: false })
    ).toBe(false);
  });

  it('documents that progressive limits still apply to non-bypass users', () => {
    expect(claimLimitForAcceptedCount(0)).toBe(NEW_USER_CLAIM_LIMIT);
    expect(submitLimit24hForAcceptedCount(0)).toBe(2);
    expect(BYPASS_CLAIM_LIMIT).toBeGreaterThan(claimLimitForAcceptedCount(0));
  });
});
