/**
 * Moderator Dashboard: Private concern reports (Founder only).
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import { CONCERN_STATUSES, CONCERN_STATUS_LABELS, CONCERN_WHERE_LABELS } from '../../services/reportConcernService';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { filterLabel, filterControl, formatDate } from './shared';

export default function ConcernsTab({
  busyKey,
  concerns,
  concernsMissing,
  concernStatusFilter,
  filteredConcerns,
  handleConcernStatus,
  loading,
  setConcernStatusFilter,
}) {
  return (
    <section aria-labelledby="concerns-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2
            id="concerns-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Concern reports
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">
            Private Report a concern submissions. Not public. Not the
            Reports tab. Founder only.
          </p>
          <p className="text-xs font-mono text-text-muted mt-1">
            Showing {filteredConcerns.length}
            {filteredConcerns.length !== concerns.length
              ? ` of ${concerns.length}`
              : ''}
          </p>
        </div>
        <div>
          <label className={filterLabel} htmlFor="mod-concern-status">
            Status
          </label>
          <select
            id="mod-concern-status"
            className={filterControl + ' w-auto min-w-[10rem]'}
            value={concernStatusFilter}
            onChange={(e) => setConcernStatusFilter(e.target.value)}
          >
            <option value="open">Open (new + reviewing)</option>
            <option value="all">All</option>
            {CONCERN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONCERN_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {concernsMissing && (
        <Card className="bg-cyber-card/80 border-amber-500/30 mb-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Concern reports are not set up yet. Run{' '}
            <code className="text-neon-cyan text-xs font-mono">
              supabase/sql/supabase_concern_reports.sql
            </code>{' '}
            in Supabase, then refresh.
          </p>
        </Card>
      )}

      {!concernsMissing && filteredConcerns.length === 0 && !loading && (
        <Card className="bg-cyber-card/80 text-sm text-text-muted">
          {concerns.length === 0
            ? 'No concern reports yet.'
            : 'No reports in this view.'}
        </Card>
      )}

      <div className="space-y-3">
        {filteredConcerns.map((row) => {
          const busy = busyKey === `concern-${row.id}`;
          return (
            <Card key={row.id} className="bg-cyber-card/80">
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={
                        row.status === 'new'
                          ? 'warning'
                          : row.status === 'reviewing'
                            ? 'neon'
                            : 'default'
                      }
                    >
                      {CONCERN_STATUS_LABELS[row.status] || row.status}
                    </Badge>
                    <Badge variant="default">
                      {CONCERN_WHERE_LABELS[row.whereHappened] ||
                        row.whereHappened}
                    </Badge>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                        Submitted
                      </dt>
                      <dd className="text-text-secondary">
                        {row.createdAt ? formatDate(row.createdAt) : 'n/a'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                        Contact
                      </dt>
                      <dd className="text-text-secondary break-all">
                        {row.contact || 'Anonymous'}
                      </dd>
                    </div>
                    {row.reference ? (
                      <div>
                        <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                          Reference
                        </dt>
                        <dd className="text-text-secondary break-all">
                          {row.reference}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
                <div className="lg:col-span-8 min-w-0">
                  <div className="text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1">
                    What happened
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {row.whatHappened}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 mt-4">
                <select
                  className="bg-cyber-surface border border-cyber-border rounded-lg px-2 py-1.5 text-xs text-white"
                  value={row.status}
                  disabled={busy}
                  onChange={(e) =>
                    void handleConcernStatus(row.id, e.target.value)
                  }
                  aria-label="Concern status"
                >
                  {CONCERN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CONCERN_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
