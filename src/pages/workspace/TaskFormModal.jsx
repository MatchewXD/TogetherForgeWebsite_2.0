/**
 * Project workspace: create / edit task form (staff).
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import Modal from '../../components/ui/Modal';
import { taskLevelLabel, HOLD_CLAIM_STAFF_HELP } from '../../services/tasksService';
import { TASK_CATEGORIES } from '../../constants/taskCategories';
import TaskCategoryBadge from '../../components/ui/TaskCategoryBadge';
import { TASK_EFFORT_OPTIONS, isStructuredTaskEffort } from '../../constants/taskEffort';
import TaskDependencyPicker from '../../components/ui/TaskDependencyPicker';
import Button from '../../components/ui/Buttons';
import { Plus, Trash2 } from 'lucide-react';
import {
  fieldLabelClass,
  fieldControlClass,
  TASK_DIFFICULTIES,
  MAX_CHECKLIST_STEPS,
} from './shared';

export default function TaskFormModal({
  addSubtaskLine,
  closeTaskForm,
  editingTaskId,
  handleTaskFormSubmit,
  isModerator,
  isStagingBoard,
  removeSubtaskLine,
  requestDeleteFromTaskForm,
  taskForm,
  taskFormBusy,
  taskFormError,
  taskFormMode,
  taskFormOpen,
  tasks,
  toggleBlockedByTask,
  updateSubtaskLine,
  updateTaskFormField,
}) {
  return (
    <Modal
      isOpen={taskFormOpen}
      onClose={closeTaskForm}
      title={
        taskFormMode === 'edit'
          ? isStagingBoard
            ? 'Edit Staging Task'
            : 'Edit Task'
          : taskForm.parentTaskId
            ? isStagingBoard
              ? 'Add Staging Sub-task'
              : 'Add Sub-task'
            : String(taskForm.title || '').startsWith('Copy of ')
              ? isStagingBoard
                ? 'Duplicate Staging Task'
                : 'Duplicate Task'
              : isStagingBoard
                ? 'Add Staging Task'
                : 'Add New Task'
      }
      size="lg"
    >
      <form onSubmit={handleTaskFormSubmit} className="space-y-6">
        <p className="text-sm text-text-secondary leading-relaxed">
          {taskFormMode === 'edit'
            ? isStagingBoard
              ? 'Update this Staging task. Volunteers will not see it until you publish the Epic or Medium.'
              : 'Update task details. Checklist labels keep their done state when unchanged.'
            : String(taskForm.title || '').startsWith('Copy of ')
              ? isStagingBoard
                ? 'Duplicating as a new Staging task. It stays off the public board until you publish.'
                : 'Duplicating as a new Unclaimed / To Do task. Edit anything below, then create. Claim, progress, and review data are not copied.'
              : taskForm.parentTaskId
                ? isStagingBoard
                  ? 'Add a nested Staging task under this parent.'
                  : 'Add a child task under the parent.'
                : isStagingBoard
                  ? 'Top-level = Epic. Nest Mediums and Smalls here, then publish when the structure is ready.'
                  : 'Top-level = Epic. Nest Medium/Small under it for claimable work.'}
        </p>

        {taskForm.parentTaskId && (
          <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 px-3 py-2 text-sm text-text-secondary">
            Parent:{' '}
            <span className="text-white font-medium">
              {tasks.find((t) => t.id === taskForm.parentTaskId)?.title ||
                'Selected task'}
            </span>
            {(() => {
              const p = tasks.find((t) => t.id === taskForm.parentTaskId);
              if (!p) return null;
              return (
                <span className="text-text-muted">
                  {' '}
                  · will be a {taskLevelLabel((p.depth || 0) + 1)}
                </span>
              );
            })()}
          </div>
        )}

        <div>
          <label className={fieldLabelClass} htmlFor="task-title">
            TITLE *
          </label>
          <input
            id="task-title"
            type="text"
            required
            maxLength={120}
            placeholder="e.g. Prototype player dash"
            className={fieldControlClass}
            value={taskForm.title}
            onChange={(e) => updateTaskFormField('title', e.target.value)}
          />
          <p className="text-xs text-text-muted mt-1">Short and action-oriented. Max 120 characters.</p>
        </div>

        <div>
          <label className={fieldLabelClass} htmlFor="task-description">
            DESCRIPTION
          </label>
          <textarea
            id="task-description"
            rows={4}
            maxLength={2000}
            placeholder="What needs to ship? Any links, acceptance criteria, or gotchas?"
            className={`${fieldControlClass} resize-y min-h-[6rem]`}
            value={taskForm.description}
            onChange={(e) => updateTaskFormField('description', e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabelClass} htmlFor="task-category">
              CATEGORY *
            </label>
            <div className="flex items-center gap-2">
              <select
                id="task-category"
                required
                className={`${fieldControlClass} min-w-0 flex-1`}
                value={taskForm.category}
                onChange={(e) =>
                  updateTaskFormField('category', e.target.value)
                }
              >
                {taskForm.category &&
                  !TASK_CATEGORIES.includes(taskForm.category) && (
                    <option value={taskForm.category}>
                      {taskForm.category}
                    </option>
                  )}
                {TASK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {taskForm.category && (
                <TaskCategoryBadge
                  category={taskForm.category}
                  size="sm"
                  className="shrink-0"
                />
              )}
            </div>
          </div>

          <div>
            <label className={fieldLabelClass} htmlFor="task-difficulty">
              DIFFICULTY *
            </label>
            <select
              id="task-difficulty"
              required
              className={fieldControlClass}
              value={taskForm.difficulty}
              onChange={(e) => updateTaskFormField('difficulty', e.target.value)}
            >
              {TASK_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={fieldLabelClass} htmlFor="task-effort">
            ESTIMATED EFFORT
          </label>
          <select
            id="task-effort"
            className={fieldControlClass}
            value={taskForm.estimatedEffort || ''}
            onChange={(e) =>
              updateTaskFormField('estimatedEffort', e.target.value)
            }
          >
            <option value="">Not set</option>
            {TASK_EFFORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {/* Legacy free-text values until staff picks a preset */}
            {taskForm.estimatedEffort &&
              !isStructuredTaskEffort(taskForm.estimatedEffort) && (
                <option value={taskForm.estimatedEffort}>
                  {taskForm.estimatedEffort} (custom — pick a preset)
                </option>
              )}
          </select>
          <p className="text-xs text-text-muted mt-1">
            Choose a range so volunteers can scan effort at a glance.
          </p>
        </div>

        <div>
          <label className={fieldLabelClass}>STAFF ONLY</label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-cyan-400 shrink-0"
              checked={Boolean(taskForm.staffOnly)}
              onChange={(e) =>
                updateTaskFormField('staffOnly', e.target.checked)
              }
            />
            <span className="text-sm text-text-secondary leading-snug">
              Volunteers can see this task on the board but cannot claim it.
              Staff and founders can claim, work, and complete it as usual.
            </span>
          </label>
        </div>

        <div>
          <label className={fieldLabelClass}>HOLD CLAIM</label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-cyan-400 shrink-0"
              checked={Boolean(taskForm.holdClaim)}
              onChange={(e) =>
                updateTaskFormField('holdClaim', e.target.checked)
              }
            />
            <span className="text-sm text-text-secondary leading-snug">
              Disable auto-release. {HOLD_CLAIM_STAFF_HELP}
            </span>
          </label>
        </div>

        {/* Blocked by — hierarchical multi dependency */}
        <div>
          <label className={fieldLabelClass}>BLOCKED BY (optional)</label>
          <p className="text-xs text-text-muted mb-2 leading-relaxed">
            This task stays locked until every selected blocker is completed
            and accepted. Expand an epic to pick a nested task without
            selecting the whole epic.
          </p>
          <TaskDependencyPicker
            tasks={tasks}
            selectedIds={taskForm.blockedByTaskIds || []}
            onToggle={toggleBlockedByTask}
            excludeTaskId={
              taskFormMode === 'edit' ? editingTaskId : null
            }
          />
          {(taskForm.blockedByTaskIds || []).length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-neon-cyan/80">
                {(taskForm.blockedByTaskIds || []).length} blocker
                {(taskForm.blockedByTaskIds || []).length === 1 ? '' : 's'}{' '}
                selected
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {(taskForm.blockedByTaskIds || []).map((id) => {
                  const t = tasks.find((x) => x.id === id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => toggleBlockedByTask(id)}
                        className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 text-[11px] text-neon-cyan hover:bg-neon-cyan/20"
                        title="Remove blocker"
                      >
                        <span className="max-w-[10rem] truncate">
                          {t?.title || 'Task'}
                        </span>
                        <span aria-hidden className="opacity-70">
                          ×
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-cyan-400 shrink-0"
              checked={Boolean(taskForm.dependencyOverride)}
              onChange={(e) =>
                updateTaskFormField('dependencyOverride', e.target.checked)
              }
            />
            <span className="text-sm text-text-secondary leading-snug">
              <span className="text-text-primary font-medium">
                Override lock
              </span>
              {' – '}
              allow claiming even while blockers are incomplete (Project Lead
              / Admin only). Dependencies stay recorded for visibility.
            </span>
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className={`${fieldLabelClass} mb-0`}>
              CHECKLIST (optional)
            </label>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono tracking-widest ${
                  taskForm.subtaskLines.length >= MAX_CHECKLIST_STEPS
                    ? 'text-amber-300'
                    : 'text-text-muted'
                }`}
              >
                {taskForm.subtaskLines.length}/{MAX_CHECKLIST_STEPS}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={addSubtaskLine}
                disabled={
                  taskForm.subtaskLines.length >= MAX_CHECKLIST_STEPS
                }
                title={
                  taskForm.subtaskLines.length >= MAX_CHECKLIST_STEPS
                    ? `Maximum ${MAX_CHECKLIST_STEPS} checklist steps`
                    : 'Add checklist step'
                }
              >
                <Plus className="w-3.5 h-3.5" />
                Add step
              </Button>
            </div>
          </div>
          {taskForm.subtaskLines.length >= MAX_CHECKLIST_STEPS ? (
            <p className="text-xs text-amber-300/90 mb-3">
              Max checklist steps reached ({MAX_CHECKLIST_STEPS}). Remove a
              step to add another.
            </p>
          ) : (
            <p className="text-xs text-text-muted mb-3">
              Optional checklist items (up to {MAX_CHECKLIST_STEPS}).
              Volunteers tick these off while they work.
            </p>
          )}
          <div className="space-y-2">
            {taskForm.subtaskLines.map((line, index) => (
              <div key={`sub-${index}`} className="flex gap-2 items-center">
                <input
                  type="text"
                  maxLength={200}
                  placeholder={`Step ${index + 1}`}
                  className={fieldControlClass}
                  value={line}
                  onChange={(e) => updateSubtaskLine(index, e.target.value)}
                />
                <button
                  type="button"
                  aria-label="Remove checklist step"
                  className="shrink-0 p-2 rounded-lg border border-cyber-border text-text-muted hover:text-red-300 hover:border-red-400/40 transition-colors"
                  onClick={() => removeSubtaskLine(index)}
                  disabled={taskForm.subtaskLines.length <= 1 && !line}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {taskFormError && (
          <div
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200"
          >
            {taskFormError}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" className="gap-2" disabled={taskFormBusy}>
            {taskFormBusy
              ? taskFormMode === 'edit'
                ? 'Saving…'
                : 'Creating…'
              : taskFormMode === 'edit'
                ? 'Save Changes'
                : 'Create Task'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={closeTaskForm}
            disabled={taskFormBusy}
          >
            Cancel
          </Button>
          {taskFormMode === 'edit' && isModerator ? (
            <Button
              type="button"
              variant="danger"
              className="gap-2"
              onClick={requestDeleteFromTaskForm}
              disabled={taskFormBusy}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
