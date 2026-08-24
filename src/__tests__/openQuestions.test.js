import { describe, it, expect } from 'vitest';
import {
  assembleQuestion,
  compareSuggestions,
} from '../services/openQuestionsService';

function q(partial = {}) {
  return {
    id: 'q1',
    project_id: 'p1',
    created_by: 'staff1',
    title: 'How long should a session feel?',
    body: 'Need a call for the first playable.',
    status: 'open',
    selected_reply_id: null,
    close_note: null,
    closed_at: null,
    closed_by: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...partial,
  };
}

function reply(partial) {
  return {
    id: partial.id,
    question_id: 'q1',
    parent_id: partial.parent_id ?? null,
    user_id: partial.user_id || 'u1',
    body: partial.body || 'Suggestion',
    created_at: partial.created_at || '2026-08-01T01:00:00Z',
  };
}

describe('compareSuggestions', () => {
  it('ranks by supports, then replies, then earliest', () => {
    const a = { id: 'a', supportCount: 2, replyCount: 0, createdAt: '2026-08-01T02:00:00Z' };
    const b = { id: 'b', supportCount: 5, replyCount: 0, createdAt: '2026-08-01T03:00:00Z' };
    const c = { id: 'c', supportCount: 5, replyCount: 3, createdAt: '2026-08-01T04:00:00Z' };
    expect(compareSuggestions(a, b)).toBeGreaterThan(0);
    expect(compareSuggestions(c, b)).toBeLessThan(0);
  });
});

describe('assembleQuestion', () => {
  it('ranks suggestions by supports then replies', () => {
    const view = assembleQuestion(
      q(),
      [
        reply({ id: 's1', body: 'Short sessions', created_at: '2026-08-01T01:00:00Z' }),
        reply({ id: 's2', body: 'Longer sessions', created_at: '2026-08-01T01:05:00Z' }),
        reply({
          id: 'r1',
          parent_id: 's1',
          body: 'Why short?',
          created_at: '2026-08-01T02:00:00Z',
        }),
      ],
      {},
      [
        { reply_id: 's2', user_id: 'u2' },
        { reply_id: 's2', user_id: 'u3' },
        { reply_id: 's1', user_id: 'u4' },
      ],
      'u2'
    );
    expect(view.suggestionCount).toBe(2);
    expect(view.suggestions[0].id).toBe('s2');
    expect(view.suggestions[0].rank).toBe(1);
    expect(view.suggestions[0].supportCount).toBe(2);
    expect(view.suggestions[0].supportedByMe).toBe(true);
    expect(view.suggestions[1].id).toBe('s1');
    expect(view.suggestions[1].replyCount).toBe(1);
    expect(view.topRanked?.id).toBe('s2');
  });

  it('still ranks when nothing has supports yet (earliest first)', () => {
    const view = assembleQuestion(q(), [
      reply({ id: 's1', body: 'Short sessions', created_at: '2026-08-01T01:00:00Z' }),
      reply({ id: 's2', body: 'Longer sessions', created_at: '2026-08-01T01:05:00Z' }),
    ]);
    expect(view.topRanked?.id).toBe('s1');
    expect(view.suggestions[0].rank).toBe(1);
  });

  it('keeps an adopted suggestion distinct from top-ranked', () => {
    const view = assembleQuestion(
      q({ selected_reply_id: 's1' }),
      [
        reply({ id: 's1', body: 'Fits the game', created_at: '2026-08-01T01:00:00Z' }),
        reply({ id: 's2', body: 'Popular but off-tone', created_at: '2026-08-01T01:05:00Z' }),
      ],
      {},
      [
        { reply_id: 's2', user_id: 'u2' },
        { reply_id: 's2', user_id: 'u3' },
      ]
    );
    expect(view.topRanked?.id).toBe('s2');
    expect(view.adoptedSuggestion?.id).toBe('s1');
    expect(view.isOpen).toBe(true);
  });

  it('surfaces close note and adopted suggestion when closed', () => {
    const view = assembleQuestion(
      q({
        status: 'closed',
        selected_reply_id: 's1',
        close_note: 'Short sessions fit the first playable.',
      }),
      [reply({ id: 's1', body: 'Short sessions' })]
    );
    expect(view.isOpen).toBe(false);
    expect(view.closeNote).toMatch(/first playable/);
    expect(view.adoptedSuggestion?.id).toBe('s1');
  });

  it('does not rank nested replies as suggestions', () => {
    const view = assembleQuestion(q(), [
      reply({ id: 's1', body: 'Short sessions' }),
      reply({
        id: 'r1',
        parent_id: 's1',
        body: 'Agree, keep it tight.',
        created_at: '2026-08-01T02:00:00Z',
      }),
    ]);
    expect(view.suggestionCount).toBe(1);
    expect(view.suggestions[0].id).toBe('s1');
    expect(view.suggestions[0].replies.map((r) => r.id)).toEqual(['r1']);
  });

  it('can close with a note and no adopted suggestion', () => {
    const view = assembleQuestion(
      q({
        status: 'closed',
        close_note: 'None of these fit the tone of the game.',
      }),
      [
        reply({ id: 's1', body: 'Popular but off-tone' }),
      ]
    );
    expect(view.isOpen).toBe(false);
    expect(view.adoptedSuggestion).toBeNull();
    expect(view.topRanked?.id).toBe('s1');
    expect(view.closeNote).toMatch(/tone of the game/);
  });
});
