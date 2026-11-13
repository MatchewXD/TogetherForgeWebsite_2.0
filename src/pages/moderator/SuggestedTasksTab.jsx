/**
 * Moderator Dashboard: Community-suggested tasks awaiting review.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import TaskCategoryBadge from '../../components/ui/TaskCategoryBadge';
import Button from '../../components/ui/Buttons';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatDate } from './shared';

export default function SuggestedTasksTab({
  busyKey,
  handleSuggestedAccept,
  loading,
  suggestedTasks,
}) {
  return (
    <section aria-labelledby="suggested-heading">
      <div className="mb-4">
        <h2
          id="suggested-heading"
          className="text-xl sm:text-2xl font-bold text-white tracking-tight"
        >
          Suggested tasks
        </h2>
        <p className="text-sm text-text-secondary mt-1 max-w-xl">
          Volunteer proposals waiting for staff. Accept copies the card
          onto that project&apos;s Staging board. Reject and strike stay
          on the project queue.
        </p>
      </div>

      {suggestedTasks.length === 0 && !loading && (
        <Card className="bg-cyber-card/80 text-sm text-text-muted">
          No pending suggested tasks.
        </Card>
      )}

      <div className="space-y-3">
        {suggestedTasks.map((row) => {
          const busy = busyKey === `suggested-${row.id}`;
          const boardHref = row.projectSlug
            ? `/projects/${row.projectSlug}/board/suggested`
            : null;
          return (
            <Card key={row.id} className="bg-cyber-card/80">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <h3 className="text-base font-semibold text-white pr-2">
                  {row.title}
                </h3>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {row.projectTitle ? (
                    <Badge variant="neon">{row.projectTitle}</Badge>
                  ) : null}
                  {row.category ? (
                    <TaskCategoryBadge category={row.category} size="sm" />
                  ) : null}
                </div>
              </div>
              {row.description ? (
                <p className="text-sm text-text-secondary leading-relaxed line-clamp-4 whitespace-pre-wrap">
                  {row.description}
                </p>
              ) : null}
              <p className="text-xs font-mono text-text-muted mt-2">
                {row.createdAt ? formatDate(row.createdAt) : ''}
                {row.authorName ? ` · ${row.authorName}` : ''}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void handleSuggestedAccept(row.id)}
                >
                  Accept to Staging
                </Button>
                {boardHref ? (
                  <Link
                    to={boardHref}
                    className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:underline"
                  >
                    Project queue
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
