/**
 * Project workspace: the task board itself (staging tree, public tree, or hub entry card).
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import { lazy, Suspense } from 'react';
import LoadingScreen from '../../components/ui/LoadingScreen';
import BoardViewToggle from '../../components/tasks/BoardViewToggle';
import { useBoardView } from '../../hooks/useBoardView';
import TaskStagingTree from '../../components/ui/TaskStagingTree';
import BoardTaskTree from '../../components/ui/BoardTaskTree';
import {
  ChevronDown,
  Lightbulb,
  LayoutGrid,
  Upload,
  Hammer,
} from 'lucide-react';
import CompletedTaskTree from '../../components/ui/CompletedTaskTree';
import Button from '../../components/ui/Buttons';
import DiscordLink from '../../components/ui/DiscordLink';
import Card from '../../components/ui/Card';
import { KANBAN_COLUMNS, REVIEW_COLUMN, COMPLETED_COLUMN } from './shared';

// Loaded only when someone switches to the Map view
const TaskMap = lazy(() => import('../../components/tasks/TaskMap'));

export default function TaskBoardSection({
  boardOnly,
  boardPath,
  boardScope,
  boardTasks,
  claimingId,
  completedOpen,
  handleClaim,
  handleDuplicateTask,
  handleMovePublicToStaging,
  handlePublishStaging,
  handleRequestJoin,
  handleStagingDelete,
  handleStagingMove,
  handleUpdateTask,
  handleViewTask,
  isModerator,
  isStagingBoard,
  joiningId,
  loading,
  myPendingJoinTaskIds,
  navigate,
  openCreateSubTask,
  openCreateTaskForm,
  openEditTaskForm,
  projectUuid,
  publishingId,
  pulse,
  reviewOpen,
  setCompletedOpen,
  setReviewOpen,
  setSuggestOpen,
  stagingBusyId,
  stagingPath,
  tasks,
  tasksByStatus,
  unpublishingId,
  user,
}) {
  const [boardView, setBoardView] = useBoardView();
  return boardOnly && isStagingBoard ? (
  <section aria-labelledby="staging-board-heading" className="space-y-4">
    <h2 id="staging-board-heading" className="sr-only">
      Staging task board
    </h2>
    {loading ? (
      <LoadingScreen variant="section" message="Loading staging…" />
    ) : (
      <TaskStagingTree
        tasks={tasks}
        busyId={stagingBusyId}
        publishingId={publishingId}
        onAddEpic={() => openCreateTaskForm(null)}
        onAddChild={(parent) => openCreateSubTask(parent)}
        onEdit={(task) => openEditTaskForm(task)}
        onDelete={handleStagingDelete}
        onPublish={handlePublishStaging}
        onMove={handleStagingMove}
        onView={handleViewTask}
      />
    )}
  </section>
  ) : boardOnly ? (
  <section aria-labelledby="board-heading" className="space-y-4">
    <h2 id="board-heading" className="sr-only">
      Task board columns
    </h2>

    <BoardViewToggle view={boardView} onChange={setBoardView} />

    {loading ? (
      <LoadingScreen variant="section" message="Loading board…" />
    ) : boardView === 'map' ? (
      <div className="space-y-2">
        <p className="text-xs text-text-muted">
          The map shows every open task on this board; use Show completed to
          include finished work. The filters above apply to the Board view.
        </p>
        <Suspense
          fallback={<LoadingScreen variant="section" message="Loading map…" />}
        >
          <TaskMap tasks={tasks} onOpenTask={handleViewTask} />
        </Suspense>
      </div>
    ) : (
      <div className="space-y-4">
        {/* Main columns: To Do / In Progress */}
        <div className="flex lg:grid lg:grid-cols-2 gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
          {KANBAN_COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col.key] || [];
            return (
              <div
                key={col.key}
                className={`snap-start shrink-0 w-[min(100%,20rem)] sm:w-[22rem] lg:w-auto flex flex-col rounded-xl border bg-cyber-surface/80 ${col.accent} min-h-[20rem]`}
              >
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-cyber-border">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <h3
                      className={`font-mono text-xs tracking-widest uppercase ${col.header}`}
                    >
                      {col.label}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-text-muted">
                    {colTasks.length}
                  </span>
                </div>

                <div className="task-scroll flex-1 p-3 space-y-3 max-h-[28rem] overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-8 px-2">
                      No tasks in this column.
                    </p>
                  ) : (
                    <BoardTaskTree
                      tasks={colTasks}
                      allTasks={boardTasks}
                      defaultExpanded={boardScope === 'all'}
                      layout="stack"
                      nestedLabel="nested tasks"
                      emptyMessage="No tasks in this column."
                      cardProps={{
                        currentUserId: user?.id,
                        claimingId,
                        joiningId,
                        pendingJoinTaskIds: myPendingJoinTaskIds,
                        onClaim:
                          col.key === 'todo' ? handleClaim : undefined,
                        onRequestJoin:
                          col.key === 'in_progress'
                            ? handleRequestJoin
                            : undefined,
                        onView: handleViewTask,
                        canStaffUpdate: isModerator,
                        isStaff: isModerator,
                        onDuplicate: isModerator
                          ? handleDuplicateTask
                          : undefined,
                        onMoveToStaging: isModerator
                          ? handleMovePublicToStaging
                          : undefined,
                        unpublishingId,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Ready for Review: full-width collapsible (same pattern as Completed) */}
        {(() => {
          const reviewTasks = tasksByStatus[REVIEW_COLUMN.key] || [];
          return (
            <div
              className={`w-full rounded-xl border bg-cyber-surface/80 ${REVIEW_COLUMN.accent} overflow-hidden`}
            >
              <button
                type="button"
                onClick={() => setReviewOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-cyber-border hover:bg-cyber-card/40 transition-colors text-left"
                aria-expanded={reviewOpen}
                aria-controls="review-tasks-panel"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${REVIEW_COLUMN.dot}`}
                  />
                  <h3
                    className={`font-mono text-xs tracking-widest uppercase ${REVIEW_COLUMN.header}`}
                  >
                    {REVIEW_COLUMN.label}
                  </h3>
                  <span className="text-xs font-mono text-text-muted tabular-nums">
                    {reviewTasks.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
                    reviewOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>

              {reviewOpen && (
                <div
                  id="review-tasks-panel"
                  className="task-scroll p-3 sm:p-4 max-h-[28rem] overflow-y-auto"
                >
                  {reviewTasks.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-8 px-2">
                      No tasks waiting for review.
                    </p>
                  ) : (
                    <BoardTaskTree
                      tasks={reviewTasks}
                      allTasks={boardTasks}
                      defaultExpanded={boardScope === 'all'}
                      layout="grid"
                      nestedLabel="nested tasks"
                      emptyMessage="No tasks waiting for review."
                      cardProps={{
                        currentUserId: user?.id,
                        onView: handleViewTask,
                        canStaffUpdate: isModerator,
                        isStaff: isModerator,
                        onDuplicate: isModerator
                          ? handleDuplicateTask
                          : undefined,
                        onMoveToStaging: isModerator
                          ? handleMovePublicToStaging
                          : undefined,
                        unpublishingId,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Completed: full-width collapsible under the active columns */}
        {(() => {
          const completedTasks =
            tasksByStatus[COMPLETED_COLUMN.key] || [];
          return (
            <div
              className={`w-full rounded-xl border bg-cyber-surface/80 ${COMPLETED_COLUMN.accent} overflow-hidden`}
            >
              <button
                type="button"
                onClick={() => setCompletedOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-cyber-border hover:bg-cyber-card/40 transition-colors text-left"
                aria-expanded={completedOpen}
                aria-controls="completed-tasks-panel"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${COMPLETED_COLUMN.dot}`}
                  />
                  <h3
                    className={`font-mono text-xs tracking-widest uppercase ${COMPLETED_COLUMN.header}`}
                  >
                    {COMPLETED_COLUMN.label}
                  </h3>
                  <span className="text-xs font-mono text-text-muted tabular-nums">
                    {completedTasks.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
                    completedOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>

              {completedOpen && (
                <div
                  id="completed-tasks-panel"
                  className="task-scroll p-3 sm:p-4 max-h-[28rem] overflow-y-auto"
                >
                  <CompletedTaskTree
                    tasks={completedTasks}
                    allTasks={tasks}
                    cardProps={{
                      currentUserId: user?.id,
                      onView: handleViewTask,
                      canStaffUpdate: isModerator,
                      isStaff: isModerator,
                      onUpdate: handleUpdateTask,
                      onDuplicate: isModerator
                        ? handleDuplicateTask
                        : undefined,
                      onMoveToStaging: isModerator
                        ? handleMovePublicToStaging
                        : undefined,
                      unpublishingId,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })()}
      </div>
    )}

    <div className="grid md:grid-cols-2 gap-4 items-stretch">
      <div className="rounded-xl border border-cyber-border bg-cyber-surface/50 px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-3 h-full">
        <h2 className="text-sm font-mono tracking-widest text-neon-cyan uppercase">
          Suggest a task
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed flex-1">
          See a gap on this board? Send a task proposal. Staff review
          every suggestion. Accepted work will be added to the task board.
        </p>
        <Button
          className="gap-2 w-full"
          onClick={() => {
            if (!user) {
              navigate('/account');
              return;
            }
            setSuggestOpen(true);
          }}
          disabled={!projectUuid}
        >
          <Lightbulb className="w-4 h-4" />
          Suggest a Task
        </Button>
      </div>
      <DiscordLink
        variant="card"
        labelKey="join"
        note="Need to talk about a task, scope, or claim? Chat with the community in real time."
      />
    </div>
  </section>
  ) : (
  /* Hub: Task Board entry (full board is on /board) */
  <section aria-labelledby="board-entry-heading">
    <Card className="bg-cyber-card/80 border-neon-cyan/25 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 p-1">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="section-header">Contribute</div>
          <h2
            id="board-entry-heading"
            className="text-2xl font-bold text-white flex items-center gap-2"
          >
            <LayoutGrid className="w-6 h-6 text-neon-cyan shrink-0" />
            Task Board
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl">
            Claim work, track progress, submit for review, and ship wins.
            The full board has room for columns, hierarchy, and every
            task on this project.
          </p>
          <div className="flex flex-wrap gap-3 text-xs font-mono text-text-muted">
            <span>
              {pulse.openTasks ?? 0} open
            </span>
            <span className="text-white/20" aria-hidden>
              ·
            </span>
            <span>
              {pulse.tasksCompleted ?? 0} completed
            </span>
            {tasks.length > 0 && (
              <>
                <span className="text-white/20" aria-hidden>
                  ·
                </span>
                <span>{tasks.length} total</span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2">
          <Button
            className="gap-2"
            to={boardPath}
            disabled={loading}
          >
            <LayoutGrid className="w-4 h-4" />
            Open Task Board
          </Button>
          {isModerator && (
            <Button
              variant="outline"
              className="gap-2"
              to={stagingPath}
              disabled={loading}
              title="Staff-only preparation board"
            >
              <Upload className="w-4 h-4" />
              Open Staging
            </Button>
          )}
          <DiscordLink
            variant="button"
            labelKey="join"
            className="w-full sm:w-auto lg:w-full"
          />
          <Button
            variant="ghost"
            className="gap-2"
            to="/get-involved"
          >
            <Hammer className="w-4 h-4" />
            How to contribute
          </Button>
        </div>
      </div>
    </Card>
  </section>
  );
}
