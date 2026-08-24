/**
 * Staff-only Staging board tree (Epic → Medium → Small).
 * Preparation area: create/edit/reorder/delete, then Publish to the public board.
 */

import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import Badge from './Badge';
import Button from './Buttons';
import TaskCategoryBadge from './TaskCategoryBadge';
import {
  canPublishStagingTask,
  compareTaskBoardOrder,
  getChildTasks,
  taskLevelLabel,
} from '../../services/tasksService';

function sortSiblings(items) {
  return (items || []).slice().sort(compareTaskBoardOrder);
}

function StaffOnlyChip({ task }) {
  if (!task?.staffOnly) return null;
  return (
    <Badge variant="gold" className="!normal-case tracking-wide !text-[10px] !py-0.5 !px-2">
      Staff Only
    </Badge>
  );
}

function PublishedChip({ task }) {
  if (!task?.publishedTaskId) return null;
  return (
    <Badge variant="success" className="!normal-case tracking-wide !text-[10px] !py-0.5 !px-2">
      Published
    </Badge>
  );
}

function LevelChip({ task }) {
  const depth = Number(task.depth) || 0;
  const variant = depth === 0 ? 'gold' : depth === 1 ? 'neon' : 'default';
  return (
    <Badge variant={variant} className="!normal-case tracking-wide !text-[10px] !py-0.5 !px-2">
      {task.levelShort || taskLevelLabel(depth)}
    </Badge>
  );
}

function RowActions({
  task,
  siblings,
  busyId,
  publishingId,
  onAddChild,
  onEdit,
  onDelete,
  onPublish,
  onMove,
}) {
  const idx = siblings.findIndex((s) => s.id === task.id);
  const canUp = idx > 0;
  const canDown = idx >= 0 && idx < siblings.length - 1;
  const canAdd = task.canAddChild !== false;
  const childLevel = taskLevelLabel(Math.min((Number(task.depth) || 0) + 1, 2));
  const busy = busyId === task.id;
  const publishing = publishingId === task.id;

  return (
    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
      <button
        type="button"
        className="p-1.5 rounded-md border border-cyber-border text-text-muted hover:text-white hover:border-neon-cyan/40 disabled:opacity-30"
        onClick={() => onMove(task, 'up')}
        disabled={!canUp || busy}
        title="Move up"
        aria-label="Move up"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className="p-1.5 rounded-md border border-cyber-border text-text-muted hover:text-white hover:border-neon-cyan/40 disabled:opacity-30"
        onClick={() => onMove(task, 'down')}
        disabled={!canDown || busy}
        title="Move down"
        aria-label="Move down"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>
      {canAdd && onAddChild && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1 !py-1 !px-2 text-xs"
          onClick={() => onAddChild(task)}
          disabled={busy}
        >
          <Plus className="w-3.5 h-3.5" />
          {childLevel}
        </Button>
      )}
      {canPublishStagingTask(task) && (
        <Button
          size="sm"
          className="gap-1 !py-1 !px-2 text-xs"
          onClick={() => onPublish(task)}
          disabled={busy || publishing}
          title="Copy this work to the public task board"
        >
          <Upload className="w-3.5 h-3.5" />
          {publishing
            ? 'Publishing…'
            : task.publishedTaskId
              ? 'Publish updates'
              : 'Publish'}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="gap-1 !py-1 !px-2 text-xs"
        onClick={() => onEdit(task)}
        disabled={busy}
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit
      </Button>
      <button
        type="button"
        className="p-1.5 rounded-md border border-cyber-border text-text-muted hover:text-red-300 hover:border-red-400/40 disabled:opacity-30"
        onClick={() => onDelete(task)}
        disabled={busy}
        title="Delete from Staging (public copies stay live)"
        aria-label="Delete from Staging"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function StagingRow({
  task,
  siblings,
  allTasks,
  busyId,
  publishingId,
  onAddChild,
  onEdit,
  onDelete,
  onPublish,
  onMove,
}) {
  const depth = Number(task.depth) || 0;
  const children = sortSiblings(getChildTasks(allTasks, task.id));
  const accent =
    depth === 0
      ? 'border-l-semantic-achievement/70'
      : depth === 1
        ? 'border-l-neon-cyan/70'
        : 'border-l-white/25';

  return (
    <li className="space-y-2">
      <div
        className={`rounded-lg border border-cyber-border bg-cyber-surface/70 px-3 py-2.5 border-l-2 ${accent}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-start gap-2 lg:gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <LevelChip task={task} />
              {task.category && (
                <TaskCategoryBadge category={task.category} size="sm" />
              )}
              <StaffOnlyChip task={task} />
              <PublishedChip task={task} />
            </div>
            <p className="text-sm sm:text-base font-semibold text-white leading-snug">
              {task.title}
            </p>
            {task.description ? (
              <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            ) : null}
            {children.length > 0 && (
              <p className="text-[10px] font-mono text-text-muted">
                {children.length} nested · {task.completedChildCount || 0}/
                {task.childCount || children.length} marked done
              </p>
            )}
          </div>
          <RowActions
            task={task}
            siblings={siblings}
            busyId={busyId}
            publishingId={publishingId}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
            onPublish={onPublish}
            onMove={onMove}
          />
        </div>
      </div>
      {children.length > 0 && (
        <ul className="space-y-2 pl-3 sm:pl-5">
          {children.map((child) => (
            <StagingRow
              key={child.id}
              task={child}
              siblings={children}
              allTasks={allTasks}
              busyId={busyId}
              publishingId={publishingId}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              onPublish={onPublish}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const TaskStagingTree = ({
  tasks = [],
  busyId = null,
  publishingId = null,
  onAddEpic,
  onAddChild,
  onEdit,
  onDelete,
  onPublish,
  onMove,
}) => {
  const roots = sortSiblings(
    (tasks || []).filter((t) => !t.parentTaskId)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
          {tasks.length} staging task{tasks.length === 1 ? '' : 's'}
        </p>
        {onAddEpic && (
          <Button size="sm" className="gap-1.5" onClick={onAddEpic}>
            <Plus className="w-3.5 h-3.5" />
            Add Epic
          </Button>
        )}
      </div>

      {roots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cyber-border bg-cyber-surface/40 px-4 py-10 text-center space-y-3">
          <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
            Staging is empty. Build Epics, Mediums, and Smalls here without
            showing them to volunteers. Publish when the structure is ready.
          </p>
          {onAddEpic && (
            <Button className="gap-1.5" onClick={onAddEpic}>
              <Plus className="w-4 h-4" />
              Add first Epic
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {roots.map((task) => (
            <StagingRow
              key={task.id}
              task={task}
              siblings={roots}
              allTasks={tasks}
              busyId={busyId}
              publishingId={publishingId}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              onPublish={onPublish}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default TaskStagingTree;
