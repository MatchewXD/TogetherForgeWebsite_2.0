import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinanceDashboard from '../components/transparency/FinanceDashboard';

const summary = {
  studioTotalCents: 10000,
  studioPaymentCount: 1,
  studioMrrCents: 0,
  source: 'supabase',
};

function renderDash(props = {}) {
  return render(
    <MemoryRouter>
      <FinanceDashboard summary={summary} recentItems={[]} {...props} />
    </MemoryRouter>
  );
}

describe('FinanceDashboard published expenses', () => {
  it('keeps Total spent at $0.00 with no placeholder rows', () => {
    renderDash({ expenses: [] });
    expect(screen.getByText('Total received').closest('div')?.parentElement).toHaveTextContent(
      '$100'
    );
    expect(screen.getByText('Total spent').closest('div')?.parentElement).toHaveTextContent(
      '$0.00'
    );
    expect(
      screen.getByText(/No published expenses yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
  });

  it('sums listed expenses without reducing Total received', () => {
    renderDash({
      expenses: [
        {
          id: 'e1',
          date: '2026-08-01',
          category: 'Tools & infrastructure',
          vendor: 'Acme Hosting',
          amountCents: 3000,
          description: 'Production database hosting for August.',
        },
        {
          id: 'e2',
          date: '2026-08-10',
          category: 'Community',
          vendor: 'Mod tools',
          amountCents: 500,
          description: 'Community moderation software.',
        },
      ],
    });

    const received = screen.getByText('Total received').closest('div')?.parentElement;
    const spent = screen.getByText('Total spent').closest('div')?.parentElement;
    expect(received).toHaveTextContent('$100');
    expect(spent).toHaveTextContent('$35.00');
    expect(screen.getByText('Acme Hosting')).toBeInTheDocument();
    expect(
      screen.getByText('Production database hosting for August.')
    ).toBeInTheDocument();
    expect(screen.getAllByText('$30.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$5.00').length).toBeGreaterThanOrEqual(1);
  });
});
