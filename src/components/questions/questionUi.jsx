import { ChevronsUp, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import Button from '../ui/Buttons';
import CharCount from '../ui/CharCount';
import UserAvatar from '../ui/UserAvatar';
import UserNameWithBadge from '../badges/UserNameWithBadge';
import { OPEN_QUESTION_REPLY_MAX } from '../../services/openQuestionsService';
import { fieldControl, formatDate } from './questionStyles';

export function AuthorLine({ author, extra }) {
  const name = author?.username || 'Member';
  return (
    <div className="flex items-center gap-2 min-w-0 text-xs">
      <UserAvatar
        src={author?.avatarUrl || author?.avatar_url}
        name={name}
        username={author?.username}
        size="sm"
      />
      <UserNameWithBadge
        username={author?.username}
        displayName={name}
        pinnedBadgeKey={author?.pinnedBadgeKey || author?.pinned_badge_key}
        linkClassName="truncate text-text-primary"
      />
      {extra ? (
        <span className="text-text-muted font-mono shrink-0">{extra}</span>
      ) : null}
    </div>
  );
}

export function VoteButton({ suggestion, disabled, onVote }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => onVote(e, suggestion.id)}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-mono transition-colors ${
        suggestion.supportedByMe
          ? 'border-neon-cyan/50 bg-neon-cyan/15 text-neon-cyan'
          : 'border-cyber-border text-text-muted hover:text-neon-cyan hover:border-neon-cyan/40'
      } disabled:opacity-50`}
      title="Vote this answer up"
    >
      <ChevronsUp className="w-3.5 h-3.5" />
      {suggestion.supportCount}
    </button>
  );
}

export function CommentThread({
  comments = [],
  isOpen,
  user,
  busy,
  replyDrafts,
  setReplyDrafts,
  replyOpenFor,
  setReplyOpenFor,
  onPostReply,
}) {
  if (!comments.length) {
    return (
      <p className="text-sm text-text-muted">
        No comments yet. Start the discussion below.
      </p>
    );
  }

  const renderNode = (node, depth = 0) => (
    <li key={node.id} className={depth > 0 ? 'mt-3' : ''}>
      <AuthorLine author={node.author} extra={formatDate(node.createdAt)} />
      <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap leading-relaxed">
        {node.body}
      </p>
      {isOpen && user ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-mono text-neon-cyan hover:text-white"
          onClick={() =>
            setReplyOpenFor((id) => (id === node.id ? null : node.id))
          }
        >
          Reply
        </button>
      ) : null}
      {replyOpenFor === node.id && isOpen ? (
        <div className="mt-2 space-y-2">
          <textarea
            className={`${fieldControl} min-h-[4rem]`}
            maxLength={OPEN_QUESTION_REPLY_MAX}
            value={replyDrafts[node.id] || ''}
            onChange={(e) =>
              setReplyDrafts((prev) => ({
                ...prev,
                [node.id]: e.target.value,
              }))
            }
            placeholder={`Reply to ${node.author?.username || 'this comment'}…`}
          />
          <CharCount
            value={replyDrafts[node.id] || ''}
            max={OPEN_QUESTION_REPLY_MAX}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => onPostReply(node.id)}>
              Send
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReplyOpenFor(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {node.replies?.length ? (
        <ul
          className={`mt-3 space-y-3 ${
            depth < 5 ? 'border-l border-white/10 pl-4' : ''
          }`}
        >
          {node.replies.map((child) => renderNode(child, depth + 1))}
        </ul>
      ) : null}
    </li>
  );

  return <ul className="space-y-4">{comments.map((c) => renderNode(c, 0))}</ul>;
}

export function SignInHint({ action = 'post' }) {
  return (
    <p className="text-sm text-text-muted">
      <Link to="/account" className="text-neon-cyan hover:underline">
        Sign in
      </Link>{' '}
      to {action}.
    </p>
  );
}

export function AnswerMeta({ suggestion }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-mono text-text-muted">
      <span className="inline-flex items-center gap-1">
        <ChevronsUp className="w-3.5 h-3.5" />
        {suggestion.supportCount} vote
        {suggestion.supportCount === 1 ? '' : 's'}
      </span>
      <span className="inline-flex items-center gap-1">
        <MessageCircle className="w-3.5 h-3.5" />
        {suggestion.replyCount} comment
        {suggestion.replyCount === 1 ? '' : 's'}
      </span>
    </div>
  );
}
