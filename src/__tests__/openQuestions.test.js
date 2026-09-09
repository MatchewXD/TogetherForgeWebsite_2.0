import { describe, it, expect } from 'vitest';
import {
  assembleQuestion,
  compareSuggestions,
  filterQuestions,
  filterSuggestions,
  flattenQuestionPrompt,
  hasStructuredPrompt,
  parseQuestionPrompt,
  questionsListPath,
  sortQuestions,
  sortSuggestions,
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

describe('parseQuestionPrompt', () => {
  it('maps a structured prompt and falls back to body as context', () => {
    const structured = parseQuestionPrompt({
      prompt: {
        context: 'Players share one beam.',
        questionDetail: 'How long should a session feel?',
        shouldFit: 'Length for 1-4 players.',
        shouldNotFit: 'A new genre.',
        additional: 'See Tether-6.2.',
      },
    });
    expect(structured.context).toMatch(/beam/);
    expect(hasStructuredPrompt(structured)).toBe(true);
    expect(flattenQuestionPrompt(structured)).toMatch(/Tether-6\.2/);
    const legacy = parseQuestionPrompt({
      body: 'Need a call for the first playable.',
    });
    expect(legacy.context).toMatch(/first playable/);
    expect(hasStructuredPrompt(legacy)).toBe(false);
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

  it('nests comments under an answer so discussion can thread', () => {
    const view = assembleQuestion(q(), [
      reply({ id: 's1', body: 'Short sessions' }),
      reply({
        id: 'c1',
        parent_id: 's1',
        body: 'Why short?',
        created_at: '2026-08-01T02:00:00Z',
      }),
      reply({
        id: 'c2',
        parent_id: 'c1',
        body: 'Fits a lunch break.',
        created_at: '2026-08-01T02:10:00Z',
      }),
    ]);
    expect(view.suggestions[0].replyCount).toBe(2);
    expect(view.suggestions[0].replies[0].id).toBe('c1');
    expect(view.suggestions[0].replies[0].replies[0].id).toBe('c2');
  });

  it('nests replies more than one level under a comment', () => {
    const view = assembleQuestion(q(), [
      reply({ id: 's1', body: 'Short sessions' }),
      reply({ id: 'c1', parent_id: 's1', body: 'Why short?' }),
      reply({ id: 'c2', parent_id: 'c1', body: 'Fits a lunch break.' }),
      reply({ id: 'c3', parent_id: 'c2', body: 'Also easier to test.' }),
    ]);
    expect(view.suggestionCount).toBe(1);
    expect(view.suggestions[0].replyCount).toBe(3);
    expect(view.suggestions[0].replies[0].replies[0].replies[0].id).toBe('c3');
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

  it('counts total votes across answers for list sorting', () => {
    const view = assembleQuestion(
      q(),
      [
        reply({ id: 's1', body: 'A' }),
        reply({ id: 's2', body: 'B' }),
      ],
      {},
      [
        { reply_id: 's1', user_id: 'u2' },
        { reply_id: 's2', user_id: 'u3' },
        { reply_id: 's2', user_id: 'u4' },
      ]
    );
    expect(view.supportTotal).toBe(3);
  });
});

describe('filter and sort questions', () => {
  const rows = [
    {
      id: 'q-open',
      title: 'How long should a session feel?',
      body: 'First playable pacing',
      isOpen: true,
      suggestionCount: 2,
      supportTotal: 1,
      nestedReplyCount: 0,
      createdAt: '2026-08-02T00:00:00Z',
      adoptedSuggestion: null,
      projectId: 'p1',
      project: { id: 'p1', slug: 'tether', title: 'Tether' },
      author: { username: 'staff' },
      suggestions: [{ body: 'Short sessions' }],
    },
    {
      id: 'q-closed',
      title: 'Should warp be limited?',
      body: 'Resource question',
      isOpen: false,
      suggestionCount: 4,
      supportTotal: 9,
      nestedReplyCount: 6,
      createdAt: '2026-08-01T00:00:00Z',
      adoptedSuggestion: { id: 's1', body: 'Yes, cap it' },
      projectId: 'p2',
      project: { id: 'p2', slug: 'other', title: 'Other' },
      author: { username: 'lead' },
      suggestions: [{ body: 'Cap warp' }],
    },
  ];

  it('filters by search across title, body, and answers', () => {
    expect(filterQuestions(rows, { search: 'session' }).map((q) => q.id)).toEqual([
      'q-open',
    ]);
    expect(filterQuestions(rows, { search: 'cap warp' }).map((q) => q.id)).toEqual([
      'q-closed',
    ]);
  });

  it('filters open, closed, and adopted', () => {
    expect(filterQuestions(rows, { status: 'open' })).toHaveLength(1);
    expect(filterQuestions(rows, { status: 'closed' })[0].id).toBe('q-closed');
    expect(filterQuestions(rows, { status: 'adopted' })[0].id).toBe('q-closed');
  });

  it('filters by project slug or id', () => {
    expect(filterQuestions(rows, { projectKey: 'tether' })[0].id).toBe('q-open');
    expect(filterQuestions(rows, { projectKey: 'p2' })[0].id).toBe('q-closed');
  });

  it('sorts by newest, answers, votes, and title', () => {
    expect(sortQuestions(rows, 'newest')[0].id).toBe('q-open');
    expect(sortQuestions(rows, 'answers')[0].id).toBe('q-closed');
    expect(sortQuestions(rows, 'votes')[0].id).toBe('q-closed');
    expect(sortQuestions(rows, 'title')[0].id).toBe('q-open');
  });

  it('builds a list path with filters', () => {
    expect(questionsListPath({ project: 'tether', sort: 'votes' })).toBe(
      '/questions?sort=votes&project=tether'
    );
  });
});

describe('filter and sort answers', () => {
  const answers = [
    {
      id: 'a',
      body: 'Short sessions',
      supportCount: 2,
      replyCount: 1,
      createdAt: '2026-08-01T01:00:00Z',
      supportedByMe: true,
      author: { username: 'sam' },
    },
    {
      id: 'b',
      body: 'Longer sessions with a boss',
      supportCount: 5,
      replyCount: 0,
      createdAt: '2026-08-01T03:00:00Z',
      supportedByMe: false,
      author: { username: 'lee' },
    },
  ];

  it('filters by search and my votes', () => {
    expect(filterSuggestions(answers, { search: 'boss' }).map((s) => s.id)).toEqual([
      'b',
    ]);
    expect(filterSuggestions(answers, { votedOnly: true }).map((s) => s.id)).toEqual([
      'a',
    ]);
  });

  it('sorts by votes, newest, and comments', () => {
    expect(sortSuggestions(answers, 'votes')[0].id).toBe('b');
    expect(sortSuggestions(answers, 'newest')[0].id).toBe('b');
    expect(sortSuggestions(answers, 'comments')[0].id).toBe('a');
  });
});
