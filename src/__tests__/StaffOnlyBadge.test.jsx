import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StaffOnlyBadge from '../components/ui/StaffOnlyBadge';
import {
  STAFF_CONTACT_EMAIL,
  STAFF_ONLY_TASK_SNIPPET,
} from '../services/tasksService';

describe('StaffOnlyBadge', () => {
  it('shows a Staff Only badge with a short hover preview', () => {
    render(<StaffOnlyBadge />);
    expect(
      screen.getByRole('button', { name: /staff only/i })
    ).toBeInTheDocument();
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent(`${STAFF_ONLY_TASK_SNIPPET}…`);
    expect(
      screen.queryByRole('link', { name: STAFF_CONTACT_EMAIL })
    ).not.toBeInTheDocument();
  });

  it('opens the full warning when the badge is clicked', () => {
    render(<StaffOnlyBadge />);
    fireEvent.click(screen.getByRole('button', { name: /staff only/i }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByText(/please be patient/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: STAFF_CONTACT_EMAIL })
    ).toHaveAttribute('href', `mailto:${STAFF_CONTACT_EMAIL}`);
    expect(screen.getByRole('link', { name: 'Discord' })).toBeInTheDocument();
  });

  it('closes the full warning on a second click', () => {
    render(<StaffOnlyBadge />);
    const btn = screen.getByRole('button', { name: /staff only/i });
    fireEvent.click(btn);
    expect(screen.getByText(/please be patient/i)).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText(/please be patient/i)).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});
