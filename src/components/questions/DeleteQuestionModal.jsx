import Button from '../ui/Buttons';
import Modal from '../ui/Modal';

export default function DeleteQuestionModal({
  isOpen,
  onClose,
  onConfirm,
  title = '',
  busy = false,
  error = '',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Delete this question"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          Delete{title ? ` “${title}”` : ' this question'} and all answers? This
          cannot be undone.
        </p>
        {error ? (
          <p className="text-sm text-semantic-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => onConfirm?.()}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
