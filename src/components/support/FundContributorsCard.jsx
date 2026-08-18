/**
 * Permanent unique public-credit list for one fund (studio or runway).
 * Named, opted-in supporters only. Fixed height + internal scroll.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import Card from '../ui/Card';
import UserAvatar from '../ui/UserAvatar';
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
    blurb:
      'Everyone who has publicly supported the personal runway. Each person appears once. This list is separate from studio Support.',
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
          <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
            {copy.blurb}
          </p>
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
          className="mt-3 task-scroll max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-cyber-border bg-cyber-surface/40 [scrollbar-gutter:stable]"
          role="region"
          aria-label={copy.title}
        >
          <ul className="divide-y divide-cyber-border/80">
            {items.map((p) => {
              const name = p.displayName || p.username;
              const path = p.username ? publicProfilePath(p.username) : null;
              return (
                <li
                  key={p.username || name}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <UserAvatar
                    src={p.avatarUrl}
                    name={name}
                    username={p.username}
                    linkProfile={Boolean(path)}
                    size="sm"
                    className="!w-9 !h-9"
                    borderClass="border border-neon-cyan/35"
                  />
                  {path ? (
                    <Link
                      to={path}
                      className="text-sm font-semibold text-white hover:text-neon-cyan truncate"
                    >
                      {name}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-white truncate">
                      {name}
                    </span>
                  )}
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
