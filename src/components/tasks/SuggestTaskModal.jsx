import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Buttons';
import TaskCategoryBadge from '../ui/TaskCategoryBadge';
import { TASK_CATEGORIES } from '../../constants/taskCategories';
import { TASK_EFFORT_OPTIONS } from '../../constants/taskEffort';
import {
  SUGGEST_LOCKED_MESSAGE,
  SUGGESTION_STRIKE_LIMIT,
  isSuggestLockedError,
  taskSuggestionsService,
} from '../../services/taskSuggestionsService';
import { taskLevelLabel } from '../../services/tasksService';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const MAX_CHECKLIST_STEPS = 20;

const fieldLabelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';
const fieldControlClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

function parseSubtaskLines(lines) {
  return (lines || [])
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .map((label, i) => ({
      id: `s${i + 1}`,
      label,
      done: false,
    }));
}

const SuggestTaskModal = ({
  isOpen,
  onClose,
  projectUuid,
  user,
  tasks = [],
  locked = false,
  strikeCount = 0,
  onSubmitted,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Code');
  const [difficulty, setDifficulty] = useState('Medium');
  const [estimatedEffort, setEstimatedEffort] = useState('');
  const [parentTaskId, setParentTaskId] = useState('');
  const [subtaskLines, setSubtaskLines] = useState(['']);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const parentOptions = useMemo(
    () =>
      (tasks || []).filter(
        (t) => t && t.canAddChild !== false && (t.depth || 0) < 2
      ),
    [tasks]
  );

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('Code');
    setDifficulty('Medium');
    setEstimatedEffort('');
    setParentTaskId('');
    setSubtaskLines(['']);
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Sign in to suggest a task.');
      return;
    }
    if (locked) {
      setError(SUGGEST_LOCKED_MESSAGE);
      return;
    }
    const trimmed = title.trim();
    if (trimmed.length < 8) {
      setError('Title must be at least 8 characters.');
      return;
    }
    if (!projectUuid) {
      setError('This project is not ready for suggestions yet.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await taskSuggestionsService.submit(projectUuid, {
        title: trimmed,
        description: description.trim(),
        category,
        difficulty,
        estimatedEffort: estimatedEffort || null,
        parentTaskId: parentTaskId || null,
        subtasks: parseSubtaskLines(subtaskLines),
      });
      reset();
      onSubmitted?.();
      onClose?.();
    } catch (err) {
      setError(
        isSuggestLockedError(err)
          ? SUGGEST_LOCKED_MESSAGE
          : err?.message || 'Could not send that suggestion.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Suggest a Task"
      size="lg"
    >
      {!user ? (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Sign in to suggest a task. Staff review every suggestion before it
            can land on Staging.
          </p>
          <Button to="/account">Sign in</Button>
        </div>
      ) : locked ? (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary leading-relaxed">
            {SUGGEST_LOCKED_MESSAGE}
          </p>
          <p className="text-xs text-text-muted">
            You have {strikeCount} of {SUGGESTION_STRIKE_LIMIT} strikes. Check
            your dashboard for the notice.
          </p>
          <Button to="/dashboard" variant="secondary">
            Open dashboard
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-sm text-text-secondary leading-relaxed">
            Propose a real piece of work for this project. Staff will accept it
            onto Staging, reject it with a reason, or strike it if it is troll,
            fake, or malicious. Three strikes lock you out of further
            suggestions.
          </p>

          {error ? (
            <p className="text-sm text-semantic-danger leading-relaxed">
              {error}
            </p>
          ) : null}

          <div>
            <label className={fieldLabelClass} htmlFor="suggest-title">
              TITLE *
            </label>
            <input
              id="suggest-title"
              type="text"
              required
              minLength={8}
              maxLength={120}
              placeholder="e.g. Graybox a two-player climb using the beam"
              className={fieldControlClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-xs text-text-muted mt-1">
              Short and action-oriented. 8–120 characters.
            </p>
          </div>

          <div>
            <label className={fieldLabelClass} htmlFor="suggest-description">
              DESCRIPTION
            </label>
            <textarea
              id="suggest-description"
              rows={4}
              maxLength={2000}
              placeholder="What should ship? Output path, definition of done, or constraints."
              className={`${fieldControlClass} resize-y min-h-[6rem]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={fieldLabelClass} htmlFor="suggest-category">
                CATEGORY *
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="suggest-category"
                  required
                  className={`${fieldControlClass} min-w-0 flex-1`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {TASK_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {category ? (
                  <TaskCategoryBadge
                    category={category}
                    size="sm"
                    className="shrink-0"
                  />
                ) : null}
              </div>
            </div>
            <div>
              <label className={fieldLabelClass} htmlFor="suggest-difficulty">
                DIFFICULTY *
              </label>
              <select
                id="suggest-difficulty"
                required
                className={fieldControlClass}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={fieldLabelClass} htmlFor="suggest-effort">
              ESTIMATED EFFORT
            </label>
            <select
              id="suggest-effort"
              className={fieldControlClass}
              value={estimatedEffort}
              onChange={(e) => setEstimatedEffort(e.target.value)}
            >
              <option value="">Not set</option>
              {TASK_EFFORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {parentOptions.length > 0 ? (
            <div>
              <label className={fieldLabelClass} htmlFor="suggest-parent">
                BELONGS UNDER (optional)
              </label>
              <select
                id="suggest-parent"
                className={fieldControlClass}
                value={parentTaskId}
                onChange={(e) => setParentTaskId(e.target.value)}
              >
                <option value="">Top-level (staff will place it)</option>
                {parentOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {t.levelShort || taskLevelLabel(t.depth || 0)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className={`${fieldLabelClass} mb-0`}>
                CHECKLIST (optional)
              </label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() =>
                  setSubtaskLines((prev) =>
                    prev.length >= MAX_CHECKLIST_STEPS
                      ? prev
                      : [...prev, '']
                  )
                }
                disabled={subtaskLines.length >= MAX_CHECKLIST_STEPS}
              >
                <Plus className="w-3.5 h-3.5" />
                Add step
              </Button>
            </div>
            <div className="space-y-2">
              {subtaskLines.map((line, index) => (
                <div key={`sg-${index}`} className="flex gap-2 items-center">
                  <input
                    type="text"
                    maxLength={200}
                    placeholder={`Step ${index + 1}`}
                    className={fieldControlClass}
                    value={line}
                    onChange={(e) =>
                      setSubtaskLines((prev) => {
                        const next = [...prev];
                        next[index] = e.target.value;
                        return next;
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remove checklist step"
                    className="shrink-0 p-2 rounded-lg border border-cyber-border text-text-muted hover:text-red-300 hover:border-red-400/40"
                    onClick={() =>
                      setSubtaskLines((prev) => {
                        const next = prev.filter((_, i) => i !== index);
                        return next.length ? next : [''];
                      })
                    }
                    disabled={subtaskLines.length <= 1 && !line}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send to staff'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Link
              to="/dashboard"
              className="text-xs text-text-muted self-center ml-auto hover:text-neon-cyan"
            >
              Strikes show on your dashboard
            </Link>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default SuggestTaskModal;
