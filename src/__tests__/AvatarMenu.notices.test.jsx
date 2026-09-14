import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const notices = vi.hoisted(() => ({
  current: {
    memberPin: false,
    staffPin: false,
    global: false,
    staffAttention: { total: 0 },
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signOut: vi.fn(async () => ({})) },
  },
}));

vi.mock('../hooks/useStaffRole', () => ({
  useStaffRole: () => ({ canSeeModeratorDashboard: true }),
}));

vi.mock('../context/UserNoticesContext', () => ({
  useUserNotices: () => notices.current,
}));

import AvatarMenu from '../components/account/AvatarMenu';

function renderMenu() {
  return render(
    <MemoryRouter>
      <AvatarMenu user={{ email: 'mod@example.com' }} username="mod" />
    </MemoryRouter>
  );
}

describe('AvatarMenu notice routing', () => {
  beforeEach(() => {
    notices.current = {
      memberPin: false,
      staffPin: false,
      global: false,
      staffAttention: { total: 0 },
    };
  });

  it('pins Moderator Dashboard with the staff mark, not Dashboard, for mod queues', () => {
    notices.current = {
      memberPin: false,
      staffPin: true,
      global: false,
      staffAttention: { total: 3 },
    };
    renderMenu();
    fireEvent.click(
      screen.getByRole('button', {
        name: /moderator queues need attention/i,
      })
    );
    const modLink = document.querySelector('a[href="/moderator"]');
    expect(modLink).toBeTruthy();
    expect(
      within(modLink).getByRole('status', {
        name: /moderator queues need attention/i,
      })
    ).toBeInTheDocument();
    const dashLink = document.querySelector('a[href="/dashboard"]');
    expect(dashLink).toBeTruthy();
    expect(within(dashLink).queryByRole('status')).not.toBeInTheDocument();
  });

  it('pins Dashboard with the member dot when the inbox has notices', () => {
    notices.current = {
      memberPin: true,
      staffPin: false,
      global: true,
      staffAttention: { total: 0 },
    };
    renderMenu();
    fireEvent.click(
      screen.getByRole('button', { name: /open account menu, new notices/i })
    );
    const dashLink = document.querySelector('a[href="/dashboard"]');
    expect(dashLink).toBeTruthy();
    expect(
      within(dashLink).getByRole('status', {
        name: /dashboard has new notices/i,
      })
    ).toBeInTheDocument();
    const modLink = document.querySelector('a[href="/moderator"]');
    expect(modLink).toBeTruthy();
    expect(within(modLink).queryByRole('status')).not.toBeInTheDocument();
  });
});
