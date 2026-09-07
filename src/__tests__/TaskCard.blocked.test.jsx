import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskCard from '../components/ui/TaskCard';

function renderCard(task) {
  return render(
    <MemoryRouter>
      <TaskCard task={task} onView={() => {}} />
    </MemoryRouter>
  );
}

describe('TaskCard blocked treatment', () => {
  it('greys a locked small and labels it Blocked', () => {
    const { container } = renderCard({
      id: 's1',
      title: 'Tether-4.1 ResourceNode and carry limit',
      depth: 2,
      isLocked: true,
      isVisuallyBlocked: true,
      lockedWaitingOn: ['Tether-3.1 Core locomotion and camera'],
      status: 'todo',
      dbStatus: 'ToDo',
    });
    const card = container.querySelector('[data-blocked="true"]');
    expect(card).toBeTruthy();
    expect(card.className).toMatch(/task-card-blocked/);
    expect(card.className).toMatch(/task-card-accent-blocked/);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(screen.getByText(/Tether-3\.1 Core locomotion/)).toBeInTheDocument();
  });

  it('greys a Medium when the group is rolled up as blocked', () => {
    const { container } = renderCard({
      id: 'm1',
      title: 'Tether-4 Resources and warp',
      depth: 1,
      isLocked: false,
      isBlockedGroup: true,
      isVisuallyBlocked: true,
      hasChildren: true,
      childCount: 2,
      completedChildCount: 0,
      lockedWaitingOn: ['Tether-3.1 Core locomotion and camera'],
      status: 'todo',
      dbStatus: 'ToDo',
    });
    const card = container.querySelector('[data-blocked="true"]');
    expect(card).toBeTruthy();
    expect(card.className).toMatch(/task-card-accent-medium/);
    expect(card.className).toMatch(/task-card-blocked/);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
  });
});
