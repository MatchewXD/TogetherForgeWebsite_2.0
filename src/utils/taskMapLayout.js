/**
 * Task Map: tree building + left-to-right layout (pure, no React).
 *
 * The map shows Epics in the first column. Opening an Epic branches out its
 * children in the next column, and so on. Within a family, open work comes
 * first; finished tasks collapse into one "N completed" node, and very large
 * families page in with a "+N more" node, so the picture stays readable.
 */

export const MAP_COLUMN_WIDTH = 264;
export const MAP_COLUMN_GAP = 76;
export const MAP_ROW_GAP = 14;
export const MAP_PADDING = 24;
export const MAP_NODE_HEIGHT = { task: 76, epic: 92, more: 40, done: 40 };
/** Children shown before a "+N more" node appears. */
export const MAP_PAGE_SIZE = 12;

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
 *   { id, task, parentId, depth, children, leafTotal, leafDone }
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
    } else {
      node.leafTotal = 0;
      node.leafDone = 0;
      for (const child of node.children) {
        finish(child, depth + 1);
        node.leafTotal += child.leafTotal;
        node.leafDone += child.leafDone;
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
  const done = node.children.filter((c) => isMapTaskDone(c.task));
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
 * @param {{ expanded?: string[], revealed?: Record<string, number>, showDone?: Record<string, boolean> }} view
 *   expanded: open node id per depth (index 0 = open Epic, 1 = open child, ...)
 * @returns {{ nodes: object[], edges: object[], width: number, height: number }}
 *   node: { key, kind, id?, task?, tree?, parentId, depth, x, y, w, h,
 *           expanded, hasChildren, posInSet, setSize, count? }
 *   edge: { key, fromKey, toKey, x1, y1, x2, y2 }
 */
export function layoutTaskMap(roots, view = {}) {
  const expanded = new Set((view.expanded || []).map(String));
  const nodes = [];
  const edges = [];
  let cursor = MAP_PADDING;
  let maxDepth = 0;

  const colX = (depth) => MAP_PADDING + depth * (MAP_COLUMN_WIDTH + MAP_COLUMN_GAP);

  /** Places an item and its visible subtree; returns the placed nodes. */
  const place = (item, depth, posInSet, setSize) => {
    maxDepth = Math.max(maxDepth, depth);
    const isTask = item.kind === 'task';
    const tree = isTask ? item.node : null;
    const h = isTask
      ? depth === 0
        ? MAP_NODE_HEIGHT.epic
        : MAP_NODE_HEIGHT.task
      : MAP_NODE_HEIGHT[item.kind];
    const placed = {
      key: isTask ? `t:${tree.id}` : `${item.kind}:${item.parentId}`,
      kind: item.kind,
      id: tree?.id,
      task: tree?.task,
      tree,
      parentId: item.parentId ?? null,
      depth,
      x: colX(depth),
      y: 0,
      w: MAP_COLUMN_WIDTH,
      h,
      hasChildren: Boolean(tree?.children.length),
      expanded: Boolean(tree && tree.children.length && expanded.has(tree.id)),
      posInSet,
      setSize,
      count: item.count,
    };
    const subtree = [placed];
    nodes.push(placed);

    if (!placed.expanded) {
      placed.y = cursor;
      cursor += h + MAP_ROW_GAP;
      return subtree;
    }

    const start = cursor;
    const kids = visibleChildren(tree, view);
    const kidNodes = [];
    kids.forEach((kid, i) => {
      const sub = place(kid, depth + 1, i + 1, kids.length);
      kidNodes.push(sub[0]);
      subtree.push(...sub);
    });
    const first = kidNodes[0];
    const last = kidNodes[kidNodes.length - 1];
    const centre = (first.y + first.h / 2 + last.y + last.h / 2) / 2;
    placed.y = centre - h / 2;
    // Parent taller than its children block: push the whole subtree down
    if (placed.y < start) {
      const delta = start - placed.y;
      for (const n of subtree) n.y += delta;
      cursor += delta;
    }
    cursor = Math.max(cursor, placed.y + h + MAP_ROW_GAP);
    for (const kid of kidNodes) {
      edges.push({
        key: `${placed.key}>${kid.key}`,
        fromKey: placed.key,
        toKey: kid.key,
      });
    }
    return subtree;
  };

  (roots || []).forEach((root, i) =>
    place({ kind: 'task', node: root, parentId: null }, 0, i + 1, roots.length)
  );

  const byKey = new Map(nodes.map((n) => [n.key, n]));
  for (const edge of edges) {
    const a = byKey.get(edge.fromKey);
    const b = byKey.get(edge.toKey);
    edge.x1 = a.x + a.w;
    edge.y1 = a.y + a.h / 2;
    edge.x2 = b.x;
    edge.y2 = b.y + b.h / 2;
  }

  return {
    nodes,
    edges,
    width: colX(maxDepth) + MAP_COLUMN_WIDTH + MAP_PADDING,
    height: Math.max(cursor - MAP_ROW_GAP + MAP_PADDING, MAP_PADDING * 2),
  };
}

/** Smooth horizontal S-curve between two points. */
export function mapEdgePath(edge) {
  const mid = (edge.x1 + edge.x2) / 2;
  return `M ${edge.x1} ${edge.y1} C ${mid} ${edge.y1}, ${mid} ${edge.y2}, ${edge.x2} ${edge.y2}`;
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
