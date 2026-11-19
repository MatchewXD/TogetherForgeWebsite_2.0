/**
 * Task Map: the task board as an endless canvas (React Flow).
 *
 * Epics sit in the first column. Clicking one branches out its tasks, and
 * clicking one of those branches out its sub-tasks. Positions come from
 * layoutTaskMap (nodes cannot be dragged); when a branch opens or closes the
 * cards glide to their new places and the view pans just enough to keep the
 * clicked card in sight.
 *
 * Selecting a card opens a details panel (a bottom sheet on phones) with the
 * same actions as the board. Every action calls the board's own handlers.
 *
 * The board's category filter highlights instead of hiding: the whole tree
 * stays, and only the paths that lead to matching work keep their colour.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  buildTaskTree,
  isMapTaskDone,
  layoutTaskMap,
  mapAncestorIds,
  mapFilterHighlight,
  mapPerRow,
  mapTaskState,
  toggleExpanded,
  MAP_CARD_GAP,
  MAP_CARD_WIDTH,
  MAP_PAGE_SIZE,
} from '../../utils/taskMapLayout';
import { boardMapFilter } from '../../utils/taskActions';
import TaskCategoryFilter from './TaskCategoryFilter';
import TaskMapPanel from './map/TaskMapPanel';
import { PagerNode, RouteEdge, TaskNode } from './map/TaskMapNodes';
import {
  DIM_MINI,
  DIM_STROKE,
  LEGEND,
  STATE_STYLES,
} from './map/taskMapStyles';

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2;
const TWEEN_MS = 420;
const PAN_MS = 450;
/** Focus mode: how long the camera takes to frame an opened branch. */
const FOCUS_MS = 400;
/** Focus mode never zooms out further than this; taller bands pin to the top. */
const FOCUS_MIN_ZOOM = 0.5;
const SHOW_COMPLETED_KEY = 'tf-task-map-show-completed';
const noop = () => {};
const NO_CATEGORIES = [];
const NODE_TYPES = { task: TaskNode, pager: PagerNode };
const EDGE_TYPES = { route: RouteEdge };
/** First load and Reset frame this many rows of Epics. */
const FIT_EPIC_ROWS = 3;
const PHONE_CANVAS = 480;
/** Keep cards this far from the canvas edges when panning or fitting. */
const VIEW_PAD = 24;
/** Bottom edge leaves room for the zoom controls and minimap. */
/** Desktop minimap size; the camera keeps cards clear of it. */
const MINIMAP_W = 120;
const MINIMAP_H = 76;
// Minimap height + its corner margin (15px) + breathing room
const VIEW_PAD_BOTTOM = MINIMAP_H + 15 + 13;
/** Height of the phone peek bar (selected card with its branch open). */
const PEEK_H = 64;

/** Card size for the canvas width: narrower cards on phones. */
function cardSizeFor(canvasWidth) {
  return canvasWidth && canvasWidth < PHONE_CANVAS
    ? { cardWidth: 200, cardGap: 24 }
    : { cardWidth: MAP_CARD_WIDTH, cardGap: MAP_CARD_GAP };
}

/** "3 unclaimed Code tasks inside", for the filters that pick tasks. */
function insidePhrase(count, categoryFilter, unclaimedOnly) {
  const words = [];
  if (unclaimedOnly) words.push('unclaimed');
  if (categoryFilter.length === 1) words.push(categoryFilter[0]);
  else if (categoryFilter.length > 1) words.push('matching');
  return `${count} ${words.join(' ')} task${count === 1 ? '' : 's'} inside`;
}

/**
 * Animated positions for the laid-out nodes. New nodes grow out of their
 * parent; existing nodes glide from where they are now.
 * @returns {Map<string, { x: number, y: number, o: number }>}
 */
function useTweenedPositions(layout, instant) {
  const [frame, setFrame] = useState(() => {
    const m = new Map();
    for (const n of layout.nodes) m.set(n.key, { x: n.x, y: n.y, o: 1 });
    return m;
  });
  const current = useRef(frame);

  useEffect(() => {
    const target = new Map(layout.nodes.map((n) => [n.key, n]));
    const from = new Map();
    for (const n of layout.nodes) {
      const cur = current.current.get(n.key);
      if (cur) {
        from.set(n.key, cur);
        continue;
      }
      const parentKey = n.parentId ? `t:${n.parentId}` : null;
      const p =
        (parentKey && current.current.get(parentKey)) ||
        (parentKey && target.get(parentKey)) ||
        null;
      from.set(
        n.key,
        p ? { x: p.x, y: p.y + ((p.h || n.h) - n.h) / 2, o: 0 } : { x: n.x, y: n.y, o: 0 }
      );
    }

    const settle = () => {
      const done = new Map();
      for (const n of layout.nodes) done.set(n.key, { x: n.x, y: n.y, o: 1 });
      current.current = done;
      setFrame(done);
    };
    if (instant || typeof window.requestAnimationFrame !== 'function') {
      settle();
      return undefined;
    }

    let raf = 0;
    let start = null;
    const step = (now) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const e = 1 - (1 - t) ** 3;
      const next = new Map();
      for (const n of layout.nodes) {
        const f = from.get(n.key);
        next.set(n.key, {
          x: f.x + (n.x - f.x) * e,
          y: f.y + (n.y - f.y) * e,
          o: f.o + (1 - f.o) * e,
        });
      }
      current.current = next;
      setFrame(next);
      if (t < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [layout, instant]);

  return frame;
}

function ZoomReadout() {
  const zoom = useStore((s) => s.transform[2]);
  return (
    <span
      className="w-11 text-center font-mono text-[11px] tabular-nums text-text-secondary"
      aria-live="polite"
    >
      {Math.round(zoom * 100)}%
    </span>
  );
}

function TaskMapCanvas({
  tasks,
  onOpenTask,
  categoryFilter,
  onToggleCategory,
  onClearCategories,
  unclaimedOnly,
  hideBlocked,
  onToggleUnclaimed,
  onToggleHideBlocked,
  viewer,
  actions,
}) {
  const rf = useReactFlow();
  const reducedMotion = useReducedMotion();
  const liteFx =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('tf-lite-fx');
  const instant = Boolean(reducedMotion || liteFx);

  const [expanded, setExpanded] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [showDone, setShowDone] = useState({});
  // Finished tasks are hidden by default; remembered per browser
  const [showCompleted, setShowCompleted] = useState(() => {
    try {
      return window.localStorage.getItem(SHOW_COMPLETED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [selectedId, setSelectedId] = useState(null);
  const [focusKey, setFocusKey] = useState(null);

  const wrapperRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const pendingFocus = useRef(null);
  /** Camera move to make after the next layout: { open: id } | { level } */
  const pendingView = useRef(null);
  const fitEpicRowsRef = useRef(null);
  const topBarRef = useRef(null);
  const [defaultViewport] = useState(() => ({ x: 24, y: 24, zoom: 1 }));
  // Canvas size decides cards per row (and card size on phones)
  const [canvasW, setCanvasW] = useState(0);
  const [canvasH, setCanvasH] = useState(0);
  const [topBarH, setTopBarH] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Phone breadcrumb: the "…" list of folded middle levels
  const [crumbsOpen, setCrumbsOpen] = useState(false);
  // Below lg the details are a bottom sheet. Opening a branch shows only a
  // small peek bar there, so the sheet does not cover the new cards.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const isPhone = canvasW > 0 && canvasW < PHONE_CANVAS;
  // Space the camera keeps clear: the top bar, and the corner overlays
  // (minimap on desktop, the attribution badge on phones)
  const insets = useMemo(
    () => ({
      top: topBarH,
      bottom:
        (isPhone ? 32 : VIEW_PAD_BOTTOM) +
        (narrow && selectedId && !sheetOpen ? PEEK_H : 0),
    }),
    [topBarH, isPhone, narrow, selectedId, sheetOpen]
  );

  const { roots, byId } = useMemo(() => buildTaskTree(tasks), [tasks]);
  const hasTasks = roots.length > 0;

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return undefined;
    const measure = () => {
      setCanvasW(el.clientWidth || 0);
      setCanvasH(el.clientHeight || 0);
      setNarrow(window.innerWidth < 1024);
      setTopBarH(topBarRef.current?.offsetHeight || 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [hasTasks]);
  const cardSize = useMemo(() => cardSizeFor(canvasW), [canvasW]);
  const perRow = useMemo(() => mapPerRow(canvasW, cardSize), [canvasW, cardSize]);

  // Drop state that points at tasks which no longer exist (board refresh)
  const safeExpanded = useMemo(() => {
    const out = [];
    for (const id of expanded) {
      if (!byId.has(id)) break;
      out.push(id);
    }
    return out;
  }, [expanded, byId]);

  // The folded-crumbs list closes whenever the open path changes
  useEffect(() => setCrumbsOpen(false), [safeExpanded]);

  const completedCount = useMemo(() => {
    let n = 0;
    for (const node of byId.values()) if (isMapTaskDone(node.task)) n += 1;
    return n;
  }, [byId]);

  const toggleShowCompleted = () => {
    setShowCompleted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SHOW_COMPLETED_KEY, next ? '1' : '0');
      } catch {
        /* private mode */
      }
      return next;
    });
  };

  const layout = useMemo(
    () =>
      layoutTaskMap(roots, {
        expanded: safeExpanded,
        revealed,
        showDone,
        showCompleted,
        perRow,
        ...cardSize,
      }),
    [roots, safeExpanded, revealed, showDone, showCompleted, perRow, cardSize]
  );
  const byKey = useMemo(
    () => new Map(layout.nodes.map((n) => [n.key, n])),
    [layout]
  );

  // Board filters highlight on the map: skill and "Unclaimed only" combine,
  // "Hide Blocked Tasks" greys blocked work instead of hiding it
  const filter = useMemo(
    () =>
      boardMapFilter({
        categoryFilter,
        unclaimedOnly: Boolean(unclaimedOnly),
        hideBlocked: Boolean(hideBlocked),
      }),
    [categoryFilter, unclaimedOnly, hideBlocked]
  );
  const highlight = useMemo(
    () => mapFilterHighlight(roots, filter, { showCompleted }),
    [roots, filter, showCompleted]
  );
  const picksTasks = Boolean(filter.matches);

  const isLit = useCallback(
    (n) => {
      if (!highlight) return true;
      if (n.kind === 'task') return Boolean(highlight.get(n.id)?.lit);
      // Pager: lit when any task it stands for is lit
      const parent = byId.get(n.parentId);
      if (!parent) return false;
      const open = parent.children.filter((c) => !isMapTaskDone(c.task));
      const limit = Math.max(
        MAP_PAGE_SIZE,
        Number(revealed[n.parentId]) || MAP_PAGE_SIZE
      );
      const hidden =
        n.kind === 'more'
          ? open.slice(limit)
          : parent.children.filter((c) => isMapTaskDone(c.task));
      return hidden.some((c) => highlight.get(c.id)?.lit);
    },
    [highlight, byId, revealed]
  );

  // The selected task stays selected through board refreshes, even when its
  // card is not currently drawn (e.g. it was just completed and hidden)
  const selectedTree = selectedId ? byId.get(selectedId) || null : null;
  const selectedNode = useMemo(() => {
    if (!selectedTree) return null;
    const drawn = byKey.get(`t:${selectedTree.id}`);
    return (
      drawn || {
        key: `t:${selectedTree.id}`,
        kind: 'task',
        id: selectedTree.id,
        task: selectedTree.task,
        tree: selectedTree,
        depth: selectedTree.depth,
        hasChildren: false,
        expanded: false,
      }
    );
  }, [selectedTree, byKey]);
  const selectedAncestors = useMemo(
    () =>
      selectedTree
        ? mapAncestorIds(byId, selectedTree.id)
            .reverse()
            .map((id) => byId.get(id))
            .filter(Boolean)
        : [],
    [selectedTree, byId]
  );

  const tabbableKey =
    focusKey && byKey.has(focusKey) ? focusKey : layout.nodes[0]?.key || null;

  /** Pan the least amount needed to bring a world-space box into view. */
  const ensureVisible = useCallback(
    (box) => {
      const el = wrapperRef.current;
      if (!el || !box) return;
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (!W || !H) return;
      const { x: vx, y: vy, zoom: z } = rf.getViewport();
      // Box fits: move the least amount. Too big: line up on `anchor`
      // (centred across, at the top going down)
      const shift = (lo, hi, v, size, padStart, padEnd, anchor, centre) => {
        const sLo = lo * z + v;
        const sHi = hi * z + v;
        if (sHi - sLo <= size - padStart - padEnd) {
          if (sLo < padStart) return padStart - sLo;
          if (sHi > size - padEnd) return size - padEnd - sHi;
          return 0;
        }
        const s = anchor * z + v;
        return centre ? size / 2 - s : padStart - s;
      };
      const dx = shift(box.x1, box.x2, vx, W, VIEW_PAD, VIEW_PAD, box.focusX ?? (box.x1 + box.x2) / 2, true);
      const dy = shift(box.y1, box.y2, vy, H, insets.top + VIEW_PAD, insets.bottom, box.y1, false);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      rf.setViewport(
        { x: vx + dx, y: vy + dy, zoom: z },
        { duration: instant ? 0 : PAN_MS }
      );
    },
    [rf, instant, insets]
  );

  const boxFor = useCallback(
    (node) => {
      if (!node) return null;
      // The card plus the band it just opened below it
      const kids = node.expanded
        ? layout.nodes.filter((n) => n.parentId === node.id && n.depth === node.depth + 1)
        : [];
      const all = [node, ...kids];
      return {
        x1: Math.min(...all.map((n) => n.x)),
        x2: Math.max(...all.map((n) => n.x + n.w)),
        y1: node.y,
        y2: Math.max(...all.map((n) => n.y + n.h)),
        focusX: node.x + node.w / 2,
      };
    },
    [layout]
  );

  /**
   * Focus mode: fit a world-space box into the canvas below the top bar,
   * zooming in no further than 100%. A box too tall to fit at a readable
   * zoom is pinned to the top instead, so the opened card stays in sight.
   */
  const focusBox = useCallback(
    (box, duration = instant ? 0 : FOCUS_MS, minZoom = FOCUS_MIN_ZOOM) => {
      const el = wrapperRef.current;
      if (!el || !box) return;
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (!W || !H) return;
      const top = insets.top + VIEW_PAD;
      const availW = W - 2 * VIEW_PAD;
      const availH = H - top - insets.bottom;
      const bw = box.x2 - box.x1;
      const bh = box.y2 - box.y1;
      const zoom = Math.max(
        minZoom,
        Math.min(1, availW / bw, availH / bh)
      );
      const x = W / 2 - ((box.x1 + box.x2) / 2) * zoom;
      const y =
        bh * zoom <= availH
          ? top + (availH - bh * zoom) / 2 - box.y1 * zoom
          : top - box.y1 * zoom;
      rf.setViewport({ x, y, zoom }, { duration });
    },
    [rf, instant, insets]
  );

  /** Level 0 = all Epics; level n = the open card at depth n-1 and its band. */
  const focusLevel = useCallback(
    (level, open = safeExpanded, duration) => {
      if (level <= 0) {
        fitEpicRowsRef.current?.(duration ?? (instant ? 0 : FOCUS_MS));
        return;
      }
      const parent = byKey.get(`t:${open[level - 1]}`);
      if (parent) focusBox(boxFor(parent), duration);
    },
    [byKey, boxFor, focusBox, safeExpanded, instant]
  );

  // After a branch opens or closes, move the camera (cards only move by the
  // row shift the layout makes): opening fits the card and its new band,
  // closing goes back to the level the card is in
  useEffect(() => {
    const next = pendingView.current;
    if (!next) return;
    pendingView.current = null;
    if (next.open) focusBox(boxFor(byKey.get(`t:${next.open}`)));
    else focusLevel(next.level);
  }, [layout, byKey, boxFor, focusBox, focusLevel]);

  /** Close every level below `level` and zoom back to it. */
  const goToLevel = useCallback(
    (level) => {
      if (level >= safeExpanded.length) {
        focusLevel(safeExpanded.length);
        return;
      }
      pendingView.current = { level };
      setExpanded(safeExpanded.slice(0, level));
    },
    [safeExpanded, focusLevel]
  );
  const goBack = useCallback(() => {
    if (safeExpanded.length) goToLevel(safeExpanded.length - 1);
  }, [safeExpanded, goToLevel]);

  const registerRef = useCallback((key, el) => {
    if (el) nodeRefs.current.set(key, el);
    else nodeRefs.current.delete(key);
  }, []);

  const focusNode = useCallback((key) => {
    setFocusKey(key);
    const el = nodeRefs.current.get(key);
    if (el) el.focus({ preventScroll: true });
    else pendingFocus.current = key;
  }, []);

  // Focus a node that only exists after the next layout (e.g. first child)
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    const el = nodeRefs.current.get(key);
    if (el) {
      pendingFocus.current = null;
      el.focus({ preventScroll: true });
    }
  }, [layout]);

  const onFocusNode = useCallback(
    (key) => {
      setFocusKey(key);
      const n = byKey.get(key);
      if (n) ensureVisible({ x1: n.x, x2: n.x + n.w, y1: n.y, y2: n.y + n.h });
    },
    [byKey, ensureVisible]
  );

  const toggle = useCallback((node) => {
    pendingView.current = node.expanded
      ? { level: node.depth } // closing: back to the level it sits in
      : { open: node.id };
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
      setSheetOpen(!node.hasChildren);
      if (node.hasChildren) toggle(node);
    },
    [toggle]
  );

  const onKeyDown = useCallback(
    (e, node) => {
      // Top-down map: Left/Right move along a band (in reading order, across
      // wrapped rows), Down opens a branch or steps into it, Up closes it or
      // steps back to the parent
      const band = () =>
        layout.nodes
          .filter((n) => n.depth === node.depth)
          .sort((a, b) => a.posInSet - b.posInSet);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const list = band();
        const i = list.findIndex((n) => n.key === node.key);
        const next = list[i + (e.key === 'ArrowRight' ? 1 : -1)];
        if (next) focusNode(next.key);
      } else if (e.key === 'ArrowDown') {
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
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (node.kind === 'task' && node.expanded) {
          toggle(node);
        } else if (node.parentId) {
          focusNode(`t:${node.parentId}`);
        }
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const list = band();
        const target = e.key === 'Home' ? list[0] : list[list.length - 1];
        if (target) focusNode(target.key);
      }
      // Escape is handled by the canvas: up one level
    },
    [layout, focusNode, toggle]
  );

  const frame = useTweenedPositions(layout, instant);

  const rfNodes = useMemo(
    () =>
      layout.nodes.map((n) => {
        const parent = n.parentId ? frame.get(`t:${n.parentId}`) : null;
        const pos =
          frame.get(n.key) ||
          (parent ? { x: parent.x, y: parent.y, o: 0 } : { x: n.x, y: n.y, o: 0 });
        const lit = isLit(n);
        const info = highlight && n.kind === 'task' ? highlight.get(n.id) : null;
        const insideLabel =
          picksTasks && info && info.inside > 0 && !n.expanded
            ? insidePhrase(info.inside, categoryFilter, unclaimedOnly)
            : null;
        return {
          id: n.key,
          type: n.kind === 'task' ? 'task' : 'pager',
          position: { x: pos.x, y: pos.y },
          width: n.w,
          height: n.h,
          draggable: false,
          selectable: false,
          connectable: false,
          focusable: false,
          // React Flow turns pointer events off for nodes that are neither
          // selectable nor draggable; the cards are buttons, so keep them on
          style: { opacity: pos.o, pointerEvents: 'all' },
          data: {
            node: n,
            selected: n.kind === 'task' && n.id === selectedId,
            tabbable: n.key === tabbableKey,
            dim: !lit,
            insideLabel,
            activate,
            onKeyDown,
            onFocusNode,
            registerRef,
          },
        };
      }),
    [
      layout,
      frame,
      isLit,
      highlight,
      picksTasks,
      categoryFilter,
      unclaimedOnly,
      selectedId,
      tabbableKey,
      activate,
      onKeyDown,
      onFocusNode,
      registerRef,
    ]
  );

  const rfEdges = useMemo(() => {
    const out = layout.edges.map((edge) => {
      const child = byKey.get(edge.toKey);
      const lit = child ? isLit(child) : false;
      const stroke = !lit
        ? DIM_STROKE
        : child.kind === 'task'
          ? STATE_STYLES[mapTaskState(child.task)].stroke
          : 'rgb(255 255 255 / 0.25)';
      return {
        id: edge.key,
        source: edge.fromKey,
        target: edge.toKey,
        type: 'route',
        data: { route: edge.route },
        focusable: false,
        selectable: false,
        zIndex: lit ? 1 : 0,
        style: {
          stroke,
          strokeWidth: highlight && lit ? 2.75 : 2,
          opacity: frame.get(edge.toKey)?.o ?? 0,
        },
        lit,
      };
    });
    // Lines share the bus above a band: draw grey ones first so the lit
    // path stays on top
    return out.sort((a, b) => Number(a.lit) - Number(b.lit));
  }, [layout, byKey, isLit, highlight, frame]);

  const miniColor = useCallback(
    (rfNode) => {
      const n = rfNode.data?.node;
      if (!n || rfNode.data.dim) return DIM_MINI;
      return n.kind === 'task'
        ? STATE_STYLES[mapTaskState(n.task)].mini
        : 'rgb(255 255 255 / 0.25)';
    },
    []
  );

  /** Frame the first rows of Epics (not the whole tree) so text is readable. */
  const fitEpicRows = useCallback(
    (duration = 0) => {
      const el = wrapperRef.current;
      const epics = layout.nodes.filter((n) => n.depth === 0 && n.row < FIT_EPIC_ROWS);
      if (!el || !epics.length || !el.clientWidth || !el.clientHeight) return;
      const W = el.clientWidth;
      const H = el.clientHeight;
      const x1 = Math.min(...epics.map((n) => n.x));
      const x2 = Math.max(...epics.map((n) => n.x + n.w));
      const y1 = Math.min(...epics.map((n) => n.y));
      const y2 = Math.max(...epics.map((n) => n.y + n.h));
      const zoom = Math.max(
        ZOOM_MIN,
        Math.min(1, (W - 2 * VIEW_PAD) / (x2 - x1), (H - insets.top - VIEW_PAD - insets.bottom) / (y2 - y1))
      );
      // Centred across, pinned to the top (not floating mid-canvas)
      rf.setViewport(
        { x: (W - (x2 - x1) * zoom) / 2 - x1 * zoom, y: insets.top + VIEW_PAD - y1 * zoom, zoom },
        { duration }
      );
    },
    [rf, layout, insets]
  );
  fitEpicRowsRef.current = fitEpicRows;
  // First load (and when the canvas is measured): frame the Epic rows once
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || !canvasW || !layout.nodes.length) return;
    didFit.current = true;
    fitEpicRows(0);
  }, [canvasW, layout, fitEpicRows]);

  const collapseAll = () => {
    setRevealed({});
    setShowDone({});
    setSelectedId(null);
    if (safeExpanded.length) {
      pendingView.current = { level: 0 };
      setExpanded([]);
    } else {
      fitEpicRows(instant ? 0 : FOCUS_MS);
    }
  };
  /** Zoom button: the whole map as it is drawn now. */
  const fitAll = () => {
    if (!layout.nodes.length) return;
    focusBox(
      {
        x1: Math.min(...layout.nodes.map((n) => n.x)),
        x2: Math.max(...layout.nodes.map((n) => n.x + n.w)),
        y1: Math.min(...layout.nodes.map((n) => n.y)),
        y2: Math.max(...layout.nodes.map((n) => n.y + n.h)),
      },
      instant ? 0 : FOCUS_MS,
      ZOOM_MIN
    );
  };

  // Breadcrumb: All Epics › open Epic › open Medium
  const crumbs = useMemo(
    () => [
      'All Epics',
      ...safeExpanded.map((id) => byId.get(id)?.task?.title || 'Task'),
    ],
    [safeExpanded, byId]
  );

  // Filter hint: lit Epics the camera cannot see right now
  const transform = useStore((s) => s.transform);
  const hint = useMemo(() => {
    if (!picksTasks || !highlight || !canvasW || !canvasH) return null;
    const [tx, ty, z] = transform;
    const onScreen = (n) =>
      (n.x + n.w) * z + tx > 0 &&
      n.x * z + tx < canvasW &&
      (n.y + n.h) * z + ty > insets.top &&
      n.y * z + ty < canvasH;
    const others = layout.nodes.filter(
      (n) =>
        n.depth === 0 &&
        n.kind === 'task' &&
        n.id !== safeExpanded[0] &&
        highlight.get(n.id)?.lit &&
        !onScreen(n)
    );
    if (!others.length) return null;
    const words = [];
    if (unclaimedOnly) words.push('unclaimed');
    if (categoryFilter.length === 1) words.push(categoryFilter[0]);
    else if (categoryFilter.length > 1) words.push('matching');
    const n = others.length;
    return {
      text: `${n} other Epic${n === 1 ? '' : 's'} ${n === 1 ? 'has' : 'have'} ${words.join(' ')} work`,
      first: others[0],
    };
  }, [
    picksTasks,
    highlight,
    canvasW,
    canvasH,
    transform,
    insets,
    layout,
    safeExpanded,
    unclaimedOnly,
    categoryFilter,
  ]);
  const showHint = () => {
    if (!hint) return;
    if (safeExpanded.length) goToLevel(0);
    else {
      const n = hint.first;
      ensureVisible({ x1: n.x, x2: n.x + n.w, y1: n.y, y2: n.y + n.h });
    }
  };

  // The top bar's height decides where the camera may put cards
  // (crumbs, the hint and the phone filter chips change its height)
  const hintText = hint?.text || '';
  useLayoutEffect(() => {
    setTopBarH(topBarRef.current?.offsetHeight || 0);
  }, [crumbs, hintText, categoryFilter, unclaimedOnly, hideBlocked, canvasW]);

  const viewerProps = { isModerator: false, ...viewer };
  const panelActions = {
    onOpenTask,
    onClaim: noop,
    onRequestJoin: noop,
    onSubmitForReview: onOpenTask,
    onAddChild: noop,
    onEdit: noop,
    onDuplicate: noop,
    onMoveToStaging: noop,
    ...actions,
    onToggle: toggle,
  };

  if (!roots.length) {
    return (
      <div className="space-y-3">
        {viewerProps.isModerator && actions?.onAddEpic ? (
          <button
            type="button"
            onClick={actions.onAddEpic}
            className="inline-flex items-center gap-1.5 rounded-md border border-forge-gold/50 bg-forge-gold/10 px-3 py-1.5 text-xs font-semibold text-forge-gold hover:bg-forge-gold/20"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add Epic
          </button>
        ) : null}
        <p className="rounded-xl border border-cyber-border bg-cyber-surface/40 px-4 py-10 text-center text-sm text-text-muted">
          No tasks on this board yet.
        </p>
      </div>
    );
  }

  // 44px tap targets on phones, compact from sm up
  const ctrlBtn =
    'inline-flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:bg-white/5 hover:text-white sm:h-8 sm:w-8';
  const toolBtn = 'min-h-11 sm:min-h-0';
  const pill =
    'pointer-events-auto rounded-lg border border-cyber-border bg-cyber-surface/95 shadow-lg backdrop-blur-sm';

  // Active filters as chips (phone bar), each removable
  const activeChips = [
    ...categoryFilter.map((cat) => ({
      key: `c:${cat}`,
      label: cat,
      clear: () => onToggleCategory?.(cat),
    })),
    unclaimedOnly
      ? { key: 'u', label: 'Unclaimed', clear: () => onToggleUnclaimed?.() }
      : null,
    hideBlocked
      ? { key: 'b', label: 'Blocked greyed', clear: () => onToggleHideBlocked?.() }
      : null,
  ].filter(Boolean);

  const legend = (
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
      {highlight && (
        <li className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          <span className="h-2 w-2 rounded-full bg-white/15" />
          Not matching
        </li>
      )}
    </ul>
  );

  const viewButtons = (
    <>
      {viewerProps.isModerator && actions?.onAddEpic ? (
        <button
          type="button"
          onClick={actions.onAddEpic}
          className={`${toolBtn} inline-flex items-center gap-1.5 rounded-md border border-forge-gold/50 bg-forge-gold/10 px-2.5 py-1.5 text-xs font-semibold text-forge-gold hover:bg-forge-gold/20`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Epic
        </button>
      ) : null}
      {completedCount > 0 && (
        <button
          type="button"
          onClick={toggleShowCompleted}
          aria-pressed={showCompleted}
          className={`${toolBtn} inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
            showCompleted
              ? 'border-semantic-success/50 bg-semantic-success/10 text-white'
              : 'border-cyber-border text-text-secondary hover:text-white'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {showCompleted ? 'Hide' : 'Show'} completed ({completedCount})
        </button>
      )}
      <button
        type="button"
        onClick={collapseAll}
        className={`${toolBtn} inline-flex items-center gap-1.5 rounded-md border border-cyber-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-white`}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Reset
      </button>
    </>
  );

  const toggleChip = (on) =>
    `min-h-11 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-colors ${
      on
        ? 'bg-semantic-achievement/15 text-semantic-achievement border-semantic-achievement/50'
        : 'bg-transparent text-text-muted border-cyber-border'
    }`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 overflow-hidden rounded-xl border border-cyber-border bg-cyber-surface/40">
        {/* Toolbar (sm and up): skill highlight, legend, view options.
            Phones get the compact filter bar inside the canvas instead. */}
        <div className="hidden space-y-2.5 border-b border-cyber-border px-3 py-2.5 sm:block sm:px-4">
          {onToggleCategory ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Highlight skill
              </span>
              <TaskCategoryFilter
                size="touch"
                label="Highlight tasks by skill"
                selected={categoryFilter}
                onToggle={onToggleCategory}
                onClear={onClearCategories}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {legend}
            <div className="flex flex-wrap items-center gap-1.5">{viewButtons}</div>
          </div>
        </div>

        {/* Phones: the canvas fills the screen under the fixed 5rem navbar,
            so the page and the canvas never both need to scroll */}
        <div
          ref={wrapperRef}
          data-testid="task-map-viewport"
          className="tf-task-map relative h-[calc(100dvh-5rem)] scroll-mt-20 bg-cyber-bg sm:h-[min(72vh,48rem)] sm:min-h-[26rem]"
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            if (safeExpanded.length) {
              e.preventDefault();
              goBack();
            } else if (selectedId) {
              e.preventDefault();
              setSelectedId(null);
            }
          }}
        >
          <div role="tree" aria-label="Task map" className="h-full w-full">
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              defaultViewport={defaultViewport}
              minZoom={ZOOM_MIN}
              maxZoom={ZOOM_MAX}
              nodesDraggable={false}
              nodesConnectable={false}
              nodesFocusable={false}
              edgesFocusable={false}
              elementsSelectable={false}
              zoomOnDoubleClick={false}
              disableKeyboardA11y
              colorMode="dark"
              // Tapping empty canvas goes up one level
              onPaneClick={goBack}
              // Kept, but out of the cards' way
              attributionPosition="bottom-left"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1.6}
                color="rgb(var(--tf-cyber-border) / 1)"
                bgColor="rgb(var(--tf-cyber-bg) / 1)"
              />
              <MiniMap
                className="!hidden sm:!block"
                ariaLabel="Task map overview"
                pannable
                zoomable
                nodeColor={miniColor}
                nodeStrokeWidth={0}
                nodeBorderRadius={6}
                bgColor="rgb(var(--tf-cyber-surface) / 0.95)"
                maskColor="rgb(0 0 0 / 0.55)"
                style={{
                  border: '1px solid rgb(var(--tf-cyber-border) / 1)',
                  borderRadius: 10,
                  width: MINIMAP_W,
                  height: MINIMAP_H,
                }}
              />
            </ReactFlow>
          </div>

          {/* Top bar over the canvas (outside the tree). Phones: one row with
              Filters, Back, breadcrumb and fit-to-view; a second row only for
              active filter chips and the hint. Desktop: breadcrumb + zoom
              controls, then the hint. The camera keeps cards below it. */}
          <div
            ref={topBarRef}
            // A solid strip, so cards above a focused branch scroll cleanly
            // under it instead of showing through between the controls
            className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-1.5 border-b border-cyber-border/70 bg-cyber-bg/95 p-2 backdrop-blur-sm"
          >
            <div className="flex items-start justify-between gap-1.5">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                aria-haspopup="dialog"
                aria-label={`Filters${activeChips.length ? ` (${activeChips.length})` : ''}`}
                title="Filters"
                className={`${pill} relative inline-flex h-11 w-11 shrink-0 items-center justify-center text-white sm:hidden`}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {activeChips.length > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-cyan px-1 font-mono text-[10px] font-bold text-cyber-bg"
                    aria-hidden="true"
                  >
                    {activeChips.length}
                  </span>
                )}
              </button>

              <nav
                aria-label="Map levels"
                className={`${pill} relative flex min-w-0 flex-1 items-center gap-0.5 p-0.5 sm:flex-initial`}
              >
                {safeExpanded.length > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    aria-label="Back one level"
                    className="inline-flex h-11 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold text-neon-cyan hover:bg-white/5 sm:h-8"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                )}
                <ol className="flex min-w-0 flex-1 items-center gap-0.5">
                  {crumbs.map((label, i) => {
                    const current = i === crumbs.length - 1;
                    // Phones: middle levels fold into "…" so the current
                    // card's name always has room
                    const middle = i > 0 && !current;
                    return (
                      <li
                        key={`${i}-${label}`}
                        className={`items-center gap-0.5 ${
                          current ? 'flex min-w-0 flex-1' : 'flex shrink-0'
                        } ${middle ? 'max-sm:hidden' : ''}`}
                      >
                        {i > 0 && (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                        )}
                        {current && crumbs.length > 2 && (
                          <span className="flex shrink-0 items-center gap-0.5 sm:hidden">
                            <button
                              type="button"
                              onClick={() => setCrumbsOpen((v) => !v)}
                              aria-expanded={crumbsOpen}
                              aria-label="Show all levels"
                              className="inline-flex h-11 min-w-9 items-center justify-center rounded-md px-1.5 text-sm font-bold text-text-secondary hover:bg-white/5"
                            >
                              …
                            </button>
                            <ChevronRight className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => goToLevel(i)}
                          aria-current={current ? 'location' : undefined}
                          title={label}
                          className={`inline-flex min-h-11 items-center rounded-md px-2 text-left text-xs sm:min-h-8 ${
                            current
                              ? // never truncated: long names wrap instead
                                'min-w-0 break-words py-1 font-semibold leading-tight text-white'
                              : 'max-w-[9rem] text-text-secondary hover:bg-white/5 hover:text-white sm:max-w-[14rem]'
                          }`}
                        >
                          <span className={current ? '' : 'truncate'}>{label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {/* Phones: pinch zooms, so only fit-to-view stays */}
                <button
                  type="button"
                  aria-label="Fit to view"
                  title="Fit to view"
                  className={`${ctrlBtn} sm:hidden`}
                  onClick={fitAll}
                >
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                </button>

                {crumbsOpen && crumbs.length > 2 && (
                  <ul
                    aria-label="All levels"
                    className="absolute left-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-cyber-border bg-cyber-surface p-1 shadow-xl sm:hidden"
                  >
                    {crumbs.slice(0, -1).map((label, i) => (
                      <li key={`all-${i}-${label}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setCrumbsOpen(false);
                            goToLevel(i);
                          }}
                          className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-text-secondary hover:bg-white/5 hover:text-white"
                          style={{ paddingLeft: 12 + i * 12 }}
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </nav>

              {/* Desktop zoom controls: top-right corner, clear of the cards */}
              <div className={`${pill} hidden shrink-0 items-center p-0.5 sm:flex`}>
                <button
                  type="button"
                  aria-label="Zoom out"
                  className={ctrlBtn}
                  onClick={() => rf.zoomOut({ duration: instant ? 0 : 200 })}
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <ZoomReadout />
                <button
                  type="button"
                  aria-label="Zoom in"
                  className={ctrlBtn}
                  onClick={() => rf.zoomIn({ duration: instant ? 0 : 200 })}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Fit to view"
                  title="Fit to view"
                  className={ctrlBtn}
                  onClick={fitAll}
                >
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {(activeChips.length > 0 || hint) && (
              <div
                className={`pointer-events-auto flex items-center gap-1.5 overflow-x-auto ${
                  hint ? "" : "sm:hidden"
                }`}
              >
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    aria-label={`Remove ${chip.label} filter`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-neon-cyan/50 bg-cyber-surface/95 px-3 text-xs font-semibold text-neon-cyan sm:hidden"
                  >
                    {chip.label}
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ))}
                {hint && (
                  <button
                    type="button"
                    onClick={showHint}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-neon-cyan/50 bg-cyber-surface/95 px-3 text-xs font-semibold text-neon-cyan shadow-lg sm:min-h-8"
                  >
                    {hint.text}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          {layout.nodes.length === 0 && (
            <p className="absolute inset-x-0 top-28 z-10 px-6 text-center text-sm text-text-muted">
              Every task on this board is completed.{' '}
              <button
                type="button"
                onClick={toggleShowCompleted}
                className="text-neon-cyan hover:underline"
              >
                Show completed tasks
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Phone filter sheet: the toolbar's filters, legend and view options */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[70] sm:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/60"
            onClick={() => setFiltersOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Map filters"
            className="absolute inset-x-0 bottom-0 max-h-[80vh] space-y-4 overflow-y-auto rounded-t-2xl border-t border-neon-cyan/40 bg-cyber-surface p-4 pb-6"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setFiltersOpen(false);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-widest text-neon-cyan">
                Filters
              </h3>
              <button
                type="button"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                onClick={() => setFiltersOpen(false)}
                className="min-h-11 rounded-lg border border-neon-cyan bg-neon-cyan/15 px-4 text-sm font-semibold text-neon-cyan"
              >
                Done
              </button>
            </div>
            {onToggleCategory ? (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Highlight skill
                </p>
                <TaskCategoryFilter
                  size="touch"
                  label="Highlight tasks by skill"
                  selected={categoryFilter}
                  onToggle={onToggleCategory}
                  onClear={onClearCategories}
                />
              </div>
            ) : null}
            {(onToggleUnclaimed || onToggleHideBlocked) && (
              <div className="flex flex-wrap gap-2">
                {onToggleUnclaimed && (
                  <button
                    type="button"
                    aria-pressed={Boolean(unclaimedOnly)}
                    onClick={onToggleUnclaimed}
                    className={toggleChip(unclaimedOnly)}
                  >
                    Unclaimed only
                  </button>
                )}
                {onToggleHideBlocked && (
                  <button
                    type="button"
                    aria-pressed={Boolean(hideBlocked)}
                    onClick={onToggleHideBlocked}
                    className={toggleChip(hideBlocked)}
                  >
                    Hide Blocked Tasks
                  </button>
                )}
              </div>
            )}
            {legend}
            <div className="flex flex-wrap items-center gap-1.5">{viewButtons}</div>
          </div>
        </div>
      )}

      {/* Below lg, with a branch just opened: a peek bar instead of the
          full sheet, so the new cards stay visible */}
      {selectedNode && !sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center gap-2 border-t border-neon-cyan/40 bg-cyber-surface px-3 py-2.5 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] lg:hidden">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            {selectedNode.task.title}
          </p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-neon-cyan bg-neon-cyan/15 px-3 text-sm font-semibold text-neon-cyan"
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="Close details"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-cyber-border text-text-secondary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Details: beside the canvas on desktop, a bottom sheet on phones */}
      <aside
        aria-label="Selected task"
        className={
          selectedNode && !sheetOpen
            ? 'hidden rounded-xl border border-cyber-border bg-cyber-surface/40 p-4 lg:sticky lg:top-24 lg:block lg:self-start'
            : selectedNode
            ? 'fixed inset-x-0 bottom-0 z-[60] max-h-[55vh] overflow-y-auto rounded-t-2xl border-t border-neon-cyan/40 bg-cyber-surface p-4 pb-6 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] lg:static lg:z-auto lg:max-h-[calc(100vh-7rem)] lg:rounded-xl lg:border lg:border-cyber-border lg:bg-cyber-surface/40 lg:pb-4 lg:shadow-none lg:sticky lg:top-24 lg:self-start'
            : 'hidden rounded-xl border border-cyber-border bg-cyber-surface/40 p-4 lg:sticky lg:top-24 lg:block lg:self-start'
        }
      >
        <div aria-live="polite">
          <TaskMapPanel
            node={selectedNode}
            ancestors={selectedAncestors}
            viewer={viewerProps}
            actions={panelActions}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </aside>
    </div>
  );
}

/**
 * @param {{
 *   tasks: object[],
 *   onOpenTask: (id: string) => void,
 *   categoryFilter?: string[],
 *   onToggleCategory?: (cat: string) => void,
 *   onClearCategories?: () => void,
 *   unclaimedOnly?: boolean,
 *   hideBlocked?: boolean,
 *   onToggleUnclaimed?: () => void,
 *   onToggleHideBlocked?: () => void,
 *   viewer?: { userId?: string|null, isModerator?: boolean, claimingId?: string|null, joiningId?: string|null, unpublishingId?: string|null, pendingJoinTaskIds?: Set<string> },
 *   actions?: { onClaim?, onRequestJoin?, onSubmitForReview?, onAddEpic?, onAddChild?, onEdit?, onDuplicate?, onMoveToStaging? },
 * }} props
 */
export default function TaskMap({
  categoryFilter = NO_CATEGORIES,
  onClearCategories = noop,
  viewer = {},
  actions = {},
  ...rest
}) {
  return (
    <ReactFlowProvider>
      <TaskMapCanvas
        categoryFilter={categoryFilter}
        onClearCategories={onClearCategories}
        viewer={viewer}
        actions={actions}
        {...rest}
      />
    </ReactFlowProvider>
  );
}
