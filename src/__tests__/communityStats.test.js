import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args) => rpc(...args),
    from: (...args) => from(...args),
  },
}));

vi.mock('../services/donationsService', () => ({
  getPublicFundContributors: vi.fn(async () => ({ items: [] })),
  uniqueContributorsFromLocal: vi.fn(() => []),
}));

import {
  assembleHomeActivity,
  getHomeCommunityStats,
} from '../services/communityStatsService';
import {
  getPublicFundContributors,
  uniqueContributorsFromLocal,
} from '../services/donationsService';

describe('getHomeCommunityStats', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    getPublicFundContributors.mockReset();
    uniqueContributorsFromLocal.mockReset();
    getPublicFundContributors.mockResolvedValue({ items: [] });
    uniqueContributorsFromLocal.mockReturnValue([]);
  });

  it('maps the public community stats RPC', async () => {
    rpc.mockResolvedValue({
      data: {
        members: 12,
        ideas_submitted: 9,
        supporters: 3,
        tasks_completed: 6,
      },
      error: null,
    });

    const stats = await getHomeCommunityStats();
    expect(rpc).toHaveBeenCalledWith('get_public_community_stats');
    expect(stats).toMatchObject({
      members: 12,
      ideasSubmitted: 9,
      supporters: 3,
      tasksCompleted: 6,
      source: 'supabase',
    });
  });

  it('falls back to table counts and unique public supporters', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'function does not exist' },
    });

    const countResult = (n) => ({
      select: () => Promise.resolve({ count: n, error: null }),
    });

    from.mockImplementation((table) => {
      if (table === 'profiles') return countResult(11);
      if (table === 'ideas') {
        return {
          select: (_cols, opts) => {
            if (opts?.count === 'exact') {
              return {
                neq: () => Promise.resolve({ count: 8, error: null }),
              };
            }
            return Promise.resolve({ data: [], error: null });
          },
        };
      }
      if (table === 'tasks') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: 4, error: null }),
          }),
        };
      }
      return countResult(0);
    });

    getPublicFundContributors.mockImplementation(async (fund) => ({
      items:
        fund === 'studio'
          ? [{ username: 'maya' }]
          : [{ username: 'maya' }, { username: 'rex' }],
    }));

    const stats = await getHomeCommunityStats();
    expect(stats.source).toBe('fallback');
    expect(stats.members).toBe(11);
    expect(stats.ideasSubmitted).toBe(8);
    expect(stats.supporters).toBe(2);
    expect(stats.tasksCompleted).toBe(4);
  });
});

describe('assembleHomeActivity', () => {
  it('merges public claims and published ideas, newest first', () => {
    const items = assembleHomeActivity({
      taskRows: [
        {
          id: 'a1',
          action: 'claimed',
          target_id: 't1',
          target_title: 'Tether art pass',
          created_at: '2026-08-20T12:00:00Z',
          profiles: { username: 'maya' },
        },
        {
          id: 'a2',
          action: 'auto_released',
          target_id: 't1',
          target_title: 'Tether art pass',
          created_at: '2026-08-21T12:00:00Z',
          profiles: { username: 'maya' },
        },
      ],
      taskMetaById: new Map([['t1', { boardScope: 'public', staffOnly: false }]]),
      ideaRows: [
        {
          id: 'i1',
          title: 'Co-op lanterns',
          user_id: 'u2',
          created_at: '2026-08-22T12:00:00Z',
          status: 'Open',
        },
        {
          id: 'i2',
          title: 'Hidden draft',
          user_id: 'u2',
          created_at: '2026-08-23T12:00:00Z',
          status: 'Draft',
        },
      ],
      profileMap: { u2: { username: 'rex' } },
      limit: 6,
    });
    expect(items.map((i) => i.id)).toEqual(['idea-i1', 'a1']);
    expect(items[0].action).toBe('submitted an idea');
    expect(items[0].target).toBe('Co-op lanterns');
    expect(items[1].action).toBe('claimed');
    expect(items.every((i) => i.user !== 'Alex R.')).toBe(true);
  });

  it('drops staging and staff-only tasks', () => {
    const items = assembleHomeActivity({
      taskRows: [
        {
          id: 'pub',
          action: 'completed',
          target_id: 't-public',
          target_title: 'Public task',
          created_at: '2026-08-20T12:00:00Z',
          profiles: { username: 'maya' },
        },
        {
          id: 'stg',
          action: 'completed',
          target_id: 't-staging',
          target_title: 'Staging task',
          created_at: '2026-08-21T12:00:00Z',
          profiles: { username: 'maya' },
        },
        {
          id: 'staff',
          action: 'claimed',
          target_id: 't-staff',
          target_title: 'Staff only',
          created_at: '2026-08-22T12:00:00Z',
          profiles: { username: 'maya' },
        },
      ],
      taskMetaById: new Map([
        ['t-public', { boardScope: 'public', staffOnly: false }],
        ['t-staging', { boardScope: 'staging', staffOnly: false }],
        ['t-staff', { boardScope: 'public', staffOnly: true }],
      ]),
    });
    expect(items.map((i) => i.id)).toEqual(['pub']);
  });
});
