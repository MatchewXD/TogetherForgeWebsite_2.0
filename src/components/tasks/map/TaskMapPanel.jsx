/**
 * Task Map details panel: what the selected node is, plus the same actions
 * the board offers for it. Every action calls a handler from the board
 * (ProjectWorkspace), so rules, confirmations and messages are shared.
 */

import { Copy, Lock, Pencil, Plus, Undo2, X } from 'lucide-react';
import {
  mapNodeProgress,
  mapTaskState,
} from '../../../utils/taskMapLayout';
import {
  getTaskWaitingOnBlockers,
  taskLevelLabel,
} from '../../../services/tasksService';
import { getTaskActionState } from '../../../utils/taskActions';
import { CLAIMS_PAUSED_LINE } from '../../../constants/claimsEnabled';
import TaskCategoryBadge from '../../ui/TaskCategoryBadge';
import ClaimPolicyInfoTip from '../ClaimPolicyInfoTip';
import { STATE_STYLES, plainText } from './taskMapStyles';

// At least 44px tall on phones (tap targets); compact from sm up
const BTN =
  'min-h-11 sm:min-h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = `${BTN} border-neon-cyan bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25`;
const BTN_SECONDARY = `${BTN} border-cyber-border text-text-secondary hover:border-white/30 hover:text-white`;
const BTN_STAFF = `${BTN} sm:!min-h-0 !px-2.5 !py-1.5 text-xs border-forge-gold/50 bg-forge-gold/10 text-forge-gold hover:bg-forge-gold/20`;

function HowToRead({ isModerator }) {
  return (
    <div className="space-y-4">
      <h3 className="font-mono text-xs uppercase tracking-widest text-neon-cyan">
        How to read the map
      </h3>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
        <li>
          Each card in the top row is an <strong>Epic</strong>: a big piece
          of the game.
        </li>
        <li>Click an Epic to open the tasks inside it, in a row below.</li>
        <li>Click one of those to open its smaller sub-tasks underneath.</li>
        <li>
          Whatever you click shows up here, with the same buttons as the board
          {isModerator ? ', including staff tools' : ''}.
        </li>
        <li>
          Pick a skill or "Unclaimed only" to light up the paths that lead
          to that work. Finished branches fade back.
        </li>
      </ol>
      <p className="text-xs text-text-muted">
        Drag the background to move around; scroll or pinch to zoom.
        Keyboard: Left and Right move along a row, Down opens a branch,
        Up goes back.
      </p>
    </div>
  );
}

function TaskActions({ task, node, viewer, actions }) {
  const joinRequestPending = Boolean(viewer.pendingJoinTaskIds?.has?.(task.id));
  const st = getTaskActionState(task, {
    currentUserId: viewer.userId,
    isStaff: viewer.isModerator,
    joinRequestPending,
  });
  const claiming = viewer.claimingId === task.id;
  const joining = viewer.joiningId === task.id;
  const moving = viewer.unpublishingId === task.id;
  // The board offers Claim from the To Do column only
  const showClaim = st.showClaim && !st.isPendingReview;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {showClaim && (
          <>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => actions.onClaim(task.id)}
              disabled={claiming}
            >
              {claiming ? 'Claiming…' : 'Claim Task'}
            </button>
            <ClaimPolicyInfoTip category={task.category} holdClaim={task.holdClaim} />
          </>
        )}
        {st.canWorkOnClaim && (
          <>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => actions.onOpenTask(task.id)}
            >
              Update progress
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => actions.onSubmitForReview(task.id)}
            >
              Submit for review
            </button>
          </>
        )}
        {viewer.isModerator && st.isPendingReview && !st.isCompleted && (
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => actions.onOpenTask(task.id)}
          >
            Review
          </button>
        )}
        {st.canRequestJoin && (
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() => actions.onRequestJoin(task.id)}
            disabled={joining}
          >
            {joining ? 'Sending…' : 'Request to Join'}
          </button>
        )}
        <button
          type="button"
          className={st.canWorkOnClaim || showClaim ? BTN_SECONDARY : BTN_PRIMARY}
          onClick={() => actions.onOpenTask(task.id)}
        >
          Open full task
        </button>
        {node?.hasChildren && (
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() => actions.onToggle(node)}
          >
            {node.expanded ? 'Close branch' : 'Open branch'}
          </button>
        )}
      </div>

      {st.showClaimsPausedLine && (
        <p className="text-xs leading-snug text-text-muted">{CLAIMS_PAUSED_LINE}</p>
      )}
      {st.showStaffOnlyInsteadOfClaim && (
        <p className="text-xs text-forge-gold">Staff Only: staff will take this one.</p>
      )}
      {joinRequestPending && !st.isMine && st.hasActiveClaim && !st.isCompleted && (
        <p className="font-mono text-[11px] tracking-wide text-semantic-warning">
          Join pending
        </p>
      )}

      {viewer.isModerator && (
        <div className="rounded-lg border border-forge-gold/30 bg-forge-gold/[0.04] p-2.5">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-forge-gold">
            Staff
          </p>
          <div className="flex flex-wrap gap-1.5">
            {task.canAddChild !== false && (
              <button
                type="button"
                className={BTN_STAFF}
                onClick={() => actions.onAddChild(task)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add sub-task
              </button>
            )}
            <button
              type="button"
              className={BTN_STAFF}
              onClick={() => actions.onEdit(task)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              className={BTN_STAFF}
              onClick={() => actions.onDuplicate(task.id)}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Duplicate
            </button>
            {st.canMoveToStaging && (
              <button
                type="button"
                className={BTN_STAFF}
                onClick={() => actions.onMoveToStaging(task)}
                disabled={moving}
                title="Remove from the public board and move back to Staging"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                {moving ? 'Moving…' : 'Move to Staging'}
              </button>
            )}
          </div>
          {!st.canMoveToStaging && (
            <p className="mt-2 text-[11px] leading-snug text-text-muted">
              Small tasks move to Staging with their parent. To delete one, use
              Edit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskMapPanel({
  node,
  ancestors,
  viewer,
  actions,
  onClose,
}) {
  if (!node) return <HowToRead isModerator={viewer.isModerator} />;

  const { task, tree } = node;
  const state = mapTaskState(task);
  const style = STATE_STYLES[state];
  const percent = mapNodeProgress(tree);
  const blockers = getTaskWaitingOnBlockers(task).filter((b) => !b.isComplete);
  const description = plainText(task.description);
  const meta = [
    taskLevelLabel(node.depth),
    task.difficulty ? `${task.difficulty} difficulty` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {ancestors.length > 0 && (
            <p className="mb-1 text-xs text-text-muted">
              {ancestors.map((a) => a.task.title).join(' › ')}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {meta}
            {task.category ? (
              <TaskCategoryBadge category={task.category} size="sm" />
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-cyber-border text-text-secondary hover:text-white sm:h-8 sm:w-8"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div>
        <h3 className="text-lg font-bold leading-snug text-white">{task.title}</h3>
        <p
          className={`mt-2 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest ${style.text}`}
        >
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          {style.label}
          {task.claimedBy ? (
            <span className="normal-case tracking-normal text-text-secondary">
              · {task.claimedBy}
            </span>
          ) : null}
        </p>
      </div>

      <TaskActions task={task} node={node} viewer={viewer} actions={actions} />

      {node.hasChildren && (
        <div className="space-y-1.5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={`${percent}% of tasks done`}
          >
            <div className={`h-full ${style.bar}`} style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-text-secondary">
            {tree.leafDone} of {tree.leafTotal} tasks done ({percent}%) ·{' '}
            {tree.children.length} direct{' '}
            {tree.children.length === 1 ? 'branch' : 'branches'}
          </p>
        </div>
      )}

      {description ? (
        <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
      ) : (
        <p className="text-sm text-text-muted">No description yet.</p>
      )}

      {blockers.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Waiting on
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-text-secondary">
            {blockers.slice(0, 6).map((b, i) => (
              <li key={b.id || `${b.title}-${i}`}>{b.title}</li>
            ))}
            {blockers.length > 6 && <li>and {blockers.length - 6} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
