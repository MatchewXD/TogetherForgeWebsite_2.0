/**
 * Permanent unique public-credit list for one fund (studio or runway).
 * Named, opted-in supporters only. Fixed height + internal scroll.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import Card from '../ui/Card';
import UserAvatar from '../ui/UserAvatar';
import BadgeIcon from '../badges/BadgeIcon';
import { getPublicFundContributors } from '../../services/donationsService';
import { publicProfilePath } from '../../utils/profileLinks';

const COPY = {
  studio: {
    title: 'Studio supporters',
    blurb:
      'Everyone who has publicly supported studio funds. Each person appears once.',
    empty: 'No public studio supporters yet.',
    headingId: 'studio-supporters-heading',
  },
  runway: {
    title: 'Runway supporters',
    blurb: '',
    empty: 'No public runway supporters yet.',
    headingId: 'runway-supporters-heading',
  },
};

export default function FundContributorsCard({
  fundType = 'studio',
  className = '',
}) {
  const fund = fundType === 'runway' ? 'runway' : 'studio';
  const copy = COPY[fund];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await getPublicFundContributors(fund);
        if (mounted) setItems(res.items || []);
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fund]);

  return (
    <Card
      className={`bg-cyber-card/80 border-cyber-border ${className}`}
      aria-labelledby={copy.headingId}
    >
      <div className="flex items-start gap-2 mb-2">
        <Users className="w-4 h-4 text-neon-cyan mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h2
            id={copy.headingId}
            className="text-lg sm:text-xl font-bold text-white tracking-tight"
          >
            {copy.title}
          </h2>
          {copy.blurb ? (
            <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
              {copy.blurb}
            </p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted py-6 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-secondary py-6 text-center">
          {copy.empty}
        </p>
      ) : (
        <div
          className="mt-3 task-scroll max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-cyber-border bg-cyber-surface/40 p-2 [scrollbar-gutter:stable]"
          role="region"
          aria-label={copy.title}
        >
          <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {items.map((p) => {
              const name = p.displayName || p.username;
              const path = p.username ? publicProfilePath(p.username) : null;
              return (
                <li key={p.username || name} className="min-w-0">
                  <div className="h-[8.5rem] rounded-lg border border-cyber-border bg-cyber-card/80 px-2 py-2 flex flex-col items-center justify-center text-center gap-1 overflow-hidden">
                    <UserAvatar
                      src={p.avatarUrl}
                      name={name}
                      username={p.username}
                      linkProfile={Boolean(path)}
                      size="sm"
                      className="!w-11 !h-11"
                      borderClass="border border-neon-cyan/35"
                    />
                    <div className="flex items-center justify-center gap-0.5 min-w-0 w-full">
                      {path ? (
                        <Link
                          to={path}
                          className="text-xs sm:text-sm font-semibold text-white hover:text-neon-cyan truncate"
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
                      )}
                      {p.pinnedBadgeKey ? (
                        <BadgeIcon badgeKey={p.pinnedBadgeKey} size="xs" />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {items.length > 0 && (
        <p className="mt-2 text-[11px] font-mono text-text-muted">
          {items.length} supporter{items.length === 1 ? '' : 's'}
        </p>
      )}
    </Card>
  );
}
