import Card from '../ui/Card';
import Badge from '../ui/Badge';
import {
  formatPollWhen,
  pollPath,
  pollVoteTotal,
  projectTagLabel,
  remainingLabel,
} from '../../services/pollsService';

function statusBadge(poll) {
  if (poll.isLive) return { variant: 'neon', label: 'Live' };
  if (poll.isDraft) return { variant: 'warning', label: 'Draft' };
  return { variant: 'success', label: 'Closed' };
}

export default function PollCard({ poll, to, showTag = true }) {
  if (!poll) return null;
  const href = to || pollPath(poll.id);
  const badge = statusBadge(poll);
  const total = pollVoteTotal(poll);
  const tag = showTag ? projectTagLabel(poll.projectTag) : '';
  const timer =
    poll.isLive && poll.closesAt ? remainingLabel(poll.closesAt) : '';

  return (
    <Card
      to={href}
      interactive
      variant="subtle"
      className="bg-cyber-card/80 flex flex-col h-full hover:border-neon-cyan/40 transition-colors group p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-lg sm:text-xl font-bold text-white leading-snug group-hover:text-neon-cyan transition-colors">
          {poll.title}
        </h3>
        <Badge variant={badge.variant} className="!normal-case shrink-0">
          {badge.label}
        </Badge>
      </div>
      {tag ? (
        <p className="text-[11px] font-mono text-neon-cyan/80 mb-2">{tag}</p>
      ) : null}
      {poll.context ? (
        <p className="text-sm text-text-secondary flex-1 mb-3 line-clamp-2 leading-relaxed">
          {poll.context}
        </p>
      ) : (
        <div className="flex-1 mb-3" />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-text-muted">
        <span className="text-neon-cyan">
          {poll.optionCount} option{poll.optionCount === 1 ? '' : 's'}
          {total
            ? ` · ${total} vote${total === 1 ? '' : 's'}`
            : poll.isLive
              ? ' · no votes yet'
              : ''}
        </span>
        <span>
          {timer ||
            (poll.closedAt
              ? `Closed ${formatPollWhen(poll.closedAt)}`
              : formatPollWhen(poll.openedAt || poll.createdAt))}
        </span>
      </div>
    </Card>
  );
}
