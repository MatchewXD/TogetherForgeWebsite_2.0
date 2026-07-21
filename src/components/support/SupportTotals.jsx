/**
 * Compact social proof totals: all-time raised + monthly recurring (MRR).
 * Full-width cards; supporting copy sits below.
 */

import { Heart, RefreshCw, Users } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { formatUsdFromCents } from '../../services/donationsService';

const SupportTotals = ({
  totalCents = 0,
  mrrCents = 0,
  paymentCount = 0,
  subscriberCount = 0,
  loading = false,
  source = 'empty',
}) => {
  return (
    <section
      aria-label="Support totals"
      className="w-full space-y-3"
    >
      {source === 'supabase' && (
        <div className="flex justify-end">
          <Badge variant="neon">Live totals</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        <Card className="bg-cyber-card/80 border-neon-cyan/25 w-full py-4 px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Heart className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                <span className="text-[10px] font-mono tracking-widest uppercase">
                  Total raised
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-bold text-neon-cyan tabular-nums">
                {loading ? '…' : formatUsdFromCents(totalCents)}
              </div>
              <p className="text-xs text-text-muted mt-1">
                {loading
                  ? 'Loading…'
                  : paymentCount > 0
                    ? `${paymentCount} contribution${paymentCount === 1 ? '' : 's'} all time`
                    : 'Be the first to fuel the forge'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-cyber-card/80 border-neon-purple/25 w-full py-4 px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <RefreshCw className="w-3.5 h-3.5 text-neon-purple shrink-0" />
                <span className="text-[10px] font-mono tracking-widest uppercase">
                  Monthly recurring
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-bold text-white tabular-nums">
                {loading ? '…' : formatUsdFromCents(mrrCents)}
                <span className="text-sm font-normal text-text-muted ml-1">
                  /mo
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                <Users className="w-3 h-3 text-neon-purple shrink-0" />
                {loading
                  ? 'Loading…'
                  : subscriberCount > 0
                    ? `${subscriberCount} monthly supporter${subscriberCount === 1 ? '' : 's'}`
                    : 'Start monthly to grow steady funding'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed w-full">
        Every contribution funds development tools, assets, and shipping real
        games. Join the people already building the forge.
      </p>
    </section>
  );
};

export default SupportTotals;
