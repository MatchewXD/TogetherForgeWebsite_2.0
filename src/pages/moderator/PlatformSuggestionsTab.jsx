/**
 * Moderator Dashboard: Platform suggestions review.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import { Link } from 'react-router-dom';
import {
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { SUGGESTION_STATUSES } from '../../constants/platformSuggestions';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import UserAvatar from '../../components/ui/UserAvatar';
import UserNameWithBadge from '../../components/badges/UserNameWithBadge';
import Button from '../../components/ui/Buttons';
import { filterLabel, filterControl, formatDate } from './shared';

export default function PlatformSuggestionsTab({
  busyKey,
  filteredSuggestions,
  handleSuggestionDelete,
  handleSuggestionHidden,
  handleSuggestionStatus,
  loading,
  setSuggestionStatusFilter,
  suggestionsMissing,
  suggestionStatusFilter,
}) {
  return (
    <section aria-labelledby="suggestions-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2
            id="suggestions-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Platform suggestions
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">
            Site feedback (not game ideas). Set status, hide a row from
            the public list, or delete it.
          </p>
          <Link
            to="/suggestions"
            className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan hover:underline mt-2"
          >
            View public list
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div>
          <label className={filterLabel} htmlFor="mod-sug-status">
            Status
          </label>
          <select
            id="mod-sug-status"
            className={filterControl}
            value={suggestionStatusFilter}
            onChange={(e) => setSuggestionStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            {SUGGESTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="hidden">Hidden</option>
          </select>
        </div>
      </div>

      {suggestionsMissing && (
        <Card className="bg-cyber-card/80 border-amber-500/30 mb-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Platform suggestions are not set up yet. Run{' '}
            <code className="text-neon-cyan text-xs font-mono">
              supabase/sql/supabase_platform_suggestions.sql
            </code>{' '}
            in Supabase, then refresh.
          </p>
        </Card>
      )}

      {!suggestionsMissing &&
        filteredSuggestions.length === 0 &&
        !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No suggestions in this view.
          </Card>
        )}

      <div className="space-y-3">
        {filteredSuggestions.map((item) => {
          const busy = busyKey === `sug-${item.id}`;
          return (
            <Card
              key={item.id}
              className={`bg-cyber-card/80 ${
                item.isHidden ? 'opacity-80 border-amber-400/30' : ''
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <h3 className="text-base font-semibold text-white pr-2">
                  {item.title}
                </h3>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <Badge variant="default">{item.category}</Badge>
                  <Badge
                    variant={
                      item.status === 'Done'
                        ? 'success'
                        : item.status === 'Under consideration'
                          ? 'neon'
                          : 'default'
                    }
                  >
                    {item.status}
                  </Badge>
                  {item.isHidden && (
                    <Badge variant="warning">Hidden</Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-text-muted font-mono">
                <UserAvatar
                  src={
                    item.creator?.avatar_url || item.creator?.avatarUrl
                  }
                  name={item.creator?.username || 'Member'}
                  username={item.creator?.username}
                  size="xs"
                />
                <UserNameWithBadge
                  username={item.creator?.username}
                  displayName={item.creator?.username || 'Member'}
                  pinnedBadgeKey={
                    item.creator?.pinnedBadgeKey ||
                    item.creator?.pinned_badge_key ||
                    null
                  }
                  linkClassName="text-neon-cyan hover:underline"
                />
                {item.createdAt && (
                  <span className="opacity-70">
                    · {formatDate(item.createdAt)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 mt-3">
                <select
                  className="bg-cyber-surface border border-cyber-border rounded-lg px-2 py-1.5 text-xs text-white"
                  value={item.status}
                  disabled={busy}
                  onChange={(e) =>
                    void handleSuggestionStatus(item.id, e.target.value)
                  }
                >
                  {SUGGESTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void handleSuggestionHidden(item.id, !item.isHidden)
                  }
                  className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-white border border-white/15 rounded-lg px-2 py-1.5"
                >
                  {item.isHidden ? (
                    <>
                      <Eye className="w-3 h-3" /> Unhide
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3" /> Hide
                    </>
                  )}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-red-300"
                  disabled={busy}
                  onClick={() => handleSuggestionDelete(item)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
