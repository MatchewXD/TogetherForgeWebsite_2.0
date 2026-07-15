import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Build a chainable supabase mock for the simple vote toggle pattern:
 *   select().eq().eq().maybeSingle()
 *   insert([...])
 *   delete().eq().eq()
 *   select(..., {count, head}).eq()  // returns { count }
 */

function createVoteMock({ startHadVote = false, startCount = 0 } = {}) {
  let hadVote = startHadVote;
  let count = startCount;
  const log = { inserts: 0, deletes: 0 };

  function votesFrom() {
    return {
      select: (_cols, opts) => {
        // count head query: select().eq() -> promise with count
        if (opts && opts.head && opts.count === 'exact') {
          return {
            eq: () =>
              Promise.resolve({ data: null, error: null, count }),
          };
        }
        // find / hasVoted: select().eq().eq().maybeSingle()
        return {
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: hadVote ? { id: 1 } : null,
                  error: null,
                }),
            }),
          }),
        };
      },
      insert: (rows) => {
        log.inserts += 1;
        hadVote = true;
        count += 1;
        return Promise.resolve({ data: rows, error: null });
      },
      delete: () => ({
        eq: () => ({
          eq: () => {
            log.deletes += 1;
            if (hadVote) {
              hadVote = false;
              count = Math.max(0, count - 1);
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    };
  }

  function ideasFrom() {
    return {
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { votes: count }, error: null }),
        }),
      }),
    };
  }

  return {
    log,
    getCount: () => count,
    getHadVote: () => hadVote,
    from: (table) => (table === 'votes' ? votesFrom() : ideasFrom()),
  };
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import { ideasService } from '../services/ideasService';

describe('ideasService voting (simple toggle)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggleVote inserts when not voted and returns voted:true + count', async () => {
    const mock = createVoteMock({ startHadVote: false, startCount: 2 });
    supabase.from.mockImplementation(mock.from);

    const result = await ideasService.toggleVote(10, 'user-abc');

    expect(result.voted).toBe(true);
    expect(result.votes).toBe(3);
    expect(mock.log.inserts).toBe(1);
    expect(mock.log.deletes).toBe(0);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('toggleVote deletes when already voted and returns voted:false + count', async () => {
    const mock = createVoteMock({ startHadVote: true, startCount: 5 });
    supabase.from.mockImplementation(mock.from);

    const result = await ideasService.toggleVote(10, 'user-abc');

    expect(result.voted).toBe(false);
    expect(result.votes).toBe(4);
    expect(mock.log.deletes).toBe(1);
    expect(mock.log.inserts).toBe(0);
  });

  it('toggleVote twice ends opposite of start (like then unlike)', async () => {
    const mock = createVoteMock({ startHadVote: false, startCount: 0 });
    supabase.from.mockImplementation(mock.from);

    const first = await ideasService.toggleVote(42, 'u1');
    expect(first).toEqual({ voted: true, votes: 1 });

    const second = await ideasService.toggleVote(42, 'u1');
    expect(second).toEqual({ voted: false, votes: 0 });
  });

  it('getUserVotedIdeaIds maps idea_id to strings', async () => {
    supabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [{ idea_id: 1 }, { idea_id: 2 }, { idea_id: null }],
            error: null,
          }),
      }),
    }));

    const ids = await ideasService.getUserVotedIdeaIds('user-1');
    expect(ids).toEqual(['1', '2']);
  });

  it('userHasVoted returns true when a row exists', async () => {
    supabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { id: 7 }, error: null }),
          }),
        }),
      }),
    }));

    await expect(ideasService.userHasVoted(3, 'u1')).resolves.toBe(true);
  });

  it('userHasVoted returns false when no row', async () => {
    supabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }));

    await expect(ideasService.userHasVoted(3, 'u1')).resolves.toBe(false);
  });
});
