import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import TaskMap from '../components/tasks/TaskMap';
import BoardViewToggle from '../components/tasks/BoardViewToggle';

const t = (id, parentTaskId, title, extra = {}) => ({
  id,
  parentTaskId,
  title,
  status: 'todo',
  sortOrder: 0,
  createdAt: `2026-01-01T00:00:${id.length}0Z`,
  boardScope: 'public',
  category: 'Code',
  difficulty: 'Easy',
  description: `About ${title}`,
  ...extra,
});

const TASKS = [
  t('e1', null, 'Movement'),
  t('e2', null, 'Art pass', { sortOrder: 1 }),
  t('m1', 'e1', 'Tether physics'),
  t('m2', 'e1', 'Dash', { sortOrder: 1, status: 'completed', dbStatus: 'Completed' }),
  t('s1', 'm1', 'Tension curve', { claimedBy: 'ada', claim: { status: 'Active' } }),
];

describe('TaskMap', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    window.localStorage.clear();
  });

  it('shows Epics first, then branches out on click', () => {
    render(<TaskMap tasks={TASKS} onOpenTask={() => {}} />);
    const tree = screen.getByRole('tree', { name: 'Task map' });
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(2);
    expect(screen.queryByText('Tether physics')).toBeNull();

    const epic = within(tree).getByRole('treeitem', { name: /Movement/ });
    expect(epic.getAttribute('aria-expanded')).toBe('false');
    expect(epic.textContent).toContain('1/2 tasks done');
    fireEvent.click(epic);

    expect(epic.getAttribute('aria-expanded')).toBe('true');
    expect(within(tree).getByRole('treeitem', { name: /Tether physics/ })).toBeTruthy();
    // finished work is hidden by default, with no placeholder either
    expect(screen.queryByRole('treeitem', { name: /Dash/ })).toBeNull();
    expect(screen.queryByRole('treeitem', { name: /completed/ })).toBeNull();

    const toggle = screen.getByRole('button', { name: 'Show completed (1)' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(
      screen.getByRole('button', { name: 'Hide completed (1)' }).getAttribute('aria-pressed')
    ).toBe('true');
    // then folded into one node until asked for
    fireEvent.click(within(tree).getByRole('treeitem', { name: /Show 1 completed/ }));
    expect(within(tree).getByRole('treeitem', { name: /Dash/ })).toBeTruthy();
  });

  it('remembers Show completed and offers it when everything is done', () => {
    const allDone = [
      t('e1', null, 'Movement', { status: 'completed', dbStatus: 'Completed' }),
    ];
    const { unmount } = render(<TaskMap tasks={allDone} onOpenTask={() => {}} />);
    expect(screen.getByText(/Every task on this board is completed/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show completed tasks' }));
    expect(screen.getByRole('treeitem', { name: /Movement/ })).toBeTruthy();
    unmount();
    render(<TaskMap tasks={allDone} onOpenTask={() => {}} />);
    expect(screen.getByRole('treeitem', { name: /Movement/ })).toBeTruthy();
  });

  it('shows details for the selected task and opens the full task', () => {
    const onOpenTask = vi.fn();
    render(<TaskMap tasks={TASKS} onOpenTask={onOpenTask} />);
    const panel = screen.getByRole('complementary', { name: 'Selected task' });
    expect(within(panel).getByText('How to read the map')).toBeTruthy();

    fireEvent.click(screen.getByRole('treeitem', { name: /Movement/ }));
    fireEvent.click(screen.getByRole('treeitem', { name: /Tether physics/ }));
    fireEvent.click(screen.getByRole('treeitem', { name: /Tension curve/ }));

    expect(within(panel).getByRole('heading', { name: 'Tension curve' })).toBeTruthy();
    expect(within(panel).getByText('Movement › Tether physics')).toBeTruthy();
    expect(within(panel).getByText('About Tension curve')).toBeTruthy();
    expect(within(panel).getByText(/In progress/)).toBeTruthy();
    expect(within(panel).getByText(/ada/)).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Open full task' }));
    expect(onOpenTask).toHaveBeenCalledWith('s1');
  });

  it('keeps one branch open per level', () => {
    render(<TaskMap tasks={[...TASKS, t('m9', 'e2', 'Icons')]} onOpenTask={() => {}} />);
    fireEvent.click(screen.getByRole('treeitem', { name: /Movement/ }));
    expect(screen.getByRole('treeitem', { name: /Tether physics/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('treeitem', { name: /Art pass/ }));
    expect(screen.getByRole('treeitem', { name: /Movement/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('treeitem', { name: /Art pass/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('treeitem', { name: /Icons/ })).toBeTruthy();
  });

  it('supports arrow keys', () => {
    render(<TaskMap tasks={TASKS} onOpenTask={() => {}} />);
    const first = screen.getByRole('treeitem', { name: /Movement/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement.textContent).toContain('Art pass');
    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(first.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(first.getAttribute('aria-expanded')).toBe('false');
  });

  it('resets and handles an empty board', async () => {
    const { rerender } = render(<TaskMap tasks={TASKS} onOpenTask={() => {}} />);
    fireEvent.click(screen.getByRole('treeitem', { name: /Movement/ }));
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    // the closing branch fades out before it leaves the page
    await waitFor(() => expect(screen.getAllByRole('treeitem')).toHaveLength(2));
    rerender(<TaskMap tasks={[]} onOpenTask={() => {}} />);
    expect(screen.getByText('No tasks on this board yet.')).toBeTruthy();
  });
});

describe('BoardViewToggle', () => {
  it('reports the chosen view and marks the active one', () => {
    const onChange = vi.fn();
    render(<BoardViewToggle view="board" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Board' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Map' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(onChange).toHaveBeenCalledWith('map');
  });
});
