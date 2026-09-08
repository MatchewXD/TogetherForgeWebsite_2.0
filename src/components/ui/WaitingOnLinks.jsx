import { Fragment } from 'react';
import {
  getTaskWaitingOnBlockers,
  waitingBlockersExcludingSelf,
} from '../../services/tasksService';

const DEFAULT_LINK =
  'text-neon-cyan hover:underline font-medium text-left';

/**
 * “Waiting on:” names. When a blocker has an id and onOpen is set, the name
 * opens that task’s modal.
 */
const WaitingOnLinks = ({
  task = null,
  blockers = null,
  onOpen = null,
  prefix = 'Waiting on:',
  emptyText = 'All nested tasks are blocked.',
  className = '',
  linkClassName = DEFAULT_LINK,
  showCompleteMark = false,
}) => {
  const items = Array.isArray(blockers)
    ? waitingBlockersExcludingSelf(task, blockers)
    : getTaskWaitingOnBlockers(task);

  if (!items.length) {
    return emptyText ? <span className={className}>{emptyText}</span> : null;
  }

  return (
    <span className={className}>
      {prefix ? `${prefix} ` : null}
      {items.map((b, i) => {
        const label =
          showCompleteMark && b.isComplete ? `${b.title} (done)` : b.title;
        const canOpen = Boolean(b.id && onOpen);
        return (
          <Fragment key={b.id || `${label}-${i}`}>
            {i > 0 ? ', ' : null}
            {canOpen ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onOpen(b.id);
                }}
                className={linkClassName}
                title={`Open ${b.title}`}
              >
                {label}
              </button>
            ) : (
              <span className="text-text-primary/90">{label}</span>
            )}
          </Fragment>
        );
      })}
    </span>
  );
};

export default WaitingOnLinks;
