import { useEffect, useState } from 'react';

import Button from '../ui/Buttons';
import CharCount from '../ui/CharCount';
import Modal from '../ui/Modal';
import {
  OPEN_QUESTION_CONDITION_MAX,
  OPEN_QUESTION_PROMPT_MAX,
  OPEN_QUESTION_TITLE_MAX,
  emptyQuestionPrompt,
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
  const [prompt, setPrompt] = useState(emptyQuestionPrompt());
  const [projectId, setProjectId] = useState(selectedProjectId || '');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTitle(editing?.title || '');
    setPrompt({
      ...emptyQuestionPrompt(),
      ...(editing?.prompt || {}),
    });
    setProjectId(editing?.projectId || selectedProjectId || '');
    setFormError('');
  }, [isOpen, editing, selectedProjectId]);

  const setPromptField = (key, value) => {
    setPrompt((prev) => ({ ...prev, [key]: value }));
  };

  const needsProject = !editing && !selectedProjectId;
  const canSubmit = Boolean(title.trim()) && (editing || projectId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await onSave({
        title,
        prompt,
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
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-text-secondary leading-relaxed">
          Set the brief the same way Ideas does: context first, then the
          question, then what a good answer must and must not be.
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
            Title *
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
          <label className={fieldLabel} htmlFor="oq-context">
            Context *
          </label>
          <p className="text-xs text-text-muted mb-2 leading-relaxed">
            What do people need to know before posting an answer?
          </p>
          <textarea
            id="oq-context"
            className={`${fieldControl} min-h-[6.5rem]`}
            value={prompt.context}
            maxLength={OPEN_QUESTION_PROMPT_MAX}
            onChange={(e) => setPromptField('context', e.target.value)}
            placeholder="The situation, what is already decided, and why this call matters now."
            required
          />
          <CharCount value={prompt.context} max={OPEN_QUESTION_PROMPT_MAX} />
        </div>

        <div className="rounded-xl border border-cyber-border bg-cyber-surface/40 p-4 space-y-3">
          <label className={fieldLabel} htmlFor="oq-question-detail">
            The Question *
          </label>
          <p className="text-xs text-text-muted leading-relaxed">
            Repeat of the title, plus a description of what you are asking.
          </p>
          <p className="text-base font-semibold text-white leading-snug">
            {title.trim() || 'Your title will appear here.'}
          </p>
          <textarea
            id="oq-question-detail"
            className={`${fieldControl} min-h-[6.5rem]`}
            value={prompt.questionDetail}
            maxLength={OPEN_QUESTION_PROMPT_MAX}
            onChange={(e) => setPromptField('questionDetail', e.target.value)}
            placeholder="Expand the question. What decision do you need from the community?"
            required
          />
          <CharCount
            value={prompt.questionDetail}
            max={OPEN_QUESTION_PROMPT_MAX}
          />
        </div>

        <div className="space-y-3">
          <div>
            <p className={fieldLabel}>Conditions *</p>
            <p className="text-xs text-text-muted leading-relaxed">
              What an answer should be to fit the context, and what it should
              not be.
            </p>
          </div>
          <div>
            <label className={fieldLabel} htmlFor="oq-should-fit">
              Should fit
            </label>
            <textarea
              id="oq-should-fit"
              className={`${fieldControl} min-h-[5rem]`}
              value={prompt.shouldFit}
              maxLength={OPEN_QUESTION_CONDITION_MAX}
              onChange={(e) => setPromptField('shouldFit', e.target.value)}
              placeholder="A good answer stays inside this brief. Example: session length for 1–4 players on the first playable."
              required
            />
            <CharCount
              value={prompt.shouldFit}
              max={OPEN_QUESTION_CONDITION_MAX}
            />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="oq-should-not">
              Should not fit
            </label>
            <textarea
              id="oq-should-not"
              className={`${fieldControl} min-h-[5rem]`}
              value={prompt.shouldNotFit}
              maxLength={OPEN_QUESTION_CONDITION_MAX}
              onChange={(e) => setPromptField('shouldNotFit', e.target.value)}
              placeholder="Out of scope. Example: new genres, extra modes, or rewriting the campaign."
              required
            />
            <CharCount
              value={prompt.shouldNotFit}
              max={OPEN_QUESTION_CONDITION_MAX}
            />
          </div>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="oq-additional">
            Additional info
          </label>
          <p className="text-xs text-text-muted mb-2 leading-relaxed">
            Optional. Anything else that might help someone write a useful
            answer.
          </p>
          <textarea
            id="oq-additional"
            className={`${fieldControl} min-h-[5rem]`}
            value={prompt.additional}
            maxLength={OPEN_QUESTION_PROMPT_MAX}
            onChange={(e) => setPromptField('additional', e.target.value)}
            placeholder="Links, related tasks, playtest notes, or constraints that are not in Context."
          />
          <CharCount value={prompt.additional} max={OPEN_QUESTION_PROMPT_MAX} />
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
