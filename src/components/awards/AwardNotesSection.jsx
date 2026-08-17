/**
 * Collapsed Award notes for Anvil / Masterwork messages.
 * Fixed-height scroll when open so it cannot grow the page without bound.
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import UserNameWithBadge from '../badges/UserNameWithBadge';
import { getAwardNotes, getForgeAwardTier } from '../../utils/forgeMarks';
import { AwardTierIcon } from './awardIcons';

export default function AwardNotesSection({
  awards = [],
  className = '',
  embedded = false,
}) {
  const [open, setOpen] = useState(false);
  const notes = getAwardNotes(awards);
  if (!notes.length) return null;

  const countLabel =
    notes.length === 1 ? '1 award note' : `${notes.length} award notes`;

  return (
    <section
      className={
        embedded
          ? `mt-3 ${className}`
          : `border-t border-white/10 pt-8 ${className}`
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-text-muted hover:text-text-secondary transition-colors"
        aria-expanded={open}
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
        Award notes ({notes.length})
        <span className="sr-only">{open ? 'Collapse' : 'Expand'} {countLabel}</span>
      </button>

      {open && (
        <div className="mt-3 task-scroll max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-cyber-border/70 bg-cyber-surface/40">
          <ul className="divide-y divide-cyber-border/60 list-none p-0 m-0">
            {notes.map((note) => {
              const tier =
                getForgeAwardTier(note.awardTier) || {
                  id: note.awardTier,
                  name: note.awardName || 'Award',
                };
              const name = note.giverUsername || 'Member';
              return (
                <li key={note.id} className="px-3.5 py-3">
                  <div className="flex items-center gap-2 min-w-0 mb-1.5">
                    <AwardTierIcon
                      tierId={tier.id}
                      className={
                        String(tier.id).toLowerCase() === 'masterwork'
                          ? 'w-6 h-6'
                          : 'w-5 h-5'
                      }
                      alt=""
                    />
                    <span className="text-xs font-semibold text-text-secondary">
                      {tier.name}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed pl-0.5 mb-2">
                    {note.message}
                  </p>
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar
                      src={note.giverAvatarUrl}
                      name={name}
                      username={note.giverUsername}
                      size="sm"
                    />
                    <UserNameWithBadge
                      username={note.giverUsername}
                      displayName={name}
                      pinnedBadgeKey={note.giverPinnedBadgeKey}
                      linkClassName="text-sm text-text-primary"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
