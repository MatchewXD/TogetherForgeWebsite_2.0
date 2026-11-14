import { describe, it, expect } from 'vitest';
import {
  MAP_NODE_HEIGHT,
  MAP_PAGE_SIZE,
  MAP_ROW_GAP,
  buildTaskTree,
  layoutTaskMap,
  mapAncestorIds,
  mapEdgePath,
  mapNodeProgress,
  mapTaskState,
  toggleExpanded,
  visibleChildren,
} from '../utils/taskMapLayout';

const t = (id, parentTaskId = null, extra = {}) => ({
  id,
  parentTaskId,
  title: `Task ${id}`,
  status: 'todo',
  sortOrder: 0,
  createdAt: `2026-01-01T00:00:${String(id).padStart(2, '0')}Z`,
  boardScope: 'public',
  ...extra,
});
const done = { status: 'completed', dbStatus: 'Completed' };

function sample() {
  return [
    t('e1'),
    t('e2', null, { sortOrder: 1 }),
    t('m1', 'e1'),
    t('m2', 'e1', { sortOrder: 1 }),
    t('m3', 'e1', { sortOrder: 2, ...done }),
    t('s1', 'm1', done),
    t('s2', 'm1', { sortOrder: 1 }),
    t('s3', 'm2'),
    t('x1', null, { boardScope: 'staging' }),
    t('x2', null, { archivedAt: '2026-02-01' }),
    t('orphan', 'missing-parent', { sortOrder: 5 }),
  ];
}

function overlaps(nodes) {
  const bad = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.x !== b.x) continue;
      if (a.y < b.y + b.h && b.y < a.y + a.h) bad.push(`${a.key}/${b.key}`);
    }
  }
  return bad;
}

describe('buildTaskTree', () => {
  it('builds the hierarchy, skipping staging and archived tasks', () => {
    const { roots, byId } = buildTaskTree(sample());
    expect(roots.map((r) => r.id)).toEqual(['e1', 'e2', 'orphan']);
    expect(byId.has('x1')).toBe(false);
    expect(byId.has('x2')).toBe(false);
    expect(byId.get('e1').children.map((c) => c.id)).toEqual(['m1', 'm2', 'm3']);
    expect(byId.get('s2').depth).toBe(2);
  });

  it('counts finished leaf tasks for progress', () => {
    const { byId } = buildTaskTree(sample());
    // leaves under e1: s1 (done), s2, s3, m3 (done)
    expect(byId.get('e1').leafTotal).toBe(4);
    expect(byId.get('e1').leafDone).toBe(2);
    expect(mapNodeProgress(byId.get('e1'))).toBe(50);
    expect(mapNodeProgress(byId.get('e2'))).toBe(0);
    expect(mapNodeProgress(byId.get('m3'))).toBe(100);
  });

  it('survives a parent cycle in bad data', () => {
    const { byId } = buildTaskTree([t('a', 'b'), t('b', 'a'), t('c')]);
    expect(byId.size).toBe(3);
  });

  it('lists ancestors nearest first', () => {
    const { byId } = buildTaskTree(sample());
    expect(mapAncestorIds(byId, 's2')).toEqual(['m1', 'e1']);
    expect(mapAncestorIds(byId, 'e1')).toEqual([]);
  });
});

describe('mapTaskState', () => {
  it('classifies tasks', () => {
    expect(mapTaskState(t('a', null, done))).toBe('done');
    expect(mapTaskState(t('a', null, { claim: { status: 'PendingReview' } }))).toBe('review');
    expect(mapTaskState(t('a', null, { status: 'in_progress' }))).toBe('active');
    expect(mapTaskState(t('a', null, { isLocked: true }))).toBe('locked');
    expect(mapTaskState(t('a', null, { isLocked: true, dependencyOverride: true }))).toBe('open');
    expect(mapTaskState(t('a'))).toBe('open');
  });
});

describe('visibleChildren', () => {
  it('hides finished tasks by default', () => {
    const { byId } = buildTaskTree(sample());
    const kids = visibleChildren(byId.get('e1'));
    expect(kids.map((k) => k.node?.id || `${k.kind}:${k.count}`)).toEqual(['m1', 'm2']);
  });

  it('with Show completed: open work first, finished folded into one node', () => {
    const { byId } = buildTaskTree(sample());
    const kids = visibleChildren(byId.get('e1'), { showCompleted: true });
    expect(kids.map((k) => k.node?.id || `${k.kind}:${k.count}`)).toEqual([
      'm1',
      'm2',
      'done:1',
    ]);
    const shown = visibleChildren(byId.get('e1'), {
      showCompleted: true,
      showDone: { e1: true },
    });
    expect(shown.map((k) => k.node?.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('pages very large families', () => {
    const many = [t('e')];
    for (let i = 0; i < 30; i++) many.push(t(`c${i}`, 'e', { sortOrder: i }));
    const { byId } = buildTaskTree(many);
    const first = visibleChildren(byId.get('e'));
    expect(first.length).toBe(MAP_PAGE_SIZE + 1);
    expect(first.at(-1)).toMatchObject({ kind: 'more', count: 30 - MAP_PAGE_SIZE });
    const more = visibleChildren(byId.get('e'), { revealed: { e: 30 } });
    expect(more.length).toBe(30);
    expect(more.some((k) => k.kind === 'more')).toBe(false);
  });
});

describe('layoutTaskMap', () => {
  it('shows only Epics when nothing is open', () => {
    const { roots } = buildTaskTree(sample());
    const { nodes, edges } = layoutTaskMap(roots);
    expect(nodes.map((n) => n.id)).toEqual(['e1', 'e2', 'orphan']);
    expect(edges).toEqual([]);
    expect(nodes.every((n) => n.depth === 0 && n.h === MAP_NODE_HEIGHT.epic)).toBe(true);
    expect(nodes[1].y - nodes[0].y).toBe(MAP_NODE_HEIGHT.epic + MAP_ROW_GAP);
    expect(nodes[0]).toMatchObject({ posInSet: 1, setSize: 3, hasChildren: true, expanded: false });
  });

  it('branches out the open Epic and the open child, with edges', () => {
    const { roots } = buildTaskTree(sample());
    const { nodes, edges, width, height } = layoutTaskMap(roots, {
      expanded: ['e1', 'm1'],
      showCompleted: true,
    });
    const keys = nodes.map((n) => n.key);
    expect(keys).toEqual([
      't:e1', 't:m1', 't:s2', 'done:m1', 't:m2', 'done:e1', 't:e2', 't:orphan',
    ]);
    expect(edges.map((e) => e.key)).toEqual([
      't:m1>t:s2', 't:m1>done:m1', 't:e1>t:m1', 't:e1>t:m2', 't:e1>done:e1',
    ]);
    const by = Object.fromEntries(nodes.map((n) => [n.key, n]));
    expect(by['t:m1'].x).toBeGreaterThan(by['t:e1'].x);
    expect(by['t:s2'].x).toBeGreaterThan(by['t:m1'].x);
    // every edge leaves the parent's right edge and meets the child's left edge
    for (const e of edges) {
      const a = by[e.fromKey];
      const b = by[e.toKey];
      expect(e.x1).toBe(a.x + a.w);
      expect(e.x2).toBe(b.x);
      expect(e.y1).toBe(a.y + a.h / 2);
      expect(e.y2).toBe(b.y + b.h / 2);
    }
    expect(overlaps(nodes)).toEqual([]);
    for (const n of nodes) {
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(width);
      expect(n.y + n.h).toBeLessThanOrEqual(height);
    }
  });

  it('centres a parent on its children and never overlaps neighbours', () => {
    const { roots } = buildTaskTree(sample());
    const { nodes } = layoutTaskMap(roots, { expanded: ['e1'], showCompleted: true });
    const by = Object.fromEntries(nodes.map((n) => [n.key, n]));
    const first = by['t:m1'];
    const last = by['done:e1'];
    const centre = (first.y + first.h / 2 + last.y + last.h / 2) / 2;
    expect(by['t:e1'].y + by['t:e1'].h / 2).toBeCloseTo(centre, 5);
    expect(overlaps(nodes)).toEqual([]);
  });

  it('keeps a tall parent with one short child clear of its neighbours', () => {
    const { roots } = buildTaskTree([
      t('a'),
      t('b', null, { sortOrder: 1 }),
      t('c', null, { sortOrder: 2 }),
      t('b1', 'b', done),
    ]);
    const { nodes } = layoutTaskMap(roots, { expanded: ['b'], showCompleted: true });
    expect(nodes.map((n) => n.key)).toEqual(['t:a', 't:b', 'done:b', 't:c']);
    expect(overlaps(nodes)).toEqual([]);
    expect(nodes.every((n) => n.y >= 0)).toBe(true);
  });

  it('never overlaps across many random trees', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let round = 0; round < 60; round++) {
      const tasks = [];
      const epics = 1 + Math.floor(rnd() * 6);
      for (let e = 0; e < epics; e++) {
        tasks.push(t(`e${e}`, null, { sortOrder: e }));
        const mids = Math.floor(rnd() * 16);
        for (let m = 0; m < mids; m++) {
          tasks.push(t(`e${e}m${m}`, `e${e}`, { sortOrder: m, ...(rnd() < 0.3 ? done : {}) }));
          const smalls = Math.floor(rnd() * 5);
          for (let s = 0; s < smalls; s++) {
            tasks.push(t(`e${e}m${m}s${s}`, `e${e}m${m}`, { sortOrder: s, ...(rnd() < 0.4 ? done : {}) }));
          }
        }
      }
      const { roots, byId } = buildTaskTree(tasks);
      const epic = roots[Math.floor(rnd() * roots.length)];
      const mid = epic.children[Math.floor(rnd() * epic.children.length)];
      const view = {
        expanded: [epic.id, mid?.id].filter(Boolean),
        showDone: rnd() < 0.5 ? { [epic.id]: true } : {},
        showCompleted: rnd() < 0.7,
      };
      const { nodes, edges } = layoutTaskMap(roots, view);
      expect(overlaps(nodes), `round ${round}`).toEqual([]);
      expect(nodes.every((n) => n.y >= 0 && Number.isFinite(n.y))).toBe(true);
      expect(new Set(nodes.map((n) => n.key)).size).toBe(nodes.length);
      expect(edges.every((e) => Number.isFinite(e.y1) && Number.isFinite(e.y2))).toBe(true);
      expect(byId.size).toBe(tasks.length);
    }
  });

  it('hides finished Epics by default and lists them last when shown', () => {
    const { roots } = buildTaskTree([
      t('old', null, { sortOrder: 0, ...done }),
      t('next', null, { sortOrder: 1 }),
      t('later', null, { sortOrder: 2 }),
    ]);
    expect(layoutTaskMap(roots).nodes.map((n) => n.id)).toEqual(['next', 'later']);
    const shown = layoutTaskMap(roots, { showCompleted: true }).nodes;
    expect(shown.map((n) => n.id)).toEqual(['next', 'later', 'old']);
    expect(shown[2]).toMatchObject({ posInSet: 3, setSize: 3 });
  });

  it('treats a task whose sub-tasks are all finished as a leaf while hidden', () => {
    const { roots } = buildTaskTree([t('e'), t('e1', 'e', done), t('e2', 'e', done)]);
    const hidden = layoutTaskMap(roots, { expanded: ['e'] });
    expect(hidden.nodes.map((n) => n.key)).toEqual(['t:e']);
    expect(hidden.nodes[0]).toMatchObject({ hasChildren: false, expanded: false });
    expect(hidden.edges).toEqual([]);
    const shown = layoutTaskMap(roots, { expanded: ['e'], showCompleted: true });
    expect(shown.nodes.map((n) => n.key)).toEqual(['t:e', 'done:e']);
  });

  it('handles an empty board', () => {
    const { nodes, edges, width, height } = layoutTaskMap([]);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});

describe('toggleExpanded', () => {
  it('opens one branch per level and closes deeper levels', () => {
    expect(toggleExpanded([], { id: 'e1', depth: 0 })).toEqual(['e1']);
    expect(toggleExpanded(['e1'], { id: 'm1', depth: 1 })).toEqual(['e1', 'm1']);
    expect(toggleExpanded(['e1', 'm1'], { id: 'm2', depth: 1 })).toEqual(['e1', 'm2']);
    expect(toggleExpanded(['e1', 'm1'], { id: 'e2', depth: 0 })).toEqual(['e2']);
    expect(toggleExpanded(['e1', 'm1'], { id: 'e1', depth: 0 })).toEqual([]);
    expect(toggleExpanded(['e1', 'm1'], { id: 'm1', depth: 1 })).toEqual(['e1']);
  });
});

describe('mapEdgePath', () => {
  it('draws a cubic curve between the two points', () => {
    expect(mapEdgePath({ x1: 0, y1: 10, x2: 100, y2: 50 })).toBe(
      'M 0 10 C 50 10, 50 50, 100 50'
    );
  });
});
