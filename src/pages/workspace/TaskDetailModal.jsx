/**
 * Project workspace: task detail dialog (progress, claim, review, staff actions).
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import Modal from '../../components/ui/Modal';
import { getTaskCategoryTextClass, getTaskCategoryStyle } from '../../constants/taskCategories';
import StaffOnlyBadge from '../../components/ui/StaffOnlyBadge';
import {
  isClaimAutoReleaseExempt,
  HOLD_CLAIM_DETAIL_COPY,
  canMovePublicTaskToStaging,
  HOLD_CLAIM_STAFF_HELP,
  getClaimAutoReleaseInfo,
  CLAIM_AUTO_RELEASE_POLICY_COPY,
  CLAIM_IDLE_RELEASE_DAYS,
  CLAIM_MAX_DURATION_DAYS,
  isChecklistComplete,
} from '../../services/tasksService';
import Badge from '../../components/ui/Badge';
import StaffToolsBar from '../../components/ui/StaffToolsBar';
import Button from '../../components/ui/Buttons';
import {
  Undo2,
  Copy,
  Pencil,
  ExternalLink,
  Github,
} from 'lucide-react';
import WaitingOnLinks from '../../components/ui/WaitingOnLinks';
import SubTaskList from '../../components/ui/SubTaskList';
import { progressTone } from '../../utils/progressTone';
import UserAvatar from '../../components/ui/UserAvatar';
import OpenConductCaseButton from '../../components/conduct/OpenConductCaseButton';
import ClaimPolicyInfoTip from '../../components/tasks/ClaimPolicyInfoTip';
import { CLAIMS_PAUSED_LINE } from '../../constants/claimsEnabled';

export default function TaskDetailModal({
  actionBusy,
  canEditProgress,
  canManageJoinRequests,
  canReturnClaim,
  canReviewSubmission,
  canStaffCompleteParent,
  canSubmitForReview,
  claimantTrust,
  claimHelperNames,
  claimingId,
  closeTaskPanel,
  handleAcceptReview,
  handleCancelScopeRequest,
  handleClaim,
  handleMovePublicToStaging,
  handleRejectAsFakeWork,
  handleRejectReview,
  handleRequestScopeHelp,
  handleResolveJoin,
  handleReturn,
  handleStaffCompleteParent,
  handleToggleHoldClaim,
  handleViewTask,
  isClaimHolder,
  isModerator,
  isPendingReview,
  isStagingBoard,
  joinRequests,
  myPendingJoinRequest,
  notesDraft,
  openCreateSubTask,
  openDuplicateTaskForm,
  openEditTaskForm,
  openSubmitReviewFlow,
  openTaskDetail,
  progressDraft,
  projectSlug,
  projectUuid,
  reviewActionBusy,
  reviewFeedbackDraft,
  scopeHelpDraft,
  scopeHelpOpen,
  selectedBreadcrumb,
  selectedChildren,
  selectedIsLeaf,
  selectedTask,
  selectedTaskCanClaim,
  selectedTaskClaimsPaused,
  selectedTaskShowsBlocked,
  selectedTaskWaitBlockers,
  setNotesDraft,
  setProgressDraft,
  setReviewFeedbackDraft,
  setScopeHelpDraft,
  setScopeHelpOpen,
  submitReviewOpen,
  subtasksDraft,
  toggleSubtask,
  unpublishingId,
  user,
}) {
  return (
    <Modal
      isOpen={Boolean(selectedTask) && !submitReviewOpen}
      onClose={closeTaskPanel}
      title={selectedTask?.title || 'Task'}
      size="lg"
    >
      {selectedTask && (
        <div className="space-y-4">
          {/* Header: path then meta (stacked on mobile so they never collide) */}
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-3 sm:gap-y-1.5">
              {selectedBreadcrumb.length > 1 ? (
                <nav
                  aria-label="Parent path"
                  className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs min-w-0 w-full sm:flex-1 sm:w-auto"
                >
                  {selectedBreadcrumb.map((crumb, i) => {
                    const isLast = i === selectedBreadcrumb.length - 1;
                    return (
                      <span
                        key={crumb.id}
                        className="inline-flex items-center gap-1 min-w-0 max-w-full"
                      >
                        {i > 0 && (
                          <span className="text-white/25 shrink-0" aria-hidden>
                            →
                          </span>
                        )}
                        {isLast ? (
                          <span
                            className="truncate max-w-[min(12rem,70vw)] text-text-secondary"
                            title={crumb.title}
                          >
                            {crumb.title}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void openTaskDetail(crumb.id)}
                            className="inline-flex max-w-[min(11rem,70vw)] items-center rounded-md border border-neon-cyan/25 bg-transparent px-2 py-0.5 text-left text-xs font-medium text-neon-cyan/80 shadow-none hover:border-neon-cyan/45 hover:bg-neon-cyan/10 hover:text-neon-cyan active:bg-neon-cyan/15 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50"
                            title={`Open ${crumb.title}`}
                          >
                            <span className="truncate">{crumb.title}</span>
                          </button>
                        )}
                      </span>
                    );
                  })}
                </nav>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono tracking-wide text-text-muted w-full sm:w-auto sm:max-w-[min(100%,22rem)] sm:justify-end sm:text-right sm:shrink-0">
                {selectedTask.levelShort && (
                  <span className="shrink-0">{selectedTask.levelShort}</span>
                )}
                {selectedTask.category && (
                  <>
                    {selectedTask.levelShort && (
                      <span className="text-white/20 shrink-0" aria-hidden>
                        ·
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 font-medium shrink-0 ${getTaskCategoryTextClass(
                        selectedTask.category
                      )}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          getTaskCategoryStyle(selectedTask.category).swatch
                        }`}
                        aria-hidden
                      />
                      {selectedTask.category}
                    </span>
                  </>
                )}
                <>
                  {(selectedTask.levelShort || selectedTask.category) && (
                    <span className="text-white/20 shrink-0" aria-hidden>
                      ·
                    </span>
                  )}
                  <span className="shrink-0">
                    {selectedTask.status === 'todo'
                      ? 'To Do'
                      : selectedTask.status === 'in_progress'
                        ? 'In Progress'
                        : selectedTask.status === 'in_review'
                          ? 'Ready for Review'
                          : selectedTask.status === 'completed'
                            ? 'Completed'
                            : String(selectedTask.status || 'Open')}
                  </span>
                </>
                {selectedTask.staffOnly && (
                  <>
                    <span className="text-white/20 shrink-0" aria-hidden>
                      ·
                    </span>
                    <StaffOnlyBadge
                      key={selectedTask.id}
                      compact
                      align="end"
                    />
                  </>
                )}
                {isClaimAutoReleaseExempt(selectedTask) &&
                  selectedTask.status !== 'completed' && (
                    <>
                      <span className="text-white/20 shrink-0" aria-hidden>
                        ·
                      </span>
                      <Badge
                        variant="default"
                        className="!normal-case tracking-wide"
                        title={HOLD_CLAIM_DETAIL_COPY}
                      >
                        Held
                      </Badge>
                    </>
                  )}
                {!selectedTask.isEpic &&
                  !selectedTask.hasChildren &&
                  (selectedTask.difficulty ||
                    selectedTask.estimatedEffort) && (
                    <>
                      <span className="text-white/20 shrink-0" aria-hidden>
                        ·
                      </span>
                      <span className="shrink-0">
                        {[
                          selectedTask.difficulty
                            ? `Difficulty: ${selectedTask.difficulty}`
                            : null,
                          selectedTask.estimatedEffort || null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </>
                  )}
                {selectedTask.hasChildren && (
                  <>
                    <span className="text-white/20 shrink-0" aria-hidden>
                      ·
                    </span>
                    <span className="shrink-0">
                      {selectedTask.completedChildCount}/
                      {selectedTask.childCount} sub-tasks
                    </span>
                  </>
                )}
              </div>
            </div>

            {isModerator ? (
              <StaffToolsBar>
                {!isStagingBoard &&
                canMovePublicTaskToStaging(selectedTask) ? (
                  <Button
                    size="sm"
                    variant="gold"
                    className="gap-1.5 !py-1 !px-2 text-xs"
                    onClick={() => handleMovePublicToStaging(selectedTask)}
                    disabled={Boolean(unpublishingId)}
                    title="Move this work back to the staging board"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    {unpublishingId === selectedTask.id
                      ? 'Moving…'
                      : 'To Staging'}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="gold"
                  className="gap-1.5 !py-1 !px-2 text-xs"
                  onClick={() => openDuplicateTaskForm(selectedTask)}
                  title="Create a new To Do task with the same details"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="gold"
                  className="gap-1.5 !py-1 !px-2 text-xs"
                  onClick={() => openEditTaskForm(selectedTask)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Task
                </Button>
                {selectedTask.status !== 'completed' ? (
                  <Button
                    size="sm"
                    variant="gold"
                    className="gap-1.5 !py-1 !px-2 text-xs"
                    onClick={() => handleToggleHoldClaim(selectedTask)}
                    disabled={actionBusy}
                    title={
                      selectedTask.holdClaim
                        ? 'Turn auto-release back on for this card'
                        : HOLD_CLAIM_STAFF_HELP
                    }
                  >
                    {selectedTask.holdClaim ? 'Remove hold' : 'Hold claim'}
                  </Button>
                ) : null}
              </StaffToolsBar>
            ) : null}

            {selectedTask.description ? (
              <div className="rounded-lg border border-cyber-border/80 bg-cyber-bg/40 px-3 py-2.5">
                <p className="font-mono tracking-widest text-[10px] text-text-muted uppercase mb-1.5">
                  Description
                </p>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {selectedTask.description}
                </p>
              </div>
            ) : null}

            {/* Locked / Blocked by */}
            {(selectedTaskShowsBlocked ||
              (selectedTask.blockedBy &&
                selectedTask.blockedBy.length > 0)) && (
              <div
                className={`rounded-lg border px-3 py-2.5 ${
                  selectedTaskShowsBlocked
                    ? 'border-white/15 bg-white/[0.04]'
                    : 'border-cyber-border/80 bg-cyber-bg/40'
                }`}
              >
                <p className="font-mono tracking-widest text-[10px] text-text-muted uppercase mb-1.5">
                  {selectedTaskShowsBlocked
                    ? 'Blocked'
                    : selectedTask.dependencyOverride
                      ? 'Dependencies (override on)'
                      : 'Blocked by'}
                </p>
                {selectedTaskShowsBlocked ? (
                  <p className="text-sm text-text-secondary leading-relaxed">
                    <WaitingOnLinks
                      task={selectedTask}
                      onOpen={handleViewTask}
                    />
                  </p>
                ) : (
                  <p className="text-sm text-text-secondary leading-relaxed">
                    <WaitingOnLinks
                      task={selectedTask}
                      blockers={selectedTask.blockedBy || []}
                      onOpen={handleViewTask}
                      prefix="Depends on:"
                      emptyText=""
                      showCompleteMark
                    />
                    {selectedTask.dependencyOverride
                      ? ' · staff override allows claiming'
                      : ''}
                  </p>
                )}
                {isModerator && selectedTask.isLocked && (
                  <p className="text-[11px] text-text-muted mt-1.5">
                    Edit task to clear blockers or enable dependency override.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Hierarchy: volunteers only see this when children exist; staff can add */}
          {(selectedChildren.length > 0 ||
            (isModerator && selectedTask.canAddChild !== false)) && (
            <SubTaskList
              items={selectedChildren}
              parentDepth={selectedTask.depth || 0}
              onOpen={handleViewTask}
              onClaim={handleClaim}
              claimingId={claimingId}
              canClaim={Boolean(user)}
              isStaff={isModerator}
              canAdd={Boolean(
                isModerator && selectedTask.canAddChild !== false
              )}
              onAdd={
                isModerator
                  ? () => openCreateSubTask(selectedTask)
                  : undefined
              }
              hideEmptyMessage={!isModerator}
            />
          )}

          {/* Progress for parents / non-editors (always labeled Progress) */}
          {!canEditProgress &&
            (selectedTask.hasChildren ||
              selectedTask.hasChecklist ||
              (selectedTask.subtasks && selectedTask.subtasks.length > 0) ||
              selectedTask.claim?.status === 'Active' ||
              selectedTask.progressPercent > 0 ||
              selectedTask.status === 'completed') && (
              <div>
                {(() => {
                  const pct =
                    selectedTask.status === 'completed'
                      ? 100
                      : Math.min(
                          100,
                          Math.max(0, selectedTask.progressPercent ?? 0)
                        );
                  const tone = progressTone(pct, {
                    isCompleted: selectedTask.status === 'completed',
                  });
                  return (
                    <>
                      <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-text-muted mb-1">
                        <span>PROGRESS</span>
                        <span className={tone.text}>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-cyber-surface border border-cyber-border overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${tone.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

          {/* Read-only checklist on leaf tasks for non-claimants */}
          {!canEditProgress &&
            selectedIsLeaf &&
            selectedTask.subtasks?.length > 0 && (
              <div>
                <div className="text-xs font-mono tracking-widest text-text-muted mb-2">
                  CHECKLIST
                </div>
                <ul className="space-y-1.5 text-sm text-text-secondary">
                  {selectedTask.subtasks.map((s, i) => (
                    <li key={s.id || i} className="flex gap-2">
                      <span className="text-neon-cyan font-mono">
                        {s.done ? '✓' : '○'}
                      </span>
                      <span
                        className={s.done ? 'line-through opacity-70' : ''}
                      >
                        {s.label || s.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Claimed leaf: assignee */}
          {selectedTask.claimedBy && !selectedTask.hasChildren && (
            <div className="flex items-center gap-2">
              <UserAvatar
                src={
                  selectedTask.claimedByAvatarUrl ||
                  selectedTask.claim?.avatarUrl ||
                  selectedTask.claim?.avatar_url
                }
                name={selectedTask.claimedBy}
                username={
                  selectedTask.claim?.username || selectedTask.claimedBy
                }
                size="sm"
              />
              <div className="text-xs font-mono text-neon-cyan">
                <p>
                  {selectedTask.status === 'completed'
                    ? 'Shipped by'
                    : 'Claimed by'}{' '}
                  {selectedTask.claimedBy}
                </p>
                {selectedTask.status !== 'completed' &&
                  selectedTask.claim?.claimedAt && (
                    <p className="text-text-muted">
                      {selectedTask.claim.heldLabel ||
                        `since ${new Date(
                          selectedTask.claim.claimedAt
                        ).toLocaleString()}`}
                    </p>
                  )}
                {isModerator && claimantTrust && (
                  <p className="text-text-muted mt-0.5">
                    <span
                      className={
                        claimantTrust.trustTier === 'trusted'
                          ? 'text-emerald-300'
                          : claimantTrust.trustTier === 'new'
                            ? 'text-semantic-warning'
                            : 'text-neon-cyan'
                      }
                    >
                      {claimantTrust.trustLabel}
                    </span>
                    {' · '}
                    {claimantTrust.acceptedTasks} accepted · load{' '}
                    {claimantTrust.activeClaims}+
                    {claimantTrust.pendingReview} in review ·{' '}
                    {claimantTrust.accountAgeDays}d
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Claim owner / staff: moderate join requests */}
          {joinRequests.length > 0 && canManageJoinRequests && (
            <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 p-3 space-y-2">
              <div className="text-xs font-mono tracking-widest text-text-muted uppercase">
                Join requests
              </div>
              {joinRequests.map((jr) => (
                <div
                  key={jr.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="text-white">{jr.username}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={actionBusy}
                      onClick={() => handleResolveJoin(jr.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={actionBusy}
                      onClick={() => handleResolveJoin(jr.id, false)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Requester (not claim owner): read-only status only - no Approve/Decline */}
          {!canManageJoinRequests && myPendingJoinRequest && (
            <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 px-3 py-2 text-sm text-text-secondary">
              Your join request is pending. Waiting on{' '}
              <span className="text-white">
                {selectedTask.claimedBy || 'the claim holder'}
              </span>
              .
            </div>
          )}

          {/* Claim holder only: progress + checklist on leaf tasks */}
          {canEditProgress && (
            <>
              {(() => {
                const info = getClaimAutoReleaseInfo(selectedTask.claim, {
                  holdClaim: isClaimAutoReleaseExempt(selectedTask),
                });
                return (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                      info.urgent
                        ? 'border-semantic-warning/50 bg-semantic-warning/10 text-semantic-warning'
                        : info.warn
                          ? 'border-semantic-warning/30 bg-semantic-warning/5 text-text-secondary'
                          : 'border-cyber-border/80 bg-cyber-bg/40 text-text-muted'
                    }`}
                  >
                    <p className="font-mono tracking-widest text-[10px] uppercase mb-1 opacity-90">
                      Claim timer
                    </p>
                    <p>
                      {info.detailLabel || CLAIM_AUTO_RELEASE_POLICY_COPY}
                    </p>
                    {!info.detailLabel && (
                      <p className="mt-1 opacity-90">
                        Idle: {CLAIM_IDLE_RELEASE_DAYS}d without progress notes
                        / checklist / status · Hard max:{' '}
                        {CLAIM_MAX_DURATION_DAYS}d from claim.
                      </p>
                    )}
                  </div>
                );
              })()}
              <div>
                {(() => {
                  const pct = Math.min(99, Number(progressDraft) || 0);
                  const tone = progressTone(pct);
                  const checklistDriven = subtasksDraft.length > 0;
                  return (
                    <>
                      <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-text-muted mb-1">
                        <span>PROGRESS</span>
                        <span className={tone.text}>{pct}%</span>
                      </div>
                      {/* Single colored bar; range is invisible overlay when not checklist-driven */}
                      <div className="relative h-2 rounded-full bg-cyber-surface border border-cyber-border overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${tone.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                        {!checklistDriven && (
                          <input
                            type="range"
                            min={0}
                            max={99}
                            step={5}
                            value={pct}
                            onChange={(e) =>
                              setProgressDraft(
                                Math.min(99, Number(e.target.value))
                              )
                            }
                            aria-label="Task progress"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">
                        {checklistDriven
                          ? 'Progress follows the checklist below.'
                          : 'Drag the bar to set progress. '}
                        100% requires a Project Lead to accept your review.
                      </p>
                    </>
                  );
                })()}
              </div>

              {subtasksDraft.length > 0 && (
                <div id="task-checklist-section">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="text-sm text-text-secondary font-mono">
                      Checklist
                    </div>
                    <span className="text-[11px] font-mono text-text-muted">
                      {subtasksDraft.filter((s) => s.done).length}/
                      {subtasksDraft.length} done
                      {!isChecklistComplete(subtasksDraft)
                        ? ' · required before review'
                        : ''}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {subtasksDraft.map((s) => (
                      <li key={s.id}>
                        <label className="flex items-start gap-2 text-sm text-text-primary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(s.done)}
                            onChange={() => toggleSubtask(s.id)}
                            className="mt-0.5 accent-cyan-400"
                          />
                          <span
                            className={
                              s.done ? 'line-through text-text-muted' : ''
                            }
                          >
                            {s.label}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-sm text-text-secondary font-mono mb-1.5">
                  Working notes
                </label>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={2}
                  placeholder="What did you ship? What is blocked?"
                  className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors text-sm"
                />
              </div>

              {claimHelperNames.length > 0 && (
                <div>
                  <div className="text-sm text-text-secondary font-mono mb-2">
                    Helpers
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {claimHelperNames.map((name) => (
                      <Badge
                        key={name}
                        variant="default"
                        className="!normal-case tracking-wide"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.claim?.reviewFeedback && (
                <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2 text-sm text-text-secondary">
                  <span className="font-semibold text-semantic-warning">
                    Review feedback:{' '}
                  </span>
                  {selectedTask.claim.reviewFeedback}
                </div>
              )}

              {/* Light secondary: scope help (does not compete with primary actions) */}
              {isClaimHolder &&
                selectedTask.claim?.status === 'Active' &&
                !selectedTask.scopeRequest && (
                  <div className="pt-0.5">
                    {!scopeHelpOpen ? (
                      <button
                        type="button"
                        onClick={() => setScopeHelpOpen(true)}
                        disabled={actionBusy}
                        className="text-xs text-text-muted hover:text-text-secondary underline decoration-white/15 underline-offset-2 transition-colors disabled:opacity-50"
                      >
                        This is bigger than expected
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-md border border-cyber-border/70 bg-cyber-surface/40 px-2.5 py-2">
                        <textarea
                          value={scopeHelpDraft}
                          onChange={(e) => setScopeHelpDraft(e.target.value)}
                          rows={2}
                          maxLength={2000}
                          placeholder="What is larger than expected?"
                          className="w-full bg-cyber-surface border border-cyber-border rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleRequestScopeHelp}
                            disabled={
                              actionBusy || scopeHelpDraft.trim().length < 10
                            }
                            className="text-xs font-medium text-neon-cyan hover:text-white disabled:opacity-50"
                          >
                            {actionBusy ? 'Sending…' : 'Request breakdown'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setScopeHelpOpen(false);
                              setScopeHelpDraft('');
                            }}
                            disabled={actionBusy}
                            className="text-xs text-text-muted hover:text-text-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {isClaimHolder &&
                selectedTask.scopeRequest?.status === 'pending' && (
                  <p className="text-xs text-text-muted">
                    <span className="text-semantic-warning">
                      Scope help requested.
                    </span>{' '}
                    A Project Lead will follow up.{' '}
                    <button
                      type="button"
                      onClick={handleCancelScopeRequest}
                      disabled={actionBusy}
                      className="underline decoration-white/20 hover:text-text-secondary"
                    >
                      Cancel request
                    </button>
                  </p>
                )}

              {/* Primary actions at bottom of working modal */}
              <div className="flex flex-wrap gap-2 pt-3 mt-1 border-t border-cyber-border">
                {canSubmitForReview && (
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => void openSubmitReviewFlow()}
                    disabled={
                      actionBusy || !isChecklistComplete(subtasksDraft)
                    }
                    title={
                      !isChecklistComplete(subtasksDraft)
                        ? 'Complete every checklist item first'
                        : 'Continue to submit for review'
                    }
                  >
                    Submit for Review
                  </Button>
                )}
                {canReturnClaim && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleReturn}
                    disabled={actionBusy}
                  >
                    Return Claim
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Staff can claim parent tasks, which have no progress editor
              above; still let the holder give the claim back. */}
          {canReturnClaim && !canEditProgress && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-cyber-border">
              <p className="text-sm text-text-secondary">
                You hold the claim on this task.
              </p>
              <Button
                size="sm"
                variant="danger"
                onClick={handleReturn}
                disabled={actionBusy}
              >
                Return Claim
              </Button>
            </div>
          )}

          {/* Staff: scope help is handled on the Moderator Dashboard */}
          {isModerator &&
            selectedTask.scopeRequest?.status === 'pending' && (
              <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-semantic-warning">
                    Scope help pending
                  </span>
                  {selectedTask.scopeRequest.username
                    ? ` from ${selectedTask.scopeRequest.username}`
                    : ''}
                  . Review and resolve on the Moderator Dashboard.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  to="/moderator?tab=scope"
                >
                  Open Scope help queue
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

          {/* Staff: close Epic/Medium when all children are Completed */}
          {canStaffCompleteParent && selectedTask && (
            <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 p-4 space-y-3">
              <div className="text-sm font-semibold text-semantic-warning">
                Ready for Review
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                All sub-tasks have been completed. Confirm integration and
                polish, then mark this task complete.
              </p>
              <p className="text-xs font-mono text-text-muted">
                {selectedTask.completedChildCount}/{selectedTask.childCount}{' '}
                children completed
              </p>
              <Button
                size="sm"
                variant="success"
                onClick={handleStaffCompleteParent}
                disabled={actionBusy}
              >
                {actionBusy ? 'Saving…' : 'Mark task complete'}
              </Button>
            </div>
          )}

          {/* Pending review: claimant read-only + staff accept/reject */}
          {isPendingReview && selectedTask && !selectedTask.hasChildren && (
            <div className="space-y-3 rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 p-4">
              <div className="text-sm font-semibold text-semantic-warning">
                Ready for Review
              </div>
              {isModerator && claimantTrust && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold tracking-wide ${
                      claimantTrust.trustTier === 'trusted'
                        ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'
                        : claimantTrust.trustTier === 'established'
                          ? 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10'
                          : claimantTrust.isRestricted
                            ? 'border-red-400/40 text-red-300 bg-red-500/10'
                            : 'border-semantic-warning/40 text-semantic-warning bg-semantic-warning/10'
                    }`}
                    title="Trust from accepted reviews + account age"
                  >
                    {claimantTrust.trustLabel}
                  </span>
                  <span className="font-mono text-text-muted">
                    {claimantTrust.acceptedTasks} accepted ·{' '}
                    {claimantTrust.accountAgeDays}d old · load{' '}
                    {claimantTrust.activeClaims} claimed +{' '}
                    {claimantTrust.pendingReview} in review
                    {claimantTrust.fakeRejectionCount > 0
                      ? ` · ${claimantTrust.fakeRejectionCount} fake flags`
                      : ''}
                  </span>
                </div>
              )}
              {selectedTask.claim?.primaryGithubUrl && (
                <a
                  href={selectedTask.claim.primaryGithubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-neon-cyan hover:underline"
                >
                  <Github className="w-4 h-4" />
                  Open GitHub evidence
                </a>
              )}
              {selectedTask.claim?.submissionEvidence && (
                <p className="text-sm text-text-secondary whitespace-pre-wrap">
                  <span className="text-text-muted">Evidence: </span>
                  {selectedTask.claim.submissionEvidence}
                </p>
              )}
              {isClaimHolder && !isModerator && (
                <p className="text-xs text-text-muted">
                  Waiting for a Project Lead or moderator to accept or reject
                  this submission. Your claim slot stays occupied until then.
                </p>
              )}
              {canReviewSubmission && (
                <>
                  <div>
                    <label className="block text-sm text-text-secondary font-mono mb-1.5">
                      Feedback (optional on accept, recommended on reject)
                    </label>
                    <textarea
                      value={reviewFeedbackDraft}
                      onChange={(e) => setReviewFeedbackDraft(e.target.value)}
                      rows={2}
                      placeholder="Notes for the contributor…"
                      className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => void handleAcceptReview()}
                      disabled={actionBusy}
                    >
                      {reviewActionBusy === 'accept'
                        ? 'Accepting…'
                        : 'Accept work'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void handleRejectReview()}
                      disabled={actionBusy}
                    >
                      {reviewActionBusy === 'reject'
                        ? 'Rejecting…'
                        : 'Reject'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-400/50 text-red-300 hover:bg-red-500/10"
                      onClick={() => void handleRejectAsFakeWork()}
                      disabled={actionBusy}
                      title="Release claim and escalate claim restrictions for fake / no real work"
                    >
                      {reviewActionBusy === 'fake'
                        ? 'Rejecting…'
                        : 'Reject as fake work'}
                    </Button>
                    {selectedTask.claim?.userId ? (
                      <OpenConductCaseButton
                        targetUserId={selectedTask.claim.userId}
                        contentType="task"
                        contentId={String(
                          selectedTask.claim.id || selectedTask.id || ''
                        )}
                        projectId={projectUuid || null}
                        contentPath={`/projects/${projectSlug}/board`}
                      />
                    ) : null}
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    “Reject as fake work” releases the claim (frees the board)
                    and records a restriction event. Multiple flags
                    automatically limit claiming privileges.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Helpers for viewers when claim has helpers */}
          {!canEditProgress &&
            !selectedTask.hasChildren &&
            claimHelperNames.length > 0 && (
              <div>
                <div className="text-xs font-mono tracking-widest text-text-muted mb-2">
                  HELPERS
                </div>
                <div className="flex flex-wrap gap-2">
                  {claimHelperNames.map((name) => (
                    <Badge
                      key={name}
                      variant="default"
                      className="!normal-case tracking-wide"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

          {/* Notes for non-holders on leaf claims only */}
          {!canEditProgress &&
            !selectedTask.hasChildren &&
            selectedTask.claim?.notes && (
              <p className="text-sm text-text-secondary border-l-2 border-neon-cyan/40 pl-3">
                {selectedTask.claim.notes}
              </p>
            )}

          {selectedTaskShowsBlocked &&
            selectedTask.status === 'todo' &&
            !selectedTask.claimedBy && (
              <div className="space-y-2 pt-2 border-t border-cyber-border">
                <p className="text-sm text-text-secondary leading-relaxed">
                  {selectedTaskWaitBlockers.length ? (
                    <WaitingOnLinks
                      task={selectedTask}
                      onOpen={handleViewTask}
                      prefix="Blocked – waiting on:"
                    />
                  ) : (
                    'This task is blocked because every nested task is blocked.'
                  )}
                </p>
                <p className="text-[11px] text-text-muted">
                  This task unlocks automatically when every blocker is
                  completed and accepted.
                </p>
              </div>
            )}

          {selectedTaskCanClaim && (
              <div className="space-y-2 pt-2 border-t border-cyber-border">
                {selectedTask.staffOnly && (
                  <Badge variant="gold" className="!normal-case tracking-wide">
                    Staff Only
                  </Badge>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleClaim(selectedTask.id)}
                    disabled={claimingId === selectedTask.id || !user}
                  >
                    {claimingId === selectedTask.id
                      ? 'Claiming…'
                      : !user
                        ? 'Sign in to claim'
                        : 'Claim Task'}
                  </Button>
                  <ClaimPolicyInfoTip
                    category={selectedTask.category}
                    holdClaim={isClaimAutoReleaseExempt(selectedTask)}
                  />
                </div>
              </div>
            )}
          {selectedTaskClaimsPaused && (
            <p className="text-sm text-text-muted pt-2 border-t border-cyber-border leading-relaxed">
              {CLAIMS_PAUSED_LINE}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
