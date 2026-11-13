/**
 * Moderator Dashboard: Idea moderation list.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import Button from '../../components/ui/Buttons';
import Card from '../../components/ui/Card';
import { Search, ExternalLink, Trash2 } from 'lucide-react';
import moderationService, { WORKFLOW_STATUSES } from '../../services/moderationService';
import { STATUS_LABELS } from '../../utils/ideaStatus';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';
import OpenConductCaseButton from '../../components/conduct/OpenConductCaseButton';
import { filterLabel, filterControl, formatDate } from './shared';

export default function IdeasTab({
  busyKey,
  filteredIdeas,
  ideaCategories,
  ideaCategoryFilter,
  ideas,
  ideaSearch,
  ideaSort,
  ideaStatusFilter,
  loading,
  runAction,
  setConfirmDialog,
  setIdeaCategoryFilter,
  setIdeaSearch,
  setIdeaSort,
  setIdeaStatusFilter,
}) {
  return (
    <section aria-labelledby="ideas-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
        <div>
          <h2
            id="ideas-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            All Ideas
          </h2>
          <p className="text-xs font-mono text-text-muted mt-1">
            Showing {filteredIdeas.length}
            {filteredIdeas.length !== ideas.length
              ? ` of ${ideas.length}`
              : ''}
          </p>
        </div>
        {(ideaSearch ||
          ideaStatusFilter !== 'all' ||
          ideaCategoryFilter !== 'all' ||
          ideaSort !== 'newest') && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setIdeaSearch('');
              setIdeaStatusFilter('all');
              setIdeaCategoryFilter('all');
              setIdeaSort('newest');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Card className="bg-cyber-card/80 mb-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={filterLabel} htmlFor="mod-idea-search">
              Search
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                aria-hidden
              />
              <input
                id="mod-idea-search"
                type="search"
                className={`${filterControl} pl-9`}
                placeholder="Title, summary, id…"
                value={ideaSearch}
                onChange={(e) => setIdeaSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={filterLabel} htmlFor="mod-idea-status">
              Status
            </label>
            <select
              id="mod-idea-status"
              className={filterControl}
              value={ideaStatusFilter}
              onChange={(e) => setIdeaStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {WORKFLOW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] || s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={filterLabel} htmlFor="mod-idea-category">
              Category
            </label>
            <select
              id="mod-idea-category"
              className={filterControl}
              value={ideaCategoryFilter}
              onChange={(e) => setIdeaCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {ideaCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={filterLabel} htmlFor="mod-idea-sort">
              Sort
            </label>
            <select
              id="mod-idea-sort"
              className={filterControl}
              value={ideaSort}
              onChange={(e) => setIdeaSort(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="votes_high">Most votes</option>
              <option value="votes_low">Fewest votes</option>
              <option value="title_az">Title A–Z</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {ideas.length === 0 && !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No ideas found.
          </Card>
        )}
        {ideas.length > 0 && filteredIdeas.length === 0 && !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No ideas match these filters.
          </Card>
        )}
        {filteredIdeas.map((idea) => {
          const busy = busyKey === `idea-${idea.id}`;
          const status = idea.status || 'Proposed';
          return (
            <Card
              key={idea.id}
              className="bg-cyber-card/80 flex flex-col gap-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white truncate">
                      {idea.title || 'Untitled'}
                    </h3>
                    <Badge variant="default">
                      {STATUS_LABELS[status] || status}
                    </Badge>
                    <span className="text-xs font-mono text-text-muted">
                      {idea.votes ?? 0} votes
                    </span>
                  </div>
                  <p className="text-xs text-text-muted font-mono">
                    #{idea.id} · {formatDate(idea.created_at)}
                    {idea.category ? ` · ${idea.category}` : ''}
                  </p>
                  {idea.summary && (
                    <p className="text-sm text-text-secondary mt-2 line-clamp-2">
                      {idea.summary}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Link
                    to={`/ideas/${idea.id}`}
                    className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:underline px-2 py-1"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </Link>
                  {idea.user_id ? (
                    <OpenConductCaseButton
                      targetUserId={idea.user_id}
                      contentType="idea"
                      contentId={String(idea.id)}
                      contentPath={`/ideas/${idea.id}`}
                    />
                  ) : null}
                  <select
                    className="text-xs bg-cyber-surface border border-cyber-border rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-neon-cyan"
                    value={
                      WORKFLOW_STATUSES.includes(status)
                        ? status
                        : 'Proposed'
                    }
                    disabled={busy}
                    onChange={(e) => {
                      const next = e.target.value;
                      runAction(
                        `idea-${idea.id}`,
                        () =>
                          moderationService.updateIdeaStatus(
                            idea.id,
                            next
                          ),
                        `Status → ${STATUS_LABELS[next] || next}`
                      );
                    }}
                    aria-label={`Status for ${idea.title}`}
                  >
                    {WORKFLOW_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s] || s}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-red-300"
                    disabled={busy}
                    onClick={() => {
                      setConfirmDialog({
                        title: 'Delete idea',
                        message: `Delete idea “${idea.title || 'Untitled'}”? This cannot be undone.`,
                        confirmLabel: 'Delete idea',
                        onConfirm: () =>
                          runAction(
                            `idea-${idea.id}`,
                            () => moderationService.deleteIdea(idea.id),
                            'Idea deleted'
                          ),
                      });
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
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
