import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskCard from '../components/ui/TaskCard';

function renderCard(task, onView = () => {}) {
  return render(
    <MemoryRouter>
      <TaskCard task={task} onView={onView} />
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
      blockedByIncomplete: [
        {
          id: 't31',
          title: 'Tether-3.1 Core locomotion and camera',
        },
      ],
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

  it('opens the blocking task modal when its name is clicked', () => {
    const onView = vi.fn();
    renderCard(
      {
        id: 's1',
        title: 'Tether-4.1 ResourceNode and carry limit',
        depth: 2,
        isLocked: true,
        isVisuallyBlocked: true,
        lockedWaitingOn: ['Tether-3.1 Core locomotion and camera'],
        blockedByIncomplete: [
          {
            id: 't31',
            title: 'Tether-3.1 Core locomotion and camera',
          },
        ],
        status: 'todo',
        dbStatus: 'ToDo',
      },
      onView
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Tether-3.1 Core locomotion and camera',
      })
    );
    expect(onView).toHaveBeenCalledWith('t31');
  });
});
