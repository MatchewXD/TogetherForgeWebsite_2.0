/**
 * Anonymized recent donations feed for social proof on Support page.
 */

import { Heart, Repeat, Sparkles } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import {
  formatTimeAgo,
  formatUsdFromCents,
} from '../../services/donationsService';

const RecentDonationsList = ({
  items = [],
  loading = false,
  source = 'empty',
}) => {
  return (
    <section aria-labelledby="recent-support-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="section-header mb-1">Recent support</div>
          <h2
            id="recent-support-heading"
            className="text-xl sm:text-2xl font-bold text-white"
          >
            People are already in
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Every entry is shown as Anonymous Supporter. Amount and timing only.
          </p>
        </div>
      </div>

      <Card className="bg-cyber-card/80 p-0 overflow-hidden">
        {loading && (
          <div className="px-5 py-10 text-center text-sm text-text-muted font-mono tracking-widest uppercase">
            Loading recent support…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="px-5 py-10 text-center">
            <Sparkles className="w-8 h-8 text-neon-cyan/50 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">No public support yet</p>
            <p className="text-sm text-text-secondary max-w-sm mx-auto">
              Your contribution can be the first on this list. Start small. Every
              dollar helps ship real work.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <ul className="divide-y divide-cyber-border">
            {items.map((item, i) => (
              <li
                key={`${item.createdAt || 't'}-${item.amountCents}-${i}`}
                className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-cyber-surface/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center shrink-0">
                  {item.isRecurring ? (
                    <Repeat className="w-4 h-4 text-neon-purple" />
                  ) : (
                    <Heart className="w-4 h-4 text-neon-cyan" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      Anonymous Supporter
                    </span>
                    {item.isRecurring && (
                      <Badge variant="purple" className="!text-[10px]">
                        Monthly
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs font-mono text-text-muted mt-0.5">
                    {formatTimeAgo(item.createdAt)}
                  </div>
                </div>
                <div className="text-sm sm:text-base font-mono font-semibold text-neon-cyan tabular-nums shrink-0">
                  {formatUsdFromCents(item.amountCents)}
                  {item.isRecurring ? (
                    <span className="text-text-muted font-normal text-xs">
                      /mo
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {source === 'local' && items.length > 0 && (
          <p className="px-5 py-2 text-[10px] font-mono text-text-muted border-t border-cyber-border">
            Showing local browser notes until public donation RPCs are live.
          </p>
        )}
      </Card>
    </section>
  );
};

export default RecentDonationsList;
