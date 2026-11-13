/**
 * Moderator Dashboard: Task Board restriction events.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { formatDate } from './shared';

export default function RestrictionsTab({
  restrictionEvents,
  restrictionsLoadError,
  restrictionsMissing,
  users,
}) {
  return (
    <section aria-labelledby="restrictions-heading" className="space-y-4">
      <div>
        <h2
          id="restrictions-heading"
          className="text-lg font-semibold text-white"
        >
          Claim restriction audit
        </h2>
        <p className="text-sm text-text-secondary mt-1 leading-relaxed">
          Fake-work rejections and claim privilege restrictions. Use
          “Reject as fake work” on a Ready for Review task to log events
          here. Escalation: 2 flags → 7 days, 3 → 30 days, 4+ → permanent.
        </p>
      </div>

      {restrictionsMissing && (
        <Card className="bg-cyber-card/80 border-amber-500/30">
          <p className="text-sm text-text-secondary leading-relaxed">
            Restriction audit is not set up yet. Run{' '}
            <code className="text-neon-cyan text-xs font-mono">
              supabase/sql/supabase_task_anti_abuse.sql
            </code>{' '}
            in Supabase after the review workflow scripts.
          </p>
        </Card>
      )}

      {restrictionsLoadError && (
        <Card className="bg-red-400/10 border-red-400/40">
          <p className="text-sm text-red-100">{restrictionsLoadError}</p>
        </Card>
      )}

      {!restrictionsMissing &&
        !restrictionsLoadError &&
        restrictionEvents.length === 0 && (
          <Card className="bg-cyber-card/80">
            <p className="text-sm text-text-muted">
              No restriction events yet. When staff flag fake work on the
              Task Board, entries appear here.
            </p>
          </Card>
        )}

      <div className="space-y-3">
        {restrictionEvents.map((ev) => {
          const userLabel =
            users.find((u) => u.id === ev.userId)?.username ||
            ev.userId?.slice?.(0, 8) ||
            'user';
          const actorLabel =
            users.find((u) => u.id === ev.actorId)?.username ||
            (ev.actorId ? ev.actorId.slice(0, 8) : 'system');
          return (
            <Card key={ev.id} className="bg-cyber-card/80">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        ev.eventType === 'fake_reject' ||
                        ev.eventType === 'auto_restrict' ||
                        ev.eventType === 'restrict'
                          ? 'danger'
                          : 'default'
                      }
                      className="!normal-case tracking-wide"
                    >
                      {ev.eventType}
                    </Badge>
                    <span className="text-sm text-white font-medium">
                      {userLabel}
                    </span>
                    <span className="text-xs font-mono text-text-muted">
                      by {actorLabel}
                    </span>
                  </div>
                  {ev.reason && (
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {ev.reason}
                    </p>
                  )}
                  <p className="text-[11px] font-mono text-text-muted">
                    {formatDate(ev.createdAt)}
                    {ev.metadata?.fake_rejection_count != null
                      ? ` · fake flags: ${ev.metadata.fake_rejection_count}`
                      : ''}
                    {ev.metadata?.is_restricted
                      ? ' · restricted'
                      : ''}
                    {ev.taskId
                      ? ` · task ${String(ev.taskId).slice(0, 8)}…`
                      : ''}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
