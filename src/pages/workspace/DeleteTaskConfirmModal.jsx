/**
 * Project workspace: confirm deleting a task.
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import Modal from '../../components/ui/Modal';
import { isStagingTask } from '../../services/tasksService';
import Button from '../../components/ui/Buttons';

export default function DeleteTaskConfirmModal({
  confirmStagingDelete,
  deleteConfirmTask,
  setDeleteConfirmTask,
  stagingBusyId,
}) {
  return (
    <Modal
      isOpen={!!deleteConfirmTask}
      onClose={() => !stagingBusyId && setDeleteConfirmTask(null)}
      title={
        deleteConfirmTask && isStagingTask(deleteConfirmTask)
          ? 'Delete from Staging?'
          : 'Delete from the board?'
      }
      size="md"
    >
      {deleteConfirmTask ? (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            {(Number(deleteConfirmTask.childCount) || 0) > 0 ? (
              <>
                Delete{' '}
                <span className="text-white font-medium">
                  {deleteConfirmTask.title}
                </span>{' '}
                and {deleteConfirmTask.childCount} nested task
                {deleteConfirmTask.childCount === 1 ? '' : 's'}?
              </>
            ) : (
              <>
                Delete{' '}
                <span className="text-white font-medium">
                  {deleteConfirmTask.title}
                </span>
                {isStagingTask(deleteConfirmTask)
                  ? ' from Staging?'
                  : ' from the board?'}
              </>
            )}
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {isStagingTask(deleteConfirmTask)
              ? 'Public copies already published stay on the live board.'
              : 'This removes the card from this board. Nested cards are removed with it.'}
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(stagingBusyId)}
              onClick={() => setDeleteConfirmTask(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={Boolean(stagingBusyId)}
              onClick={() => void confirmStagingDelete()}
            >
              {stagingBusyId ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
