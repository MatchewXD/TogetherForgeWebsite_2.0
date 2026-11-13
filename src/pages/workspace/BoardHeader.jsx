/**
 * Project workspace: Task Board page header (title, filters, quotas, staff tools).
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import InfoHoverTip from '../../components/ui/InfoHoverTip';
import { CLAIM_AUTO_RELEASE_POLICY_COPY, CLAIM_IDLE_RELEASE_DAYS } from '../../services/tasksService';
import Button from '../../components/ui/Buttons';
import StaffToolsBar from '../../components/ui/StaffToolsBar';
import {
  Github,
  Pencil,
  Inbox,
  Upload,
  LayoutGrid,
  Plus,
  Users,
  ExternalLink,
} from 'lucide-react';
import Badge from '../../components/ui/Badge';
import { TASK_CATEGORIES, normalizeTaskCategoryKey, getTaskCategoryStyle } from '../../constants/taskCategories';
import { CLAIMS_PAUSED_LINE } from '../../constants/claimsEnabled';

export default function BoardHeader({
  autoReleaseBusy,
  autoReleaseNotices,
  boardCategoryFilter,
  boardFiltersActive,
  boardPath,
  boardScope,
  boardTasks,
  boardUnclaimedOnly,
  claimQuota,
  claimsEnabled,
  clearBoardFilters,
  dismissAutoReleaseNotices,
  displayProject,
  handleRunAutoReleaseCheck,
  hideBlockedTasks,
  isModerator,
  isStagingBoard,
  loading,
  lockedTaskCount,
  openCreateTaskForm,
  openGithubEdit,
  pendingSuggestionCount,
  projectGithubUrl,
  projectPath,
  projectUuid,
  setBoardCategoryFilter,
  setBoardScope,
  setBoardUnclaimedOnly,
  setHideBlockedTasks,
  stagingPath,
  suggestedPath,
  tasks,
  toggleBoardCategory,
  user,
}) {
  return (
    <header className="space-y-5">
      <div className="min-w-0">
        <div className="section-header">
          {isStagingBoard ? 'Staff only' : 'Task Board'}
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-neon-cyan drop-shadow-[0_0_24px_rgba(0,249,255,0.25)]">
          {isStagingBoard ? 'Staging' : displayProject.title}
        </h1>
        {isStagingBoard && (
          <p className="mt-2 text-sm text-text-secondary max-w-2xl leading-relaxed">
            Preparation board for {displayProject.title}. Volunteers never
            see these tasks. Publish an Epic or Medium to copy it onto the
            public board.
          </p>
        )}
      </div>

      {/* Contribution loop: TF board vs GitHub — below title, above controls */}
      <div className="rounded-lg border border-cyber-border/80 bg-cyber-bg/40 px-3 py-2.5 text-xs text-text-secondary leading-relaxed">
        <p className="font-mono tracking-widest text-[10px] text-text-muted uppercase mb-1 flex items-center gap-1.5">
          {isStagingBoard ? 'How staging works' : 'How contributing works'}
          {!isStagingBoard ? (
            <InfoHoverTip label="Claim auto-release rules">
              {CLAIM_AUTO_RELEASE_POLICY_COPY}
            </InfoHoverTip>
          ) : null}
        </p>
        <p>
          {isStagingBoard ? (
            <>
              Build Epics, Mediums, and Smalls here. Reorder and delete
              freely. When a Medium or Epic is ready,{' '}
              <span className="text-white font-medium">Publish</span> it
              to the public board. Staff can move public work back to
              Staging. Staff Only flags are kept. Volunteers never see
              Staging.
            </>
          ) : (
            <>
          <span className="text-white font-medium">Together Forge</span>{' '}
          = claim, track, review, and credit ·{' '}
          <span className="text-white font-medium">GitHub</span> = where
          technical work lives
          {projectGithubUrl ? (
            <>
              {' '}
              (
              <a
                href={projectGithubUrl}
                target="_blank"
                rel="noreferrer"
                className="text-neon-cyan hover:underline"
              >
                project repo
              </a>
              )
            </>
          ) : (
            ''
          )}
          . Claim here → do the work
          {projectGithubUrl ? ' on GitHub' : ' (GitHub for code tasks)'}{' '}
          → submit with clear evidence (PR preferred for Code) → get
          credit when accepted.
            </>
          )}
        </p>
      </div>

      {!isStagingBoard && autoReleaseNotices.length > 0 && (
        <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-mono tracking-widest text-semantic-warning uppercase">
              Claim auto-released
            </p>
            {autoReleaseNotices.map((n) => (
              <p
                key={n.id}
                className="text-sm text-text-secondary leading-snug"
              >
                {n.message}
                {n.taskTitle ? (
                  <span className="text-text-muted">
                    {' '}
                    ({n.taskTitle})
                  </span>
                ) : null}
              </p>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={dismissAutoReleaseNotices}
          >
            Dismiss
          </Button>
        </div>
      )}

      {isModerator ? (
          <StaffToolsBar className="mb-3">
            {!projectGithubUrl ? (
              <Button
                variant="gold"
                className="gap-2"
                size="sm"
                onClick={openGithubEdit}
                disabled={!projectUuid}
                title="Set the GitHub repo so contributors know where technical work lives"
              >
                <Github className="w-4 h-4" />
                Set GitHub repo
              </Button>
            ) : (
              <Button
                variant="gold"
                size="sm"
                className="gap-1.5"
                onClick={openGithubEdit}
                title="Edit project GitHub URL"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit repo
              </Button>
            )}
            <Button
              variant="gold"
              className="gap-2"
              size="sm"
              to={suggestedPath}
              disabled={!projectUuid || loading}
              title="Volunteer task suggestions. Staff only."
            >
              <Inbox className="w-4 h-4" />
              Suggested
              {pendingSuggestionCount > 0 ? (
                <span className="ml-1 tabular-nums opacity-90">
                  ({pendingSuggestionCount})
                </span>
              ) : null}
            </Button>
            {!isStagingBoard ? (
              <Button
                variant="gold"
                className="gap-2"
                size="sm"
                to={stagingPath}
                disabled={!projectUuid || loading}
                title="Staff-only preparation board. Volunteers cannot see it."
              >
                <Upload className="w-4 h-4" />
                Staging
              </Button>
            ) : (
              <Button
                variant="gold"
                className="gap-2"
                size="sm"
                to={boardPath}
              >
                <LayoutGrid className="w-4 h-4" />
                Public board
              </Button>
            )}
            {!isStagingBoard ? (
              <Button
                variant="gold"
                size="sm"
                className="gap-2"
                onClick={() => openCreateTaskForm(null)}
                disabled={!projectUuid || loading}
                title={
                  !projectUuid
                    ? 'Project must be loaded from Supabase first'
                    : 'Create a new top-level task on this board'
                }
              >
                <Plus className="w-4 h-4" />
                Add New Task
              </Button>
            ) : null}
            {!isStagingBoard ? (
              <Button
                variant="gold"
                size="sm"
                className="gap-2"
                onClick={() => void handleRunAutoReleaseCheck()}
                disabled={autoReleaseBusy || !projectUuid}
                title={`TEST: Release Active claims as if they have been idle for ${CLAIM_IDLE_RELEASE_DAYS} days (no real wait). Staff only.`}
              >
                {autoReleaseBusy
                  ? 'Testing…'
                  : 'Run auto-release check now'}
              </Button>
            ) : null}
          </StaffToolsBar>
        ) : null}

      <div className="w-full rounded-xl border border-cyber-border bg-cyber-surface/70 px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          {/* Meta: claims + counts */}
          <div className="flex flex-wrap items-center gap-2 min-w-0 lg:flex-1">
            <Badge variant="neon" className="justify-center shrink-0">
              {loading
                ? 'Loading…'
                : isStagingBoard
                  ? `${tasks.length} staging`
                  : `${boardTasks.length} shown · ${tasks.length} total`}
            </Badge>
            {!user && !isStagingBoard && (
              <span className="text-xs font-mono text-text-muted">
                Sign in to claim
              </span>
            )}
            {claimQuota?.signedIn && !isStagingBoard && (
              <span className="text-xs font-mono text-text-muted">
                Your claims: {claimQuota.activeClaims ?? 0}/
                {claimQuota.claimLimit ?? 2} active
                {claimQuota.completedClaims != null
                  ? ` · ${claimQuota.completedClaims} accepted`
                  : ''}
                {typeof claimQuota.submitsLast24h === 'number' &&
                typeof claimQuota.submitLimit24h === 'number'
                  ? ` · submits ${claimQuota.submitsLast24h}/${claimQuota.submitLimit24h} (24h)`
                  : ''}
                {claimQuota.cooldownEndsAt &&
                new Date(claimQuota.cooldownEndsAt) > new Date()
                  ? ' · claim cooldown'
                  : ''}
                {claimQuota.submitCooldownEndsAt &&
                new Date(claimQuota.submitCooldownEndsAt) > new Date()
                  ? ' · submit cooldown'
                  : ''}
                {claimQuota.isRestricted ? ' · restricted' : ''}
              </span>
            )}
          </div>

          {/* Scope toggle — centered on wide screens */}
          <div className="flex justify-start lg:justify-center lg:shrink-0">
            <div className="inline-flex rounded-lg border border-cyber-border overflow-hidden text-xs font-mono w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setBoardScope('top')}
                className={`flex-1 sm:flex-none px-4 py-2.5 transition-colors ${
                  boardScope === 'top'
                    ? 'bg-neon-cyan/15 text-neon-cyan'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Overview: epics only. Nested blocked work lives inside the Epic, not on this list."
              >
                Top-level
              </button>
              <button
                type="button"
                onClick={() => setBoardScope('all')}
                className={`flex-1 sm:flex-none px-4 py-2.5 border-l border-cyber-border transition-colors ${
                  boardScope === 'all'
                    ? 'bg-neon-cyan/15 text-neon-cyan'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Show every task nested under its Epic and Medium"
              >
                All tasks
              </button>
            </div>
          </div>

          {/* Volunteer / everyone actions */}
          <div className="flex flex-wrap items-center gap-2 lg:flex-1 lg:justify-end">
            {projectGithubUrl ? (
              <a
                href={projectGithubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-2 text-xs font-semibold text-neon-cyan hover:bg-neon-cyan/20 hover:text-white transition-colors"
                title="Open this project’s GitHub repository or board"
              >
                <Github className="w-4 h-4" />
                View on GitHub
              </a>
            ) : null}
            <Button
              variant="outline"
              className="gap-2"
              to={`${projectPath}/contributors`}
            >
              <Users className="w-4 h-4" />
              Contributors
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              to={projectPath}
            >
              <ExternalLink className="w-4 h-4" />
              Project hub
            </Button>
          </div>
        </div>

        {/* Category + unclaimed filters — skill-first for new contributors */}
        {!isStagingBoard && (
        <div className="mt-3 pt-3 border-t border-cyber-border/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
              Filter by skill
            </p>
            {boardFiltersActive && (
              <button
                type="button"
                onClick={clearBoardFilters}
                className="text-[11px] font-mono text-neon-cyan hover:text-white transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Task board filters"
          >
            <button
              type="button"
              onClick={() => setBoardCategoryFilter([])}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                boardCategoryFilter.length === 0
                  ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50'
                  : 'bg-transparent text-text-muted border-cyber-border hover:border-cyber-border hover:text-text-secondary'
              }`}
              aria-pressed={boardCategoryFilter.length === 0}
            >
              All categories
            </button>
            {TASK_CATEGORIES.map((cat) => {
              const active = boardCategoryFilter.some(
                (c) =>
                  normalizeTaskCategoryKey(c) ===
                  normalizeTaskCategoryKey(cat)
              );
              const style = getTaskCategoryStyle(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleBoardCategory(cat)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                    active
                      ? `${style.badge} ring-1 ${style.ring}`
                      : 'bg-cyber-surface/40 text-text-muted border-cyber-border/80 hover:text-text-secondary hover:border-cyber-border'
                  }`}
                  aria-pressed={active}
                  title={
                    active
                      ? `Remove ${cat} filter`
                      : `Show ${cat} tasks`
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      active ? style.swatch : 'bg-text-muted/50'
                    }`}
                    aria-hidden
                  />
                  {cat}
                </button>
              );
            })}
            <span
              className="hidden sm:inline w-px h-5 bg-cyber-border mx-0.5"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => setBoardUnclaimedOnly((v) => !v)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                boardUnclaimedOnly
                  ? 'bg-semantic-achievement/15 text-semantic-achievement border-semantic-achievement/50 ring-1 ring-semantic-achievement/30'
                  : 'bg-transparent text-text-muted border-cyber-border hover:text-text-secondary'
              }`}
              aria-pressed={boardUnclaimedOnly}
              title="Only tasks you can claim right now"
            >
              Unclaimed only
            </button>
            <button
              type="button"
              onClick={() => setHideBlockedTasks((v) => !v)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                hideBlockedTasks
                  ? 'bg-white/10 text-text-secondary border-white/30 ring-1 ring-white/15'
                  : 'bg-transparent text-text-muted border-cyber-border hover:text-text-secondary'
              }`}
              aria-pressed={hideBlockedTasks}
              title={
                hideBlockedTasks
                  ? 'Blocked tasks are hidden everywhere. Click to show them nested under their parents.'
                  : 'Blocked tasks are visible in their nested place. Click to hide them.'
              }
            >
              Hide Blocked Tasks
              {lockedTaskCount > 0 ? (
                <span className="ml-1.5 tabular-nums opacity-80">
                  ({lockedTaskCount})
                </span>
              ) : null}
            </button>
          </div>
          {!claimsEnabled && !isModerator ? (
            <p className="text-sm text-text-muted leading-relaxed">
              {CLAIMS_PAUSED_LINE}
            </p>
          ) : null}
          {boardFiltersActive && !loading && (
            <p className="text-[11px] font-mono text-text-muted">
              Showing {boardTasks.length} match
              {boardTasks.length === 1 ? '' : 'es'}
              {boardCategoryFilter.length > 0
                ? ` · ${boardCategoryFilter.join(', ')}`
                : ''}
              {boardUnclaimedOnly ? ' · unclaimed only' : ''}
              {hideBlockedTasks ? ' · hiding blocked' : ''}
              {boardScope === 'top'
                ? ' · includes matching nested tasks'
                : ' · nested under parents'}
            </p>
          )}
        </div>
        )}
      </div>
    </header>
  );
}
