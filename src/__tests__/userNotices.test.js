import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasAvatarNoticePin,
  hasMemberNoticePin,
  hasStaffQueuePin,
  keysFromNoticeSummary,
  menuNoticeTargets,
  noticeKey,
  readDeletedNoticeIds,
  readSeenNoticeKeys,
  rememberDeletedNoticeIds,
  rememberNoticeKeys,
  summarizeUserNotices,
} from '../utils/userNotices';

describe('summarizeUserNotices', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('flags join requests, reviewed suggestions, and notice-card items', () => {
    const summary = summarizeUserNotices({
      joinRequests: [{ id: 'j1' }],
      suggestions: [
        { id: 's-wait', status: 'pending' },
        { id: 's-ok', status: 'accepted' },
        { id: 's-no', status: 'rejected' },
      ],
      noticeItems: [{ id: 'n1' }],
      seen: new Set(),
    });
    expect(summary.joinRequests).toBe(true);
    expect(summary.suggestions).toBe(true);
    expect(summary.noticesCard).toBe(true);
    expect(summary.global).toBe(true);
    expect(summary.suggestionIds).toEqual(['s-ok', 's-no']);
  });

  it('flags hidden Open Question replies on the notices card and avatar', () => {
    const summary = summarizeUserNotices({
      joinRequests: [],
      suggestions: [],
      noticeItems: [{ id: 'n-inbox', kind: 'oq_hide' }],
      seen: new Set(),
    });
    expect(summary.noticesCard).toBe(true);
    expect(summary.global).toBe(true);
    expect(summary.noticeIds).toEqual(['n-inbox']);
  });

  it('does not flag an Open Question notice after it is read', () => {
    const summary = summarizeUserNotices({
      joinRequests: [],
      suggestions: [],
      noticeItems: [
        { id: 'n-inbox', kind: 'oq_hide', readAt: '2026-09-12T00:00:00Z' },
      ],
      seen: new Set(),
    });
    expect(summary.noticesCard).toBe(false);
    expect(summary.global).toBe(false);
  });

  it('does not flag a notice after it is marked seen', () => {
    const summary = summarizeUserNotices({
      joinRequests: [],
      suggestions: [],
      noticeItems: [{ id: 'n-inbox', kind: 'oq_hide' }],
      seen: new Set([noticeKey('notice', 'n-inbox')]),
    });
    expect(summary.noticesCard).toBe(false);
  });

  it('does not use pending suggestions for the global notice', () => {
    const summary = summarizeUserNotices({
      joinRequests: [],
      suggestions: [{ id: 's-wait', status: 'pending' }],
      noticeItems: [],
      seen: new Set(),
    });
    expect(summary.suggestions).toBe(false);
    expect(summary.global).toBe(false);
  });

  it('clears join and suggestion flags after leaving dashboard, notices stay until read', () => {
    const first = summarizeUserNotices({
      joinRequests: [{ id: 'j1' }],
      suggestions: [{ id: 's1', status: 'accepted' }],
      noticeItems: [{ id: 'n1' }],
      seen: new Set(),
    });
    rememberNoticeKeys('user-1', keysFromNoticeSummary(first));
    const seen = readSeenNoticeKeys('user-1');
    expect(seen.has(noticeKey('join', 'j1'))).toBe(true);
    expect(seen.has(noticeKey('notice', 'n1'))).toBe(false);
    const second = summarizeUserNotices({
      joinRequests: [{ id: 'j1' }],
      suggestions: [{ id: 's1', status: 'accepted' }],
      noticeItems: [{ id: 'n1' }],
      seen,
    });
    expect(second.joinRequests).toBe(false);
    expect(second.suggestions).toBe(false);
    expect(second.noticesCard).toBe(true);
    expect(second.global).toBe(true);
  });

  it('drops deleted notices from the card and avatar', () => {
    rememberDeletedNoticeIds('user-1', ['oqhide:abc']);
    const deleted = readDeletedNoticeIds('user-1');
    const summary = summarizeUserNotices({
      joinRequests: [],
      suggestions: [],
      noticeItems: [{ id: 'oqhide:abc' }, { id: 'n2' }],
      seen: new Set(),
      deleted,
    });
    expect(summary.noticeIds).toEqual(['n2']);
    expect(summary.noticesCard).toBe(true);
  });
});

describe('staff queue pins', () => {
  it('pins the avatar when staff queues have open work', () => {
    const member = summarizeUserNotices({
      joinRequests: [],
      suggestions: [],
      noticeItems: [],
      seen: new Set(),
    });
    expect(member.global).toBe(false);
    expect(hasAvatarNoticePin(member)).toBe(false);
    expect(hasStaffQueuePin({ total: 0 })).toBe(false);
    expect(
      hasAvatarNoticePin({
        ...member,
        staffAttention: { suggestions: 1, scope: 0, reports: 0, bugs: 0, total: 1 },
      })
    ).toBe(true);
    expect(hasStaffQueuePin({ total: 2 })).toBe(true);
  });

  it('does not treat staff queues as member dashboard notices', () => {
    const member = summarizeUserNotices({
      joinRequests: [],
      suggestions: [{ id: 's-wait', status: 'pending' }],
      noticeItems: [],
      seen: new Set(),
    });
    expect(member.global).toBe(false);
    expect(member.suggestions).toBe(false);
    expect(
      hasStaffQueuePin({
        suggestions: 3,
        scope: 1,
        reports: 2,
        bugs: 4,
        showcase: 1,
        total: 11,
      })
    ).toBe(true);
  });

  it('puts staff-only pins on Moderator Dashboard, not Dashboard', () => {
    const staffOnly = {
      ...summarizeUserNotices({
        joinRequests: [],
        suggestions: [],
        noticeItems: [],
        seen: new Set(),
      }),
      staffAttention: {
        suggestions: 1,
        scope: 0,
        reports: 0,
        bugs: 0,
        total: 1,
      },
    };
    expect(hasMemberNoticePin(staffOnly)).toBe(false);
    expect(menuNoticeTargets(staffOnly)).toEqual({
      dashboard: false,
      moderatorDashboard: true,
    });
  });

  it('keeps member inbox on Dashboard when both kinds are present', () => {
    const both = {
      ...summarizeUserNotices({
        joinRequests: [{ id: 'j1' }],
        suggestions: [],
        noticeItems: [],
        seen: new Set(),
      }),
      staffAttention: { total: 2 },
    };
    expect(menuNoticeTargets(both)).toEqual({
      dashboard: true,
      moderatorDashboard: true,
    });
  });
});
