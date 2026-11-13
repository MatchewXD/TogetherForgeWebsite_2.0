/**
 * Moderator Dashboard: Pending Community Showcase submissions.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Card from '../../components/ui/Card';
import { showcaseHref } from '../../services/showcaseService';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Buttons';
import { formatDate } from './shared';

export default function ShowcaseTab({
  busyKey,
  handleShowcaseAction,
  loading,
  showcaseMissing,
  showcasePending,
}) {
  return (
    <section aria-labelledby="showcase-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2
            id="showcase-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Showcase submissions
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">
            Community posts wait here until staff approve them. They do
            not go live on their own.
          </p>
          <Link
            to="/showcase/moderate"
            className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan hover:underline mt-2"
          >
            Full showcase queue
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {showcaseMissing && (
        <Card className="bg-cyber-card/80 border-amber-500/30 mb-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Showcase is not set up yet. Run{' '}
            <code className="text-neon-cyan text-xs font-mono">
              supabase/sql/supabase_community_showcase.sql
            </code>{' '}
            in Supabase, then refresh.
          </p>
        </Card>
      )}

      {!showcaseMissing &&
        showcasePending.length === 0 &&
        !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No pending showcase submissions.
          </Card>
        )}

      <div className="space-y-3">
        {showcasePending.map((post) => {
          const busy = busyKey === `showcase-${post.id}`;
          const href = showcaseHref(post);
          return (
            <Card key={post.id} className="bg-cyber-card/80">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <h3 className="text-base font-semibold text-white pr-2">
                  {post.title}
                </h3>
                <Badge variant="warning">
                  {post.contentType || 'pending'}
                </Badge>
              </div>
              {post.description ? (
                <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">
                  {post.description}
                </p>
              ) : null}
              <p className="text-xs font-mono text-text-muted mt-2">
                {post.createdAt ? formatDate(post.createdAt) : ''}
                {post.creatorDisplayName
                  ? ` · ${post.creatorDisplayName}`
                  : ''}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 mt-3">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:underline"
                  >
                    Open
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void handleShowcaseAction(
                      post.id,
                      'approve',
                      'Approved — now live'
                    )
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-300"
                  disabled={busy}
                  onClick={() =>
                    void handleShowcaseAction(
                      post.id,
                      'reject',
                      'Rejected'
                    )
                  }
                >
                  Reject
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
