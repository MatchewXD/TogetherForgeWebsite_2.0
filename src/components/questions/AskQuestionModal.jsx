import { useEffect, useState } from 'react';

import Button from '../ui/Buttons';
import CharCount from '../ui/CharCount';
import Modal from '../ui/Modal';
import {
  OPEN_QUESTION_BODY_MAX,
  OPEN_QUESTION_TITLE_MAX,
} from '../../services/openQuestionsService';
import { fieldControl, fieldLabel } from './questionStyles';

export default function AskQuestionModal({
  isOpen,
  onClose,
  onSave,
  busy = false,
  editing = null,
  projects = [],
  selectedProjectId = '',
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [projectId, setProjectId] = useState(selectedProjectId || '');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTitle(editing?.title || '');
    setBody(editing?.body || '');
    setProjectId(editing?.projectId || selectedProjectId || '');
    setFormError('');
  }, [isOpen, editing, selectedProjectId]);

  const needsProject = !editing && !selectedProjectId;
  const canSubmit = Boolean(title.trim()) && (editing || projectId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await onSave({
        title,
        body,
        projectId: editing ? editing.projectId : projectId,
      });
    } catch (err) {
      setFormError(err?.message || 'Could not save.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title={editing ? 'Edit question' : 'Ask a question'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          Ask one concrete decision. Keep it tighter than an Idea. The community
          posts Suggestions, not a new game pitch.
        </p>
        {needsProject ? (
          <div>
            <label className={fieldLabel} htmlFor="oq-project">
              Project
            </label>
            <select
              id="oq-project"
              className={fieldControl}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
            >
              <option value="">Choose a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className={fieldLabel} htmlFor="oq-title">
            Question
          </label>
          <input
            id="oq-title"
            className={fieldControl}
            value={title}
            maxLength={OPEN_QUESTION_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How long should a co-op session feel?"
            required
          />
          <CharCount value={title} max={OPEN_QUESTION_TITLE_MAX} />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="oq-body">
            Context (optional)
          </label>
          <textarea
            id="oq-body"
            className={`${fieldControl} min-h-[7rem]`}
            value={body}
            maxLength={OPEN_QUESTION_BODY_MAX}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What you already know, options you are weighing, or why this call matters now."
          />
          <CharCount value={body} max={OPEN_QUESTION_BODY_MAX} />
        </div>
        {formError ? (
          <p className="text-sm text-semantic-danger">{formError}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !canSubmit}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Post question'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
