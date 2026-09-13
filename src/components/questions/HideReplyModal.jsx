import { useEffect, useState } from 'react';

import Button from '../ui/Buttons';
import CharCount from '../ui/CharCount';
import Modal from '../ui/Modal';
import {
  OPEN_QUESTION_HIDE_NOTE_MAX,
} from '../../services/openQuestionsService';
import { fieldControl, fieldLabel } from './questionStyles';

export default function HideReplyModal({
  isOpen,
  onClose,
  onSubmit,
  busy = false,
}) {
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setNote('');
    setFormError('');
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await onSubmit(note);
    } catch (err) {
      setFormError(err?.message || 'Could not hide that reply.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Hide off-brief reply"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          The author will see this note on the post and on their dashboard.
        </p>
        <div>
          <label className={fieldLabel} htmlFor="oq-hide-note">
            Note to the author *
          </label>
          <textarea
            id="oq-hide-note"
            className={`${fieldControl} min-h-[6rem]`}
            maxLength={OPEN_QUESTION_HIDE_NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this reply is off-brief, so they can try again."
            required
          />
          <CharCount value={note} max={OPEN_QUESTION_HIDE_NOTE_MAX} />
        </div>
        {formError ? (
          <p className="text-sm text-semantic-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !note.trim()}>
            {busy ? 'Hiding…' : 'Hide reply'}
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
