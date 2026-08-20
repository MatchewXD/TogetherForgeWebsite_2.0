/**
 * Personal runway fund transparency block.
 * Shared on Founders Thoughts and /support-runway.
 * Current amount comes from public support totals (runway fund only).
 */

import { useEffect, useState } from 'react';
import { Wallet, Calendar, ListChecks } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import { getPublicSupportSummary } from '../../services/donationsService';

/** Expense categories shown under the live totals. */
export const RUNWAY_FUND = {
  expenses: [
    { label: 'Housing', note: 'Covered by runway' },
    { label: 'Food and household', note: 'Covered by runway' },
    { label: 'Transportation', note: 'Covered by runway' },
    { label: 'Healthcare and insurance', note: 'Covered by runway' },
    { label: 'Utilities and communications', note: 'Covered by runway' },
  ],
};

export const formatRunwayUsd = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0);

/**
 * @param {object} props
 * @param {string} [props.id]
 * @param {string} [props.className]
 * @param {import('react').ReactNode} [props.footer] - optional CTA under the list
 * @param {string} [props.description] - override body copy
 */
const RunwayTransparency = ({
  id = 'runway-transparency',
  className = '',
  footer = null,
  description =
    'Separate from studio Support. These numbers track direct contributions to founder living expenses so the community can see runway status clearly.',
}) => {
  const [amountUsd, setAmountUsd] = useState(0);
  const [giftCount, setGiftCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const summary = await getPublicSupportSummary();
        if (!mounted) return;
        setAmountUsd((Number(summary?.runwayTotalCents) || 0) / 100);
        setGiftCount(Number(summary?.runwayPaymentCount) || 0);
      } catch {
        if (mounted) {
          setAmountUsd(0);
          setGiftCount(0);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`scroll-mt-24 ${className}`}
    >
      <Card className="bg-cyber-card/80 border-neon-purple/25 overflow-hidden">
        <div className="mb-6">
          <div className="section-header mb-2">Runway transparency</div>
          <h2
            id={`${id}-heading`}
            className="text-2xl sm:text-3xl font-bold text-white"
          >
            Personal runway fund
          </h2>
          <p className="text-sm sm:text-base text-text-secondary mt-2 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-cyber-border bg-cyber-surface/80 p-5">
            <div className="flex items-center gap-2 text-text-muted mb-2">
              <Wallet className="w-4 h-4 text-neon-cyan" />
              <span className="text-xs font-mono tracking-widest uppercase">
                Current amount
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-bold text-neon-cyan">
              {formatRunwayUsd(amountUsd)}
            </div>
            <p className="text-xs text-text-muted mt-2">
              Raised for personal runway
              {giftCount > 0
                ? ` · ${giftCount} gift${giftCount === 1 ? '' : 's'}`
                : ''}
            </p>
          </div>
          <div className="rounded-xl border border-cyber-border bg-cyber-surface/80 p-5">
            <div className="flex items-center gap-2 text-text-muted mb-2">
              <Calendar className="w-4 h-4 text-neon-purple" />
              <span className="text-xs font-mono tracking-widest uppercase">
                Coverage
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-bold text-white">
              {giftCount}
              <span className="text-lg text-text-muted font-normal ml-2">
                {giftCount === 1 ? 'gift' : 'gifts'}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Recorded on the personal runway path
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-cyber-border bg-cyber-surface/50 p-5 mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <ListChecks className="w-4 h-4 text-neon-purple" />
            <h3 className="text-sm font-semibold text-white">
              General expense categories
            </h3>
            <Badge variant="default">Runway only</Badge>
          </div>
          <ul className="divide-y divide-cyber-border">
            {RUNWAY_FUND.expenses.map((item) => (
              <li
                key={item.label}
                className="flex justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <span className="text-text-secondary">{item.label}</span>
                <span className="text-text-muted font-mono text-xs shrink-0">
                  {item.note}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {footer}
      </Card>
    </section>
  );
};

export default RunwayTransparency;
