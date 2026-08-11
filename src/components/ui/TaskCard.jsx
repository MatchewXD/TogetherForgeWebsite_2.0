import Button from './Buttons';
import Badge from './Badge';
import TaskCategoryBadge from './TaskCategoryBadge';
import UserAvatar from './UserAvatar';
import UserNameWithBadge from '../badges/UserNameWithBadge';
import {
  formatClaimHeldSince,
  getClaimAutoReleaseInfo,
} from '../../services/tasksService';
import { progressTone } from '../../utils/progressTone';

/**
 * Hierarchy rail on chamfered panels (see index.css).
 * Level classes always apply; status can stack so Epic/Medium/Small stay clear.
 */
function levelAccentClass(depth, { isCompleted, isStale } = {}) {
  const level =
    depth === 0
      ? 'task-card-accent-epic'
      : depth === 1
        ? 'task-card-accent-medium'
        : 'task-card-accent-small';
  if (isCompleted) return `${level} task-card-accent-success`;
  if (isStale) return `${level} task-card-accent-warning`;
  return level;
}

function levelBadgeVariant(depth) {
  // Epic = gold (stands out vs category purple); Medium = cyan; Small = muted
  if (depth === 0) return 'gold';
  if (depth === 1) return 'neon';
  return 'default';
}

/**
 * Compact task card for kanban boards and task lists.
 * Semantic colors: completed=success, stale=warning (theme-mapped).
 */
const TaskCard = ({
  task,
  onClaim,
  onView,
  onUpdate,
  onRequestJoin,
  claiming = false,
  joining = false,
  currentUserId = null,
  joinRequestPending = false,
  /** Project Lead / Admin / Moderator - Update on completed tasks */
  canStaffUpdate = false,
  /** Staff: open create form pre-filled from this task */
  onDuplicate = null,
}) => {
  const isCompleted =
    task.status === 'completed' || task.dbStatus === 'Completed';
  const isPendingReview =
    task.status === 'in_review' ||
    task.dbStatus === 'InReview' ||
    task.claim?.status === 'PendingReview' ||
    Boolean(task.readyForParentReview);
  const hasActiveClaim = Boolean(
    task.claim?.status === 'Active' ||
      task.claim?.status === 'PendingReview' ||
      (task.claimedBy && !isCompleted)
  );
  const hasChildren = Boolean(task.hasChildren || task.childCount > 0);
  const depth = task.depth || 0;
  const isLocked = Boolean(task.isLocked);
  const lockedWaitingOn = Array.isArray(task.lockedWaitingOn)
    ? task.lockedWaitingOn
    : [];
  const showClaim =
    !isLocked &&
    (task.volunteerClaimable !== undefined
      ? task.volunteerClaimable && !hasActiveClaim && !isCompleted
      : !hasActiveClaim && !isCompleted && depth > 0 && !hasChildren);

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
    (depth === 0 ? 'Epic' : depth === 1 ? 'Mid' : 'Small');

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

  const releaseInfo =
    hasActiveClaim && !isCompleted && !isPendingReview
      ? getClaimAutoReleaseInfo(task.claim)
      : null;
  const stale = Boolean(releaseInfo?.warn);

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

  // Prefix difficulty so "Medium" never looks like hierarchy "Mid"
  const effortLine = [
    task.difficulty ? `Difficulty: ${task.difficulty}` : null,
    task.estimatedEffort || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const { text: progressColor, bar: progressBarColor } = progressTone(
    isCompleted ? 100 : progress,
    { isCompleted, isStale: stale }
  );

  const isEpic = depth === 0;
  const isMedium = depth === 1;

  return (
    <div
      className={`task-card cyber-card cyber-card-subtle transition-all group ${
        isEpic ? 'p-4 sm:p-5' : 'p-4'
      } ${levelAccentClass(depth, { isCompleted, isStale: stale })} ${
        isLocked
          ? 'opacity-60 grayscale-[0.45] border-white/10 shadow-none'
          : ''
      }`}
      style={
        depth > 0
          ? { marginLeft: Math.min(depth, 2) * 14 }
          : undefined
      }
      data-task-level={levelShort}
      data-locked={isLocked ? 'true' : undefined}
    >
      {/* Level chip first so hierarchy is obvious in All tasks */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <Badge
          variant={levelBadgeVariant(depth)}
          className={`!normal-case tracking-widest ${
            isEpic ? 'text-[11px] px-3.5 py-1 shadow-sm' : 'tracking-wide'
          }`}
        >
          {levelShort}
        </Badge>
        {isLocked && (
          <Badge
            variant="default"
            className="!normal-case tracking-wide !bg-white/5 !text-text-muted !border-white/15"
          >
            Locked
          </Badge>
        )}
        {isCompleted && (
          <Badge variant="success" className="!normal-case tracking-wide">
            Completed
          </Badge>
        )}
        {isPendingReview && !isCompleted && (
          <Badge variant="warning" className="!normal-case tracking-wide">
            Ready for Review
          </Badge>
        )}
        {task.claim?.primaryGithubUrl && (
          <a
            href={task.claim.primaryGithubUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center rounded-full border border-neon-cyan/35 bg-neon-cyan/10 px-2 py-0.5 text-[10px] font-mono tracking-wide text-neon-cyan hover:bg-neon-cyan/20"
            title="Open GitHub evidence from submission"
          >
            GitHub
          </a>
        )}
        {stale && !isPendingReview && (
          <Badge
            variant="warning"
            className="!normal-case tracking-wide"
            title={releaseInfo?.detailLabel || 'Claim may auto-release soon'}
          >
            {releaseInfo?.urgent
              ? releaseInfo.shortLabel || 'Release due'
              : releaseInfo?.shortLabel || 'Needs attention'}
          </Badge>
        )}
        {task.scopeRequest?.status === 'pending' && (
          <Badge variant="warning" className="!normal-case tracking-wide">
            Scope help
          </Badge>
        )}
        {task.category && (
          <TaskCategoryBadge category={task.category} size="sm" />
        )}
        {hasChildren && (
          <Badge variant="default" className="!normal-case tracking-wide">
            {completedChildren}/{childCount} sub-tasks
          </Badge>
        )}
      </div>

      <div className="flex justify-between items-start gap-2 mb-2">
        <h4
          className={`leading-snug min-w-0 ${
            isEpic
              ? 'font-bold text-base sm:text-[1.05rem] text-white'
              : isMedium
                ? 'font-semibold text-sm text-text-primary'
                : 'font-medium text-sm text-text-primary'
          }`}
        >
          {task.title}
        </h4>
      </div>

      {showDifficultyEffort && effortLine && (
        <p className="text-xs font-mono text-text-muted mb-2">{effortLine}</p>
      )}

      {isLocked && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 mb-3">
          <p className="text-[11px] font-mono tracking-wide text-text-muted uppercase mb-0.5">
            Locked
          </p>
          <p className="text-text-secondary text-xs leading-snug line-clamp-2">
            Waiting on:{' '}
            <span className="text-text-primary/90">
              {lockedWaitingOn.length
                ? lockedWaitingOn.join(', ')
                : 'blocking tasks'}
            </span>
          </p>
        </div>
      )}

      {task.description ? (
        <div className="rounded-lg border border-cyber-border/80 bg-cyber-bg/40 px-2.5 py-2 mb-3">
          <p className="text-text-secondary text-sm line-clamp-2 leading-snug">
            {task.description}
          </p>
        </div>
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
              <UserNameWithBadge
                username={task.claim?.username || assigneeName}
                displayName={assigneeName}
                pinnedBadgeKey={
                  task.claim?.pinnedBadgeKey ||
                  task.claim?.pinned_badge_key ||
                  null
                }
                linkClassName={
                  isCompleted ? 'text-semantic-success' : 'text-neon-cyan'
                }
              />
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
                  releaseInfo?.detailLabel ||
                  (stale
                    ? 'Claim is aging - update progress or it may auto-release'
                    : 'Time since claim')
                }
              >
                {heldLabel}
                {stale
                  ? releaseInfo?.urgent
                    ? ' · release soon'
                    : ' · update soon'
                  : ''}
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
            {isCompleted
              ? 'View Details'
              : isMine
                ? 'Update'
                : 'View Details'}
          </Button>
        )}
        {canStaffUpdate && onDuplicate && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e?.stopPropagation?.();
              onDuplicate(task.id);
            }}
            title="Duplicate as a new To Do task"
          >
            Duplicate
          </Button>
        )}
        {isCompleted && canStaffUpdate && onUpdate && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdate(task.id)}
          >
            Update
          </Button>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
