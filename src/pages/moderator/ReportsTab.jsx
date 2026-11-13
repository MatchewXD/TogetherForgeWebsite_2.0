/**
 * Moderator Dashboard: Content reports queue.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Button from '../../components/ui/Buttons';
import moderationService from '../../services/moderationService';
import { formatDate } from './shared';

export default function ReportsTab({
  busyKey,
  loading,
  reports,
  reportsMissing,
  runAction,
}) {
  return (
    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading" className="sr-only">
        Reports
      </h2>

      {reportsMissing && (
        <Card className="bg-cyber-card/80 border-amber-500/30 mb-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            The <code className="text-neon-cyan text-xs font-mono">content_reports</code>{' '}
            table is not available yet. Run{' '}
            <code className="text-neon-cyan text-xs font-mono">
              supabase/sql/supabase_moderation.sql
            </code>{' '}
            in Supabase to enable the reports queue. Pending items will
            show here afterward.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {!reportsMissing && reports.length === 0 && !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No reports in the queue. Looking good.
          </Card>
        )}
        {reports.map((r) => {
          const busy = busyKey === `report-${r.id}`;
          return (
            <Card key={r.id} className="bg-cyber-card/80">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge
                      variant={
                        r.status === 'pending' ? 'neon' : 'default'
                      }
                    >
                      {r.status}
                    </Badge>
                    <span className="text-xs font-mono text-text-muted uppercase tracking-widest">
                      {r.target_type} · {r.target_id}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium">
                    {r.reason || 'No reason given'}
                  </p>
                  {r.details && (
                    <p className="text-sm text-text-secondary mt-1">
                      {r.details}
                    </p>
                  )}
                  <p className="text-xs font-mono text-text-muted mt-2">
                    #{r.id} · {formatDate(r.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {r.target_type === 'idea' && (
                    <Link
                      to={`/ideas/${r.target_id}`}
                      className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:underline px-2 py-1"
                    >
                      View idea <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || r.status === 'reviewing'}
                    onClick={() =>
                      runAction(
                        `report-${r.id}`,
                        () =>
                          moderationService.resolveReport(
                            r.id,
                            'reviewing'
                          ),
                        'Marked reviewing'
                      )
                    }
                  >
                    Reviewing
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || r.status === 'resolved'}
                    onClick={() =>
                      runAction(
                        `report-${r.id}`,
                        () =>
                          moderationService.resolveReport(
                            r.id,
                            'resolved'
                          ),
                        'Report resolved'
                      )
                    }
                  >
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || r.status === 'dismissed'}
                    onClick={() =>
                      runAction(
                        `report-${r.id}`,
                        () =>
                          moderationService.resolveReport(
                            r.id,
                            'dismissed'
                          ),
                        'Report dismissed'
                      )
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
