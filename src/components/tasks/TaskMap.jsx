/**
 * Task Map: the task board as an interactive branching diagram.
 *
 * Epics sit in the first column. Clicking one branches out its tasks, and
 * clicking one of those branches out its sub-tasks. Selecting any node shows
 * its details beside the map, with a button to open the full task dialog.
 *
 * Read-only view of the same tasks as the board: claiming, progress and
 * review all still happen in the task dialog.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronRight,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  buildTaskTree,
  layoutTaskMap,
  mapAncestorIds,
  mapEdgePath,
  mapNodeProgress,
  mapTaskState,
  toggleExpanded,
  MAP_PAGE_SIZE,
} from '../../utils/taskMapLayout';
import {
  getTaskWaitingOnBlockers,
  taskLevelLabel,
} from '../../services/tasksService';

const STATE_STYLES = {
  open: {
    label: 'Open',
    dot: 'bg-neon-cyan',
    bar: 'bg-neon-cyan',
    border: 'border-neon-cyan/40',
    text: 'text-neon-cyan',
    stroke: 'rgb(var(--tf-neon-cyan) / 0.55)',
  },
  active: {
    label: 'In progress',
    dot: 'bg-neon-magenta',
    bar: 'bg-neon-magenta',
    border: 'border-neon-magenta/50',
    text: 'text-fuchsia-400',
    stroke: 'rgb(var(--tf-neon-magenta) / 0.6)',
  },
  review: {
    label: 'In review',
    dot: 'bg-semantic-warning',
    bar: 'bg-semantic-warning',
    border: 'border-semantic-warning/50',
    text: 'text-semantic-warning',
    stroke: 'rgb(var(--tf-semantic-warning) / 0.6)',
  },
  done: {
    label: 'Done',
    dot: 'bg-semantic-success',
    bar: 'bg-semantic-success',
    border: 'border-semantic-success/40',
    text: 'text-semantic-success',
    stroke: 'rgb(var(--tf-semantic-success) / 0.5)',
  },
  locked: {
    label: 'Blocked',
    dot: 'bg-white/40',
    bar: 'bg-white/40',
    border: 'border-white/20',
    text: 'text-text-secondary',
    stroke: 'rgb(255 255 255 / 0.25)',
  },
};
const LEGEND = ['open', 'active', 'review', 'done', 'locked'];
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.4;
const ZOOM_STEP = 0.1;

function plainText(text, max = 320) {
  const clean = String(text || '')
    .replace(/[#*_`>~]+/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function ProgressBar({ percent, tone, label, decorative = false }) {
  const a11y = decorative
    ? { 'aria-hidden': true }
    : {
        role: 'progressbar',
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': percent,
        'aria-label': label,
      };
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
      {...a11y}
    >
      <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function MapNode({
  node,
  selected,
  tabbable,
  onActivate,
  onKeyDown,
  registerRef,
}) {
  if (node.kind !== 'task') {
    const isDone = node.kind === 'done';
    return (
      <button
        type="button"
        role="treeitem"
        aria-level={node.depth + 1}
        aria-posinset={node.posInSet}
        aria-setsize={node.setSize}
        aria-selected={false}
        data-map-node=""
        ref={(el) => registerRef(node.key, el)}
        tabIndex={tabbable ? 0 : -1}
        onClick={() => onActivate(node)}
        onKeyDown={(e) => onKeyDown(e, node)}
        className="flex h-full w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 bg-cyber-surface/70 px-3 text-xs font-mono tracking-wide text-text-secondary hover:border-neon-cyan/60 hover:text-white"
      >
        {isDone ? (
          <>
            <CheckCircle2
              className="h-3.5 w-3.5 text-semantic-success"
              aria-hidden="true"
            />
            Show {node.count} completed
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Show {Math.min(node.count, MAP_PAGE_SIZE)} more ({node.count} left)
          </>
        )}
      </button>
    );
  }

  const state = mapTaskState(node.task);
  const style = STATE_STYLES[state];
  const percent = mapNodeProgress(node.tree);
  const isEpic = node.depth === 0;

  return (
    <button
      type="button"
      role="treeitem"
      data-map-node=""
      data-task-id={node.id}
      ref={(el) => registerRef(node.key, el)}
      tabIndex={tabbable ? 0 : -1}
      aria-level={node.depth + 1}
      aria-posinset={node.posInSet}
      aria-setsize={node.setSize}
      aria-selected={selected}
      aria-expanded={node.hasChildren ? node.expanded : undefined}
      onClick={() => onActivate(node)}
      onKeyDown={(e) => onKeyDown(e, node)}
      className={`group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border bg-cyber-card pl-4 pr-3 py-2.5 text-left transition-shadow ${
        style.border
      } ${
        selected
          ? 'ring-2 ring-neon-cyan shadow-[0_0_24px_rgba(0,249,255,0.18)]'
          : 'hover:shadow-[0_0_18px_rgba(0,249,255,0.10)]'
      } ${state === 'done' ? 'opacity-75' : ''}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${style.bar}`}
        aria-hidden="true"
      />
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {taskLevelLabel(node.depth)}
        </span>
        <span
          className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest ${style.text}`}
        >
          {state === 'locked' ? (
            <Lock className="h-3 w-3" aria-hidden="true" />
          ) : (
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          )}
          {style.label}
        </span>
      </span>

      <span className="flex items-center gap-2">
        <span
          className={`min-w-0 flex-1 font-semibold leading-snug text-white ${
            isEpic ? 'text-[15px] line-clamp-2' : 'text-sm line-clamp-2'
          }`}
        >
          {node.task.title}
        </span>
        {node.hasChildren && (
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${
              node.expanded ? 'rotate-90 text-neon-cyan' : ''
            }`}
            aria-hidden="true"
          />
        )}
      </span>

      {node.hasChildren ? (
        <span className="flex items-center gap-2">
          <ProgressBar percent={percent} tone={style.bar} decorative />
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-secondary">
            {node.tree.leafDone}/{node.tree.leafTotal}
            <span className="sr-only"> tasks done</span>
          </span>
        </span>
      ) : isEpic ? (
        <span className="font-mono text-[10px] text-text-muted">
          No sub-tasks yet
        </span>
      ) : node.task.claimedBy ? (
        <span className="sr-only">Claimed by {node.task.claimedBy}</span>
      ) : null}
    </button>
  );
}

function DetailPanel({ node, ancestors, onOpenTask, onToggle }) {
  if (!node) {
    return (
      <div className="space-y-4">
        <h3 className="font-mono text-xs uppercase tracking-widest text-neon-cyan">
          How to read the map
        </h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
          <li>
            Each box in the first column is an <strong>Epic</strong>: a big
            piece of the game.
          </li>
          <li>Click an Epic to branch out the tasks inside it.</li>
          <li>Click a task to branch out its smaller sub-tasks.</li>
          <li>
            The details of whatever you click show up here, with a button to
            open the full task.
          </li>
        </ol>
        <p className="text-xs text-text-muted">
          Keyboard: arrow keys move between boxes, Enter opens a branch.
        </p>
      </div>
    );
  }

  const { task, tree } = node;
  const state = mapTaskState(task);
  const style = STATE_STYLES[state];
  const percent = mapNodeProgress(tree);
  const blockers = getTaskWaitingOnBlockers(task).filter((b) => !b.isComplete);
  const description = plainText(task.description);
  const meta = [
    taskLevelLabel(node.depth),
    task.category,
    task.difficulty ? `${task.difficulty} difficulty` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-4">
      {ancestors.length > 0 && (
        <p className="text-xs text-text-muted">
          {ancestors.map((a) => a.task.title).join(' › ')}
        </p>
      )}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {meta}
        </p>
        <h3 className="mt-1 text-lg font-bold leading-snug text-white">
          {task.title}
        </h3>
        <p
          className={`mt-2 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest ${style.text}`}
        >
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          {style.label}
          {task.claimedBy ? (
            <span className="normal-case tracking-normal text-text-secondary">
              · {task.claimedBy}
            </span>
          ) : null}
        </p>
      </div>

      {node.hasChildren && (
        <div className="space-y-1.5">
          <ProgressBar
            percent={percent}
            tone={style.bar}
            label={`${percent}% of tasks done`}
          />
          <p className="text-xs text-text-secondary">
            {tree.leafDone} of {tree.leafTotal} tasks done ({percent}%) ·{' '}
            {tree.children.length} direct{' '}
            {tree.children.length === 1 ? 'branch' : 'branches'}
          </p>
        </div>
      )}

      {description ? (
        <p className="text-sm leading-relaxed text-text-secondary">
          {description}
        </p>
      ) : (
        <p className="text-sm text-text-muted">No description yet.</p>
      )}

      {blockers.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Waiting on
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-text-secondary">
            {blockers.slice(0, 6).map((b, i) => (
              <li key={b.id || `${b.title}-${i}`}>{b.title}</li>
            ))}
            {blockers.length > 6 && <li>and {blockers.length - 6} more</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onOpenTask(task.id)}
          className="rounded-lg border border-neon-cyan bg-neon-cyan/10 px-4 py-2 text-sm font-semibold text-neon-cyan hover:bg-neon-cyan/20"
        >
          Open full task
        </button>
        {node.hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(node)}
            className="rounded-lg border border-cyber-border px-4 py-2 text-sm text-text-secondary hover:text-white"
          >
            {node.expanded ? 'Close branch' : 'Open branch'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function TaskMap({ tasks, onOpenTask }) {
  const reducedMotion = useReducedMotion();
  const liteFx =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('tf-lite-fx');
  const instant = reducedMotion || liteFx;

  const [expanded, setExpanded] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [showDone, setShowDone] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [focusKey, setFocusKey] = useState(null);
  // Phones start zoomed out a little so a branch and its parent both fit
  const [scale, setScale] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 0.8 : 1
  );

  const viewportRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const drag = useRef(null);
  const pendingFocus = useRef(null);

  const { roots, byId } = useMemo(() => buildTaskTree(tasks), [tasks]);

  // Drop state that points at tasks which no longer exist (board refresh)
  const safeExpanded = useMemo(() => {
    const out = [];
    for (const id of expanded) {
      if (!byId.has(id)) break;
      out.push(id);
    }
    return out;
  }, [expanded, byId]);

  const layout = useMemo(
    () => layoutTaskMap(roots, { expanded: safeExpanded, revealed, showDone }),
    [roots, safeExpanded, revealed, showDone]
  );
  const byKey = useMemo(
    () => new Map(layout.nodes.map((n) => [n.key, n])),
    [layout]
  );

  const selectedNode =
    selectedId && byKey.get(`t:${selectedId}`)
      ? byKey.get(`t:${selectedId}`)
      : null;
  const selectedAncestors = useMemo(
    () =>
      selectedNode
        ? mapAncestorIds(byId, selectedNode.id)
            .reverse()
            .map((id) => byId.get(id))
            .filter(Boolean)
        : [],
    [selectedNode, byId]
  );

  const tabbableKey =
    focusKey && byKey.has(focusKey) ? focusKey : layout.nodes[0]?.key || null;

  const registerRef = useCallback((key, el) => {
    if (el) nodeRefs.current.set(key, el);
    else nodeRefs.current.delete(key);
  }, []);

  const focusNode = useCallback((key) => {
    setFocusKey(key);
    const el = nodeRefs.current.get(key);
    if (el) el.focus({ preventScroll: false });
    else pendingFocus.current = key;
  }, []);

  // Focus a node that only exists after the next layout (e.g. first child)
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    const el = nodeRefs.current.get(key);
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  }, [layout]);

  const toggle = useCallback((node) => {
    setExpanded((prev) => toggleExpanded(prev, node));
  }, []);

  const activate = useCallback(
    (node) => {
      setFocusKey(node.key);
      if (node.kind === 'more') {
        setRevealed((prev) => ({
          ...prev,
          [node.parentId]:
            (Number(prev[node.parentId]) || MAP_PAGE_SIZE) + MAP_PAGE_SIZE,
        }));
        return;
      }
      if (node.kind === 'done') {
        setShowDone((prev) => ({ ...prev, [node.parentId]: true }));
        return;
      }
      setSelectedId(node.id);
      if (node.hasChildren) toggle(node);
    },
    [toggle]
  );

  const onKeyDown = useCallback(
    (e, node) => {
      const column = () =>
        layout.nodes
          .filter((n) => n.depth === node.depth)
          .sort((a, b) => a.y - b.y);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const col = column();
        const i = col.findIndex((n) => n.key === node.key);
        const next = col[i + (e.key === 'ArrowDown' ? 1 : -1)];
        if (next) focusNode(next.key);
      } else if (e.key === 'ArrowRight') {
        if (node.kind !== 'task' || !node.hasChildren) return;
        e.preventDefault();
        if (!node.expanded) {
          setSelectedId(node.id);
          toggle(node);
        } else {
          const child = layout.nodes.find(
            (n) => n.parentId === node.id && n.depth === node.depth + 1
          );
          if (child) focusNode(child.key);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (node.kind === 'task' && node.expanded) {
          toggle(node);
        } else if (node.parentId) {
          focusNode(`t:${node.parentId}`);
        }
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const col = column();
        const target = e.key === 'Home' ? col[0] : col[col.length - 1];
        if (target) focusNode(target.key);
      }
    },
    [layout, focusNode, toggle]
  );

  // Bring a freshly opened branch into view
  const deepestOpen = safeExpanded[safeExpanded.length - 1] || null;
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !deepestOpen) return;
    const node = byKey.get(`t:${deepestOpen}`);
    if (!node) return;
    const kids = layout.nodes.filter((n) => n.parentId === node.id);
    const top = Math.min(node.y, ...kids.map((k) => k.y));
    const bottom = Math.max(
      node.y + node.h,
      ...kids.map((k) => k.y + k.h)
    );
    const right = (kids[0] ? kids[0].x + kids[0].w : node.x + node.w) * scale;
    const left = node.x * scale;
    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;
    // Show the whole branch when it fits; otherwise start at the opened node
    const targetLeft =
      right - left + 48 <= viewW
        ? Math.min(Math.max(0, right + 24 - viewW), Math.max(0, left - 24))
        : kids[0]
          ? // Narrow screens: show the new branch, keep a sliver of its parent
            kids[0].x * scale - 56
          : left - 24;
    const centre = ((top + bottom) / 2) * scale;
    const blockH = (bottom - top) * scale;
    const targetTop =
      blockH + 48 <= viewH ? centre - viewH / 2 : top * scale - 24;
    viewport.scrollTo({
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
      behavior: instant ? 'auto' : 'smooth',
    });
    // Only when the open branch changes, not on every layout tweak
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepestOpen, safeExpanded.length]);

  // Mouse drag pans the map (touch and wheel use native scrolling)
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (e.target.closest('[data-map-node]')) return;
    const viewport = viewportRef.current;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    viewport.setPointerCapture(e.pointerId);
    viewport.style.cursor = 'grabbing';
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const viewport = viewportRef.current;
    viewport.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
    viewport.scrollTop = drag.current.top - (e.clientY - drag.current.y);
  };
  const endDrag = (e) => {
    if (!drag.current) return;
    drag.current = null;
    const viewport = viewportRef.current;
    viewport.style.cursor = '';
    try {
      viewport.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const zoomBy = (delta) =>
    setScale((s) =>
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((s + delta) * 10) / 10))
    );
  const collapseAll = () => {
    setExpanded([]);
    setRevealed({});
    setShowDone({});
    setSelectedId(null);
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
  };

  const transition = instant
    ? { duration: 0 }
    : { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 };

  if (!roots.length) {
    return (
      <p className="rounded-xl border border-cyber-border bg-cyber-surface/40 px-4 py-10 text-center text-sm text-text-muted">
        No tasks on this board yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 rounded-xl border border-cyber-border bg-cyber-surface/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyber-border px-4 py-2.5">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
            {LEGEND.map((key) => (
              <li
                key={key}
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary"
              >
                <span className={`h-2 w-2 rounded-full ${STATE_STYLES[key].dot}`} />
                {STATE_STYLES[key].label}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={scale <= ZOOM_MIN}
              aria-label="Zoom out"
              className="rounded-md border border-cyber-border p-1.5 text-text-secondary hover:text-white disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span
              className="w-12 text-center font-mono text-xs tabular-nums text-text-secondary"
              aria-live="polite"
            >
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={scale >= ZOOM_MAX}
              aria-label="Zoom in"
              className="rounded-md border border-cyber-border p-1.5 text-text-secondary hover:text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-cyber-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>

        <div
          ref={viewportRef}
          data-testid="task-map-viewport"
          className="task-scroll relative cursor-grab overflow-auto overscroll-contain"
          style={{ height: 'min(72vh, 46rem)', minHeight: '24rem' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            style={{
              width: layout.width * scale,
              height: layout.height * scale,
              minWidth: '100%',
              minHeight: '100%',
            }}
          >
            <div
              role="tree"
              aria-label="Task map"
              className="relative"
              style={{
                width: layout.width,
                height: layout.height,
                transform: `scale(${scale})`,
                transformOrigin: '0 0',
              }}
            >
              <svg
                className="pointer-events-none absolute inset-0"
                width={layout.width}
                height={layout.height}
                aria-hidden="true"
              >
                <AnimatePresence initial={false}>
                  {layout.edges.map((edge) => {
                    const child = byKey.get(edge.toKey);
                    const stroke =
                      child?.kind === 'task'
                        ? STATE_STYLES[mapTaskState(child.task)].stroke
                        : 'rgb(255 255 255 / 0.2)';
                    return (
                      <motion.path
                        key={edge.key}
                        fill="none"
                        strokeWidth={2}
                        strokeLinecap="round"
                        stroke={stroke}
                        initial={{ d: mapEdgePath(edge), opacity: 0 }}
                        animate={{ d: mapEdgePath(edge), opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        transition={transition}
                      />
                    );
                  })}
                </AnimatePresence>
              </svg>

              <AnimatePresence initial={false}>
                {layout.nodes.map((node) => {
                  const parent = node.parentId
                    ? byKey.get(`t:${node.parentId}`)
                    : null;
                  const from = parent
                    ? { x: parent.x, y: parent.y + (parent.h - node.h) / 2 }
                    : { x: node.x, y: node.y };
                  return (
                    <motion.div
                      key={node.key}
                      className="absolute left-0 top-0"
                      style={{ width: node.w, height: node.h }}
                      initial={{ x: from.x, y: from.y, opacity: 0 }}
                      animate={{ x: node.x, y: node.y, opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={transition}
                    >
                      <MapNode
                        node={node}
                        selected={node.kind === 'task' && node.id === selectedId}
                        tabbable={node.key === tabbableKey}
                        onActivate={activate}
                        onKeyDown={onKeyDown}
                        registerRef={registerRef}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <aside
        aria-label="Selected task"
        aria-live="polite"
        className="rounded-xl border border-cyber-border bg-cyber-surface/40 p-4 lg:sticky lg:top-24 lg:self-start"
      >
        <DetailPanel
          node={selectedNode}
          ancestors={selectedAncestors}
          onOpenTask={onOpenTask}
          onToggle={toggle}
        />
      </aside>
    </div>
  );
}
