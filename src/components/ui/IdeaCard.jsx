import { Flame, MessageCircle } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import UserAvatar from './UserAvatar';
import ProfileLink from './ProfileLink';
import {
  deriveIdeaStatus,
  getIdeaProjectKey,
  isStudioStageKey,
  resolveLinkDisplayName,
  parseTags,
  statusChipClasses,
  statusLabel,
} from '../../utils/ideaStatus';
import { getIdeaImageUrl } from '../../services/ideasService';

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
  isOwn = false,
  voting = false,
  onVote,
  onOpen,
  /** Resolved project/game display name when linked */
  projectName = null,
  /** Slug/id used when clicking the link target chip */
  projectSlug = null,
  /** Called when the project/game chip is clicked (stopPropagation applied) */
  onProjectClick,
  commentCount,
  showTags = true,
  className = '',
}) => {
  const status = deriveIdeaStatus(idea);
  const isLinked = status === 'Linked';
  const creatorUsername = idea.creator?.username || null;
  const creatorName =
    creatorUsername || idea.submitter || 'Community';
  const avatarSrc =
    idea.creator?.avatar_url || idea.creator?.avatarUrl || null;
  const tags = showTags ? parseTags(idea.tags).slice(0, 4) : [];
  const projectKey = getIdeaProjectKey(idea);
  const linkedLabel =
    resolveLinkDisplayName(projectKey, projectName) || projectName || null;
  const linkIsStage = isStudioStageKey(projectKey);
  const comments =
    typeof commentCount === 'number'
      ? commentCount
      : idea.commentCount ?? 0;
  const createdAt = idea.created_at || idea.createdAt || null;
  const category = idea.category || null;
  const summary = idea.summary || idea.description || 'No summary yet.';
  const thumbUrl = getIdeaImageUrl(idea);

  const open = () => onOpen?.(idea.id);

  const handleProjectChip = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onProjectClick) {
      onProjectClick({
        slug: projectSlug || projectKey,
        name: linkedLabel,
        key: projectKey,
        isStage: linkIsStage,
      });
    }
  };

  const statusChip = isLinked ? (
    <button
      type="button"
      onClick={handleProjectChip}
      title={
        onProjectClick
          ? `View ideas for ${linkedLabel || 'link'}`
          : linkedLabel || 'Linked'
      }
      className={`inline-flex items-center max-w-full gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono tracking-wide border transition-colors ${statusChipClasses(
        'Linked'
      )}`}
    >
      <span className="opacity-80 shrink-0">Linked</span>
      {linkedLabel && (
        <>
          <span className="opacity-80 shrink-0">·</span>
          <span className="truncate font-medium">{linkedLabel}</span>
        </>
      )}
    </button>
  ) : (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono tracking-wide border ${statusChipClasses(
        status
      )}`}
    >
      {statusLabel(status)}
    </span>
  );

  return (
    <Card
      interactive
      variant="subtle"
      className={`transition-colors group p-4 sm:p-5 ${className}`}
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
      {/* Header: category + status on one row (no absolute / reserved column) */}
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        {category && (
          <Badge variant="default" className="!normal-case tracking-wide">
            {category}
          </Badge>
        )}
        <div
          className="ml-auto max-w-[min(100%,14rem)] shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {statusChip}
        </div>
      </div>

      {/* Body: text left, optional image right */}
      <div className="flex gap-3 sm:gap-4 items-start min-w-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-1.5 group-hover:text-neon-cyan transition-colors leading-snug">
            {idea.title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed line-clamp-2 mb-2.5">
            {summary}
          </p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded border border-cyber-border text-text-muted"
                >
                  #{tag}
                </span>
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

      {/* Footer: vote + meta in one compact row (no left empty column) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-mono text-text-muted pt-1">
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
            <ProfileLink
              username={creatorUsername}
              className="text-neon-cyan"
            >
              {creatorName}
            </ProfileLink>
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
    </Card>
  );
};

export default IdeaCard;
