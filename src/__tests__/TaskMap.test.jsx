import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import TaskMap from '../components/tasks/TaskMap';
import BoardViewToggle from '../components/tasks/BoardViewToggle';

// jsdom has no layout engine; React Flow needs these (see reactflow.dev testing)
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.DOMMatrixReadOnly = class {
    constructor(transform) {
      const scale = transform?.match?.(/scale\(([0-9.]+)\)/)?.[1];
      this.m22 = scale !== undefined ? Number(scale) : 1;
    }
  };
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { configurable: true, get() { return parseFloat(this.style.height) || 1; } },
    offsetWidth: { configurable: true, get() { return parseFloat(this.style.width) || 1; } },
  });
  SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
  // Reduced motion: cards land in place at once (no animation frames in tests)
  window.matchMedia = (query) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
});

const t = (id, parentTaskId, title, extra = {}) => ({
  id,
  parentTaskId,
  title,
  status: 'todo',
  sortOrder: 0,
  createdAt: `2026-01-01T00:00:${id.length}0Z`,
  boardScope: 'public',
  category: 'Art',
  difficulty: 'Easy',
  description: `About ${title}`,
  depth: parentTaskId ? (parentTaskId.startsWith('e') ? 1 : 2) : 0,
  ...extra,
});

const TASKS = [
  t('e1', null, 'Movement', { hasChildren: true, childCount: 2 }),
  t('e2', null, 'Art pass', { sortOrder: 1 }),
  t('m1', 'e1', 'Tether physics', { hasChildren: true, childCount: 1 }),
  t('m2', 'e1', 'Dash', { sortOrder: 1, status: 'completed', dbStatus: 'Completed' }),
  t('s1', 'm1', 'Tension curve', {
    category: 'Code',
    claimedBy: 'ada',
    claim: { status: 'Active', userId: 'u-ada' },
  }),
];

const panel = () => screen.getByRole('complementary', { name: 'Selected task' });
const item = (name) => screen.getByRole('treeitem', { name });

function openToSmall() {
  fireEvent.click(item(/Movement/));
  fireEvent.click(item(/Tether physics/));
  fireEvent.click(item(/Tension curve/));
}

describe('TaskMap', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows Epics first, then branches out on click', () => {
    render(<TaskMap tasks={TASKS} onOpenTask={() => {}} />);
    const tree = screen.getByRole('tree', { name: 'Task map' });
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(2);
    expect(screen.queryByText('Tether physics')).toBeNull();

    const epic = within(tree).getByRole('treeitem', { name: /Movement/ });
    expect(epic.getAttribute('aria-expanded')).toBe('false');
    expect(epic.textContent).toContain('2 tasks · 0 open · 50% done');
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

  it('draws the canvas with a minimap, zoom and fit controls', () => {
    render(<TaskMap tasks={TASKS} onOpenTask={() => {}} />);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy();
    // phones keep only fit-to-view (inline in the breadcrumb); desktop has the full group
    expect(screen.getAllByRole('button', { name: 'Fit to view' })).toHaveLength(2);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(document.querySelector('.react-flow__minimap')).toBeTruthy();
    expect(document.querySelector('.react-flow__background')).toBeTruthy();
  });

  it('remembers Show completed and offers it when everything is done', () => {
    const allDone = [
      t('e1', null, 'Movement', { status: 'completed', dbStatus: 'Completed' }),
    ];
    const { unmount } = render(<TaskMap tasks={allDone} onOpenTask={() => {}} />);
    expect(screen.getByText(/Every task on this board is completed/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show completed tasks' }));
    expect(item(/Movement/)).toBeTruthy();
    unmount();
    render(<TaskMap tasks={allDone} onOpenTask={() => {}} />);
    expect(item(/Movement/)).toBeTruthy();
  });

  it('shows details for the selected task and opens the full task', () => {
    const onOpenTask = vi.fn();
    render(<TaskMap tasks={TASKS} onOpenTask={onOpenTask} />);
    expect(within(panel()).getByText('How to read the map')).toBeTruthy();

    openToSmall();

    expect(within(panel()).getByRole('heading', { name: 'Tension curve' })).toBeTruthy();
    expect(within(panel()).getByText('Movement › Tether physics')).toBeTruthy();
    expect(within(panel()).getByText('About Tension curve')).toBeTruthy();
    expect(within(panel()).getByText(/In progress/)).toBeTruthy();

    fireEvent.click(within(panel()).getByRole('button', { name: 'Open full task' }));
    expect(onOpenTask).toHaveBeenCalledWith('s1');

    fireEvent.click(within(panel()).getByRole('button', { name: 'Close details' }));
    expect(within(panel()).getByText('How to read the map')).toBeTruthy();
  });

  it('keeps branches and selection when the board refreshes', () => {
    const { rerender } = render(<TaskMap tasks={TASKS} onOpenTask={() => {}} />);
    openToSmall();
    const refreshed = TASKS.map((task) =>
      task.id === 's1' ? { ...task, title: 'Tension curve v2' } : { ...task }
    );
    rerender(<TaskMap tasks={refreshed} onOpenTask={() => {}} />);
    expect(item(/Movement/).getAttribute('aria-expanded')).toBe('true');
    expect(item(/Tether physics/).getAttribute('aria-expanded')).toBe('true');
    expect(within(panel()).getByRole('heading', { name: 'Tension curve v2' })).toBeTruthy();
  });

  it('keeps one branch open per level', () => {
    render(<TaskMap tasks={[...TASKS, t('m9', 'e2', 'Icons')]} onOpenTask={() => {}} />);
    fireEvent.click(item(/Movement/));
    expect(item(/Tether physics/)).toBeTruthy();
    fireEvent.click(item(/Art pass/));
    expect(item(/Movement/).getAttribute('aria-expanded')).toBe('false');
    expect(item(/Art pass/).getAttribute('aria-expanded')).toBe('true');
    expect(item(/Icons/)).toBeTruthy();
  });

  it('supports arrow keys (Left/Right along a row, Down opens, Up closes)', () => {
    render(<TaskMap tasks={TASKS} onOpenTask={() => {}} />);
    const first = item(/Movement/);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement.textContent).toContain('Art pass');
    fireEvent.keyDown(document.activeElement, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(first.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement.textContent).toContain('Tether physics');
    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(first.getAttribute('aria-expanded')).toBe('false');
  });

  it('resets and handles an empty board', () => {
    const { rerender } = render(<TaskMap tasks={TASKS} onOpenTask={() => {}} />);
    fireEvent.click(item(/Movement/));
    expect(screen.getAllByRole('treeitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    expect(screen.getAllByRole('treeitem')).toHaveLength(2);
    rerender(<TaskMap tasks={[]} onOpenTask={() => {}} />);
    expect(screen.getByText('No tasks on this board yet.')).toBeTruthy();
  });
});

describe('TaskMap actions match the board', () => {
  const actions = () => ({
    onClaim: vi.fn(),
    onRequestJoin: vi.fn(),
    onSubmitForReview: vi.fn(),
    onAddEpic: vi.fn(),
    onAddChild: vi.fn(),
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onMoveToStaging: vi.fn(),
  });
  const open = [
    t('e1', null, 'Movement', { hasChildren: true, childCount: 1 }),
    t('m1', 'e1', 'Grapple', { volunteerClaimable: true }),
  ];

  it('signed out: Claim (sign-in prompt is the board handler), no staff tools', () => {
    const a = actions();
    render(<TaskMap tasks={open} onOpenTask={() => {}} actions={a} viewer={{}} />);
    fireEvent.click(item(/Movement/));
    fireEvent.click(item(/Grapple/));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Claim Task' }));
    expect(a.onClaim).toHaveBeenCalledWith('m1');
    expect(within(panel()).queryByText('Staff')).toBeNull();
    expect(screen.queryByRole('button', { name: /Add Epic/ })).toBeNull();
  });

  it('claimer: update progress and submit for review on their own claim', () => {
    const a = actions();
    const onOpenTask = vi.fn();
    render(
      <TaskMap tasks={TASKS} onOpenTask={onOpenTask} actions={a} viewer={{ userId: 'u-ada' }} />
    );
    openToSmall();
    expect(within(panel()).queryByRole('button', { name: 'Claim Task' })).toBeNull();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Update progress' }));
    expect(onOpenTask).toHaveBeenCalledWith('s1');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Submit for review' }));
    expect(a.onSubmitForReview).toHaveBeenCalledWith('s1');
  });

  it('another user: Request to Join instead of claim tools', () => {
    const a = actions();
    render(<TaskMap tasks={TASKS} onOpenTask={() => {}} actions={a} viewer={{ userId: 'u-bo' }} />);
    openToSmall();
    expect(within(panel()).queryByRole('button', { name: 'Submit for review' })).toBeNull();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Request to Join' }));
    expect(a.onRequestJoin).toHaveBeenCalledWith('s1');
  });

  it('moderator: add Epic, add sub-task, edit, duplicate, move to staging', () => {
    const a = actions();
    render(
      <TaskMap tasks={open} onOpenTask={() => {}} actions={a} viewer={{ userId: 'm', isModerator: true }} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Add Epic/ }));
    expect(a.onAddEpic).toHaveBeenCalled();

    fireEvent.click(item(/Movement/));
    const p = panel();
    fireEvent.click(within(p).getByRole('button', { name: /Add sub-task/ }));
    expect(a.onAddChild).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
    fireEvent.click(within(p).getByRole('button', { name: /Edit/ }));
    expect(a.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
    fireEvent.click(within(p).getByRole('button', { name: /Duplicate/ }));
    expect(a.onDuplicate).toHaveBeenCalledWith('e1');
    fireEvent.click(within(p).getByRole('button', { name: /Move to Staging/ }));
    expect(a.onMoveToStaging).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });
});

describe('TaskMap category highlight', () => {
  // Epic A has one Code Small two levels down; Epic B has no Code work
  const tree = [
    t('eA', null, 'Epic A', { category: 'Design' }),
    t('eB', null, 'Epic B', { category: 'Art', sortOrder: 1 }),
    t('mA1', 'eA', 'Mid with code', { category: 'Design' }),
    t('mA2', 'eA', 'Mid without code', { category: 'Art', sortOrder: 1 }),
    t('sA1', 'mA1', 'Small code', { category: 'Code' }),
    t('sA2', 'mA1', 'Small art', { category: 'Art', sortOrder: 1 }),
    t('mB1', 'eB', 'Mid B', { category: 'Art' }),
  ];
  const dim = (name) => item(name).getAttribute('data-dim') === 'true';

  it('colours the path to Code work and greys the rest, level by level', () => {
    render(<TaskMap tasks={tree} onOpenTask={() => {}} categoryFilter={['Code']} />);
    expect(dim(/Epic A/)).toBe(false);
    expect(dim(/Epic B/)).toBe(true);
    expect(item(/Epic A/).textContent).toContain('1 Code task inside');

    fireEvent.click(item(/Epic A/));
    expect(dim(/Mid with code/)).toBe(false);
    expect(dim(/Mid without code/)).toBe(true);
    // greyed cards are still clickable
    fireEvent.click(item(/Epic B/));
    expect(item(/Mid B/)).toBeTruthy();
    fireEvent.click(item(/Epic A/));

    fireEvent.click(item(/Mid with code/));
    expect(dim(/Small code/)).toBe(false);
    expect(dim(/Small art/)).toBe(true);
  });

  it('uses the shared filter chips above the map', () => {
    const onToggleCategory = vi.fn();
    render(
      <TaskMap tasks={tree} onOpenTask={() => {}} onToggleCategory={onToggleCategory} />
    );
    const chips = screen.getByRole('group', { name: 'Highlight tasks by skill' });
    fireEvent.click(within(chips).getByRole('button', { name: 'Code' }));
    expect(onToggleCategory).toHaveBeenCalledWith('Code');
    // nothing selected: everything in colour
    expect(dim(/Epic B/)).toBe(false);
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

describe('TaskMap: other board filters highlight too', () => {
  const tree = [
    t('eA', null, 'Epic A', { category: 'Design', hasChildren: true }),
    t('eB', null, 'Epic B', { category: 'Design', sortOrder: 1, hasChildren: true }),
    t('mA', 'eA', 'Mid A', { category: 'Design', hasChildren: true }),
    t('sOpen', 'mA', 'Open code', { category: 'Code' }),
    t('sTaken', 'mA', 'Taken code', {
      category: 'Code',
      sortOrder: 1,
      claimedBy: 'ada',
      claim: { status: 'Active', userId: 'u1' },
    }),
    t('mB', 'eB', 'Mid B', { category: 'Design', hasChildren: true }),
    t('sTaken2', 'mB', 'Taken code 2', {
      category: 'Code',
      claimedBy: 'bo',
      claim: { status: 'Active', userId: 'u2' },
    }),
    t('mBlocked', 'eB', 'Blocked mid', {
      category: 'Code',
      sortOrder: 1,
      isLocked: true,
      lockedWaitingOn: ['Something'],
    }),
  ];
  const dim = (name) => item(name).getAttribute('data-dim') === 'true';

  it('Code + Unclaimed only: only the path to unclaimed Code work is lit', () => {
    render(
      <TaskMap tasks={tree} onOpenTask={() => {}} categoryFilter={['Code']} unclaimedOnly />
    );
    expect(dim(/Epic A/)).toBe(false);
    expect(dim(/Epic B/)).toBe(true);
    expect(item(/Epic A/).textContent).toContain('1 unclaimed Code task inside');
    fireEvent.click(item(/Epic A/));
    fireEvent.click(item(/Mid A/));
    expect(dim(/Open code/)).toBe(false);
    expect(dim(/Taken code/)).toBe(true);
    // no "applies to the Board only" note any more
    expect(screen.queryByText(/Board view only/)).toBeNull();
  });

  it('Hide Blocked Tasks: blocked cards stay on the map, greyed', () => {
    render(<TaskMap tasks={tree} onOpenTask={() => {}} hideBlocked />);
    fireEvent.click(item(/Epic B/));
    expect(dim(/Blocked mid/)).toBe(true);
    expect(dim(/Mid B/)).toBe(false);
  });

  it('fades fully finished branches', () => {
    const done = { status: 'completed', dbStatus: 'Completed' };
    render(
      <TaskMap
        tasks={[
          t('e1', null, 'Busy epic', { hasChildren: true }),
          t('m1', 'e1', 'Left to do'),
          t('e2', null, 'Wrapped up', { sortOrder: 1, hasChildren: true }),
          t('m2', 'e2', 'Shipped', done),
        ]}
        onOpenTask={() => {}}
      />
    );
    expect(item(/Wrapped up/).getAttribute('data-finished')).toBe('true');
    expect(item(/Busy epic/).getAttribute('data-finished')).toBeNull();
  });
});

describe('TaskMap: focus mode and breadcrumb', () => {
  const levels = () => screen.getByRole('navigation', { name: 'Map levels' });

  it('shows the open path as a breadcrumb; crumbs, Back and Esc go up', () => {
    render(<TaskMap tasks={TASKS} onOpenTask={() => {}} />);
    const crumbNames = () =>
      within(levels()).getAllByRole('button').map((b) => b.getAttribute('title')).filter((t) => t && t !== 'Fit to view');
    expect(crumbNames()).toEqual(['All Epics']);

    openToSmall();
    expect(crumbNames()).toEqual(['All Epics', 'Movement', 'Tether physics']);

    // phones fold the middle levels into "…"; tapping it lists them
    fireEvent.click(within(levels()).getByRole('button', { name: 'Show all levels' }));
    const all = within(levels()).getByRole('list', { name: 'All levels' });
    expect(within(all).getAllByRole('button').map((b) => b.textContent)).toEqual(['All Epics', 'Movement']);
    fireEvent.click(within(all).getByRole('button', { name: 'Movement' }));
    expect(item(/Tether physics/).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'All levels' })).toBeNull();
    fireEvent.click(item(/Tether physics/));
    expect(within(levels()).getByRole('button', { name: 'Tether physics' }).getAttribute('aria-current')).toBe('location');

    // Back: up one level (closes Tether physics)
    fireEvent.click(within(levels()).getByRole('button', { name: 'Back one level' }));
    expect(item(/Tether physics/).getAttribute('aria-expanded')).toBe('false');
    expect(item(/Movement/).getAttribute('aria-expanded')).toBe('true');

    // Esc on the canvas: up again, to All Epics
    fireEvent.keyDown(item(/Movement/), { key: 'Escape' });
    expect(item(/Movement/).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Back one level' })).toBeNull();

    // A crumb closes everything deeper
    openToSmall();
    fireEvent.click(within(levels()).getByRole('button', { name: 'All Epics' }));
    expect(screen.getAllByRole('treeitem')).toHaveLength(2);
  });
});

describe('TaskMap: phone filter bar', () => {
  it('opens a filter sheet and shows active filters as removable chips', () => {
    const onToggleCategory = vi.fn();
    const onToggleUnclaimed = vi.fn();
    render(
      <TaskMap
        tasks={TASKS}
        onOpenTask={() => {}}
        categoryFilter={['Code']}
        unclaimedOnly
        onToggleCategory={onToggleCategory}
        onToggleUnclaimed={onToggleUnclaimed}
        onToggleHideBlocked={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Code filter' }));
    expect(onToggleCategory).toHaveBeenCalledWith('Code');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Unclaimed filter' }));
    expect(onToggleUnclaimed).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Filters (2)' }));
    const sheet = screen.getByRole('dialog', { name: 'Map filters' });
    expect(within(sheet).getByRole('group', { name: 'Highlight tasks by skill' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Unclaimed only' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(sheet).getByRole('list', { name: 'Legend' })).toBeTruthy();
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Map filters' })).toBeNull();
  });
});

describe('TaskMap: filter hint', () => {
  beforeAll(() => {
    // Give the canvas a size so the camera and hint can work out what is on screen
    Object.defineProperties(HTMLElement.prototype, {
      clientWidth: { configurable: true, get() { return this.dataset?.testid === 'task-map-viewport' ? 900 : 0; } },
      clientHeight: { configurable: true, get() { return this.dataset?.testid === 'task-map-viewport' ? 600 : 0; } },
    });
  });
  afterAll(() => {
    delete HTMLElement.prototype.clientWidth;
    delete HTMLElement.prototype.clientHeight;
  });

  it('says how many coloured Epics are out of view, and goes back to them', () => {
    const many = [t('e0', null, 'Open me', { category: 'Code', hasChildren: true })];
    for (let i = 0; i < 6; i++) many.push(t(`k${i}`, 'e0', `Kid ${i}`, { category: 'Code', sortOrder: i }));
    for (let i = 1; i <= 12; i++) many.push(t(`e${i}`, null, `Epic ${i}`, { category: i % 4 === 0 ? 'Code' : 'Art', sortOrder: i }));
    render(<TaskMap tasks={many} onOpenTask={() => {}} categoryFilter={['Code']} />);
    fireEvent.click(item(/Open me/));
    const hint = screen.getByRole('button', { name: /other Epics? ha(s|ve) Code work/ });
    fireEvent.click(hint);
    expect(item(/Open me/).getAttribute('aria-expanded')).toBe('false');
  });
});
