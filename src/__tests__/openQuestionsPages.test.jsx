import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock('../hooks/useStaffRole', () => ({
  useStaffRole: () => ({ isStaff: false, loading: false }),
}));

const sampleQuestion = {
  id: 'q1',
  projectId: 'p1',
  title: 'How long should a session feel?',
  body: 'Need a call for the first playable.',
  isOpen: true,
  suggestionCount: 2,
  supportTotal: 5,
  nestedReplyCount: 1,
  createdAt: '2026-08-01T00:00:00Z',
  author: { username: 'staff', avatarUrl: null },
  project: { id: 'p1', slug: 'tether', title: 'Tether' },
  adoptedSuggestion: null,
  topRanked: {
    id: 's2',
    body: 'Keep it to a lunch break.',
    supportCount: 4,
    replyCount: 1,
    rank: 1,
    createdAt: '2026-08-01T02:00:00Z',
    author: { username: 'lee' },
    supportedByMe: false,
    replies: [],
  },
  suggestions: [
    {
      id: 's2',
      body: 'Keep it to a lunch break.',
      supportCount: 4,
      replyCount: 1,
      rank: 1,
      createdAt: '2026-08-01T02:00:00Z',
      author: { username: 'lee' },
      supportedByMe: false,
      replies: [],
    },
    {
      id: 's1',
      body: 'Make it a long evening session.',
      supportCount: 1,
      replyCount: 0,
      rank: 2,
      createdAt: '2026-08-01T01:00:00Z',
      author: { username: 'sam' },
      supportedByMe: true,
      replies: [],
    },
  ],
};

const listAll = vi.fn(async () => [sampleQuestion]);
const listProjects = vi.fn(async () => [
  { id: 'p1', slug: 'tether', title: 'Tether' },
]);
const getById = vi.fn(async () => sampleQuestion);

vi.mock('../services/openQuestionsService', async () => {
  const actual = await vi.importActual('../services/openQuestionsService');
  return {
    ...actual,
    openQuestionsService: {
      listAll: (...args) => listAll(...args),
      listProjects: (...args) => listProjects(...args),
      getById: (...args) => getById(...args),
      listForProject: vi.fn(async () => [sampleQuestion]),
    },
  };
});

import OpenQuestions from '../pages/OpenQuestions';
import OpenQuestionDetail from '../pages/OpenQuestionDetail';

describe('Open Questions pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAll.mockResolvedValue([sampleQuestion]);
    listProjects.mockResolvedValue([
      { id: 'p1', slug: 'tether', title: 'Tether' },
    ]);
    getById.mockResolvedValue(sampleQuestion);
  });

  it('lists questions with search, sort, and filters like Ideas', async () => {
    render(
      <MemoryRouter initialEntries={['/questions']}>
        <Routes>
          <Route path="/questions" element={<OpenQuestions />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('heading', { name: /community decisions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: /search open questions/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /sort questions/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filter by status/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filter by project/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /how long should a session feel/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/tether/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: /how long should a session feel/i })
    ).toHaveAttribute('href', '/questions/q1');
  });

  it('filters the list by search text', async () => {
    render(
      <MemoryRouter initialEntries={['/questions']}>
        <Routes>
          <Route path="/questions" element={<OpenQuestions />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /how long should a session feel/i });
    fireEvent.change(
      screen.getByRole('searchbox', { name: /search open questions/i }),
      { target: { value: 'warp' } }
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /how long should a session feel/i })
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText(/no questions match these filters/i)).toBeInTheDocument();
  });

  it('shows the full question and sortable answers on the detail page', async () => {
    render(
      <MemoryRouter initialEntries={['/questions/q1']}>
        <Routes>
          <Route path="/questions/:questionId" element={<OpenQuestionDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('heading', { name: /how long should a session feel/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/need a call for the first playable/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /community ideas/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/most voted sit at the top/i)
    ).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search answers/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /sort answers/i })).toBeInTheDocument();
    expect(screen.getByText(/keep it to a lunch break/i)).toBeInTheDocument();
    expect(screen.getByText(/make it a long evening session/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your answer/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /post an answer/i })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /open this idea/i }).length).toBe(
      2
    );

    fireEvent.click(screen.getByRole('button', { name: /post an answer/i }));
    expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
  });
});
