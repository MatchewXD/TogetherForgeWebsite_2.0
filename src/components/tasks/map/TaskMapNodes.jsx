/**
 * Task Map canvas nodes (React Flow custom nodes).
 *
 * Each node is one button with role="treeitem" so the map keeps working with
 * the keyboard and screen readers. The hidden handles are only anchor points
 * for the connector lines; nodes cannot be dragged or connected.
 */

import { memo } from 'react';
import { BaseEdge, Handle, Position } from '@xyflow/react';
import { CheckCircle2, ChevronRight, Lock, Plus } from 'lucide-react';
import {
  MAP_PAGE_SIZE,
  isMapBranchFinished,
  mapEdgePath,
  mapEdgePoints,
  mapNodeProgress,
  mapNodeSummary,
  mapTaskState,
} from '../../../utils/taskMapLayout';
import TaskCategoryBadge from '../../ui/TaskCategoryBadge';
import { STATE_STYLES } from './taskMapStyles';

/** Short level names, so the category badge always fits beside them. */
const LEVEL_SHORT = ['Epic', 'Medium', 'Small'];

const HANDLE_STYLE = {
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 0,
  pointerEvents: 'none',
};

function Anchors() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={HANDLE_STYLE}
      />
    </>
  );
}

function ProgressBar({ percent, tone }) {
  return (
    <span
      className="block h-1.5 w-full overflow-hidden rounded-full bg-white/10"
      aria-hidden="true"
    >
      <span className={`block h-full ${tone}`} style={{ width: `${percent}%` }} />
    </span>
  );
}

function a11yProps(node, data) {
  return {
    role: 'treeitem',
    'aria-level': node.depth + 1,
    'aria-posinset': node.posInSet,
    'aria-setsize': node.setSize,
    'data-map-node': '',
    ref: (el) => data.registerRef(node.key, el),
    tabIndex: data.tabbable ? 0 : -1,
    onClick: () => data.activate(node),
    onKeyDown: (e) => data.onKeyDown(e, node),
    onFocus: () => data.onFocusNode(node.key),
  };
}

function TaskNodeView({ data }) {
  const { node, selected, dim, insideLabel } = data;
  const state = mapTaskState(node.task);
  const style = STATE_STYLES[state];
  const percent = mapNodeProgress(node.tree);
  const isEpic = node.depth === 0;
  const summary = mapNodeSummary(node.tree);
  // Fully finished branches fade back so attention goes to remaining work
  const finished = isMapBranchFinished(node.tree);

  return (
    <>
      <Anchors />
      <button
        type="button"
        {...a11yProps(node, data)}
        data-task-id={node.id}
        data-dim={dim ? 'true' : undefined}
        data-finished={finished ? 'true' : undefined}
        aria-selected={selected}
        aria-expanded={node.hasChildren ? node.expanded : undefined}
        className={`tf-map-card group relative flex h-full w-full flex-col justify-between gap-1 overflow-hidden rounded-xl border pl-4 pr-3 py-2.5 text-left transition-[box-shadow,opacity,filter] duration-200 ${
          dim
            ? 'border-white/10 bg-cyber-card/70 opacity-45 grayscale'
            : `${style.border} bg-cyber-card`
        } ${
          selected
            ? 'ring-2 ring-neon-cyan shadow-[0_0_28px_rgba(0,249,255,0.22)] !opacity-100'
            : 'shadow-[0_6px_18px_rgba(0,0,0,0.45)] hover:shadow-[0_0_20px_rgba(0,249,255,0.14)]'
        } ${finished && !dim && !selected ? 'opacity-50 hover:opacity-80' : ''}`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-1.5 ${dim ? 'bg-white/15' : style.bar}`}
          aria-hidden="true"
        />
        {/* Level + category. The category name is never cut short: the
            status lives on the footer line, so this line has the room. */}
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {LEVEL_SHORT[Math.min(node.depth, 2)]}
          </span>
          {node.task.category ? (
            <TaskCategoryBadge
              category={node.task.category}
              size="sm"
              className="shrink-0"
            />
          ) : null}
        </span>

        <span className="flex items-center gap-2">
          <span
            className={`min-w-0 flex-1 font-semibold leading-snug text-white line-clamp-2 ${
              isEpic ? 'text-[15px]' : 'text-sm'
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

        <span className="flex flex-col gap-1">
          {summary && !insideLabel ? (
            <ProgressBar percent={percent} tone={dim ? 'bg-white/30' : style.bar} />
          ) : null}
          {/* Footer: status first (always a text label), then the detail */}
          <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px]">
            <span
              className={`inline-flex shrink-0 items-center gap-1 uppercase tracking-widest ${style.text}`}
            >
              {state === 'locked' ? (
                <Lock className="h-3 w-3" aria-hidden="true" />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              )}
              {style.label}
            </span>
            {insideLabel ? (
              <span className="min-w-0 truncate rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-1.5 text-neon-cyan">
                {insideLabel}
              </span>
            ) : (
              <span className="min-w-0 truncate tabular-nums text-text-secondary">
                <span className="text-text-muted" aria-hidden="true">· </span>
                {summary ||
                  (isEpic
                    ? 'No sub-tasks yet'
                    : node.task.claimedBy
                      ? `Claimed by ${node.task.claimedBy}`
                      : 'Unclaimed')}
              </span>
            )}
          </span>
        </span>
      </button>
    </>
  );
}

function PagerNodeView({ data }) {
  const { node } = data;
  const isDone = node.kind === 'done';
  return (
    <>
      <Anchors />
      <button
        type="button"
        {...a11yProps(node, data)}
        aria-selected={false}
        className={`flex h-full w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 bg-cyber-surface/80 px-3 text-xs font-mono tracking-wide text-text-secondary hover:border-neon-cyan/60 hover:text-white ${
          data.dim ? 'opacity-45' : ''
        }`}
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
    </>
  );
}

export const TaskNode = memo(TaskNodeView);
export const PagerNode = memo(PagerNodeView);

/**
 * Connector from a parent's bottom to a child's top along the route the
 * layout chose (down, along the gap above the band, down into the child).
 * Uses React Flow's live end points so it follows cards while they glide.
 */
function RouteEdgeView({ id, sourceX, sourceY, targetX, targetY, data, style }) {
  const points = mapEdgePoints(sourceX, sourceY, targetX, targetY, data?.route);
  return <BaseEdge id={id} path={mapEdgePath(points)} style={style} />;
}

export const RouteEdge = memo(RouteEdgeView);
