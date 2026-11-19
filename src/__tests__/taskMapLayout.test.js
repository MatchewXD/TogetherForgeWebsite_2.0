import { describe, it, expect } from 'vitest';
import {
  MAP_BAND_GAP,
  MAP_CARD_GAP,
  MAP_CARD_WIDTH,
  MAP_NODE_HEIGHT,
  MAP_PADDING,
  MAP_PAGE_SIZE,
  MAP_PER_ROW,
  MAP_ROW_GAP,
  buildTaskTree,
  isMapBranchFinished,
  layoutTaskMap,
  mapAncestorIds,
  mapEdgePath,
  mapEdgePoints,
  mapFilterHighlight,
  mapNodeProgress,
  mapNodeSummary,
  mapPerRow,
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

function crossings(nodes, edges) {
  const bad = [];
  for (const e of edges) {
    for (let i = 1; i < e.points.length; i++) {
      const [px, py] = e.points[i - 1];
      const [qx, qy] = e.points[i];
      for (const n of nodes) {
        if (
          Math.max(px, qx) > n.x + 0.5 &&
          Math.min(px, qx) < n.x + n.w - 0.5 &&
          Math.max(py, qy) > n.y + 0.5 &&
          Math.min(py, qy) < n.y + n.h - 0.5
        ) {
          bad.push(`${e.key} crosses ${n.key}`);
        }
      }
    }
  }
  return bad;
}

function overlaps(nodes) {
  const bad = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const xs = a.x < b.x + b.w && b.x < a.x + a.w;
      const ys = a.y < b.y + b.h && b.y < a.y + a.h;
      if (xs && ys) bad.push(`${a.key}/${b.key}`);
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

const centreX = (n) => n.x + n.w / 2;

describe('layoutTaskMap (top-down, wrapping rows)', () => {
  it('puts the Epics in a row across the top when nothing is open', () => {
    const { roots } = buildTaskTree(sample());
    const { nodes, edges } = layoutTaskMap(roots);
    expect(nodes.map((n) => n.id)).toEqual(['e1', 'e2', 'orphan']);
    expect(edges).toEqual([]);
    expect(nodes.every((n) => n.depth === 0 && n.h === MAP_NODE_HEIGHT.epic)).toBe(true);
    expect(new Set(nodes.map((n) => n.y)).size).toBe(1);
    expect(nodes[0].y).toBe(MAP_PADDING);
    expect(nodes[1].x - nodes[0].x).toBe(MAP_CARD_WIDTH + MAP_CARD_GAP);
    expect(nodes[0]).toMatchObject({ posInSet: 1, setSize: 3, hasChildren: true, expanded: false });
  });

  it('drops each open branch into a band below its parent, centred under it', () => {
    const { roots } = buildTaskTree(sample());
    const { nodes, bands } = layoutTaskMap(roots, {
      expanded: ['e1', 'm1'],
      showCompleted: true,
    });
    expect(nodes.map((n) => n.key)).toEqual([
      't:e1', 't:e2', 't:orphan',
      't:m1', 't:m2', 'done:e1',
      't:s2', 'done:m1',
    ]);
    const by = Object.fromEntries(nodes.map((n) => [n.key, n]));
    expect(by['t:e1'].expanded).toBe(true);
    expect(by['t:m1'].expanded).toBe(true);
    // each band sits right under its parent's row, with a clear gap between
    expect(bands.map((b) => b.depth)).toEqual([0, 1, 2]);
    expect(bands[1].top - bands[0].rows[0].bottom).toBe(MAP_BAND_GAP);
    expect(bands[2].top - bands[1].rows[0].bottom).toBe(MAP_BAND_GAP);
    expect(bands[1].parentKey).toBe('t:e1');
    expect(by['t:m1'].y).toBeGreaterThan(by['t:e1'].y + by['t:e1'].h);
    // centred under the parent, unless that would leave the canvas
    const bandW = 2 * MAP_CARD_WIDTH + MAP_CARD_GAP;
    expect(by['t:s2'].x).toBe(
      Math.max(MAP_PADDING, centreX(by['t:m1']) - bandW / 2)
    );
    // e2 is far enough right for its band to centre exactly
    const right = layoutTaskMap(roots, { expanded: ['e2', 'x'] });
    expect(right.nodes.filter((n) => n.depth === 1)).toEqual([]);
    const wide = layoutTaskMap(buildTaskTree([
      t('a'), t('b', null, { sortOrder: 1 }), t('c', null, { sortOrder: 2 }),
      t('c1', 'c'), t('c2', 'c', { sortOrder: 1 }),
    ]).roots, { expanded: ['c'] });
    const wb = Object.fromEntries(wide.nodes.map((n) => [n.key, n]));
    expect((wb['t:c1'].x + wb['t:c2'].x + MAP_CARD_WIDTH) / 2).toBeCloseTo(centreX(wb['t:c']), 5);
    expect(overlaps(nodes)).toEqual([]);
  });

  it('opens a first-row Epic right under its own row; later rows move down, then back', () => {
    const tasks = [];
    for (let e = 0; e < 9; e++) tasks.push(t(`e${e}`, null, { sortOrder: e }));
    for (let i = 0; i < 3; i++) tasks.push(t(`k${i}`, 'e1', { sortOrder: i }));
    const { roots } = buildTaskTree(tasks);
    const closed = layoutTaskMap(roots, { perRow: 4 });
    const open = layoutTaskMap(roots, { perRow: 4, expanded: ['e1'] });
    const at = (layout, key) => layout.nodes.find((n) => n.key === key);

    // children sit between Epic row 1 and Epic row 2
    const kids = open.nodes.filter((n) => n.depth === 1);
    const row1Bottom = at(open, 't:e1').rowBottom;
    expect(kids.every((k) => k.y === row1Bottom + MAP_BAND_GAP)).toBe(true);
    expect(at(open, 't:e4').y).toBeGreaterThan(Math.max(...kids.map((k) => k.y + k.h)));
    // the first row stays put; later rows shift down by exactly the band
    expect(at(open, 't:e0').y).toBe(at(closed, 't:e0').y);
    const shift = at(open, 't:e4').y - at(closed, 't:e4').y;
    expect(shift).toBe(2 * MAP_BAND_GAP + MAP_NODE_HEIGHT.task - MAP_ROW_GAP);
    expect(at(open, 't:e8').y - at(closed, 't:e8').y).toBe(shift);
    // and the connector is short: straight down into the gap under row 1
    for (const e of open.edges) {
      expect(e.points.every(([, y]) => y <= at(open, 't:e4').y)).toBe(true);
    }
    // closing puts everything back
    expect(layoutTaskMap(roots, { perRow: 4, expanded: [] }).nodes.map((n) => [n.key, n.x, n.y]))
      .toEqual(closed.nodes.map((n) => [n.key, n.x, n.y]));
  });

  it('opens a Medium in the middle of a wrapped band right under its row, at every level', () => {
    const tasks = [t('e')];
    for (let i = 0; i < 9; i++) tasks.push(t(`m${i}`, 'e', { sortOrder: i }));
    for (let i = 0; i < 5; i++) tasks.push(t(`s${i}`, 'm4', { sortOrder: i }));
    const { roots } = buildTaskTree(tasks);
    // m4 is in row 1 of the Medium band (perRow 3: m0-2 | m3-5 | m6-8)
    const { nodes, edges, bands } = layoutTaskMap(roots, { perRow: 3, expanded: ['e', 'm4'] });
    const by = Object.fromEntries(nodes.map((n) => [n.key, n]));
    const smalls = nodes.filter((n) => n.depth === 2);
    expect(Math.min(...smalls.map((s) => s.y))).toBe(by['t:m4'].rowBottom + MAP_BAND_GAP);
    // the Medium row after it moved below the Smalls
    expect(by['t:m6'].y).toBe(bands[2].bottom + MAP_BAND_GAP);
    expect(by['t:m6'].y).toBeGreaterThan(Math.max(...smalls.map((s) => s.y + s.h)));
    expect(overlaps(nodes)).toEqual([]);
    // lines from the Epic to m6-m8 must get past the inserted Smalls
    expect(crossings(nodes, edges)).toEqual([]);
  });

  it('wraps a crowded band onto extra rows instead of growing wider', () => {
    const tasks = [t('e')];
    for (let i = 0; i < 10; i++) tasks.push(t(`c${i}`, 'e', { sortOrder: i }));
    const { roots } = buildTaskTree(tasks);
    const { nodes, bands, width } = layoutTaskMap(roots, { expanded: ['e'], perRow: 4 });
    const kids = nodes.filter((n) => n.depth === 1);
    expect(kids).toHaveLength(10);
    expect(bands[1].rows).toHaveLength(3); // 4 + 4 + 2
    expect(kids.map((k) => k.row)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2]);
    // every row on one column grid, so the gutters line up
    for (const k of kids) {
      expect((k.x - kids[0].x) % (MAP_CARD_WIDTH + MAP_CARD_GAP)).toBe(0);
    }
    expect(new Set(kids.slice(0, 4).map((k) => k.y)).size).toBe(1);
    expect(kids[4].y - kids[0].y).toBe(MAP_NODE_HEIGHT.task + MAP_ROW_GAP);
    // never wider than perRow cards
    expect(width).toBeLessThanOrEqual(
      2 * MAP_PADDING + 4 * MAP_CARD_WIDTH + 3 * MAP_CARD_GAP
    );
    // the short last row is centred under the full rows
    const fullCentre = (kids[0].x + kids[3].x + kids[3].w) / 2;
    const lastCentre = (kids[8].x + kids[9].x + kids[9].w) / 2;
    expect(lastCentre).toBeCloseTo(fullCentre, 5);
    expect(overlaps(nodes)).toEqual([]);
  });

  it('wraps the Epic row too', () => {
    const tasks = [];
    for (let i = 0; i < 7; i++) tasks.push(t(`e${i}`, null, { sortOrder: i }));
    const { roots } = buildTaskTree(tasks);
    const { nodes, bands } = layoutTaskMap(roots, { perRow: 2 });
    expect(bands[0].rows).toHaveLength(4);
    expect(nodes.map((n) => n.row)).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect(nodes.at(-1).posInSet).toBe(7);
  });

  it('runs every connector top to bottom, through gaps, never across a card', () => {
    const tasks = [];
    for (let e = 0; e < 5; e++) tasks.push(t(`e${e}`, null, { sortOrder: e }));
    for (let i = 0; i < 7; i++) tasks.push(t(`m${i}`, 'e1', { sortOrder: i }));
    for (let i = 0; i < 5; i++) tasks.push(t(`s${i}`, 'm5', { sortOrder: i }));
    const { roots } = buildTaskTree(tasks);
    // e1 sits in the first Epic row (with a second row below it), m5 in a
    // wrapped row of its band: both the exit and the entry need the gutters
    const { nodes, edges } = layoutTaskMap(roots, { expanded: ['e1', 'm5'], perRow: 3 });
    const by = Object.fromEntries(nodes.map((n) => [n.key, n]));
    expect(edges).toHaveLength(7 + 5);
    for (const e of edges) {
      const a = by[e.fromKey];
      const b = by[e.toKey];
      // leaves the parent's bottom edge, meets the child's top edge
      expect(e.x1).toBe(centreX(a));
      expect(e.y1).toBe(a.y + a.h);
      expect(e.x2).toBe(centreX(b));
      expect(e.y2).toBe(b.y);
      expect(e.points[0]).toEqual([e.x1, e.y1]);
      expect(e.points.at(-1)).toEqual([e.x2, e.y2]);
      // first step goes down, last step comes down into the child
      expect(e.points[1][1]).toBeGreaterThan(e.y1);
      expect(e.points.at(-2)[1]).toBeLessThan(e.y2);
      // only straight horizontal / vertical runs
      for (let i = 1; i < e.points.length; i++) {
        const [px, py] = e.points[i - 1];
        const [qx, qy] = e.points[i];
        expect(px === qx || py === qy).toBe(true);
        // and no run passes through any card
        for (const n of nodes) {
          const hit =
            Math.max(px, qx) > n.x + 0.5 &&
            Math.min(px, qx) < n.x + n.w - 0.5 &&
            Math.max(py, qy) > n.y + 0.5 &&
            Math.min(py, qy) < n.y + n.h - 0.5;
          expect(hit, `${e.key} crosses ${n.key}`).toBe(false);
        }
      }
    }
  });

  it('draws the route as one path with rounded corners', () => {
    const d = mapEdgePath([[0, 0], [0, 40], [100, 40], [100, 80]]);
    expect(d.startsWith('M 0 0 L 0 28 Q 0 40 12 40')).toBe(true);
    expect(d.endsWith('L 100 80')).toBe(true);
    // straight drop when parent and child line up
    expect(mapEdgePoints(50, 100, 50, 200, { busDy: 44 })).toEqual([[50, 100], [50, 200]]);
  });

  it('never overlaps across many random trees', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let round = 0; round < 60; round++) {
      const tasks = [];
      const epics = 1 + Math.floor(rnd() * 9);
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
        perRow: 2 + Math.floor(rnd() * 5),
      };
      const { nodes, edges, width, height } = layoutTaskMap(roots, view);
      expect(overlaps(nodes), `round ${round}`).toEqual([]);
      expect(crossings(nodes, edges), `round ${round}`).toEqual([]);
      // every open band starts right under its parent's row
      for (const p of nodes.filter((n) => n.expanded)) {
        const kids = nodes.filter((n) => n.parentId === p.id && n.depth === p.depth + 1);
        expect(Math.min(...kids.map((k) => k.rowTop))).toBe(p.rowBottom + MAP_BAND_GAP);
      }
      expect(new Set(nodes.map((n) => n.key)).size).toBe(nodes.length);
      for (const n of nodes) {
        expect(n.x).toBeGreaterThanOrEqual(MAP_PADDING);
        expect(n.x + n.w).toBeLessThanOrEqual(width);
        expect(n.y + n.h).toBeLessThanOrEqual(height);
      }
      expect(edges.every((e) => e.points.every((p) => p.every(Number.isFinite)))).toBe(true);
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

  it('ignores an open id that is not in the open branch', () => {
    const { roots } = buildTaskTree(sample());
    const { nodes } = layoutTaskMap(roots, { expanded: ['e1', 's3'] });
    expect(nodes.filter((n) => n.depth === 2)).toEqual([]);
  });

  it('handles an empty board', () => {
    const { nodes, edges, width, height } = layoutTaskMap([]);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});

describe('mapPerRow', () => {
  it('fits 4 to 6 cards on desktop canvases and 2 on a phone', () => {
    expect(mapPerRow(358, { cardWidth: 200, cardGap: 24 })).toBe(2);
    expect(mapPerRow(830)).toBe(4);
    expect(mapPerRow(1050)).toBe(5);
    expect(mapPerRow(1600)).toBe(6);
    expect(mapPerRow(0)).toBe(MAP_PER_ROW);
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

describe('card summaries', () => {
  it('summarises everything under a card and spots finished branches', () => {
    const { byId } = buildTaskTree([
      t('e'),
      t('m', 'e'),
      t('s1', 'm', done),
      t('s2', 'm', { claim: { status: 'Active' } }),
      t('s3', 'm', { isLocked: true }),
      t('s4', 'm'),
      t('f', null, { sortOrder: 1 }),
      t('f1', 'f', done),
    ]);
    expect(mapNodeSummary(byId.get('e'))).toBe('4 tasks · 1 open · 25% done');
    expect(mapNodeSummary(byId.get('s4'))).toBe('');
    expect(isMapBranchFinished(byId.get('e'))).toBe(false);
    expect(isMapBranchFinished(byId.get('f'))).toBe(true);
    expect(isMapBranchFinished(byId.get('s1'))).toBe(true);
  });
});

describe('mapFilterHighlight', () => {
  const matchCode = (task) => task.category === 'Code';
  // e1 > m1 > s1 (Code); e1 > m2 (Art) > s2 (Art); e2 (Code) alone;
  // e3 > m3 > s3 (Code, finished)
  const tree = () =>
    buildTaskTree([
      t('e1', null, { category: 'Design' }),
      t('m1', 'e1', { category: 'Design' }),
      t('s1', 'm1', { category: 'Code' }),
      t('m2', 'e1', { category: 'Art', sortOrder: 1 }),
      t('s2', 'm2', { category: 'Art' }),
      t('e2', null, { category: 'Code', sortOrder: 1 }),
      t('e3', null, { category: 'Art', sortOrder: 2 }),
      t('m3', 'e3', { category: 'Art' }),
      t('s3', 'm3', { category: 'Code', ...done }),
    ]).roots;

  it('is off (null) with no filter on', () => {
    expect(mapFilterHighlight(tree(), {})).toBeNull();
  });

  it('lights a task when it or any descendant at any depth matches', () => {
    const h = mapFilterHighlight(tree(), { matches: matchCode });
    // the Epic is lit by a Small two levels down
    expect(h.get('e1')).toEqual({ lit: true, self: false, inside: 1 });
    // only the Medium that leads to Code work is lit
    expect(h.get('m1')).toEqual({ lit: true, self: false, inside: 1 });
    expect(h.get('m2')).toEqual({ lit: false, self: false, inside: 0 });
    // the matching Small itself
    expect(h.get('s1')).toEqual({ lit: true, self: true, inside: 0 });
    expect(h.get('s2').lit).toBe(false);
    // a matching task with no children is lit by itself
    expect(h.get('e2')).toEqual({ lit: true, self: true, inside: 0 });
  });

  it('counts finished matches only while completed tasks are shown', () => {
    const hidden = mapFilterHighlight(tree(), { matches: matchCode });
    expect(hidden.get('e3').lit).toBe(false);
    expect(hidden.get('s3').lit).toBe(false);
    const shown = mapFilterHighlight(tree(), { matches: matchCode }, { showCompleted: true });
    expect(shown.get('e3')).toEqual({ lit: true, self: false, inside: 1 });
    expect(shown.get('m3').lit).toBe(true);
  });

  it('counts every matching descendant for the "N inside" label', () => {
    const { roots } = buildTaskTree([
      t('e1'),
      t('m1', 'e1', { category: 'Code' }),
      t('s1', 'm1', { category: 'Code' }),
      t('s2', 'm1', { category: 'Code', sortOrder: 1 }),
    ]);
    const h = mapFilterHighlight(roots, { matches: matchCode });
    expect(h.get('e1').inside).toBe(3);
    expect(h.get('m1')).toEqual({ lit: true, self: true, inside: 2 });
  });

  it('greys blocked tasks instead of hiding them', () => {
    const { roots } = buildTaskTree([
      t('e1'),
      t('m1', 'e1', { isLocked: true }),
      t('m2', 'e1', { sortOrder: 1 }),
    ]);
    const h = mapFilterHighlight(roots, { blocked: (task) => Boolean(task.isLocked) });
    expect(h.get('m1').lit).toBe(false);
    expect(h.get('m2').lit).toBe(true);
    expect(h.get('e1').lit).toBe(true);
  });
});
