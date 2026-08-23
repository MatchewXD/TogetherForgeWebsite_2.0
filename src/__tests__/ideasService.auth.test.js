/**
 * Ideas: publish/draft require auth; safe payload shape for submit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      refreshSession: vi.fn(async () => ({
        data: { session: null },
        error: null,
      })),
    },
  },
}));

import {
  ideasService,
  buildSafeIdeaPayload,
  filterPublicIdeas,
} from '../services/ideasService';

describe('ideasService auth gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveDraft requires userId', async () => {
    await expect(
      ideasService.saveDraft({ title: 'x' }, null)
    ).rejects.toThrow(/signed in/i);
  });

  it('publishIdea requires userId', async () => {
    await expect(
      ideasService.publishIdea({ title: 'x' }, null)
    ).rejects.toThrow(/signed in/i);
  });

  it('toggleVote requires userId', async () => {
    await expect(ideasService.toggleVote(1, null)).rejects.toThrow(
      /signed in/i
    );
  });
});

describe('buildSafeIdeaPayload (submit idea shape)', () => {
  it('trims title and keeps status', () => {
    const p = buildSafeIdeaPayload({
      title: '  My idea  ',
      summary: 'A summary',
      status: 'Proposed',
      user_id: 'u1',
    });
    expect(p.title).toBe('My idea');
    expect(p.user_id).toBe('u1');
  });
});

describe('filterPublicIdeas (published vs draft)', () => {
  it('excludes drafts from public feed helpers', () => {
    const list = filterPublicIdeas([
      { id: 1, status: 'Draft', title: 'd' },
      { id: 2, status: 'Proposed', title: 'p' },
    ]);
    expect(list.map((i) => i.id)).toEqual([2]);
  });
});
