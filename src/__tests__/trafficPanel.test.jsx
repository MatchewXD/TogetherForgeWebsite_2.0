import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/trafficService', () => ({
  getTrafficActiveNow: vi.fn(async () => ({
    activeNow: 3,
    signedIn: 1,
    guests: 2,
  })),
  getTrafficReport: vi.fn(async () => ({
    range: '7d',
    bucket: '1 hour',
    activeNow: 3,
    uniqueVisitors: 8,
    pageviews: 21,
    signedInVisitors: 2,
    guestVisitors: 6,
    signedInPageviews: 5,
    guestPageviews: 16,
    series: [
      { t: '2026-08-01T00:00:00Z', concurrent: 1, pageviews: 2 },
      { t: '2026-08-01T01:00:00Z', concurrent: 3, pageviews: 4 },
    ],
    topPages: [
      { path: '/about', pageviews: 3 },
      { path: '/ideas', pageviews: 10 },
    ],
  })),
}));

import TrafficPanel from '../components/moderation/TrafficPanel';

describe('TrafficPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows live count, range default, and a Pages list', async () => {
    render(
      <MemoryRouter>
        <TrafficPanel />
      </MemoryRouter>
    );

    expect(await screen.findByText('Active now')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Traffic' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 days' })).toBeInTheDocument();
    expect(screen.getByText('Ideas')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/user_id/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/First-party counts for planning spikes/i)
    ).not.toBeInTheDocument();
  });
});
