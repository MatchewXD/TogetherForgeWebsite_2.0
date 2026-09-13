import { useState } from 'react';
import Button from '../ui/Buttons';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import {
  formatPollWhen,
  isPollLive,
  nonePollOption,
  optionPercent,
  orderedPollOptions,
  pollVoteTotal,
  remainingLabel,
  winningOptionIds,
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
  const [signInOpen, setSignInOpen] = useState(false);
  if (!poll) return null;
  const live = isPollLive(poll);
  const enabled = arePollsEnabled();
  const total = pollVoteTotal(poll);
  const showCounts = live || poll.isClosed;
  const options = orderedPollOptions(poll.options);
  const none = nonePollOption(options);
  const noneSelected = Boolean(none && selectedId === none.id);
  const leaders = winningOptionIds(options);
  const canPick = live && enabled && canVote && !busy;
  const liveTimer = live && poll.closesAt ? remainingLabel(poll.closesAt) : '';
  const closedWhen = !live
    ? formatPollWhen(poll.closedAt || poll.closesAt)
    : '';

  const pick = (optionId) => {
    if (!canPick || !optionId) return;
    if (!user) {
      setSignInOpen(true);
      return;
    }
    onSelect?.(optionId);
    onVote?.(optionId);
  };

  return (
    <div className="space-y-3">
      {liveTimer ? (
        <p className="text-xs font-mono tracking-widest uppercase text-neon-cyan">
          {liveTimer}
        </p>
      ) : null}
      {closedWhen ? (
        <p className="text-sm font-mono text-semantic-success">
          Closed {closedWhen}
        </p>
      ) : null}

      <Card variant="subtle" className="p-3 sm:p-4">
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((option) => {
          const picked = selectedId === option.id;
          const mine = poll.myOptionId === option.id;
          const pct = optionPercent(option, total);
          const greyed = noneSelected && !option.isNone;
          const votes = Number(option.voteCount) || 0;
          const winning = leaders.includes(option.id);
          const winLabel = !winning
            ? ''
            : leaders.length > 1
              ? 'Tied'
              : live
                ? 'Leading'
                : 'Winner';
          return (
            <li key={option.id} className="min-h-0">
              <button
                type="button"
                disabled={!canPick}
                onClick={() => pick(option.id)}
                className={`cyber-card cyber-card-subtle w-full h-full p-0 text-left overflow-hidden ${
                  winning
                    ? 'ring-1 ring-semantic-achievement/80'
                    : picked
                      ? 'ring-1 ring-neon-cyan/70'
                      : ''
                } ${greyed ? 'opacity-40' : ''} disabled:cursor-default`}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] h-full min-h-[7.5rem]">
                  <div className="px-4 py-3 flex flex-col justify-center gap-1">
                    <p className="text-base sm:text-lg font-bold text-white leading-snug">
                      {option.name}
                    </p>
                    {option.description ? (
                      <p className="text-sm text-text-secondary leading-snug">
                        {option.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {winLabel ? (
                        <p className="text-[11px] font-mono tracking-widest uppercase text-semantic-achievement">
                          {winLabel}
                        </p>
                      ) : null}
                      {mine ? (
                        <p className="text-[11px] font-mono text-neon-cyan">
                          Your pick
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={`relative min-h-[7.5rem] border-l border-white/10 ${
                      winning ? 'bg-semantic-achievement/10' : 'bg-black/25'
                    }`}
                  >
                    {showCounts ? (
                      <div
                        className={`absolute inset-x-0 bottom-0 ${
                          winning ? 'bg-semantic-achievement/35' : 'bg-neon-cyan/30'
                        }`}
                        style={{ height: `${Math.max(pct, pct > 0 ? 8 : 0)}%` }}
                        aria-hidden
                      />
                    ) : null}
                    <div className="relative z-10 h-full min-h-[7.5rem] flex flex-col items-center justify-center px-2 py-3 text-center">
                      {showCounts ? (
                        <>
                          <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums leading-none tracking-tight">
                            {pct}
                            <span
                              className={`text-xl ${
                                winning
                                  ? 'text-semantic-achievement'
                                  : 'text-neon-cyan'
                              }`}
                            >
                              %
                            </span>
                          </p>
                          <p
                            className={`text-xs font-mono mt-2 tabular-nums ${
                              winning
                                ? 'text-semantic-achievement'
                                : 'text-neon-cyan'
                            }`}
                          >
                            {votes} vote{votes === 1 ? '' : 's'}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs font-mono text-text-muted">
                          Vote to score
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      </Card>

      {poll.staffNote ? (
        <p className="text-sm text-text-secondary">
          <span className="font-mono text-[10px] tracking-widest uppercase text-text-muted mr-2">
            Staff note
          </span>
          {poll.staffNote}
        </p>
      ) : null}

      <Modal
        isOpen={signInOpen}
        onClose={() => setSignInOpen(false)}
        title="Sign in to vote"
        size="sm"
      >
        <p className="text-sm text-text-secondary leading-relaxed">
          Sign in to pick an option. You can change your vote until the poll
          closes.
        </p>
        <div className="flex flex-wrap gap-2 mt-5">
          <Button to="/account">Sign in</Button>
          <Button variant="ghost" onClick={() => setSignInOpen(false)}>
            Not now
          </Button>
        </div>
      </Modal>
    </div>
  );
}
