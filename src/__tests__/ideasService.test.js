import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ideasService,
  mapProfile,
  attachCreators,
  attachCommentProfiles,
  normalizeProjectKeys,
  ideaMatchesProject,
  buildSafeIdeaPayload,
} from '../services/ideasService';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [{ id: 1 }], error: null })),
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: { id: 1, user_id: 'u1' }, error: null })
          ),
          order: vi.fn(() =>
            Promise.resolve({ data: [{ id: 10, user_id: 'u1' }], error: null })
          ),
        })),
        in: vi.fn(() =>
          Promise.resolve({
            data: [{ id: 'u1', username: 'forge', avatar_url: 'https://img/a.png' }],
            error: null,
          })
        ),
        limit: vi.fn(() =>
          Promise.resolve({ data: [{ id: 1, user_id: 'u1' }], error: null })
        ),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 99 }, error: null })),
        })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: true, error: null })),
  },
}));

import { supabase } from '../lib/supabase';

describe('ideasService helpers', () => {
  it('mapProfile normalizes avatar_url and avatarUrl', () => {
    expect(mapProfile({ username: 'a', avatar_url: 'x' })).toEqual({
      id: null,
      username: 'a',
      avatar_url: 'x',
      avatarUrl: 'x',
    });
    expect(mapProfile(null, 'Guest').username).toBe('Guest');
  });

  it('attachCreators maps user_id to creator profile', () => {
    const ideas = [{ id: 1, user_id: 'u1', title: 'T' }];
    const map = {
      u1: { username: 'forge', avatar_url: 'img', avatarUrl: 'img' },
    };
    const result = attachCreators(ideas, map);
    expect(result[0].creator.username).toBe('forge');
    expect(result[0].creator.avatar_url).toBe('img');
  });

  it('attachCommentProfiles maps authors', () => {
    const comments = [{ id: 1, user_id: 'u1', content: 'hi' }];
    const map = {
      u1: { username: 'alice', avatar_url: null, avatarUrl: null },
    };
    const result = attachCommentProfiles(comments, map);
    expect(result[0].profiles.username).toBe('alice');
  });

  it('normalizeProjectKeys dedupes slug and id', () => {
    expect(normalizeProjectKeys('prototype-systems')).toEqual([
      'prototype-systems',
    ]);
    expect(
      normalizeProjectKeys({ slug: 'a', id: 'uuid-1' })
    ).toEqual(['a', 'uuid-1']);
    expect(normalizeProjectKeys(null)).toEqual([]);
  });

  it('ideaMatchesProject matches slug case-insensitively', () => {
    expect(
      ideaMatchesProject(
        { project_id: 'Prototype-Systems' },
        ['prototype-systems']
      )
    ).toBe(true);
    expect(ideaMatchesProject({ project_id: 'other' }, ['prototype-systems'])).toBe(
      false
    );
  });

  it('buildSafeIdeaPayload includes project_id and drops unknown arrays', () => {
    const payload = buildSafeIdeaPayload({
      title: 'Hello',
      summary: 'Sum',
      user_id: 'u1',
      project_id: 'prototype-systems',
      enemies: [{ name: 'Goblin', description: 'Fast' }],
      progressionType: 'XP',
    });
    expect(payload.project_id).toBe('prototype-systems');
    expect(payload.title).toBe('Hello');
    expect(payload.user_id).toBe('u1');
    expect(payload.enemies).toBeUndefined();
    expect(payload.progression_system).toContain('XP');
  });
});

describe('ideasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAllIdeas returns data from supabase', async () => {
    const result = await ideasService.getAllIdeas();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('createIdea inserts and returns new idea', async () => {
    const idea = { title: 'Test' };
    const result = await ideasService.createIdea(idea);
    expect(result).toEqual({ id: 99 });
  });

  it('addVote calls insert and rpc', async () => {
    await ideasService.addVote(1, 'user-1');
    expect(supabase.from).toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalled();
  });
});
