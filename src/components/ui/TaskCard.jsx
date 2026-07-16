import Button from './Buttons';
import Badge from './Badge';
import UserAvatar from './UserAvatar';
import ProfileLink from './ProfileLink';

/**
 * Compact task card for kanban boards and task lists.
 * Expected task shape (mapped from tasksService):
 * {
 *   id, title, description, difficulty, category, status,
 *   claimedBy, claimedByAvatarUrl, progressPercent,
 *   claim?: { username, avatarUrl, avatar_url, userId, status, progressPercent }
 * }
 */
const TaskCard = ({
  task,
  onClaim,
  onView,
  claiming = false,
  currentUserId = null,
}) => {
  const isCompleted = task.status === 'completed' || task.dbStatus === 'Completed';
  const hasActiveClaim = Boolean(
    task.claim?.status === 'Active' || (task.claimedBy && !isCompleted)
  );
  const isClaimable = !hasActiveClaim && !isCompleted;
  const isMine =
    currentUserId && task.claim?.userId && task.claim.userId === currentUserId;
  const progress =
    typeof task.progressPercent === 'number'
      ? task.progressPercent
      : task.claim?.progressPercent ?? 0;

  const assigneeName =
    task.claimedBy || task.claim?.username || null;
  const assigneeAvatar =
    task.claimedByAvatarUrl ||
    task.claim?.avatarUrl ||
    task.claim?.avatar_url ||
    null;

  return (
    <div className="task-card cyber-card p-4 border border-cyber-border hover:border-neon-cyan/50 transition-all group">
      <div className="flex justify-between items-start gap-2 mb-2">
        <h4 className="font-medium text-text-primary text-sm leading-snug min-w-0">
          {task.title}
        </h4>
        {task.difficulty && (
          <Badge variant="default" className="shrink-0">
            {task.difficulty}
          </Badge>
        )}
      </div>

      {task.category && (
        <div className="mb-2">
          <Badge variant="purple" className="!normal-case tracking-wide">
            {task.category}
          </Badge>
        </div>
      )}

      <p className="text-text-secondary text-sm line-clamp-2 mb-3">
        {task.description}
      </p>

      {assigneeName && (
        <div
          className="flex items-center gap-2 mb-3 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <UserAvatar
            src={assigneeAvatar}
            name={assigneeName}
            username={task.claim?.username || assigneeName}
            size="sm"
            className="shrink-0"
            borderClass="border border-neon-cyan/40"
          />
          <p className="text-xs font-mono text-neon-cyan/80 truncate min-w-0">
            <span className="text-text-muted">
              {isCompleted ? 'Shipped by' : 'Claimed by'}{' '}
            </span>
            <ProfileLink
              username={task.claim?.username || assigneeName}
              className="text-neon-cyan"
            >
              {assigneeName}
            </ProfileLink>
            {isMine && !isCompleted ? (
              <span className="text-text-muted"> (you)</span>
            ) : null}
          </p>
        </div>
      )}

      {(hasActiveClaim || isCompleted) && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-text-muted mb-1">
            <span>PROGRESS</span>
            <span className="text-neon-cyan">
              {isCompleted ? 100 : progress}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-cyber-surface border border-cyber-border overflow-hidden">
            <div
              className="h-full rounded-full bg-neon-cyan transition-all duration-300"
              style={{
                width: `${isCompleted ? 100 : Math.min(100, Math.max(0, progress))}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isClaimable && onClaim && (
          <Button
            size="sm"
            onClick={() => onClaim(task.id)}
            disabled={claiming}
          >
            {claiming ? 'Claiming…' : 'Claim Task'}
          </Button>
        )}
        {onView && (
          <Button size="sm" variant="secondary" onClick={() => onView(task.id)}>
            {isMine ? 'Update' : 'View Details'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
