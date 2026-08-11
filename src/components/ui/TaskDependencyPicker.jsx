/**
 * Hierarchical multi-select for task "Blocked by" dependencies.
 * Expand epics/mediums and pick individual nested tasks without selecting the parent.
 */

import { useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Badge from './Badge';

function isTaskDone(task) {
  return Boolean(
    task &&
      (task.dbStatus === 'Completed' ||
        task.status === 'completed' ||
        task.isFullyDone)
  );
}

function levelBadgeVariant(depth) {
  if (depth === 0) return 'gold';
  if (depth === 1) return 'neon';
  return 'default';
}

/**
 * @param {object} props
 * @param {Array} props.tasks - full project task list (enriched with hierarchy)
 * @param {string[]} props.selectedIds - currently selected blocker task ids
 * @param {(id: string) => void} props.onToggle - toggle one task id
 * @param {string|null} [props.excludeTaskId] - hide this task (editing self)
 * @param {string} [props.className]
 */
const TaskDependencyPicker = ({
  tasks = [],
  selectedIds = [],
  onToggle,
  excludeTaskId = null,
  className = '',
}) => {
  const selectedSet = useMemo(
    () => new Set((selectedIds || []).filter(Boolean)),
    [selectedIds]
  );

  const { roots, childrenOf, byId } = useMemo(() => {
    const byIdMap = new Map();
    const kids = new Map();

    for (const t of tasks || []) {
      if (!t?.id || t.id === excludeTaskId) continue;
      byIdMap.set(t.id, t);
    }

    for (const t of byIdMap.values()) {
      const parentId = t.parentTaskId;
      if (parentId && byIdMap.has(parentId)) {
        if (!kids.has(parentId)) kids.set(parentId, []);
        kids.get(parentId).push(t);
      }
    }

    for (const arr of kids.values()) {
      arr.sort((a, b) =>
        String(a.title || '').localeCompare(String(b.title || ''))
      );
    }

    // Roots: no parent in the selectable set (orphans under excluded parent rise up)
    const rootList = [...byIdMap.values()]
      .filter((t) => !t.parentTaskId || !byIdMap.has(t.parentTaskId))
      .sort((a, b) =>
        String(a.title || '').localeCompare(String(b.title || ''))
      );

    return { roots: rootList, childrenOf: kids, byId: byIdMap };
  }, [tasks, excludeTaskId]);

  /** Ancestor ids of every selected task (auto-expand so picks stay visible). */
  const selectedAncestors = useMemo(() => {
    const next = new Set();
    for (const id of selectedSet) {
      let cur = byId.get(id);
      let guard = 0;
      while (cur?.parentTaskId && byId.has(cur.parentTaskId) && guard < 10) {
        next.add(cur.parentTaskId);
        cur = byId.get(cur.parentTaskId);
        guard += 1;
      }
    }
    return next;
  }, [selectedSet, byId]);

  const [userExpanded, setUserExpanded] = useState(() => new Set());
  const [userCollapsed, setUserCollapsed] = useState(() => new Set());

  const isExpanded = useCallback(
    (id) => {
      if (userCollapsed.has(id)) return false;
      if (userExpanded.has(id)) return true;
      return selectedAncestors.has(id);
    },
    [userExpanded, userCollapsed, selectedAncestors]
  );

  const handleExpandClick = (id, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isExpanded(id)) {
      setUserCollapsed((prev) => new Set(prev).add(id));
      setUserExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setUserCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setUserExpanded((prev) => new Set(prev).add(id));
    }
  };

  const renderNode = (task, depth = 0) => {
    if (!task?.id) return null;

    const kids = childrenOf.get(task.id) || [];
    const hasKids = kids.length > 0;
    const open = hasKids && isExpanded(task.id);
    const checked = selectedSet.has(task.id);
    const done = isTaskDone(task);
    const depthVal = typeof task.depth === 'number' ? task.depth : depth;
    const levelLabel =
      task.levelShort ||
      (depthVal === 0 ? 'Epic' : depthVal === 1 ? 'Mid' : 'Small');

    return (
      <li key={task.id} className="select-none">
        <div
          className={`flex items-center gap-1.5 py-1.5 pr-2 hover:bg-white/[0.03] ${
            checked ? 'bg-neon-cyan/5' : ''
          }`}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {hasKids ? (
            <button
              type="button"
              onClick={(e) => handleExpandClick(task.id, e)}
              className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
              aria-expanded={open}
              aria-label={
                open ? `Collapse ${task.title}` : `Expand ${task.title}`
              }
              title={
                open
                  ? 'Collapse nested tasks'
                  : 'Open to pick nested tasks without selecting this one'
              }
            >
              {open ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-7 shrink-0" aria-hidden />
          )}

          <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer py-0.5">
            <input
              type="checkbox"
              className="accent-cyan-400 shrink-0"
              checked={checked}
              onChange={() => onToggle?.(task.id)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-sm truncate ${
                    done ? 'text-text-muted' : 'text-text-primary'
                  }`}
                >
                  {task.title}
                </span>
                <Badge
                  variant={levelBadgeVariant(depthVal)}
                  className="!text-[9px] !normal-case !tracking-wide shrink-0"
                >
                  {levelLabel}
                </Badge>
                {done && (
                  <span className="text-[10px] font-mono text-semantic-success/80 shrink-0">
                    Done
                  </span>
                )}
                {task.isLocked && !done && (
                  <span className="text-[10px] font-mono text-text-muted shrink-0">
                    Locked
                  </span>
                )}
              </span>
              {(task.category || hasKids) && (
                <span className="block text-[10px] font-mono text-text-muted mt-0.5">
                  {task.category || ''}
                  {task.category && hasKids ? ' · ' : ''}
                  {hasKids
                    ? `${kids.length} nested · expand to pick one`
                    : ''}
                </span>
              )}
            </span>
          </label>
        </div>

        {hasKids && open && (
          <ul className="border-l border-cyber-border/40 ml-[1.35rem]">
            {kids.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  if (roots.length === 0) {
    return (
      <div
        className={`rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-3 ${className}`}
      >
        <p className="text-xs text-text-muted">
          No other tasks on this board yet. Create blockers first, then link
          them here.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`task-scroll max-h-56 overflow-y-auto rounded-lg border border-cyber-border bg-cyber-surface/50 ${className}`}
    >
      <p className="sticky top-0 z-[1] px-3 py-1.5 text-[10px] font-mono tracking-wide text-text-muted bg-cyber-surface/95 border-b border-cyber-border/60 backdrop-blur-sm">
        Expand a parent to pick nested work · checkbox selects only that task
      </p>
      <ul className="py-1">{roots.map((r) => renderNode(r, 0))}</ul>
    </div>
  );
};

export default TaskDependencyPicker;
