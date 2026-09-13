import { describe, it, expect } from 'vitest';
import { arePollsEnabled } from '../constants/pollsEnabled';
import {
  POLL_HEADER_BODY,
  POLL_HEADER_SUBTITLE,
  POLL_HEADER_TITLE,
  POLL_INFORM_COPY,
  POLL_NONE_NAME,
  POLL_OPTION_MAX,
  POLL_OPTION_MIN,
  comparePolls,
  emptyPollOptions,
  isNoneOptionName,
  POLL_LIVE_HOLD_MS,
  isHeldOnLiveIndex,
  isPollLive,
  nonePollOption,
  optionPercent,
  orderedPollOptions,
  pollManagePath,
  pollPath,
  pollVoteTotal,
  remainingLabel,
  staffPollOptions,
  winningOptionIds,
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
    expect(POLL_HEADER_TITLE).toBe('Polls');
    expect(POLL_HEADER_SUBTITLE).toMatch(/hear the room/i);
    expect(POLL_HEADER_BODY).toMatch(/none of these/i);
    expect(POLL_HEADER_BODY).not.toMatch(/Sign in,/);
    expect(POLL_HEADER_BODY).not.toMatch(/does not lock the game/i);
    expect(POLL_INFORM_COPY).toMatch(/does not lock the game/i);
    expect(POLL_NONE_NAME).toBe('None of these');
    expect(pollPath('abc')).toBe('/polls/abc');
    expect(pollManagePath('abc')).toBe('/moderator?tab=polls&poll=abc');
  });

  it('sorts live polls first', () => {
    const live = { status: 'live', openedAt: '2026-01-01T00:00:00Z' };
    const closed = { status: 'closed', openedAt: '2026-02-01T00:00:00Z' };
    expect(comparePolls(live, closed)).toBeLessThan(0);
  });

  it('keeps a closed poll on the Live list for 3 minutes', () => {
    const now = Date.parse('2026-09-12T18:40:00Z');
    const justClosed = {
      status: 'closed',
      closedAt: new Date(now - 60 * 1000).toISOString(),
    };
    const agedOut = {
      status: 'closed',
      closedAt: new Date(now - POLL_LIVE_HOLD_MS - 1000).toISOString(),
    };
    expect(isHeldOnLiveIndex(justClosed, now)).toBe(true);
    expect(isHeldOnLiveIndex(agedOut, now)).toBe(false);
    expect(isPollLive(justClosed)).toBe(false);
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

  it('keeps None of these last and outside the staff 2-8', () => {
    const options = [
      { id: 'n', name: 'None of these', isNone: true, sortOrder: 100 },
      { id: 'a', name: 'Spark', isNone: false, sortOrder: 1 },
      { id: 'b', name: 'Knife', isNone: false, sortOrder: 0 },
    ];
    expect(staffPollOptions(options).map((o) => o.id)).toEqual(['a', 'b']);
    expect(nonePollOption(options).id).toBe('n');
    expect(orderedPollOptions(options).map((o) => o.id)).toEqual(['b', 'a', 'n']);
    expect(isNoneOptionName('None of these')).toBe(true);
    expect(isNoneOptionName('Spark')).toBe(false);
  });

  it('marks the highest vote count as winning and ties as both', () => {
    expect(winningOptionIds([{ id: 'a', voteCount: 0 }])).toEqual([]);
    expect(
      winningOptionIds([
        { id: 'a', voteCount: 2 },
        { id: 'b', voteCount: 5 },
        { id: 'c', voteCount: 5 },
      ])
    ).toEqual(['b', 'c']);
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
