import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock('../hooks/useStaffRole', () => ({
  useStaffRole: () => ({ isStaff: false, loading: false }),
}));

vi.mock('../constants/pollsEnabled', () => ({
  arePollsEnabled: () => true,
}));

vi.mock('../services/pollsService', async () => {
  const actual = await vi.importActual('../services/pollsService');
  return {
    ...actual,
    pollsService: {
      listPublic: vi.fn(async () => []),
      getById: vi.fn(async () => null),
      vote: vi.fn(),
    },
  };
});

import Polls from '../pages/Polls';
import PollDetail from '../pages/PollDetail';
import PollVotePanel from '../components/polls/PollVotePanel';
import { pollsService } from '../services/pollsService';

describe('Polls pages', () => {
  beforeEach(() => {
    pollsService.listPublic.mockClear();
    pollsService.getById.mockClear();
  });

  it('shows the empty live state and no compose box', async () => {
    render(
      <MemoryRouter>
        <Polls />
      </MemoryRouter>
    );
    expect(
      await screen.findByText(/Help Together Forge hear the room/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Polls' })).toBeInTheDocument();
    expect(
      await screen.findByText(/There are currently no live polls/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/write-in/i)).toBeNull();
    expect(screen.queryByText(/Moderation Dashboard/i)).toBeNull();
  });

  it('has no comment thread on a missing poll', async () => {
    render(
      <MemoryRouter initialEntries={['/polls/missing']}>
        <Routes>
          <Route path="/polls/:pollId" element={<PollDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/Poll not found/i)).toBeInTheDocument();
    expect(screen.queryByText(/comment/i)).toBeNull();
  });

  it('pops a sign-in notice if a logged-out visitor tries to vote', async () => {
    render(
      <MemoryRouter>
        <PollVotePanel
          poll={{
            status: 'live',
            isClosed: false,
            options: [
              { id: 'a', name: 'Spark', description: 'Zap.', isNone: false },
              {
                id: 'n',
                name: 'None of these',
                description: '',
                isNone: true,
              },
            ],
          }}
          user={null}
          selectedId={null}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Spark/i }));
    expect(await screen.findByText(/Sign in to vote/i)).toBeInTheDocument();
  });
});
