import { useEffect, useState } from 'react';

import Button from '../ui/Buttons';
import CharCount from '../ui/CharCount';
import Modal from '../ui/Modal';
import { OPEN_QUESTION_REPLY_MAX } from '../../services/openQuestionsService';
import { fieldControl, fieldLabel } from './questionStyles';
import { SignInHint } from './questionUi';

export default function PostAnswerModal({
  isOpen,
  onClose,
  onSubmit,
  busy = false,
  user = null,
}) {
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setBody('');
    setFormError('');
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');
    try {
      await onSubmit(body);
      onClose();
    } catch (err) {
      setFormError(err?.message || 'Could not post.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Post an answer"
      size="md"
    >
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Propose a direction. Others can vote it up and comment on the full
            answer.
          </p>
          <div>
            <label className={fieldLabel} htmlFor="oq-suggestion">
              Your answer
            </label>
            <textarea
              id="oq-suggestion"
              className={`${fieldControl} min-h-[8rem]`}
              maxLength={OPEN_QUESTION_REPLY_MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Keep it to one concrete call, not a new game pitch."
              required
            />
            <CharCount value={body} max={OPEN_QUESTION_REPLY_MAX} />
          </div>
          {formError ? (
            <p className="text-sm text-semantic-danger">{formError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !body.trim()}>
              {busy ? 'Posting…' : 'Post answer'}
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
      ) : (
        <SignInHint action="post an answer" />
      )}
    </Modal>
  );
}
