/**
 * Project workspace: confirm moving a public task back to staging.
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Buttons';

export default function UnpublishTaskConfirmModal({
  confirmMovePublicToStaging,
  setUnpublishConfirmTask,
  unpublishConfirmTask,
  unpublishingId,
}) {
  return (
    <Modal
      isOpen={!!unpublishConfirmTask}
      onClose={() => !unpublishingId && setUnpublishConfirmTask(null)}
      title="Move back to Staging?"
      size="md"
    >
      {unpublishConfirmTask ? (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Move{' '}
            <span className="text-white font-medium">
              {unpublishConfirmTask.title}
            </span>{' '}
            (
            {(Number(unpublishConfirmTask.depth) || 0) === 0
              ? 'Epic'
              : 'Medium'}
            ) and any nested tasks back to Staging?
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            They will leave the public board. Active claims on this work are
            returned. Staff Only flags are kept.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(unpublishingId)}
              onClick={() => setUnpublishConfirmTask(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={Boolean(unpublishingId)}
              onClick={() => void confirmMovePublicToStaging()}
            >
              {unpublishingId ? 'Moving…' : 'Move to Staging'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
