import { Flame, MessageCircle, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from './Card';
import Badge from './Badge';
import UserAvatar from './UserAvatar';
import UserNameWithBadge from '../badges/UserNameWithBadge';
import {
  getPublicIdeaLabel,
  parseTags,
  statusChipClasses,
  statusLabel,
} from '../../utils/ideaStatus';
import { getIdeaImageUrl } from '../../services/ideasService';
import { ideaHasParent } from '../../utils/ideaRelations';
import { ideasListHrefForTag } from '../../utils/ideaTags';
import CommunityAwardStrip from '../awards/CommunityAwardStrip';

/**
 * Shared idea listing card for GameIdeas + Project Workspace.
 *
 * Compact balanced layout (no empty side columns):
 *  [category] ……………………………… [status]
 *  title / summary / tags …………… [image]
 *  [vote] · avatar · date · comments
 */
const IdeaCard = ({
  idea,
  voted = false,
  isOwn: _isOwn = false,
  voting = false,
  onVote,
  onOpen,
  /** Kept for callers that still pass project chip props */
  projectName: _projectName = null,
  projectSlug: _projectSlug = null,
  onProjectClick: _onProjectClick,
  commentCount,
  showTags = true,
  className = '',
  awards = [],
}) => {
  const publicLabel = getPublicIdeaLabel(idea);
  const creatorUsername = idea.creator?.username || null;
  const creatorName =
    creatorUsername || idea.submitter || 'Community';
  const avatarSrc =
    idea.creator?.avatar_url || idea.creator?.avatarUrl || null;
  const tags = showTags ? parseTags(idea.tags).slice(0, 4) : [];
  const comments =
    typeof commentCount === 'number'
      ? commentCount
      : idea.commentCount ?? 0;
  const createdAt = idea.created_at || idea.createdAt || null;
  const category = idea.category || null;
  const summary = idea.summary || idea.description || 'No summary yet.';
  const thumbUrl = getIdeaImageUrl(idea);
  const parentSummary = idea.parent || idea.parentIdea || null;
  const hasParent = ideaHasParent(idea) || Boolean(parentSummary);

  const open = () => onOpen?.(idea.id);

  const statusChip = publicLabel ? (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono tracking-wide border ${statusChipClasses(
        publicLabel
      )}`}
    >
      {statusLabel(publicLabel)}
    </span>
  ) : null;

  return (
    <Card
      interactive
      variant="subtle"
      className={`transition-colors group p-4 sm:p-5 h-full flex flex-col ${className}`}
      onClick={open}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      {/* Header: category left, awards immediately left of Adopted / Under Review */}
      <div className="flex items-center gap-2 mb-2.5 min-w-0">
        {category && (
          <Badge variant="default" className="!normal-case tracking-wide shrink-0">
            {category}
          </Badge>
        )}
        <div className="flex-1 min-w-0" />
        <div
          className="flex items-center gap-2 min-w-0 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {awards?.length > 0 && (
            <CommunityAwardStrip awards={awards} compact />
          )}
          {statusChip}
        </div>
      </div>

      {/* Body: text left, optional image right — grows so footer stays at bottom */}
      <div className="flex gap-3 sm:gap-4 items-start min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-1.5 group-hover:text-neon-cyan transition-colors leading-snug">
            {idea.title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed line-clamp-2 mb-2.5">
            {summary}
          </p>

          {hasParent && (
            <div
              className="inline-flex items-center gap-1.5 max-w-full mb-2.5 text-[11px] font-mono text-neon-purple/90 border border-neon-purple/30 bg-neon-purple/10 rounded-full px-2 py-0.5"
              title={
                parentSummary?.title
                  ? `Builds on ${parentSummary.title}${
                      parentSummary.creator?.username
                        ? ` by ${parentSummary.creator.username}`
                        : ''
                    }`
                  : 'Builds on another idea'
              }
            >
              <Link2 className="w-3 h-3 shrink-0" aria-hidden />
              <span className="truncate">
                {parentSummary?.title
                  ? `Builds on ${parentSummary.title}`
                  : 'Related idea'}
              </span>
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.map((tag) => (
                <Link
                  key={tag}
                  to={ideasListHrefForTag(tag)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded border border-cyber-border text-text-muted hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50"
                  title={`View ideas tagged #${tag}`}
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        {thumbUrl && (
          <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-cyber-border bg-cyber-surface">
            <img
              src={thumbUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
      </div>

      <div className="mt-auto pt-3">
      {/* Footer: always pinned to the bottom of the card */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-mono text-text-muted">
        <div
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (voting || !onVote) return;
              onVote?.(e, idea);
            }}
            disabled={!onVote}
            aria-busy={voting || undefined}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50 disabled:cursor-not-allowed ${
              voted
                ? 'border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/15'
                : 'border-cyber-border bg-cyber-surface/60 hover:border-orange-400/40 hover:bg-white/5'
            } ${voting ? 'opacity-80' : ''}`}
            title={voted ? 'Remove your vote' : 'Vote for this idea'}
            aria-pressed={!!voted}
            aria-label={
              voted
                ? `Remove vote for ${idea.title}`
                : `Vote for ${idea.title}`
            }
          >
            <Flame
              className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                voted
                  ? 'text-orange-500 fill-orange-500/30'
                  : 'text-slate-400'
              }`}
              strokeWidth={voted ? 2.25 : 2}
            />
            <span
              className={`tabular-nums min-w-[1rem] text-center ${
                voted ? 'text-orange-400' : 'text-text-secondary'
              }`}
            >
              {Number(idea.votes) > 0 ? idea.votes : 0}
            </span>
          </button>
        </div>

        <div
          className="inline-flex items-center gap-2 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <UserAvatar
            src={avatarSrc}
            name={creatorName}
            username={creatorUsername}
            size="sm"
            borderClass="border border-neon-cyan/30"
          />
          <span className="truncate">
            by{' '}
            <UserNameWithBadge
              username={creatorUsername}
              displayName={creatorName}
              pinnedBadgeKey={
                idea.creator?.pinnedBadgeKey ||
                idea.creator?.pinned_badge_key ||
                null
              }
              linkClassName="text-neon-cyan"
            />
          </span>
        </div>

        {createdAt && (
          <span className="tabular-nums text-text-muted/80">
            {new Date(createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}

        <span className="inline-flex items-center gap-1.5 sm:ml-auto text-text-secondary group-hover:text-neon-cyan transition-colors">
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="tabular-nums">{comments}</span>
        </span>
      </div>
      </div>
    </Card>
  );
};

export default IdeaCard;
