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

import { getHomeCommunityStats } from '../services/communityStatsService';
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
