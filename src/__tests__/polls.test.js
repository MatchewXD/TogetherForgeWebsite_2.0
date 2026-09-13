import { describe, it, expect } from 'vitest';
import { arePollsEnabled } from '../constants/pollsEnabled';
import {
  POLL_INFORM_COPY,
  POLL_OPTION_MAX,
  POLL_OPTION_MIN,
  comparePolls,
  emptyPollOptions,
  isPollLive,
  optionPercent,
  pollManagePath,
  pollPath,
  pollVoteTotal,
  remainingLabel,
} from '../services/pollsService';

describe('arePollsEnabled', () => {
  it('defaults off so production stays dark', () => {
    expect(arePollsEnabled({})).toBe(false);
  });

  it('follows VITE_ENABLE_POLLS', () => {
    expect(arePollsEnabled({ VITE_ENABLE_POLLS: 'true' })).toBe(true);
    expect(arePollsEnabled({ VITE_ENABLE_POLLS: 'false' })).toBe(false);
  });
});

describe('poll helpers', () => {
  it('keeps option min/max and no comments or multi-vote copy', () => {
    expect(POLL_OPTION_MIN).toBe(2);
    expect(POLL_OPTION_MAX).toBe(8);
    expect(emptyPollOptions()).toHaveLength(2);
    expect(POLL_INFORM_COPY).toMatch(/do not lock/i);
    expect(pollPath('abc')).toBe('/polls/abc');
    expect(pollManagePath('abc')).toBe('/moderator?tab=polls&poll=abc');
  });

  it('sorts live polls first', () => {
    const live = { status: 'live', openedAt: '2026-01-01T00:00:00Z' };
    const closed = { status: 'closed', openedAt: '2026-02-01T00:00:00Z' };
    expect(comparePolls(live, closed)).toBeLessThan(0);
  });

  it('treats overdue live polls as not live', () => {
    expect(
      isPollLive({
        status: 'live',
        closesAt: '2020-01-01T00:00:00Z',
      })
    ).toBe(false);
    expect(isPollLive({ status: 'live', closesAt: null })).toBe(true);
    expect(isPollLive({ status: 'closed' })).toBe(false);
  });

  it('computes percents and remaining time', () => {
    expect(pollVoteTotal({ options: [{ voteCount: 2 }, { voteCount: 3 }] })).toBe(
      5
    );
    expect(optionPercent({ voteCount: 2 }, 5)).toBe(40);
    expect(optionPercent({ voteCount: 0 }, 0)).toBe(0);
    expect(remainingLabel('2020-01-01T00:00:00Z')).toBe('Closed');
    const later = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    expect(remainingLabel(later)).toMatch(/h left/);
  });
});
