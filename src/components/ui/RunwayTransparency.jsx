/**
 * Personal runway fund transparency.
 * Full breakdown on Founder Runway. Compact summary on Founders Thoughts.
 * Raised totals are personal runway only — never studio Support.
 */

import { useEffect, useState } from 'react';
import { Wallet, Calendar, ListChecks } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import { getPublicSupportSummary } from '../../services/donationsService';
import {
  RUNWAY_GRAND_TOTAL_USD,
  RUNWAY_LIVING_LINES,
  RUNWAY_LIVING_YEAR_USD,
  RUNWAY_MONTHLY_COST_CENTS,
  RUNWAY_MONTHLY_LIVING_USD,
  RUNWAY_TAX_RESERVE_USD,
  RUNWAY_TOTALS_COPY,
  RUNWAY_YEAR_MONTHS,
  formatRunwayCoverage,
  formatRunwayUsd,
  runwayCoverageMonths,
  runwayGoalTicks,
} from '../../constants/runway';

const GOAL_TICKS = runwayGoalTicks();

function useRunwayRaised() {
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

  const months = runwayCoverageMonths(
    amountUsd * 100,
    RUNWAY_MONTHLY_COST_CENTS
  );
  const goalPct = Math.min(
    100,
    Math.round((amountUsd / RUNWAY_GRAND_TOTAL_USD) * 100)
  );

  return { amountUsd, giftCount, months, goalPct };
}

function TotalsStat({ label, amount, hint, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs font-mono tracking-widest uppercase text-text-muted mb-2">
        {label}
      </p>
      <p className="text-2xl sm:text-3xl font-mono font-bold text-white tabular-nums">
        {formatRunwayUsd(amount)}
      </p>
      {hint ? (
        <p className="text-xs text-text-muted mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

function GoalProgress({ amountUsd, goalPct }) {
  const fillPct = Math.min(
    100,
    Math.max(0, (Number(amountUsd) / RUNWAY_GRAND_TOTAL_USD) * 100)
  );

  return (
    <div>
      <div className="flex justify-between items-baseline gap-3 mb-2">
        <span className="text-xs font-mono tracking-widest uppercase text-text-muted">
          Goal
        </span>
        <span className="text-sm font-mono font-semibold tabular-nums text-neon-cyan">
          {goalPct}% of {formatRunwayUsd(RUNWAY_GRAND_TOTAL_USD)}
        </span>
      </div>
      <div
        className="relative h-4 rounded-md border border-cyber-border bg-cyber-surface overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={goalPct}
        aria-label={`Personal runway ${goalPct} percent of ${formatRunwayUsd(RUNWAY_GRAND_TOTAL_USD)} goal`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-neon-purple/80 to-neon-cyan transition-[width] duration-500 ease-out"
          style={{
            width: amountUsd > 0 ? `max(0.35rem, ${fillPct}%)` : '0%',
          }}
        />
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {GOAL_TICKS.map((tick) => (
            <span
              key={tick.usd}
              title={formatRunwayUsd(tick.usd)}
              className={`absolute w-px ${
                tick.major
                  ? 'inset-y-0 bg-white/45'
                  : 'bottom-0 h-1/2 bg-white/25'
              }`}
              style={{ left: `${tick.pct}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] font-mono text-text-muted tabular-nums">
        <span>{formatRunwayUsd(0)}</span>
        <span>{formatRunwayUsd(RUNWAY_GRAND_TOTAL_USD)}</span>
      </div>
    </div>
  );
}

function RaisedAndCoverage({ amountUsd, giftCount, months, goalPct }) {
  return (
    <div className="mb-6">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
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
            {formatRunwayCoverage(months)}
          </div>
          <p className="text-xs text-text-muted mt-2">
            At {formatRunwayUsd(RUNWAY_MONTHLY_LIVING_USD)} / month living costs
            {months >= RUNWAY_YEAR_MONTHS
              ? ' · a full year of living costs'
              : ` · ${formatRunwayCoverage(Math.max(0, RUNWAY_YEAR_MONTHS - months))} to a living year`}
          </p>
        </div>
      </div>
      <GoalProgress amountUsd={amountUsd} goalPct={goalPct} />
    </div>
  );
}

/**
 * @param {object} props
 * @param {'full'|'compact'} [props.variant]
 * @param {string} [props.id]
 * @param {string} [props.className]
 * @param {import('react').ReactNode} [props.footer]
 */
const RunwayTransparency = ({
  variant = 'full',
  id = 'runway-transparency',
  className = '',
  footer = null,
}) => {
  const raised = useRunwayRaised();
  const compact = variant === 'compact';

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`scroll-mt-24 ${className}`}
    >
      <Card className="bg-cyber-card/80 border-neon-purple/25 overflow-hidden">
        <div className="mb-6">
          {compact ? (
            <>
              <div className="section-header mb-2">Runway transparency</div>
              <h2
                id={`${id}-heading`}
                className="text-2xl sm:text-3xl font-bold text-white"
              >
                Personal runway fund
              </h2>
            </>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <h2 id={`${id}-heading`} className="section-header !mb-0">
                Runway transparency
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary text-right leading-snug ml-auto max-w-[16rem] sm:max-w-xs">
                This is not a charity and it is not tax-deductible.
              </p>
            </div>
          )}
        </div>

        <RaisedAndCoverage {...raised} />

        {compact ? null : (
          <>
            <div className="rounded-xl border border-cyber-border bg-cyber-surface/50 p-5 mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <ListChecks className="w-4 h-4 text-neon-purple" />
                <h3 className="text-sm font-semibold text-white">
                  Monthly living costs
                </h3>
                <Badge variant="default">Runway only</Badge>
              </div>
              <ul className="divide-y divide-cyber-border">
                {RUNWAY_LIVING_LINES.map((item) => (
                  <li key={item.label} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-text-secondary">{item.label}</span>
                      <span className="text-white font-mono text-sm tabular-nums shrink-0">
                        {formatRunwayUsd(item.monthlyUsd)}
                      </span>
                    </div>
                    {item.note ? (
                      <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-xl">
                        {item.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-white font-semibold mt-4 pt-3 border-t border-cyber-border">
                Monthly living total {formatRunwayUsd(RUNWAY_MONTHLY_LIVING_USD)}
              </p>
            </div>

            <div className="rounded-xl border border-cyber-border bg-cyber-surface/80 p-5 mb-6">
              <div className="grid sm:grid-cols-3 gap-5 sm:gap-0">
                <TotalsStat
                  label="Living total"
                  amount={RUNWAY_LIVING_YEAR_USD}
                  hint={`per year (${formatRunwayUsd(RUNWAY_MONTHLY_LIVING_USD)} a month)`}
                  className="sm:pr-6"
                />
                <TotalsStat
                  label="Tax reserve (25%)"
                  amount={RUNWAY_TAX_RESERVE_USD}
                  className="sm:px-6 sm:border-l sm:border-cyber-border"
                />
                <TotalsStat
                  label="Grand total"
                  amount={RUNWAY_GRAND_TOTAL_USD}
                  className="sm:pl-6 sm:border-l sm:border-cyber-border"
                />
              </div>
              <p className="text-sm text-text-secondary leading-relaxed pt-4 mt-4 border-t border-cyber-border">
                {RUNWAY_TOTALS_COPY.grandNote}
              </p>
            </div>
          </>
        )}

        {footer}
      </Card>
    </section>
  );
};

export default RunwayTransparency;
