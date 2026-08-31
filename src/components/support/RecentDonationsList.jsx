/**
 * Recent support feed for Studio Support and Runway Support.
 * Username, avatar, time — no individual amounts.
 */

import { Link } from 'react-router-dom';
import { Heart, Repeat, Sparkles } from 'lucide-react';
import Card from '../ui/Card';
import UserAvatar from '../ui/UserAvatar';
import BadgeIcon from '../badges/BadgeIcon';
import { formatTimeAgo } from '../../services/donationsService';
import { publicProfilePath } from '../../utils/profileLinks';

function SupporterCard({ item, index }) {
  const name = item.label || item.username || 'Anonymous Supporter';
  const isAnon = item.isAnonymous || !item.username;
  const profilePath =
    !isAnon && item.username ? publicProfilePath(item.username) : null;

  const avatar = isAnon ? (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
        item.isRecurring
          ? 'bg-neon-purple/15 border-neon-purple/40'
          : 'bg-neon-cyan/15 border-neon-cyan/40'
      }`}
    >
      {item.isRecurring ? (
        <Repeat className="w-5 h-5 text-neon-purple" aria-hidden />
      ) : (
        <Heart className="w-5 h-5 text-neon-cyan" aria-hidden />
      )}
    </div>
  ) : (
    <UserAvatar
      src={item.avatarUrl}
      name={name}
      username={item.username}
      size="md"
      className="!w-10 !h-10 shrink-0"
      borderClass="border-2 border-neon-cyan/45"
    />
  );

  const nameEl = profilePath ? (
    <Link
      to={profilePath}
      className="text-xs sm:text-sm font-semibold text-white hover:text-neon-cyan transition-colors truncate"
      title={name}
    >
      {name}
    </Link>
  ) : (
    <span
      className="text-xs sm:text-sm font-semibold text-white truncate"
      title={name}
    >
      {name}
    </span>
  );

  return (
    <li
      key={`${item.createdAt || 't'}-${item.username || 'anon'}-${index}`}
      className="list-none"
    >
      <Card className="bg-cyber-card/90 border border-cyber-border hover:border-neon-cyan/35 transition-colors p-2.5 flex flex-col items-center text-center gap-1.5 h-[8.75rem] overflow-hidden">
        {avatar}
        <div className="min-w-0 w-full flex flex-col items-center gap-1 flex-1 justify-center">
          <div className="flex items-center justify-center gap-1 min-w-0 w-full">
            {nameEl}
            {!isAnon && item.pinnedBadgeKey ? (
              <BadgeIcon badgeKey={item.pinnedBadgeKey} size="xs" />
            ) : null}
          </div>
          <p className="text-[11px] font-mono text-text-muted tracking-wide flex items-center justify-center gap-1.5 min-w-0 w-full">
            {item.isRecurring ? (
              <span className="shrink-0 text-[9px] font-mono tracking-widest uppercase text-neon-purple">
                Monthly
              </span>
            ) : null}
            <span className="truncate">{formatTimeAgo(item.createdAt)}</span>
          </p>
        </div>
      </Card>
    </li>
  );
}

const RecentDonationsList = ({
  items = [],
  loading = false,
  source = 'empty',
  title = 'Recent contributions',
  headingId = 'recent-support-heading',
  emptyTitle = 'No public support yet',
  emptyBody = 'Your contribution can be the first on this list. Start small. Every dollar helps ship real work.',
  showCreditNote = true,
  creditNote = 'Named supporters opted in to public credit. Private gifts show as Anonymous.',
  className = '',
}) => {
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className={`${showCreditNote ? 'mb-4' : 'mb-6'} flex justify-center`}>
        <h2
          id={headingId}
          className="section-header section-header--centered !mb-2 !text-2xl sm:!text-3xl !font-bold !tracking-tight !normal-case !text-neon-cyan"
        >
          {title}
        </h2>
      </div>
      {showCreditNote ? (
        <p className="text-center text-sm text-text-secondary mb-6 max-w-lg mx-auto">
          {creditNote}
        </p>
      ) : null}

      {loading && (
        <Card className="bg-cyber-card/80 px-5 py-12 text-center text-sm text-text-muted font-mono tracking-widest uppercase">
          Loading recent support…
        </Card>
      )}

      {!loading && items.length === 0 && (
        <Card className="bg-cyber-card/80 px-5 py-12 text-center">
          <Sparkles className="w-8 h-8 text-neon-cyan/50 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">{emptyTitle}</p>
          <p className="text-sm text-text-secondary max-w-sm mx-auto">
            {emptyBody}
          </p>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <>
          <div
            className="task-scroll max-h-[28rem] sm:max-h-[32rem] overflow-y-auto overscroll-contain rounded-xl border border-cyber-border bg-cyber-surface/30 p-3 sm:p-4 [scrollbar-gutter:stable]"
            role="region"
            aria-label="Recent supporters list"
          >
            <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
              {items.map((item, i) => (
                <SupporterCard
                  key={`${item.createdAt}-${i}`}
                  item={item}
                  index={i}
                />
              ))}
            </ul>
          </div>
          {source === 'local' && (
            <p className="mt-3 text-[10px] font-mono text-text-muted">
              Recent activity on this device. Public list updates as payments
              settle.
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default RecentDonationsList;
