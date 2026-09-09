import { describe, it, expect, beforeEach } from 'vitest';
import {
  keysFromNoticeSummary,
  noticeKey,
  readSeenNoticeKeys,
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

  it('clears flags after ids are remembered', () => {
    const first = summarizeUserNotices({
      joinRequests: [{ id: 'j1' }],
      suggestions: [{ id: 's1', status: 'accepted' }],
      noticeItems: [{ id: 'n1' }],
      seen: new Set(),
    });
    rememberNoticeKeys('user-1', keysFromNoticeSummary(first));
    const seen = readSeenNoticeKeys('user-1');
    expect(seen.has(noticeKey('join', 'j1'))).toBe(true);
    const second = summarizeUserNotices({
      joinRequests: [{ id: 'j1' }],
      suggestions: [{ id: 's1', status: 'accepted' }],
      noticeItems: [{ id: 'n1' }],
      seen,
    });
    expect(second.global).toBe(false);
  });
});
