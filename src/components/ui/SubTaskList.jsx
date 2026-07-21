/**
 * Hierarchical child tasks under a parent (Epic/Medium).
 * Not the jsonb checklist — those remain separate "checklist" items.
 */

import Badge from './Badge';
import Button from './Buttons';
import { taskLevelLabel } from '../../services/tasksService';

const statusLabel = (task) => {
  if (task.status === 'completed' || task.dbStatus === 'Completed') {
    return 'Done';
  }
  if (task.status === 'in_progress' || task.dbStatus === 'InProgress') {
    return 'Active';
  }
  return 'Open';
};

const statusVariant = (task) => {
  if (task.status === 'completed' || task.dbStatus === 'Completed') {
    return 'neon';
  }
  if (task.status === 'in_progress' || task.dbStatus === 'InProgress') {
    return 'purple';
  }
  return 'default';
};

/**
 * @param {object} props
 * @param {Array} props.items - enriched task rows (direct children)
 * @param {function} [props.onOpen] - (taskId) => void
 * @param {function} [props.onAdd] - create sub-task callback
 * @param {boolean} [props.canAdd]
 * @param {boolean} [props.canClaim]
 * @param {function} [props.onClaim]
 * @param {string|null} [props.claimingId]
 * @param {number} [props.parentDepth]
 */
const SubTaskList = ({
  items = [],
  onOpen,
  onAdd,
  canAdd = false,
  canClaim = false,
  onClaim,
  claimingId = null,
  parentDepth = 0,
  /** When true, hide empty-state copy (volunteers never see "No sub-tasks yet") */
  hideEmptyMessage = false,
}) => {
  const childLevel = taskLevelLabel(Math.min(parentDepth + 1, 2));
  const done = items.filter(
    (c) => c.status === 'completed' || c.dbStatus === 'Completed'
  ).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((100 * done) / total) : 0;

  // Nothing to show for empty lists when empty message is hidden and staff cannot add
  if (total === 0 && hideEmptyMessage && !canAdd) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-mono tracking-widest text-neon-cyan">
          SUB-TASKS
          {total > 0 && (
            <span className="text-text-muted font-normal normal-case tracking-normal ml-2">
              {done}/{total} done · {pct}%
            </span>
          )}
        </div>
        {canAdd && onAdd && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            Add {childLevel}
          </Button>
        )}
      </div>

      {total > 0 && (
        <ul className="space-y-2">
          {items.map((child) => {
            const isDone =
              child.status === 'completed' || child.dbStatus === 'Completed';
            const hasActiveClaim =
              child.claim?.status === 'Active' ||
              (Boolean(child.claimedBy) && !isDone);
            const showClaim =
              canClaim &&
              onClaim &&
              child.volunteerClaimable &&
              !hasActiveClaim &&
              !isDone;
            const depth = child.depth ?? parentDepth + 1;
            const accent =
              depth === 1
                ? 'border-l-2 border-l-neon-cyan'
                : 'border-l-2 border-l-white/25';

            return (
              <li
                key={child.id}
                className={`rounded-lg border border-cyber-border bg-cyber-surface/60 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${accent}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen?.(child.id)}
                      className="text-sm font-medium text-white hover:text-neon-cyan text-left truncate transition-colors"
                    >
                      {child.title}
                    </button>
                    <Badge variant="default" className="!text-[10px] !normal-case">
                      {child.levelShort || taskLevelLabel(depth)}
                    </Badge>
                    <Badge variant={statusVariant(child)} className="!text-[10px]">
                      {statusLabel(child)}
                    </Badge>
                    {child.hasChildren && (
                      <span className="text-[10px] font-mono text-text-muted">
                        {child.completedChildCount}/{child.childCount} nested
                      </span>
                    )}
                  </div>
                  {child.claimedBy && !child.hasChildren && (
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {isDone ? 'Shipped by' : 'Claimed by'} {child.claimedBy}
                    </p>
                  )}
                  {(child.hasChildren ||
                    hasActiveClaim ||
                    isDone ||
                    child.hasChecklist ||
                    (child.subtasks && child.subtasks.length > 0) ||
                    child.progressPercent > 0) && (
                    <div className="mt-1.5 max-w-[12rem]">
                      <div className="flex items-center justify-between text-[9px] font-mono text-text-muted mb-0.5">
                        <span>PROGRESS</span>
                        <span className="text-neon-cyan">
                          {isDone
                            ? 100
                            : Math.min(100, child.progressPercent || 0)}
                          %
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-neon-cyan/80 rounded-full"
                          style={{
                            width: `${
                              isDone
                                ? 100
                                : Math.min(100, child.progressPercent || 0)
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {showClaim && (
                    <Button
                      size="sm"
                      onClick={() => onClaim(child.id)}
                      disabled={claimingId === child.id}
                    >
                      {claimingId === child.id ? '…' : 'Claim'}
                    </Button>
                  )}
                  {onOpen && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onOpen(child.id)}
                    >
                      Open
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SubTaskList;
