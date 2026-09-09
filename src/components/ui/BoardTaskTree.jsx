/**
 * Nested Epic → Medium → Small list for a board column (or Completed).
 * Children sit under their parent instead of a flat shuffle.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import TaskCard from './TaskCard';
import {
  countCompletedDescendants,
  groupTaskForest,
} from '../../services/tasksService';

function TaskTreeNode({
  task,
  childrenOf,
  depth,
  expandedIds,
  onToggle,
  cardProps,
  nestedLabel,
  layout,
}) {
  const kids = childrenOf.get(task.id) || [];
  const hasKids = kids.length > 0;
  const open = expandedIds.has(task.id);
  const nestedCount = hasKids
    ? countCompletedDescendants(task.id, childrenOf)
    : 0;
  const spanRoot = layout === 'grid' && open && depth === 0;
  const {
    claimingId,
    joiningId,
    pendingJoinTaskIds,
    unpublishingId,
    ...restCardProps
  } = cardProps;

  return (
    <div className={spanRoot ? 'sm:col-span-2 xl:col-span-3' : ''}>
      <div className="flex items-start gap-1.5">
        {hasKids ? (
          <button
            type="button"
            className="shrink-0 mt-3 p-1 rounded text-text-muted hover:text-white"
            aria-expanded={open}
            aria-label={
              open ? `Collapse ${task.title}` : `Expand ${task.title}`
            }
            onClick={() => onToggle(task.id)}
          >
            {open ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : null}
        <div className="min-w-0 flex-1" id={`task-${task.id}`}>
          <TaskCard
            {...restCardProps}
            task={task}
            indentByDepth={false}
            claiming={claimingId === task.id}
            joining={joiningId === task.id}
            joinRequestPending={Boolean(pendingJoinTaskIds?.has?.(task.id))}
            movingToStaging={unpublishingId === task.id}
          />
          {hasKids ? (
            <button
              type="button"
              className="mt-1.5 text-[10px] font-mono text-text-muted hover:text-white"
              onClick={() => onToggle(task.id)}
            >
              {open ? 'Hide' : 'Show'} {nestedCount} {nestedLabel}
            </button>
          ) : null}
        </div>
      </div>
      {hasKids && open ? (
        <div className="mt-2 ml-6 sm:ml-8 space-y-2 border-l border-cyber-border/80 pl-3 sm:pl-4">
          {kids.map((child) => (
            <TaskTreeNode
              key={child.id}
              task={child}
              childrenOf={childrenOf}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              cardProps={cardProps}
              nestedLabel={nestedLabel}
              layout={layout}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {Array} props.tasks tasks to show in this slice
 * @param {Array} [props.allTasks] full board list for ancestor lookup
 * @param {object} [props.cardProps]
 * @param {boolean} [props.defaultExpanded]
 * @param {'stack'|'grid'} [props.layout]
 * @param {string} [props.emptyMessage]
 * @param {string} [props.nestedLabel]
 */
const BoardTaskTree = ({
  tasks = [],
  allTasks,
  cardProps = {},
  defaultExpanded = false,
  layout = 'stack',
  emptyMessage = 'No tasks in this column.',
  nestedLabel = 'nested tasks',
}) => {
  const { roots, childrenOf } = useMemo(
    () => groupTaskForest(tasks, { allTasks }),
    [tasks, allTasks]
  );

  const collapsibleKey = useMemo(
    () =>
      [...childrenOf.keys()]
        .filter((id) => (childrenOf.get(id) || []).length > 0)
        .sort()
        .join('|'),
    [childrenOf]
  );
  const collapsibleIds = useMemo(
    () => (collapsibleKey ? collapsibleKey.split('|') : []),
    [collapsibleKey]
  );

  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [userTouched, setUserTouched] = useState(false);

  useEffect(() => {
    if (userTouched || !defaultExpanded) return;
    setExpandedIds(new Set(collapsibleIds));
  }, [defaultExpanded, collapsibleIds, userTouched]);

  const toggle = (id) => {
    setUserTouched(true);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allCollapsed =
    collapsibleIds.length > 0 &&
    collapsibleIds.every((id) => !expandedIds.has(id));

  if (roots.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-8 px-2">
        {emptyMessage}
      </p>
    );
  }

  const listClass =
    layout === 'grid'
      ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-3 items-start'
      : 'space-y-3';

  return (
    <div className="space-y-3">
      {collapsibleIds.length > 0 ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-[11px] font-mono text-text-muted hover:text-white"
            onClick={() => {
              setUserTouched(true);
              setExpandedIds(
                allCollapsed ? new Set(collapsibleIds) : new Set()
              );
            }}
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      ) : null}
      <div className={listClass}>
        {roots.map((task) => (
          <TaskTreeNode
            key={task.id}
            task={task}
            childrenOf={childrenOf}
            depth={0}
            expandedIds={expandedIds}
            onToggle={toggle}
            cardProps={cardProps}
            nestedLabel={nestedLabel}
            layout={layout}
          />
        ))}
      </div>
    </div>
  );
};

export default BoardTaskTree;
