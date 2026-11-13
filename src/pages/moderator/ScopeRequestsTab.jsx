/**
 * Moderator Dashboard: Scope-help requests queue.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import Card from '../../components/ui/Card';
import { SplitSquareVertical, ExternalLink } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import { displayProjectTitle } from '../../utils/ideaStatus';
import UserAvatar from '../../components/ui/UserAvatar';
import TaskCategoryBadge from '../../components/ui/TaskCategoryBadge';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Buttons';
import { tasksService } from '../../services/tasksService';
import { filterControl, SCOPE_RESOLUTION_LABELS, formatDate } from './shared';

export default function ScopeRequestsTab({
  busyKey,
  loading,
  runAction,
  scopeLoadError,
  scopeMissing,
  scopeRequests,
  scopeStaffNotes,
  scopeStatusFilter,
  setScopeStaffNotes,
  setScopeStatusFilter,
}) {
  return (
    <section aria-labelledby="scope-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2
            id="scope-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Scope help
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">
            Volunteers flagged work as larger than expected. Open the
            board task, break it down or re-scope, then mark resolved.
            Scope discovery is expected, not a failure.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="mod-scope-status">
            Status filter
          </label>
          <select
            id="mod-scope-status"
            className={filterControl + ' w-auto min-w-[9rem]'}
            value={scopeStatusFilter}
            onChange={(e) => setScopeStatusFilter(e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {scopeMissing && (
        <Card className="bg-semantic-warning/10 border-semantic-warning/40 mb-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Scope requests table is not installed yet. Run{' '}
            <code className="text-neon-cyan text-xs">
              supabase/sql/supabase_task_scope_requests.sql
            </code>{' '}
            in the Supabase SQL Editor, then click Refresh.
          </p>
        </Card>
      )}

      {!scopeMissing && scopeLoadError && (
        <Card className="bg-red-400/10 border-red-400/40 mb-4">
          <p className="text-sm text-red-100" role="alert">
            {scopeLoadError}
          </p>
        </Card>
      )}

      {!scopeMissing &&
        !scopeLoadError &&
        scopeRequests.length === 0 &&
        !loading && (
        <Card className="bg-cyber-card/80 text-center py-10 px-6">
          <SplitSquareVertical className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            {scopeStatusFilter === 'pending'
              ? 'No open scope help requests. When claimants flag oversized work, they appear here.'
              : 'No requests in this filter.'}
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {scopeRequests.map((req) => {
          const busy = busyKey === `scope-${req.id}`;
          return (
            <Card
              key={req.id}
              className="bg-cyber-card/80 border-cyber-border"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          req.status === 'pending'
                            ? 'warning'
                            : req.status === 'resolved'
                              ? 'success'
                              : 'default'
                        }
                        className="!normal-case"
                      >
                        {req.status}
                      </Badge>
                      {req.resolution && (
                        <span className="text-[11px] font-mono text-text-muted">
                          {SCOPE_RESOLUTION_LABELS[req.resolution] ||
                            req.resolution}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-text-muted">
                        {formatDate(req.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-white truncate flex flex-wrap items-center gap-2">
                      {req.taskTitle}
                      {req.staffOnly && (
                        <Badge
                          variant="gold"
                          className="!normal-case tracking-wide !text-[10px]"
                        >
                          Staff Only
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs font-mono text-text-muted">
                      {displayProjectTitle({
                        title: req.projectTitle,
                        slug: req.projectSlug,
                      })}
                      {req.taskCategory ? ` · ${req.taskCategory}` : ''}
                      {req.taskDifficulty
                        ? ` · Difficulty: ${req.taskDifficulty}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <UserAvatar
                      src={req.avatarUrl}
                      name={req.username}
                      username={req.username}
                      size="sm"
                    />
                    <span className="text-sm text-text-secondary">
                      {req.username}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-text-secondary whitespace-pre-wrap border-l-2 border-semantic-warning/40 pl-3">
                  {req.note}
                </p>

                {req.staffNote && (
                  <p className="text-sm text-text-secondary whitespace-pre-wrap border-l-2 border-neon-cyan/30 pl-3">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted block mb-1">
                      Staff note
                    </span>
                    {req.staffNote}
                  </p>
                )}

                {req.taskCategory && (
                  <div>
                    <TaskCategoryBadge
                      category={req.taskCategory}
                      size="sm"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Link to={req.boardPath}>
                    <Button size="sm" variant="secondary" className="gap-1.5">
                      Open board
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>

                {req.status === 'pending' && (
                  <div className="space-y-2 pt-1 border-t border-cyber-border/60">
                    <label
                      className="block text-[10px] font-mono tracking-widest uppercase text-text-muted"
                      htmlFor={`scope-staff-note-${req.id}`}
                    >
                      Resolve note (optional)
                    </label>
                    <textarea
                      id={`scope-staff-note-${req.id}`}
                      rows={2}
                      maxLength={1000}
                      placeholder="What you did or told the volunteer (e.g. split into three Small tasks under this parent)."
                      className={`${filterControl} resize-y min-h-[3.5rem]`}
                      value={scopeStaffNotes[req.id] || ''}
                      onChange={(e) =>
                        setScopeStaffNotes((prev) => ({
                          ...prev,
                          [req.id]: e.target.value,
                        }))
                      }
                      disabled={busy}
                    />
                    <p className="text-[11px] text-text-muted">
                      Saved with the resolution on this request (and in
                      activity history). Optional but helpful for the
                      volunteer and future staff.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            `scope-${req.id}`,
                            () =>
                              tasksService.resolveScopeRequest(
                                req.id,
                                'breakdown',
                                scopeStaffNotes[req.id] || ''
                              ),
                            'Marked as broken into sub-tasks'
                          )
                        }
                      >
                        Broken into sub-tasks
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            `scope-${req.id}`,
                            () =>
                              tasksService.resolveScopeRequest(
                                req.id,
                                'promoted',
                                scopeStaffNotes[req.id] || ''
                              ),
                            'Marked as promoted / re-parented'
                          )
                        }
                      >
                        Promoted
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            `scope-${req.id}`,
                            () =>
                              tasksService.resolveScopeRequest(
                                req.id,
                                'adjusted',
                                scopeStaffNotes[req.id] || ''
                              ),
                            'Marked as adjusted'
                          )
                        }
                      >
                        Adjusted
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            `scope-${req.id}`,
                            () =>
                              tasksService.resolveScopeRequest(
                                req.id,
                                'kept',
                                scopeStaffNotes[req.id] || ''
                              ),
                            'Closed as clarified'
                          )
                        }
                      >
                        Clarified / keep
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
