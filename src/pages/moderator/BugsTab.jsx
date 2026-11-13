/**
 * Moderator Dashboard: Bug reports triage.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { severityBadgeVariant, statusBadgeVariant, BUG_STATUSES } from '../../services/bugReportsService';
import { formatDate } from './shared';

export default function BugsTab({
  bugs,
  bugsMissing,
  busyKey,
  handleBugStatus,
  loading,
}) {
  return (
    <section aria-labelledby="bugs-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2
            id="bugs-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Bug reports
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">
            Open reports from the public tracker. Change status here, or
            open the full list.
          </p>
          <Link
            to="/bugs"
            className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan hover:underline mt-2"
          >
            Open bug tracker
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {bugsMissing && (
        <Card className="bg-cyber-card/80 border-amber-500/30 mb-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Bug tracker is not set up yet. Run{' '}
            <code className="text-neon-cyan text-xs font-mono">
              supabase/sql/supabase_bug_reports.sql
            </code>{' '}
            in Supabase, then refresh.
          </p>
        </Card>
      )}

      {!bugsMissing && bugs.length === 0 && !loading && (
        <Card className="bg-cyber-card/80 text-sm text-text-muted">
          No open bug reports.
        </Card>
      )}

      <div className="space-y-3">
        {bugs.map((bug) => {
          const busy = busyKey === `bug-${bug.id}`;
          return (
            <Card key={bug.id} className="bg-cyber-card/80">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <h3 className="text-base font-semibold text-white pr-2">
                  {bug.title}
                </h3>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <Badge variant={severityBadgeVariant(bug.severity)}>
                    {bug.severity}
                  </Badge>
                  <Badge variant={statusBadgeVariant(bug.status)}>
                    {bug.status}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap line-clamp-4">
                {bug.description}
              </p>
              <p className="text-xs font-mono text-text-muted mt-2">
                {bug.createdAt ? formatDate(bug.createdAt) : ''}
                {bug.reporterName ? ` · ${bug.reporterName}` : ''}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 mt-3">
                <select
                  className="bg-cyber-surface border border-cyber-border rounded-lg px-2 py-1.5 text-xs text-white"
                  value={bug.status}
                  disabled={busy}
                  onChange={(e) =>
                    void handleBugStatus(bug.id, e.target.value)
                  }
                  aria-label={`Status for ${bug.title}`}
                >
                  {BUG_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Link
                  to="/bugs"
                  className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:underline"
                >
                  Full tracker
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
