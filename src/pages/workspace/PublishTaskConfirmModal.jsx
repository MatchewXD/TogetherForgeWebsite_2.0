/**
 * Project workspace: confirm publishing a staging task.
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Buttons';

export default function PublishTaskConfirmModal({
  confirmPublishStaging,
  publishConfirmTask,
  publishingId,
  setPublishConfirmTask,
}) {
  return (
    <Modal
      isOpen={!!publishConfirmTask}
      onClose={() => !publishingId && setPublishConfirmTask(null)}
      title="Publish to the public board?"
      size="md"
    >
      {publishConfirmTask ? (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Publish{' '}
            <span className="text-white font-medium">
              {publishConfirmTask.title}
            </span>{' '}
            (
            {(Number(publishConfirmTask.depth) || 0) === 0
              ? 'Epic'
              : 'Medium'}
            ) to the public task board?
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            This copies it and any nested staging tasks to the live board,
            then removes those cards from Staging. Staff Only flags are kept.
          </p>
          {publishConfirmTask.publishedTaskId ? (
            <p className="text-sm text-text-secondary leading-relaxed">
              Public copies already exist and stay in place. Staging copies of
              this work will still leave Staging.
            </p>
          ) : null}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(publishingId)}
              onClick={() => setPublishConfirmTask(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={Boolean(publishingId)}
              onClick={() => void confirmPublishStaging()}
            >
              {publishingId ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
