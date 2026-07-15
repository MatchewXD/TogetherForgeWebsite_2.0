/**
 * Personal runway fund transparency block.
 * Shared on Founders Thoughts and /support-runway.
 * Placeholder numbers until a live ledger is connected.
 */

import { Wallet, Calendar, ListChecks } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';

/** Placeholder runway data (replace with live ledger later). */
export const RUNWAY_FUND = {
  amountUsd: 0,
  monthsCovered: 0,
  expenses: [
    { label: 'Housing', note: 'Placeholder' },
    { label: 'Food and household', note: 'Placeholder' },
    { label: 'Transportation', note: 'Placeholder' },
    { label: 'Healthcare and insurance', note: 'Placeholder' },
    { label: 'Utilities and communications', note: 'Placeholder' },
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
    'Separate from studio Support. These numbers track direct contributions to founder living expenses. Placeholders until a live ledger is connected.',
}) => {
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
              {formatRunwayUsd(RUNWAY_FUND.amountUsd)}
            </div>
            <p className="text-xs text-text-muted mt-2">In runway trust</p>
          </div>
          <div className="rounded-xl border border-cyber-border bg-cyber-surface/80 p-5">
            <div className="flex items-center gap-2 text-text-muted mb-2">
              <Calendar className="w-4 h-4 text-neon-purple" />
              <span className="text-xs font-mono tracking-widest uppercase">
                Coverage
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-bold text-white">
              {RUNWAY_FUND.monthsCovered}
              <span className="text-lg text-text-muted font-normal ml-2">
                months
              </span>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Of living expenses covered
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-cyber-border bg-cyber-surface/50 p-5 mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <ListChecks className="w-4 h-4 text-neon-purple" />
            <h3 className="text-sm font-semibold text-white">
              General expense categories
            </h3>
            <Badge variant="default">Placeholder</Badge>
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
