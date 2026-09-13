import { Link } from 'react-router-dom';
import Button from '../ui/Buttons';
import {
  POLL_INFORM_COPY,
  formatPollWhen,
  isPollLive,
  optionPercent,
  pollVoteTotal,
  remainingLabel,
} from '../../services/pollsService';
import { arePollsEnabled } from '../../constants/pollsEnabled';

export default function PollVotePanel({
  poll,
  user,
  selectedId,
  onSelect,
  onVote,
  busy = false,
  canVote = true,
}) {
  if (!poll) return null;
  const live = isPollLive(poll);
  const enabled = arePollsEnabled();
  const total = pollVoteTotal(poll);
  const showCounts = live || poll.isClosed;
  const timer = poll.closesAt
    ? live
      ? remainingLabel(poll.closesAt)
      : `Closed ${formatPollWhen(poll.closedAt || poll.closesAt)}`
    : poll.isClosed
      ? `Closed ${formatPollWhen(poll.closedAt)}`
      : '';

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary leading-relaxed">
        {POLL_INFORM_COPY}
      </p>
      {timer ? (
        <p className="text-xs font-mono tracking-widest uppercase text-neon-cyan">
          {timer}
        </p>
      ) : null}
      {poll.isClosed ? (
        <p className="text-sm text-semantic-success border border-semantic-success/40 bg-semantic-success/10 rounded-lg px-3 py-2">
          This poll is closed. The counts below are the record.
        </p>
      ) : null}

      <ul className="space-y-3">
        {(poll.options || []).map((option) => {
          const picked = selectedId === option.id;
          const mine = poll.myOptionId === option.id;
          const pct = optionPercent(option, total);
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={!live || !enabled || !canVote || busy || !user}
                onClick={() => onSelect?.(option.id)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                  picked
                    ? 'border-neon-cyan bg-neon-cyan/10'
                    : 'border-cyber-border bg-cyber-surface hover:border-neon-cyan/40'
                } disabled:hover:border-cyber-border disabled:cursor-default`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{option.name}</p>
                    <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                      {option.description}
                    </p>
                  </div>
                  {showCounts ? (
                    <p className="shrink-0 text-xs font-mono text-neon-cyan tabular-nums">
                      {option.voteCount} · {pct}%
                    </p>
                  ) : null}
                </div>
                {showCounts ? (
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-neon-cyan/80"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                ) : null}
                {mine ? (
                  <p className="text-[11px] font-mono text-neon-cyan mt-2">
                    Your pick
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {live && enabled ? (
        user ? (
          <Button
            className="w-full sm:w-auto"
            disabled={!selectedId || busy}
            onClick={() => onVote?.(selectedId)}
          >
            {poll.myOptionId ? 'Change vote' : 'Vote'}
          </Button>
        ) : (
          <p className="text-sm text-text-secondary">
            <Link to="/account" className="text-neon-cyan hover:underline">
              Sign in
            </Link>{' '}
            to pick an option.
          </p>
        )
      ) : null}

      {poll.staffNote ? (
        <p className="text-sm text-text-secondary border border-white/10 rounded-lg px-3 py-2">
          <span className="font-mono text-[10px] tracking-widest uppercase text-text-muted block mb-1">
            Staff note
          </span>
          {poll.staffNote}
        </p>
      ) : null}
    </div>
  );
}
