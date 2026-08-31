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
  RUNWAY_AFTER_FEES_GOAL_USD,
  RUNWAY_LIVING_LINES,
  RUNWAY_MONTHLY_COST_CENTS,
  RUNWAY_MONTHLY_LIVING_USD,
  RUNWAY_NET_GOAL_USD,
  RUNWAY_RAISE_GOAL_USD,
  RUNWAY_TAX_RESERVE_USD,
  RUNWAY_TOTALS_COPY,
  RUNWAY_YEAR_MONTHS,
  formatRunwayCoverage,
  formatRunwayUsd,
  runwayCoverageMonths,
  runwayGoalTicks,
  runwayMoneyStack,
} from '../../constants/runway';

const GOAL_TICKS = runwayGoalTicks();

function useRunwayRaised() {
  const [raisedCents, setRaisedCents] = useState(0);
  const [paymentCount, setPaymentCount] = useState(0);
  const [feeCents, setFeeCents] = useState(null);
  const [afterFeesCents, setAfterFeesCents] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const summary = await getPublicSupportSummary();
        if (!mounted) return;
        setRaisedCents(Number(summary?.runwayTotalCents) || 0);
        setPaymentCount(Number(summary?.runwayPaymentCount) || 0);
        setFeeCents(
          summary?.runwayFeeCents == null ? null : Number(summary.runwayFeeCents)
        );
        setAfterFeesCents(
          summary?.runwayAfterFeesCents == null
            ? null
            : Number(summary.runwayAfterFeesCents)
        );
      } catch {
        if (mounted) {
          setRaisedCents(0);
          setPaymentCount(0);
          setFeeCents(null);
          setAfterFeesCents(null);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const stack = runwayMoneyStack({
    raisedCents,
    paymentCount,
    feeCents,
    afterFeesCents,
  });
  const months = runwayCoverageMonths(
    stack.runwayNetCents,
    RUNWAY_MONTHLY_COST_CENTS
  );
  const goalPct = Math.min(
    100,
    Math.round((stack.raisedCents / (RUNWAY_RAISE_GOAL_USD * 100)) * 100)
  );

  return { stack, months, goalPct };
}

function StackRow({ label, amountUsd, hint, strong = false }) {
  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex justify-between gap-4 text-sm">
        <span className={strong ? 'text-white font-semibold' : 'text-text-secondary'}>
          {label}
        </span>
        <span
          className={`font-mono tabular-nums shrink-0 ${
            strong ? 'text-white font-bold' : 'text-white'
          }`}
        >
          {formatRunwayUsd(amountUsd, { cents: true })}
        </span>
      </div>
      {hint ? (
        <p className="text-xs text-text-muted mt-1 leading-relaxed">{hint}</p>
      ) : null}
    </li>
  );
}

function RunwayLedgerStack({ stack }) {
  const feeHint = stack.feesEstimated
    ? 'Estimated PayPal fees (about 3.49% + $0.49 per payment). Ko-fi one-time tip fee is 0%. Replaced when a real PayPal net is stored.'
    : 'From stored PayPal net on the runway ledger.';

  return (
    <div className="rounded-xl border border-cyber-border bg-cyber-surface/80 p-5 mb-6">
      <h3 className="text-sm font-semibold text-white mb-3">Runway ledger</h3>
      <ul className="divide-y divide-cyber-border">
        <StackRow label="Raised" amountUsd={stack.raisedCents / 100} />
        <StackRow
          label={stack.feesEstimated ? 'Service fees (estimated)' : 'Service fees'}
          amountUsd={stack.feeCents / 100}
          hint={feeHint}
        />
        <StackRow label="After fees" amountUsd={stack.afterFeesCents / 100} />
        <StackRow
          label="Tax reserve (25%)"
          amountUsd={stack.taxReserveCents / 100}
        />
        <StackRow
          label="Runway net"
          amountUsd={stack.runwayNetCents / 100}
          strong
        />
      </ul>
      <p className="text-xs text-text-muted mt-4 pt-3 border-t border-cyber-border leading-relaxed">
        Goal: raise {formatRunwayUsd(RUNWAY_RAISE_GOAL_USD)} so about{' '}
        {formatRunwayUsd(RUNWAY_AFTER_FEES_GOAL_USD)} lands after fees. Then{' '}
        {formatRunwayUsd(RUNWAY_TAX_RESERVE_USD)} tax reserve (25%) and{' '}
        {formatRunwayUsd(RUNWAY_NET_GOAL_USD)} runway net. Studio support is not
        part of these figures.
      </p>
    </div>
  );
}

function GoalProgress({ raisedUsd, goalPct }) {
  const fillPct = Math.min(
    100,
    Math.max(0, (Number(raisedUsd) / RUNWAY_RAISE_GOAL_USD) * 100)
  );

  return (
    <div>
      <div className="flex justify-between items-baseline gap-3 mb-2">
        <span className="text-xs font-mono tracking-widest uppercase text-text-muted">
          Goal
        </span>
        <span className="text-sm font-mono font-semibold tabular-nums text-neon-cyan">
          {goalPct}% of {formatRunwayUsd(RUNWAY_RAISE_GOAL_USD)}
        </span>
      </div>
      <div
        className="relative h-4 rounded-md border border-cyber-border bg-cyber-surface overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={goalPct}
        aria-label={`Personal runway ${goalPct} percent of ${formatRunwayUsd(RUNWAY_RAISE_GOAL_USD)} raise goal`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-neon-purple/80 to-neon-cyan transition-[width] duration-500 ease-out"
          style={{
            width: raisedUsd > 0 ? `max(0.35rem, ${fillPct}%)` : '0%',
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
        <span>{formatRunwayUsd(RUNWAY_RAISE_GOAL_USD)}</span>
      </div>
    </div>
  );
}

function RaisedAndCoverage({ stack, months, goalPct }) {
  const paymentLabel =
    stack.paymentCount > 0
      ? ` · ${stack.paymentCount} payment${stack.paymentCount === 1 ? '' : 's'}`
      : '';

  return (
    <div className="mb-6">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-cyber-border bg-cyber-surface/80 p-5">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <Wallet className="w-4 h-4 text-neon-cyan" />
            <span className="text-xs font-mono tracking-widest uppercase">
              Raised
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-bold text-neon-cyan">
            {formatRunwayUsd(stack.raisedCents / 100, { cents: true })}
          </div>
          <p className="text-xs text-text-muted mt-2">
            Personal runway ledger
            {paymentLabel}
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
            Runway net at {formatRunwayUsd(RUNWAY_MONTHLY_LIVING_USD)} / month
            {months >= RUNWAY_YEAR_MONTHS
              ? ' · a full year of living costs'
              : ` · ${formatRunwayCoverage(Math.max(0, RUNWAY_YEAR_MONTHS - months))} to a living year`}
          </p>
        </div>
      </div>
      <GoalProgress raisedUsd={stack.raisedCents / 100} goalPct={goalPct} />
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
        <RunwayLedgerStack stack={raised.stack} />

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

            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              {RUNWAY_TOTALS_COPY.grandNote}
            </p>
          </>
        )}

        {footer}
      </Card>
    </section>
  );
};

export default RunwayTransparency;
