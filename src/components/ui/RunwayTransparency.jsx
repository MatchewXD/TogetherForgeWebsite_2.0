/**
 * Personal runway fund transparency.
 * Full breakdown on Founder Runway. Compact summary on Founders Thoughts.
 * Raised totals are personal runway only — never studio Support.
 */

import { useEffect, useMemo, useState } from 'react';
import { Wallet, Calendar, ListChecks } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import { getPublicSupportSummary } from '../../services/donationsService';
import { parseEnableFlag } from '../../constants/donationsEnabled';
import useStaffRole from '../../hooks/useStaffRole';
import {
  RUNWAY_LIVING_LINES,
  RUNWAY_MONTHLY_COST_CENTS,
  RUNWAY_MONTHLY_LIVING_USD,
  RUNWAY_RAISE_GOAL_USD,
  RUNWAY_TOTALS_COPY,
  formatRunwayCoverage,
  formatRunwayUsd,
  runwayCoverageMonths,
  runwayGoalProgress,
  runwayGoalTicks,
  runwayMoneyStack,
} from '../../constants/runway';

const PREVIEW_STORAGE_KEY = 'tf_runway_preview';

function runwayPreviewAllowed(isStaff) {
  const explicit = parseEnableFlag(import.meta.env.VITE_RUNWAY_PREVIEW);
  if (explicit === false) return false;
  if (explicit === true) return true;
  return Boolean(import.meta.env.DEV) || Boolean(isStaff);
}

function readPreviewState() {
  try {
    const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return { on: false, raisedUsd: String(RUNWAY_RAISE_GOAL_USD) };
    const parsed = JSON.parse(raw);
    return {
      on: Boolean(parsed?.on),
      raisedUsd:
        parsed?.raisedUsd != null && parsed.raisedUsd !== ''
          ? String(parsed.raisedUsd)
          : String(RUNWAY_RAISE_GOAL_USD),
    };
  } catch {
    return { on: false, raisedUsd: String(RUNWAY_RAISE_GOAL_USD) };
  }
}

function writePreviewState(next) {
  try {
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const GOAL_TICKS = runwayGoalTicks();

function useRunwayRaised(preview) {
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

  const stack = useMemo(() => {
    if (preview?.on) {
      const usd = Math.max(0, Number(preview.raisedUsd) || 0);
      return runwayMoneyStack({
        raisedCents: Math.round(usd * 100),
        paymentCount: 1,
        feeCents: null,
        afterFeesCents: null,
      });
    }
    return runwayMoneyStack({
      raisedCents,
      paymentCount,
      feeCents,
      afterFeesCents,
    });
  }, [
    preview?.on,
    preview?.raisedUsd,
    raisedCents,
    paymentCount,
    feeCents,
    afterFeesCents,
  ]);

  const months = runwayCoverageMonths(
    stack.runwayNetCents,
    RUNWAY_MONTHLY_COST_CENTS
  );

  return { stack, months };
}

function RunwayPreviewPanel({ preview, onChange }) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...preview, on: !preview.on })}
          className={`text-[10px] font-mono tracking-wide px-2 py-0.5 rounded border ${
            preview.on
              ? 'border-semantic-warning/50 text-semantic-warning bg-semantic-warning/10'
              : 'border-cyber-border text-text-muted hover:text-text-secondary'
          }`}
        >
          {preview.on ? 'Preview on' : 'Preview'}
        </button>
        <p className="text-[10px] text-text-muted">Only staff see this option</p>
      </div>
      {preview.on ? (
        <div className="mt-2">
          <label
            htmlFor="runway-preview-raised"
            className="block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1"
          >
            Raised USD
          </label>
          <input
            id="runway-preview-raised"
            type="number"
            min="0"
            step="1"
            value={preview.raisedUsd}
            onChange={(e) =>
              onChange({ ...preview, raisedUsd: e.target.value })
            }
            className="w-36 bg-cyber-surface border border-cyber-border rounded px-2 py-1 text-xs text-white font-mono tabular-nums focus:border-neon-cyan outline-none"
          />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {[0, 200, RUNWAY_RAISE_GOAL_USD, Math.round(RUNWAY_RAISE_GOAL_USD * 3.3)].map(
              (n) => (
                <button
                  key={n}
                  type="button"
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-cyber-border text-text-muted hover:text-white hover:border-neon-cyan/50"
                  onClick={() =>
                    onChange({ ...preview, on: true, raisedUsd: String(n) })
                  }
                >
                  {formatRunwayUsd(n)}
                </button>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
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
    ? 'Estimated PayPal fees (about 3.49% + $0.49 per payment).'
    : 'From stored PayPal net on the runway ledger.';

  return (
    <div className="rounded-xl border border-cyber-border bg-cyber-surface/80 p-5">
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
    </div>
  );
}

function GoalProgress({ raisedUsd }) {
  const { fillPct, multiplier, showMultiplier } = runwayGoalProgress(raisedUsd);
  const labelPct = Math.round(fillPct);

  return (
    <div>
      <div className="flex justify-between items-center gap-3 mb-2">
        <span className="text-xs font-mono tracking-widest uppercase text-text-muted">
          Goal
        </span>
        <div className="flex items-baseline gap-2 tabular-nums">
          {showMultiplier ? (
            <span className="text-2xl sm:text-3xl font-mono font-bold text-neon-cyan leading-none">
              {multiplier}×
            </span>
          ) : null}
          <span className="text-sm font-mono font-semibold text-neon-cyan">
            {showMultiplier
              ? `${labelPct}%`
              : `${labelPct}% of ${formatRunwayUsd(RUNWAY_RAISE_GOAL_USD)}`}
          </span>
        </div>
      </div>
      <div
        className="relative h-4 rounded-md border border-cyber-border bg-cyber-surface overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={labelPct}
        aria-label={
          showMultiplier
            ? `Personal runway ${multiplier} times the ${formatRunwayUsd(RUNWAY_RAISE_GOAL_USD)} goal, ${labelPct} percent into the next`
            : `Personal runway ${labelPct} percent of ${formatRunwayUsd(RUNWAY_RAISE_GOAL_USD)} raise goal`
        }
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

function RaisedAndCoverage({ stack, months }) {
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
            {formatRunwayUsd(stack.raisedCents / 100)}
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
            At 12 months we go full time Together Forge!
          </p>
        </div>
      </div>
      <GoalProgress raisedUsd={stack.raisedCents / 100} />
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
  const { isStaff } = useStaffRole();
  const [preview, setPreview] = useState(readPreviewState);
  const showPreviewPanel = runwayPreviewAllowed(isStaff);
  const raised = useRunwayRaised(showPreviewPanel ? preview : { on: false });
  const compact = variant === 'compact';

  const onPreviewChange = (next) => {
    setPreview(next);
    writePreviewState(next);
  };

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

        {showPreviewPanel ? (
          <RunwayPreviewPanel preview={preview} onChange={onPreviewChange} />
        ) : null}

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
          </>
        )}

        {compact ? null : (
          <div className="mb-6">
            <RunwayLedgerStack stack={raised.stack} />
          </div>
        )}

        {footer}

        {compact ? null : (
          <p className="text-sm text-text-secondary leading-relaxed">
            {RUNWAY_TOTALS_COPY.grandNote}
          </p>
        )}
      </Card>
    </section>
  );
};

export default RunwayTransparency;
