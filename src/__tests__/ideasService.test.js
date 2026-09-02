import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ideasService,
  mapProfile,
  attachCreators,
  attachCommentProfiles,
  normalizeProjectKeys,
  ideaMatchesProject,
  buildSafeIdeaPayload,
  escapePostgrestOrValue,
  IDEAS_PAGE_SIZE,
} from '../services/ideasService';
import { canonicalProjectSlug } from '../utils/ideaStatus';

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
      pinnedBadgeKey: null,
      pinned_badge_key: null,
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

  it('canonicalProjectSlug rewrites Prototype Systems to tether', () => {
    expect(canonicalProjectSlug('prototype-systems')).toBe('tether');
    expect(canonicalProjectSlug('Tether')).toBe('tether');
    expect(canonicalProjectSlug('core-features')).toBe('core-features');
  });

  it('normalizeProjectKeys dedupes slug and id', () => {
    expect(normalizeProjectKeys('prototype-systems')).toEqual([
      'tether',
      'prototype-systems',
    ]);
    expect(normalizeProjectKeys('tether')).toEqual([
      'tether',
      'prototype-systems',
    ]);
    expect(
      normalizeProjectKeys({ slug: 'a', id: 'uuid-1' })
    ).toEqual(['a', 'uuid-1']);
    expect(normalizeProjectKeys(null)).toEqual([]);
  });

  it('ideaMatchesProject matches Tether aliases case-insensitively', () => {
    expect(
      ideaMatchesProject(
        { project_id: 'Prototype-Systems' },
        ['tether']
      )
    ).toBe(true);
    expect(
      ideaMatchesProject({ project_id: 'tether' }, ['prototype-systems'])
    ).toBe(true);
    expect(ideaMatchesProject({ project_id: 'other' }, ['tether'])).toBe(
      false
    );
  });

  it('buildSafeIdeaPayload includes project_id, status, guided_data', () => {
    const payload = buildSafeIdeaPayload({
      title: 'Hello',
      summary: 'Sum',
      description: 'Full desc',
      user_id: 'u1',
      project_id: 'tether',
      features: [{ name: 'Dash', description: 'Fast move' }],
      additionalNotes: ['Playtest note'],
      economySystem: 'Shared scrap economy',
      twitchIntegration: 'Chat votes on events',
      artStyle: 'Stylized pixel',
      targetPlatforms: 'PC first',
      coreLoopLength: '20 minute runs',
      primaryInspiration: 'Hades + DRG',
      estimatedScope: 'Small team',
    });
    expect(payload.project_id).toBe('tether');
    expect(
      buildSafeIdeaPayload({
        title: 'Hello',
        summary: 'Sum',
        description: 'Full desc',
        user_id: 'u1',
        project_id: 'prototype-systems',
      }).project_id
    ).toBe('tether');
    expect(payload.title).toBe('Hello');
    expect(payload.user_id).toBe('u1');
    expect(payload.description).toBe('Full desc');
    expect(payload.status).toBe('Proposed');
    expect(payload.guided_data).toBeTruthy();
    expect(payload.guided_data.features?.[0]?.name).toBe('Dash');
    expect(payload.guided_data.additional_notes).toContain('Playtest note');
    expect(payload.guided_data.economy_system).toBe('Shared scrap economy');
    expect(payload.guided_data.twitch_community).toBe('Chat votes on events');
    expect(payload.guided_data.art_style).toBe('Stylized pixel');
    expect(payload.guided_data.target_platforms).toBe('PC first');
    expect(payload.guided_data.core_loop_length).toBe('20 minute runs');
    expect(payload.guided_data.primary_inspiration).toBe('Hades + DRG');
    expect(payload.guided_data.estimated_scope).toBe('Small team');
    expect(payload.economy_description).toBe('Shared scrap economy');
    expect(payload.twitch_integration).toBe('Chat votes on events');
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

  it('escapePostgrestOrValue strips or-filter breakers', () => {
    expect(escapePostgrestOrValue('hello, world%_')).toBe('hello world');
    expect(IDEAS_PAGE_SIZE).toBe(12);
  });

  it('createIdea inserts and returns new idea', async () => {
    const idea = { title: 'Test' };
    const result = await ideasService.createIdea(idea);
    expect(result).toEqual({ id: 99 });
  });

  it('addVote inserts without calling RPC', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'votes') {
        return {
          insert: () => Promise.resolve({ data: null, error: null }),
          select: () => ({
            eq: () => Promise.resolve({ data: null, error: null, count: 1 }),
          }),
        };
      }
      return {
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
        select: () => ({
          order: () => Promise.resolve({ data: [{ id: 1 }], error: null }),
          eq: () => ({
            single: () =>
              Promise.resolve({ data: { id: 1, user_id: 'u1' }, error: null }),
            maybeSingle: () =>
              Promise.resolve({ data: { votes: 1 }, error: null }),
          }),
          in: () =>
            Promise.resolve({
              data: [{ id: 'u1', username: 'forge', avatar_url: 'x' }],
              error: null,
            }),
          limit: () =>
            Promise.resolve({ data: [{ id: 1, user_id: 'u1' }], error: null }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 99 }, error: null }),
          }),
        }),
      };
    });

    const result = await ideasService.addVote(1, 'user-1');
    expect(supabase.from).toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('getIdeasListingPage fetches one page with range and bounded comment counts', async () => {
    const range = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 7,
            user_id: 'u1',
            status: 'Proposed',
            title: 'A',
            votes: 2,
          },
        ],
        error: null,
        count: 40,
      })
    );
    const ideasChain = {
      or: vi.fn(() => ideasChain),
      in: vi.fn(() => ideasChain),
      eq: vi.fn(() => ideasChain),
      gte: vi.fn(() => ideasChain),
      lt: vi.fn(() => ideasChain),
      not: vi.fn(() => ideasChain),
      order: vi.fn(() => ideasChain),
      range,
      select: vi.fn(() => ideasChain),
    };
    const commentIn = vi.fn(() =>
      Promise.resolve({ data: [{ idea_id: 7 }], error: null })
    );
    const profileIn = vi.fn(() =>
      Promise.resolve({
        data: [{ id: 'u1', username: 'forge', avatar_url: null }],
        error: null,
      })
    );

    supabase.from.mockImplementation((table) => {
      if (table === 'ideas') {
        return ideasChain;
      }
      if (table === 'comments') {
        return {
          select: () => ({ in: commentIn }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            in: profileIn,
            ilike: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    });

    const result = await ideasService.getIdeasListingPage({
      limit: 12,
      offset: 12,
      sort: 'newest',
    });
    expect(range).toHaveBeenCalledWith(12, 23);
    expect(commentIn).toHaveBeenCalled();
    expect(result.total).toBe(40);
    expect(result.hasMore).toBe(true);
    expect(result.ideas).toHaveLength(1);
    expect(result.ideas[0].commentCount).toBe(1);
  });
});
