/**
 * Dual claim auto-release rules (idle 14d + hard max 30d).
 */
import { describe, it, expect } from 'vitest';
import {
  CLAIM_IDLE_RELEASE_DAYS,
  CLAIM_MAX_DURATION_DAYS,
  CLAIM_STALE_DAYS,
  CLAIM_AUTO_RELEASE_POLICY_COPY,
  HOLD_CLAIM_DETAIL_COPY,
  daysSinceIso,
  getClaimAutoReleaseInfo,
  formatAutoReleaseReason,
  formatClaimSplitNotice,
  isTaskClaimHeld,
  isClaimAutoReleaseExempt,
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

  it('skips countdown when staff holds the card', () => {
    const info = getClaimAutoReleaseInfo(
      {
        status: 'Active',
        claimedAt: daysAgoIso(40),
        lastActivityAt: daysAgoIso(20),
      },
      { holdClaim: true }
    );
    expect(info.held).toBe(true);
    expect(info.warn).toBe(false);
    expect(info.urgent).toBe(false);
    expect(info.reason).toBeNull();
    expect(info.detailLabel).toBe(HOLD_CLAIM_DETAIL_COPY);
  });
});

describe('hold claim exemption', () => {
  it('treats the staff flag as held', () => {
    expect(isTaskClaimHeld({ holdClaim: true })).toBe(true);
    expect(isTaskClaimHeld({ hold_claim: true })).toBe(true);
    expect(isTaskClaimHeld({ holdClaim: false })).toBe(false);
  });

  it('exempts held cards and the Tether-CD epic', () => {
    expect(isClaimAutoReleaseExempt({ holdClaim: true, depth: 2 })).toBe(true);
    expect(
      isClaimAutoReleaseExempt({
        title: 'Tether-CD Community Decisions',
        parentTaskId: null,
      })
    ).toBe(true);
    expect(
      isClaimAutoReleaseExempt({
        title: 'Tether-CD.1 Suit and world palette',
        parentTaskId: 'epic',
      })
    ).toBe(false);
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

describe('formatClaimSplitNotice', () => {
  it('names the returned task and points at To Do', () => {
    expect(
      formatClaimSplitNotice('Tether-4.1 Resource nodes')
    ).toBe(
      'Your task Tether-4.1 Resource nodes has been updated with small tasks and moved to the To Do list.'
    );
    expect(formatClaimSplitNotice('')).toMatch(/your task/i);
  });
});
