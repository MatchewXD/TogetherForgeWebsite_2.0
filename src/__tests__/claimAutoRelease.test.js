/**
 * Dual claim auto-release rules (idle 14d + hard max 30d).
 */
import { describe, it, expect } from 'vitest';
import {
  CLAIM_IDLE_RELEASE_DAYS,
  CLAIM_MAX_DURATION_DAYS,
  CLAIM_STALE_DAYS,
  CLAIM_AUTO_RELEASE_POLICY_COPY,
  daysSinceIso,
  getClaimAutoReleaseInfo,
  formatAutoReleaseReason,
} from '../services/tasksService';

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('claim auto-release constants', () => {
  it('defines 14-day idle and 30-day hard max', () => {
    expect(CLAIM_IDLE_RELEASE_DAYS).toBe(14);
    expect(CLAIM_STALE_DAYS).toBe(14);
    expect(CLAIM_MAX_DURATION_DAYS).toBe(30);
    expect(CLAIM_AUTO_RELEASE_POLICY_COPY).toMatch(/14/);
    expect(CLAIM_AUTO_RELEASE_POLICY_COPY).toMatch(/30/);
    expect(CLAIM_AUTO_RELEASE_POLICY_COPY).not.toMatch(/[—–]/);
    expect(CLAIM_AUTO_RELEASE_POLICY_COPY).toMatch(/viewing a task does not/i);
  });
});

describe('getClaimAutoReleaseInfo', () => {
  it('is quiet for fresh active claims', () => {
    const info = getClaimAutoReleaseInfo({
      status: 'Active',
      claimedAt: daysAgoIso(1),
      lastActivityAt: daysAgoIso(0.5),
    });
    expect(info.warn).toBe(false);
    expect(info.urgent).toBe(false);
  });

  it('warns when idle nears 14 days (even with old claim start)', () => {
    const info = getClaimAutoReleaseInfo({
      status: 'Active',
      claimedAt: daysAgoIso(10),
      lastActivityAt: daysAgoIso(8),
    });
    expect(info.warn).toBe(true);
    expect(info.reason).toBe('idle');
    expect(info.shortLabel).toMatch(/Idle/i);
  });

  it('flags hard max when held near 30 days even with recent activity', () => {
    const info = getClaimAutoReleaseInfo({
      status: 'Active',
      claimedAt: daysAgoIso(26),
      lastActivityAt: daysAgoIso(1),
    });
    expect(info.warn).toBe(true);
    expect(info.reason).toBe('max_duration');
    expect(info.maxDaysLeft).toBeLessThanOrEqual(5 + 0.01);
  });

  it('marks overdue idle as urgent', () => {
    const info = getClaimAutoReleaseInfo({
      status: 'Active',
      claimedAt: daysAgoIso(20),
      lastActivityAt: daysAgoIso(15),
    });
    expect(info.urgent).toBe(true);
    expect(info.reason).toBe('idle');
  });

  it('marks overdue hard max as urgent despite recent notes', () => {
    const info = getClaimAutoReleaseInfo({
      status: 'Active',
      claimedAt: daysAgoIso(35),
      lastActivityAt: daysAgoIso(1),
    });
    expect(info.urgent).toBe(true);
    expect(info.reason).toBe('max_duration');
  });

  it('skips countdown for PendingReview (waiting on staff)', () => {
    const info = getClaimAutoReleaseInfo({
      status: 'PendingReview',
      claimedAt: daysAgoIso(20),
      lastActivityAt: daysAgoIso(15),
    });
    expect(info.warn).toBe(false);
    expect(info.reason).toBeNull();
  });

  it('prefers hard-max reason when both limits are overdue', () => {
    const info = getClaimAutoReleaseInfo({
      status: 'Active',
      claimedAt: daysAgoIso(40),
      lastActivityAt: daysAgoIso(20),
    });
    expect(info.reason).toBe('max_duration');
  });
});

describe('formatAutoReleaseReason', () => {
  it('explains idle vs max_duration clearly', () => {
    expect(formatAutoReleaseReason('idle')).toMatch(/meaningful progress/i);
    expect(formatAutoReleaseReason('max_duration')).toMatch(/maximum/i);
    expect(formatAutoReleaseReason('idle')).toMatch(/open for others/i);
  });
});

describe('daysSinceIso', () => {
  it('returns null for bad input and ~n for n days ago', () => {
    expect(daysSinceIso(null)).toBeNull();
    expect(daysSinceIso('not-a-date')).toBeNull();
    const d = daysSinceIso(daysAgoIso(3));
    expect(d).toBeGreaterThan(2.9);
    expect(d).toBeLessThan(3.1);
  });
});
