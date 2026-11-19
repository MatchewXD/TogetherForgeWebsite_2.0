/**
 * Task Map: tree building + top-down layout (pure, no React).
 *
 * Epics sit in a row across the top. Opening a card drops its children into
 * a band below it, centred under the parent; opening one of those drops the
 * next band, and so on (one open branch per level). Any band with more cards
 * than fit across wraps onto extra rows instead of growing wider.
 *
 * Connector lines leave a parent's bottom edge, run along the clear gap above
 * the child band (the "bus"), and drop into each child's top. Lines to a
 * wrapped row travel down the gutter beside the card column, so they never
 * cross a card.
 *
 * Finished tasks are hidden unless the viewer turns on "Show completed"; then
 * open work still comes first and finished tasks collapse into one
 * "N completed" node. Very large families page in with a "+N more" node.
 */

/** Card width on desktop; phones pass a narrower one (view.cardWidth). */
export const MAP_CARD_WIDTH = 232;
/** Space between cards in a row; wrapped-row lines run down this gutter. */
export const MAP_CARD_GAP = 32;
/** Space between wrapped rows of one band; lines turn here. */
export const MAP_ROW_GAP = 36;
/** Clear space between a parent's band and its children's band. */
export const MAP_BAND_GAP = 88;
export const MAP_PADDING = 24;
// Cards hold: level + category + state, a two-line title, and a summary line
export const MAP_NODE_HEIGHT = { task: 112, epic: 124, more: 48, done: 48 };
/** Cards per row when the caller does not say (see mapPerRow). */
export const MAP_PER_ROW = 5;
/** Children shown before a "+N more" node appears. */
export const MAP_PAGE_SIZE = 12;

/**
 * Cards per row for a canvas this wide: as many as fit at about 80% zoom,
 * between 2 (phones) and 6.
 * @param {number} canvasWidth CSS pixels
 * @param {{ cardWidth?: number, cardGap?: number }} [opts]
 */
export function mapPerRow(canvasWidth, opts = {}) {
  const w = opts.cardWidth || MAP_CARD_WIDTH;
  const gap = opts.cardGap ?? MAP_CARD_GAP;
  if (!canvasWidth || !Number.isFinite(canvasWidth)) return MAP_PER_ROW;
  const fit = Math.floor((canvasWidth / 0.8 + gap) / (w + gap));
  return Math.min(6, Math.max(2, fit));
}

function order(a, b) {
  const so = (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0);
  if (so !== 0) return so;
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
}

export function isMapTaskDone(task) {
  return Boolean(
    task &&
      (task.status === 'completed' ||
        task.dbStatus === 'Completed' ||
        task.isFullyDone)
  );
}

/**
 * One of: done | review | active | locked | open
 * @param {object} task
 */
export function mapTaskState(task) {
  if (!task) return 'open';
  if (isMapTaskDone(task)) return 'done';
  if (
    task.claim?.status === 'PendingReview' ||
    task.status === 'in_review' ||
    task.dbStatus === 'InReview'
  ) {
    return 'review';
  }
  if (
    task.claim?.status === 'Active' ||
    task.status === 'in_progress' ||
    task.dbStatus === 'InProgress'
  ) {
    return 'active';
  }
  if (
    !task.dependencyOverride &&
    (task.isLocked || task.isVisuallyBlocked || task.isBlockedGroup)
  ) {
    return 'locked';
  }
  return 'open';
}

/**
 * @param {object[]} tasks mapped tasks (tasksService.mapTaskRow shape)
 * @returns {{ roots: object[], byId: Map<string, object> }} tree nodes:
 *   { id, task, parentId, depth, children, leafTotal, leafDone, leafOpen }
 */
export function buildTaskTree(tasks) {
  const byId = new Map();
  for (const task of tasks || []) {
    if (!task?.id || task.archivedAt) continue;
    if (task.boardScope && task.boardScope !== 'public') continue;
    byId.set(String(task.id), {
      id: String(task.id),
      task,
      parentId: null,
      depth: 0,
      children: [],
      leafTotal: 0,
      leafDone: 0,
      leafOpen: 0,
    });
  }
  const roots = [];
  for (const node of byId.values()) {
    const pid = node.task.parentTaskId ? String(node.task.parentTaskId) : null;
    const parent = pid && pid !== node.id ? byId.get(pid) : null;
    if (parent) {
      node.parentId = parent.id;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const visiting = new Set();
  const finish = (node, depth) => {
    // Defensive: a parent cycle in bad data must not hang the page
    if (visiting.has(node.id)) {
      node.children = [];
      return;
    }
    visiting.add(node.id);
    node.depth = depth;
    node.children.sort((a, b) => order(a.task, b.task));
    if (!node.children.length) {
      node.leafTotal = 1;
      node.leafDone = isMapTaskDone(node.task) ? 1 : 0;
      node.leafOpen = mapTaskState(node.task) === 'open' ? 1 : 0;
    } else {
      node.leafTotal = 0;
      node.leafDone = 0;
      node.leafOpen = 0;
      for (const child of node.children) {
        finish(child, depth + 1);
        node.leafTotal += child.leafTotal;
        node.leafDone += child.leafDone;
        node.leafOpen += child.leafOpen;
      }
    }
    visiting.delete(node.id);
  };
  roots.sort((a, b) => order(a.task, b.task));
  for (const root of roots) finish(root, 0);
  return { roots, byId };
}

/** 0–100, by finished leaf tasks underneath (or the task itself). */
export function mapNodeProgress(node) {
  if (!node || !node.leafTotal) return 0;
  return Math.round((node.leafDone / node.leafTotal) * 100);
}

/** Ids from a node up to its root, nearest first. */
export function mapAncestorIds(byId, id) {
  const out = [];
  const seen = new Set();
  let cur = byId.get(String(id));
  while (cur?.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    out.push(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return out;
}

/**
 * Children to draw under an open node.
 * @returns {Array<{ kind: 'task'|'more'|'done', node?: object, count?: number, parentId: string }>}
 */
export function visibleChildren(node, view = {}) {
  const open = node.children.filter((c) => !isMapTaskDone(c.task));
  // Completed work is hidden unless the viewer turns on "Show completed"
  const done = view.showCompleted
    ? node.children.filter((c) => isMapTaskDone(c.task))
    : [];
  const limit = Math.max(
    MAP_PAGE_SIZE,
    Number(view.revealed?.[node.id]) || MAP_PAGE_SIZE
  );
  const items = open
    .slice(0, limit)
    .map((child) => ({ kind: 'task', node: child, parentId: node.id }));
  if (open.length > limit) {
    items.push({ kind: 'more', count: open.length - limit, parentId: node.id });
  }
  if (done.length) {
    if (view.showDone?.[node.id]) {
      for (const child of done) {
        items.push({ kind: 'task', node: child, parentId: node.id });
      }
    } else {
      items.push({ kind: 'done', count: done.length, parentId: node.id });
    }
  }
  return items;
}

/**
 * @param {object[]} roots from buildTaskTree
 * @param {{
 *   expanded?: string[], revealed?: Record<string, number>,
 *   showDone?: Record<string, boolean>, showCompleted?: boolean,
 *   perRow?: number, cardWidth?: number, cardGap?: number,
 * }} view
 *   expanded: open node id per level (index 0 = open Epic, 1 = open child, ...)
 *   perRow: most cards side by side in one row (see mapPerRow); more wrap
 * @returns {{ nodes: object[], edges: object[], width: number, height: number, bands: object[] }}
 *   node: { key, kind, id?, task?, tree?, parentId, depth, row, rowTop,
 *           rowBottom, x, y, w, h, expanded, hasChildren, posInSet, setSize, count? }
 *   edge: { key, fromKey, toKey, x1, y1, x2, y2, route, points }
 *     (x1, y1) = parent's bottom centre, (x2, y2) = child's top centre
 *   band: { depth, parentKey, top, bottom, rows: [{ top, bottom }] }
 *
 * An open card's band is inserted directly under the row that card is in;
 * the rest of its own band (and everything below) moves down to make room.
 * Rows from different bands therefore never share the same height on the
 * canvas, so every gap between two rows is a clear lane across the whole
 * map. Connectors use those lanes: down from the parent into the gap, along
 * it, down a clear channel between cards, along the gap above the child's
 * row, and down into the child.
 */
export function layoutTaskMap(roots, view = {}) {
  const perRow = Math.max(1, Math.floor(Number(view.perRow) || MAP_PER_ROW));
  const cardW = Number(view.cardWidth) || MAP_CARD_WIDTH;
  const gap = view.cardGap ?? MAP_CARD_GAP;
  const expanded = (view.expanded || []).map(String);

  const nodes = [];
  const bands = [];
  const links = [];
  let right = MAP_PADDING;
  const rowWidth = (n) => n * cardW + Math.max(0, n - 1) * gap;
  const heightOf = (item, depth) =>
    item.kind === 'task'
      ? depth === 0
        ? MAP_NODE_HEIGHT.epic
        : MAP_NODE_HEIGHT.task
      : MAP_NODE_HEIGHT[item.kind];

  /** Places a band (and any open band inside it); returns its bottom. */
  const placeBand = (items, depth, parent, top) => {
    const across = Math.min(items.length, perRow);
    const bandW = rowWidth(across);
    // Centred under the parent, but never off the left edge of the canvas
    const centre = parent ? parent.x + parent.w / 2 : MAP_PADDING + bandW / 2;
    const left = Math.max(MAP_PADDING, centre - bandW / 2);
    const band = { depth, parentKey: parent?.key ?? null, top, bottom: top, rows: [] };
    bands.push(band);

    let y = top;
    let gapAbove = parent ? MAP_BAND_GAP : 0;
    for (let r = 0; r * perRow < items.length; r++) {
      const row = items.slice(r * perRow, (r + 1) * perRow);
      const rowH = Math.max(...row.map((it) => heightOf(it, depth)));
      // A short last row sits as near the centre as the column grid allows;
      // staying on the grid keeps the gaps between columns lined up
      const rowLeft = left + Math.floor((across - row.length) / 2) * (cardW + gap);
      const placedRow = row.map((item, c) => {
        const isTask = item.kind === 'task';
        const tree = isTask ? item.node : null;
        // With completed hidden, a task whose sub-tasks are all finished has
        // nothing to branch out to
        const kids = tree && tree.children.length ? visibleChildren(tree, view) : [];
        const h = heightOf(item, depth);
        const placed = {
          key: isTask ? `t:${tree.id}` : `${item.kind}:${item.parentId}`,
          kind: item.kind,
          id: tree?.id,
          task: tree?.task,
          tree,
          kids,
          parentId: item.parentId ?? null,
          depth,
          row: r,
          rowTop: y,
          rowBottom: y + rowH,
          gapAbove,
          x: rowLeft + c * (cardW + gap),
          y: y + (rowH - h) / 2,
          w: cardW,
          h,
          hasChildren: kids.length > 0,
          expanded: false,
          posInSet: r * perRow + c + 1,
          setSize: items.length,
          count: item.count,
        };
        nodes.push(placed);
        right = Math.max(right, placed.x + cardW);
        if (parent) links.push([parent, placed]);
        return placed;
      });
      band.rows.push({ top: y, bottom: y + rowH });
      band.bottom = y + rowH;
      y += rowH;

      const openId = expanded[depth];
      const open = openId
        ? placedRow.find((n) => n.kind === 'task' && n.id === openId && n.hasChildren)
        : null;
      if (open) {
        // The open card's own band goes right under its row
        open.expanded = true;
        const childBottom = placeBand(open.kids, depth + 1, open, y + MAP_BAND_GAP);
        band.bottom = childBottom;
        y = childBottom + MAP_BAND_GAP;
        gapAbove = MAP_BAND_GAP;
      } else {
        y += MAP_ROW_GAP;
        gapAbove = MAP_ROW_GAP;
      }
    }
    return band.bottom;
  };

  // Epics: open first. Finished Epics only with "Show completed", after the rest.
  const openRoots = (roots || []).filter((r) => !isMapTaskDone(r.task));
  const doneRoots = view.showCompleted
    ? (roots || []).filter((r) => isMapTaskDone(r.task))
    : [];
  const epics = [...openRoots, ...doneRoots].map((root) => ({
    kind: 'task',
    node: root,
    parentId: null,
  }));
  const bottom = epics.length ? placeBand(epics, 0, null, MAP_PADDING) : MAP_PADDING;

  // Connectors, once every card has its place
  const edges = links.map(([parent, child]) => {
    const x1 = parent.x + parent.w / 2;
    const y1 = parent.y + parent.h;
    const x2 = child.x + child.w / 2;
    const y2 = child.y;
    // Along the gap between the parent's row and its band
    const busY = parent.rowBottom + MAP_BAND_GAP / 2;
    let tgtLane = null;
    if (child.row > 0) {
      // Along the gap just above the child's row, reached by a clear
      // vertical channel (preferably the gap left of the child's column)
      const laneY = child.rowTop - child.gapAbove / 2;
      const vx = clearChannel(nodes, child.x - gap / 2, busY, laneY, gap);
      tgtLane = { dy: y2 - laneY, gutterDx: vx - x2 };
    }
    const route = { srcLane: null, busDy: y2 - busY, tgtLane };
    return {
      key: `${parent.key}>${child.key}`,
      fromKey: parent.key,
      toKey: child.key,
      x1,
      y1,
      x2,
      y2,
      route,
      points: mapEdgePoints(x1, y1, x2, y2, route),
    };
  });

  for (const n of nodes) delete n.kids;
  return {
    nodes,
    edges,
    bands,
    width: right + MAP_PADDING,
    height: bottom + MAP_PADDING,
  };
}

/**
 * Nearest x to `preferred` where a vertical line from y1 to y2 touches no
 * card (cards opened between two rows can sit in the way of a gap).
 */
function clearChannel(nodes, preferred, y1, y2, gap) {
  const margin = 6;
  const inRange = nodes.filter((n) => n.y < y2 && n.y + n.h > y1);
  const clear = (x) =>
    inRange.every((n) => x <= n.x - margin || x >= n.x + n.w + margin);
  if (clear(preferred)) return preferred;
  const candidates = [];
  for (const n of inRange) {
    candidates.push(n.x - gap / 2, n.x + n.w + gap / 2);
  }
  candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
  return candidates.find(clear) ?? preferred;
}

/**
 * Corner points of a connector, from a parent's bottom centre (x1, y1) to a
 * child's top centre (x2, y2). The route is relative to the two ends, so the
 * line follows the cards while they glide to new places.
 * @param {{ srcLane?: { dy: number, gutterDx: number }|null, busDy?: number, tgtLane?: { dy: number, gutterDx: number }|null }} route
 * @returns {Array<[number, number]>}
 */
export function mapEdgePoints(x1, y1, x2, y2, route = {}) {
  const pts = [[x1, y1]];
  let x = x1;
  if (route.srcLane) {
    const laneY = y1 + route.srcLane.dy;
    x = x1 + route.srcLane.gutterDx;
    pts.push([x1, laneY], [x, laneY]);
  }
  const busY = y2 - (route.busDy ?? (y2 - y1) / 2);
  pts.push([x, busY]);
  if (route.tgtLane) {
    const gx = x2 + route.tgtLane.gutterDx;
    const laneY = y2 - route.tgtLane.dy;
    pts.push([gx, busY], [gx, laneY], [x2, laneY]);
  } else {
    pts.push([x2, busY]);
  }
  pts.push([x2, y2]);

  // Drop repeated points and points in the middle of a straight run
  const out = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev[0] - p[0]) < 0.01 && Math.abs(prev[1] - p[1]) < 0.01) {
      continue;
    }
    const before = out[out.length - 2];
    if (
      before &&
      ((Math.abs(before[0] - prev[0]) < 0.01 && Math.abs(prev[0] - p[0]) < 0.01) ||
        (Math.abs(before[1] - prev[1]) < 0.01 && Math.abs(prev[1] - p[1]) < 0.01))
    ) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

const fmt = (n) => String(Math.round(n * 100) / 100);

/** SVG path through the points, with rounded corners. */
export function mapEdgePath(points, radius = 12) {
  if (!points?.length) return '';
  let d = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, ay] = points[i - 1];
    const [px, py] = points[i];
    const [bx, by] = points[i + 1];
    const inLen = Math.hypot(px - ax, py - ay);
    const outLen = Math.hypot(bx - px, by - py);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const p1x = px - ((px - ax) / (inLen || 1)) * r;
    const p1y = py - ((py - ay) / (inLen || 1)) * r;
    const p2x = px + ((bx - px) / (outLen || 1)) * r;
    const p2y = py + ((by - py) / (outLen || 1)) * r;
    d += ` L ${fmt(p1x)} ${fmt(p1y)} Q ${fmt(px)} ${fmt(py)} ${fmt(p2x)} ${fmt(p2y)}`;
  }
  const end = points[points.length - 1];
  return `${d} L ${fmt(end[0])} ${fmt(end[1])}`;
}

/**
 * Map highlight: with board filters on, the whole tree still shows, but
 * only the paths that lead to matching work stay in colour.
 *
 * A task is "lit" when it, or any task beneath it at any depth, matches.
 * A "blocked" task (Hide Blocked Tasks on) is never lit and never counts as
 * a match, so it turns grey instead of disappearing. Finished tasks only
 * count while "Show completed" is on, so a lit card never opens onto
 * nothing in colour.
 *
 * @param {object[]} roots from buildTaskTree
 * @param {{ matches?: ((task: object) => boolean)|null, blocked?: ((task: object) => boolean)|null }} filter
 *   matches: every active filter combined (category AND unclaimed ...);
 *   null when only the blocked filter is on
 * @param {{ showCompleted?: boolean }} [view]
 * @returns {Map<string, { lit: boolean, self: boolean, inside: number }>|null}
 *   null when no filter is on (everything is in colour).
 *   inside = matching tasks beneath the node (not counting itself).
 */
export function mapFilterHighlight(roots, filter = {}, view = {}) {
  const matches = typeof filter.matches === 'function' ? filter.matches : null;
  const blocked = typeof filter.blocked === 'function' ? filter.blocked : null;
  if (!matches && !blocked) return null;
  const out = new Map();
  const visiting = new Set();
  const counts = (node) => {
    if (visiting.has(node.id)) return 0;
    visiting.add(node.id);
    let inside = 0;
    for (const child of node.children) inside += counts(child);
    visiting.delete(node.id);
    const shown = view.showCompleted || !isMapTaskDone(node.task);
    const isBlocked = blocked ? Boolean(blocked(node.task)) : false;
    const self =
      shown && !isBlocked && (matches ? Boolean(matches(node.task)) : true);
    out.set(node.id, { lit: !isBlocked && (self || inside > 0), self, inside });
    return inside + (self ? 1 : 0);
  };
  for (const root of roots || []) counts(root);
  return out;
}

/**
 * Short summary for a card with tasks under it, e.g. "8 tasks · 3 open · 60% done".
 * Counts the smallest tasks beneath it; "open" = ready to claim now.
 */
export function mapNodeSummary(tree) {
  if (!tree?.children?.length) return '';
  const total = tree.leafTotal || 0;
  return `${total} task${total === 1 ? '' : 's'} · ${tree.leafOpen || 0} open · ${mapNodeProgress(tree)}% done`;
}

/** True when every task in the branch (or the task itself) is finished. */
export function isMapBranchFinished(tree) {
  if (!tree) return false;
  if (isMapTaskDone(tree.task)) return true;
  return tree.leafTotal > 0 && tree.leafDone === tree.leafTotal;
}

/**
 * Open one node: closes any other branch at its depth and everything deeper.
 * Clicking the open node again closes it.
 * @param {string[]} expanded current open id per depth
 * @param {{ id: string, depth: number }} node
 */
export function toggleExpanded(expanded, node) {
  const next = (expanded || []).slice(0, node.depth);
  if (expanded?.[node.depth] !== node.id) next[node.depth] = node.id;
  return next;
}
