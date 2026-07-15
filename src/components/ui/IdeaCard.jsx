import { Flame, MessageCircle } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import UserAvatar from './UserAvatar';
import {
  deriveIdeaStatus,
  getIdeaProjectKey,
  parseTags,
  statusChipClasses,
} from '../../utils/ideaStatus';

/**
 * Shared idea listing card for GameIdeas + Project Workspace.
 *
 * Layout:
 *  [vote]  title ………………………………… [status top-right]
 *          category · summary · tags
 *          avatar · creator · date · comments
 */
const IdeaCard = ({
  idea,
  voted = false,
  isOwn = false,
  voting = false,
  onVote,
  onOpen,
  /** Resolved project display name when status is Linked */
  projectName = null,
  /** Slug/id used when clicking the Linked chip */
  projectSlug = null,
  /** Called when Linked chip is clicked (stopPropagation applied) */
  onProjectClick,
  commentCount,
  showTags = true,
  className = '',
}) => {
  const status = deriveIdeaStatus(idea);
  const isLinked = status === 'Linked';
  const creatorName =
    idea.creator?.username || idea.submitter || 'Community';
  const avatarSrc =
    idea.creator?.avatar_url || idea.creator?.avatarUrl || null;
  const tags = showTags ? parseTags(idea.tags).slice(0, 4) : [];
  const projectKey = getIdeaProjectKey(idea);
  const linkedLabel = projectName || projectKey || 'Linked project';
  const comments =
    typeof commentCount === 'number'
      ? commentCount
      : idea.commentCount ?? 0;
  const createdAt = idea.created_at || idea.createdAt || null;
  const category = idea.category || null;
  const summary = idea.summary || idea.description || 'No summary yet.';

  const open = () => onOpen?.(idea.id);

  const handleProjectChip = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onProjectClick) {
      onProjectClick({
        slug: projectSlug || projectKey,
        name: linkedLabel,
        key: projectKey,
      });
    }
  };

  return (
    <Card
      className={`bg-cyber-card/80 hover:border-neon-cyan/40 cursor-pointer transition-colors group relative p-5 sm:p-6 ${className}`}
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
      {/* Status — top right */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 max-w-[45%] sm:max-w-[40%]">
        {isLinked ? (
          <button
            type="button"
            onClick={handleProjectChip}
            title={
              onProjectClick
                ? `View ideas for ${linkedLabel}`
                : linkedLabel
            }
            className={`inline-flex items-center max-w-full gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono tracking-wide border transition-colors ${statusChipClasses(
              'Linked'
            )}`}
          >
            <span className="opacity-80 shrink-0">Linked ·</span>
            <span className="truncate font-medium">{linkedLabel}</span>
          </button>
        ) : (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono tracking-wide border ${statusChipClasses(
              status
            )}`}
          >
            {status}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Fire vote */}
        <div
          className="flex sm:flex-col items-center gap-2 sm:gap-1 shrink-0 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onVote?.(e, idea);
            }}
            disabled={voting || !onVote}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-white/5 hover:text-white transition text-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={voted ? 'Remove your vote' : 'Vote for this idea'}
            aria-pressed={voted}
            aria-label={
              voted
                ? `Remove vote for ${idea.title}`
                : `Vote for ${idea.title}`
            }
          >
            <Flame
              className={`w-4 h-4 transition-colors ${
                voted
                  ? 'text-orange-500'
                  : 'text-text-muted hover:text-orange-400/70'
              }`}
            />
            <span className="font-mono tabular-nums text-sm text-text-secondary">
              {idea.votes || 0}
            </span>
          </button>
        </div>

        {/* Main content — pad right so title doesn’t collide with status */}
        <div className="flex-1 min-w-0 pr-0 sm:pr-28">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {category && (
              <Badge variant="default" className="!normal-case tracking-wide">
                {category}
              </Badge>
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white mb-1.5 group-hover:text-neon-cyan transition-colors leading-snug">
            {idea.title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed line-clamp-2 mb-3">
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-text-muted">
            <div className="inline-flex items-center gap-2 min-w-0">
              <UserAvatar
                src={avatarSrc}
                name={creatorName}
                size="sm"
                borderClass="border border-neon-cyan/30"
              />
              <span className="truncate">
                by <span className="text-neon-cyan">{creatorName}</span>
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
              <MessageCircle className="w-4 h-4" />
              <span className="tabular-nums">{comments}</span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default IdeaCard;
