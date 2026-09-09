import { useEffect, useState } from 'react';

import Button from '../ui/Buttons';
import CharCount from '../ui/CharCount';
import Modal from '../ui/Modal';
import { OPEN_QUESTION_CLOSE_NOTE_MAX } from '../../services/openQuestionsService';
import { fieldControl, fieldLabel } from './questionStyles';

export default function CloseQuestionModal({
  isOpen,
  onClose,
  onSubmit,
  busy = false,
  initialNote = '',
}) {
  const [note, setNote] = useState(initialNote);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setNote(initialNote || '');
    setFormError('');
  }, [isOpen, initialNote]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await onSubmit(note);
    } catch (err) {
      setFormError(err?.message || 'Could not close the question.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Close this question"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          Adopt a suggestion first if it is the official call. Closing needs a
          short note so the community can see the final choice, including if
          nothing was adopted because it did not fit the game.
        </p>
        <div>
          <label className={fieldLabel} htmlFor="oq-close-note">
            Close note *
          </label>
          <textarea
            id="oq-close-note"
            className={`${fieldControl} min-h-[6rem]`}
            maxLength={OPEN_QUESTION_CLOSE_NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this is the call, or why the top-ranked suggestion was not adopted."
            required
          />
          <CharCount value={note} max={OPEN_QUESTION_CLOSE_NOTE_MAX} />
        </div>
        {formError ? (
          <p className="text-sm text-semantic-danger">{formError}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={busy}>
            {busy ? 'Closing…' : 'Close question'}
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
