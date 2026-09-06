import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import TaskCard from './TaskCard';
import {
  countCompletedDescendants,
  groupCompletedTaskForest,
} from '../../services/tasksService';

function CompletedNode({
  task,
  childrenOf,
  depth,
  expandedIds,
  onToggle,
  cardProps,
}) {
  const kids = childrenOf.get(task.id) || [];
  const hasKids = kids.length > 0;
  const open = expandedIds.has(task.id);
  const nestedCount = hasKids
    ? countCompletedDescendants(task.id, childrenOf)
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-1.5">
        {hasKids ? (
          <button
            type="button"
            className="shrink-0 mt-4 p-1 rounded text-text-muted hover:text-white"
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
        ) : (
          <span className="w-6 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1" id={`task-${task.id}`}>
          <TaskCard
            task={task}
            indentByDepth={false}
            {...cardProps}
            movingToStaging={cardProps.unpublishingId === task.id}
          />
          {hasKids && !open ? (
            <button
              type="button"
              className="mt-1.5 text-[10px] font-mono text-text-muted hover:text-white"
              onClick={() => onToggle(task.id)}
            >
              Show {nestedCount} nested completed
            </button>
          ) : null}
        </div>
      </div>
      {hasKids && open ? (
        <div
          className={`space-y-2 ${
            depth === 0 ? 'pl-6 sm:pl-8' : 'pl-4 sm:pl-6'
          }`}
        >
          {kids.map((child) => (
            <CompletedNode
              key={child.id}
              task={child}
              childrenOf={childrenOf}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              cardProps={cardProps}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Completed column: Epics (and Mediums) wrap their completed children
 * and start collapsed so the list stays scannable.
 */
const CompletedTaskTree = ({ tasks = [], cardProps = {} }) => {
  const { roots, childrenOf } = groupCompletedTaskForest(tasks);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapsibleIds = [...childrenOf.keys()].filter(
    (id) => (childrenOf.get(id) || []).length > 0
  );
  const allCollapsed =
    collapsibleIds.length > 0 &&
    collapsibleIds.every((id) => !expandedIds.has(id));

  if (roots.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-8 px-2">
        No completed tasks yet. Accepted work appears here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {collapsibleIds.length > 0 ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-[11px] font-mono text-text-muted hover:text-white"
            onClick={() =>
              setExpandedIds(allCollapsed ? new Set(collapsibleIds) : new Set())
            }
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      ) : null}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
        {roots.map((task) => (
          <CompletedNode
            key={task.id}
            task={task}
            childrenOf={childrenOf}
            depth={0}
            expandedIds={expandedIds}
            onToggle={toggle}
            cardProps={cardProps}
          />
        ))}
      </div>
    </div>
  );
};

export default CompletedTaskTree;
