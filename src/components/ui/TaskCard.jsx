import Button from './Buttons';
import Badge from './Badge';
import UserAvatar from './UserAvatar';
import ProfileLink from './ProfileLink';
import {
  formatClaimHeldSince,
  CLAIM_STALE_DAYS,
} from '../../services/tasksService';

/**
 * Level / status rail on chamfered panels.
 * Uses inset box-shadow classes (see index.css) - Tailwind border-l is
 * disabled by .cyber-card { border: none }.
 */
function levelAccentClass(depth, { isCompleted, isStale } = {}) {
  if (isCompleted) return 'task-card-accent-success';
  if (isStale) return 'task-card-accent-warning';
  if (depth === 0) return 'task-card-accent-epic';
  if (depth === 1) return 'task-card-accent-medium';
  return 'task-card-accent-small';
}

function levelBadgeVariant(depth) {
  if (depth === 0) return 'purple';
  if (depth === 1) return 'neon';
  return 'default';
}

/** True when claim is aging toward auto-release (half of stale window). */
function isClaimStale(claimedAtIso) {
  if (!claimedAtIso) return false;
  const then = new Date(claimedAtIso).getTime();
  if (Number.isNaN(then)) return false;
  const days = (Date.now() - then) / (1000 * 60 * 60 * 24);
  const warnAfter = Math.max(3, Math.floor(CLAIM_STALE_DAYS / 2));
  return days >= warnAfter;
}

/**
 * Compact task card for kanban boards and task lists.
 * Semantic colors: completed=success, stale=warning (theme-mapped).
 */
const TaskCard = ({
  task,
  onClaim,
  onView,
  onRequestJoin,
  claiming = false,
  joining = false,
  currentUserId = null,
  joinRequestPending = false,
}) => {
  const isCompleted =
    task.status === 'completed' || task.dbStatus === 'Completed';
  const hasActiveClaim = Boolean(
    task.claim?.status === 'Active' || (task.claimedBy && !isCompleted)
  );
  const hasChildren = Boolean(task.hasChildren || task.childCount > 0);
  const depth = task.depth || 0;
  const showClaim =
    task.volunteerClaimable !== undefined
      ? task.volunteerClaimable && !hasActiveClaim && !isCompleted
      : !hasActiveClaim && !isCompleted && depth > 0 && !hasChildren;

  const showDifficultyEffort =
    depth > 0 && !hasChildren && (task.difficulty || task.estimatedEffort);

  const isMine =
    currentUserId &&
    task.claim?.userId &&
    String(task.claim.userId) === String(currentUserId);
  const progress =
    typeof task.progressPercent === 'number'
      ? task.progressPercent
      : task.claim?.progressPercent ?? 0;

  const childCount = task.childCount || 0;
  const completedChildren = task.completedChildCount || 0;
  const levelShort =
    task.levelShort ||
    (depth === 0 ? 'Epic' : depth === 1 ? 'Medium' : 'Small');

  const assigneeName = task.claimedBy || task.claim?.username || null;
  const assigneeAvatar =
    task.claimedByAvatarUrl ||
    task.claim?.avatarUrl ||
    task.claim?.avatar_url ||
    null;

  const heldLabel =
    task.claim?.heldLabel ||
    (hasActiveClaim && !isCompleted
      ? formatClaimHeldSince(task.claim?.claimedAt)
      : '');

  const stale =
    hasActiveClaim &&
    !isCompleted &&
    isClaimStale(task.claim?.claimedAt || task.claim?.lastActivityAt);

  const canRequestJoin =
    hasActiveClaim &&
    !isCompleted &&
    !hasChildren &&
    currentUserId &&
    !isMine &&
    !joinRequestPending &&
    onRequestJoin;

  const hasChecklist = Boolean(
    task.hasChecklist || (task.subtasks && task.subtasks.length > 0)
  );
  const showProgress =
    hasChildren || hasActiveClaim || isCompleted || hasChecklist;

  const effortLine = [task.difficulty, task.estimatedEffort]
    .filter(Boolean)
    .join(' · ');

  const progressColor = isCompleted
    ? 'text-semantic-success'
    : stale
      ? 'text-semantic-warning'
      : 'text-neon-cyan';
  const progressBarColor = isCompleted
    ? 'bg-semantic-success'
    : stale
      ? 'bg-semantic-warning'
      : 'bg-neon-cyan';

  return (
    <div
      className={`task-card cyber-card cyber-card-subtle p-4 transition-all group ${levelAccentClass(
        depth,
        { isCompleted, isStale: stale }
      )}`}
      style={
        depth > 0 && task.parentTaskId
          ? { marginLeft: Math.min(depth, 2) * 6 }
          : undefined
      }
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <h4 className="font-medium text-text-primary text-sm leading-snug min-w-0">
          {task.title}
        </h4>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <Badge
          variant={levelBadgeVariant(depth)}
          className="!normal-case tracking-wide"
        >
          {levelShort}
        </Badge>
        {isCompleted && (
          <Badge variant="success" className="!normal-case tracking-wide">
            Completed
          </Badge>
        )}
        {stale && (
          <Badge variant="warning" className="!normal-case tracking-wide">
            Needs attention
          </Badge>
        )}
        {task.category && (
          <Badge variant="purple" className="!normal-case tracking-wide">
            {task.category}
          </Badge>
        )}
        {hasChildren && (
          <Badge variant="default" className="!normal-case tracking-wide">
            {completedChildren}/{childCount} sub-tasks
          </Badge>
        )}
      </div>

      {showDifficultyEffort && effortLine && (
        <p className="text-xs font-mono text-text-muted mb-2">{effortLine}</p>
      )}

      {task.description ? (
        <p className="text-text-secondary text-sm line-clamp-2 mb-3">
          {task.description}
        </p>
      ) : null}

      {assigneeName && !hasChildren && (
        <div
          className="flex items-center gap-2 mb-2 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <UserAvatar
            src={assigneeAvatar}
            name={assigneeName}
            username={task.claim?.username || assigneeName}
            size="sm"
            className="shrink-0"
            borderClass={
              isCompleted
                ? 'border border-semantic-success/40'
                : stale
                  ? 'border border-semantic-warning/40'
                  : 'border border-neon-cyan/40'
            }
          />
          <div className="min-w-0 text-xs font-mono">
            <p
              className={`truncate ${
                isCompleted
                  ? 'text-semantic-success/90'
                  : 'text-neon-cyan/80'
              }`}
            >
              <span className="text-text-muted">
                {isCompleted ? 'Shipped by' : 'Claimed by'}{' '}
              </span>
              <ProfileLink
                username={task.claim?.username || assigneeName}
                className={
                  isCompleted ? 'text-semantic-success' : 'text-neon-cyan'
                }
              >
                {assigneeName}
              </ProfileLink>
              {isMine && !isCompleted ? (
                <span className="text-text-muted"> (you)</span>
              ) : null}
            </p>
            {heldLabel && !isCompleted && (
              <p
                className={`truncate ${
                  stale ? 'text-semantic-warning' : 'text-text-muted'
                }`}
                title={
                  stale
                    ? 'Claim is aging - update progress or it may auto-release'
                    : 'Time since claim'
                }
              >
                {heldLabel}
                {stale ? ' · update soon' : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {showProgress && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-text-muted mb-1">
            <span>PROGRESS</span>
            <span className={progressColor}>
              {isCompleted ? 100 : progress}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-cyber-surface border border-cyber-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
              style={{
                width: `${isCompleted ? 100 : Math.min(100, Math.max(0, progress))}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {showClaim && onClaim && (
          <Button
            size="sm"
            onClick={() => onClaim(task.id)}
            disabled={claiming}
          >
            {claiming ? 'Claiming…' : 'Claim Task'}
          </Button>
        )}
        {canRequestJoin && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRequestJoin(task.id)}
            disabled={joining}
          >
            {joining ? 'Sending…' : 'Request to Join'}
          </Button>
        )}
        {joinRequestPending && !isMine && hasActiveClaim && !isCompleted && (
          <span className="text-[10px] font-mono text-semantic-warning tracking-wide">
            Join pending
          </span>
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
