/**
 * Focused tree for a single Epic workstream: Epic → Medium → Small.
 * Unrelated Epics are never shown. Current task is highlighted.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Badge from './Badge';
import { getChildTasks, taskLevelShort } from '../../services/tasksService';

function statusHint(task) {
  if (
    task.status === 'completed' ||
    task.dbStatus === 'Completed' ||
    task.isFullyDone
  ) {
    return { label: 'Done', variant: 'success' };
  }
  if (task.readyForParentReview || task.allChildrenCompleted) {
    return { label: 'Ready', variant: 'warning' };
  }
  if (
    task.claim?.status === 'PendingReview' ||
    task.status === 'in_review' ||
    task.dbStatus === 'InReview'
  ) {
    return { label: 'Review', variant: 'warning' };
  }
  if (
    task.claim?.status === 'Active' ||
    task.status === 'in_progress' ||
    task.dbStatus === 'InProgress'
  ) {
    return { label: 'Active', variant: 'purple' };
  }
  return null;
}

function levelBadgeVariant(depth) {
  if (depth === 0) return 'gold';
  if (depth === 1) return 'neon';
  return 'default';
}

function buildChildrenOf(allTasks, rootId) {
  const childrenOf = new Map();
  const visit = (id) => {
    const kids = getChildTasks(allTasks, id).sort((a, b) =>
      String(a.title || '').localeCompare(String(b.title || ''))
    );
    childrenOf.set(id, kids);
    for (const k of kids) visit(k.id);
  };
  visit(rootId);
  return childrenOf;
}

/**
 * @param {object} props
 * @param {object} props.epicRoot - root epic (or orphan top task)
 * @param {Array} props.tasks - full project task list (enriched)
 * @param {string} props.currentTaskId
 * @param {(id: string) => void} props.onSelectTask
 * @param {string[]} [props.forceExpandIds] - ancestor path to keep expanded
 */
const EpicBranchTree = ({
  epicRoot,
  tasks = [],
  currentTaskId,
  onSelectTask,
  forceExpandIds = [],
}) => {
  const rootId = epicRoot?.id;
  const childrenOf = useMemo(() => {
    if (!rootId) return new Map();
    return buildChildrenOf(tasks, rootId);
  }, [tasks, rootId]);

  const expandKey = forceExpandIds.join('|');
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  // Expand path to current task + epic root when selection/epic changes
  useEffect(() => {
    if (!rootId) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(rootId);
      for (const id of forceExpandIds) {
        if (id) next.add(id);
      }
      return next;
    });
    // forceExpandIds is mirrored by expandKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, currentTaskId, expandKey]);

  const toggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!epicRoot) return null;

  const renderNode = (task, depth) => {
    const kids = childrenOf.get(task.id) || [];
    const hasKids = kids.length > 0;
    const isOpen = expandedIds.has(task.id);
    const isCurrent = String(task.id) === String(currentTaskId);
    const depthNum =
      typeof task.depth === 'number' ? task.depth : depth;
    const level = task.levelShort || taskLevelShort(depthNum);
    const hint = statusHint(task);
    const pad = Math.min(depthNum, 2) * 12;

    return (
      <li key={task.id} className="list-none">
        <div
          className={`flex items-stretch gap-0.5 rounded-lg transition-colors ${
            isCurrent
              ? 'bg-neon-cyan/15 ring-1 ring-neon-cyan/55 shadow-[0_0_20px_rgba(0,249,255,0.08)]'
              : 'hover:bg-white/[0.04]'
          }`}
          style={{ paddingLeft: pad }}
        >
          {hasKids ? (
            <button
              type="button"
              className="shrink-0 px-1.5 text-text-muted hover:text-white self-center"
              aria-expanded={isOpen}
              aria-label={
                isOpen ? `Collapse ${task.title}` : `Expand ${task.title}`
              }
              onClick={(e) => {
                e.stopPropagation();
                toggle(task.id);
              }}
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span
              className="w-7 shrink-0 flex items-center justify-center text-text-muted/40 text-xs self-center"
              aria-hidden
            >
              ·
            </span>
          )}

          <button
            type="button"
            onClick={() => onSelectTask?.(task.id)}
            className="flex-1 min-w-0 text-left flex flex-wrap items-center gap-1.5 py-2 pr-2"
            aria-current={isCurrent ? 'true' : undefined}
          >
            <Badge
              variant={levelBadgeVariant(depthNum)}
              className="!normal-case tracking-wide shrink-0 !px-2 !py-0.5 text-[10px]"
            >
              {level}
            </Badge>
            <span
              className={`min-w-0 truncate text-sm ${
                depthNum === 0
                  ? 'font-bold'
                  : depthNum === 1
                    ? 'font-semibold'
                    : 'font-medium'
              } ${isCurrent ? 'text-neon-cyan' : 'text-white'}`}
            >
              {task.title}
            </span>
            {hint && (
              <Badge
                variant={hint.variant}
                className="!normal-case tracking-wide shrink-0 !px-2 !py-0.5 text-[10px]"
              >
                {hint.label}
              </Badge>
            )}
            {isCurrent && (
              <span className="text-[10px] font-mono tracking-widest text-neon-cyan uppercase shrink-0">
                Viewing
              </span>
            )}
          </button>
        </div>

        {hasKids && isOpen && (
          <ul className="mt-0.5 space-y-0.5">
            {kids.map((child) => renderNode(child, depthNum + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div
      className="rounded-xl border border-cyber-border bg-cyber-surface/60 overflow-hidden"
      aria-label={`${epicRoot.title} workstream tree`}
    >
      <div className="px-3 py-2 border-b border-cyber-border">
        <p className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
          Epic workstream
        </p>
      </div>
      <ul className="p-2 space-y-0.5 max-h-[min(40vh,22rem)] overflow-y-auto task-scroll">
        {renderNode(epicRoot, 0)}
      </ul>
    </div>
  );
};

export default EpicBranchTree;
