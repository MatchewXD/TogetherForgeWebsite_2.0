/**
 * Cyber dashboard for Studio Support finances (Transparency Hub).
 *
 * Two clear layers:
 *  1. Current snapshot - available now vs reserved
 *  2. History & use - lifetime inflows, spend, categories, trend
 */

import { Component } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  Percent,
  Shield,
  Landmark,
  TrendingUp,
  Info,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';

import Card from '../ui/Card';
import Badge from '../ui/Badge';
import HudProgressBar from '../ui/dashboard/HudProgressBar';
import SparkLine from '../ui/dashboard/SparkLine';
import LoadingScreen from '../ui/LoadingScreen';

/** Share of net set aside for tax / legal obligations (policy target). */
const TAX_RESERVE_PCT = 0.25;

/** Spend categories for history (amounts stay 0 until a spend ledger exists). */
const SPEND_CATEGORIES = [
  {
    key: 'dev',
    label: 'Development & tools',
    tone: 'cyan',
    desc: 'Engines, licenses, pipelines, software that ship games.',
  },
  {
    key: 'infra',
    label: 'Tools & infrastructure',
    tone: 'purple',
    desc: 'Hosting, databases, build systems, and studio tooling.',
  },
  {
    key: 'community',
    label: 'Community',
    tone: 'magenta',
    desc: 'Site features, credit systems, moderation, volunteer tools.',
  },
  {
    key: 'ops',
    label: 'Operations',
    tone: 'success',
    desc: 'Day-to-day operating costs outside the tax reserve.',
  },
];

function estimateProcessingFeesCents(grossCents, paymentCount) {
  const gross = Math.max(0, Number(grossCents) || 0);
  const n = Math.max(0, Number(paymentCount) || 0);
  if (gross <= 0) return 0;
  return Math.round(gross * 0.029 + n * 30);
}

function formatMoney(n, opts = {}) {
  try {
    const amount = Number(n);
    const safe = Number.isFinite(amount) ? amount : 0;
    const showCents = Boolean(opts && opts.cents);
    const minDigits = showCents && safe > 0 && safe < 1 ? 2 : 0;
    const maxDigits = showCents ? 2 : 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: maxDigits,
      minimumFractionDigits: Math.min(minDigits, maxDigits),
    }).format(safe);
  } catch {
    return '$0';
  }
}

function buildMonthlyInflow(items) {
  try {
    const list = Array.isArray(items) ? items : [];
    const map = new Map();
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      if (!item || !item.createdAt || item.amountCents == null) continue;
      const cents = Number(item.amountCents);
      if (!Number.isFinite(cents) || cents <= 0) continue;
      const d = new Date(item.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + cents);
    }
    if (map.size === 0) return [];
    return [...map.keys()]
      .sort()
      .slice(-6)
      .map((k) => (map.get(k) || 0) / 100);
  } catch {
    return [];
  }
}

function FinanceDashboardView({
  summary,
  recentItems,
  loading = false,
}) {
  const data =
    summary && typeof summary === 'object' && !Array.isArray(summary)
      ? summary
      : {};
  const items = Array.isArray(recentItems) ? recentItems : [];

  const grossCents = Number(data.studioTotalCents) || 0;
  const paymentCount = Number(data.studioPaymentCount) || 0;
  const mrrCents = Number(data.studioMrrCents) || 0;
  const source = typeof data.source === 'string' ? data.source : 'empty';

  const feesCents = estimateProcessingFeesCents(grossCents, paymentCount);
  const netReceivedCents = Math.max(0, grossCents - feesCents);
  const reservedCents = Math.round(netReceivedCents * TAX_RESERVE_PCT);
  const spentCents = 0;
  const availableToSpendCents = Math.max(
    0,
    netReceivedCents - reservedCents - spentCents
  );

  const gross = grossCents / 100;
  const fees = feesCents / 100;
  const netReceived = netReceivedCents / 100;
  const reserved = reservedCents / 100;
  const spent = spentCents / 100;
  const availableToSpend = availableToSpendCents / 100;
  const reserveTargetPct = Math.round(TAX_RESERVE_PCT * 100);
  const inflowTrend = buildMonthlyInflow(items);
  const hasSpendHistory = spentCents > 0;

  if (loading) {
    return (
      <div className="tf-finance-dash">
        <LoadingScreen variant="section" message="Loading financials..." />
      </div>
    );
  }

  return (
    <div className="tf-finance-dash space-y-8">
      <Card variant="subtle" className="!p-4 border-cyber-border/80 bg-cyber-surface/40">
        <div className="flex gap-3 items-start">
          <Info className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary leading-relaxed">
            Contributions to Together Forge are{' '}
            <span className="text-white font-medium">not tax-deductible</span>.
            Together Forge is a community-supported for-profit studio. Support
            funds projects and operations. A portion of net funds is reserved for
            taxes and legal obligations so those costs stay visible and covered.
          </p>
        </div>
      </Card>

      {/* Current balances */}
      <section aria-label="Current funds" className="space-y-4">
        <Card variant="panel" className="!p-5 sm:!p-6 border-neon-cyan/35">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs font-sans font-semibold tracking-[0.18em] uppercase text-neon-cyan">
                  Available to spend
                </span>
              </div>
              <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-neon-cyan tabular-nums tracking-tight leading-none">
                {formatMoney(availableToSpend)}
              </div>
              <p className="text-sm text-text-secondary mt-3 max-w-lg">
                Net received after fees, minus the tax and obligations reserve
                {hasSpendHistory ? ' and recorded spending' : ''}. This is the
                amount ready for projects and expenses.
              </p>
            </div>
            {mrrCents > 0 && (
              <p className="text-xs text-text-muted lg:text-right shrink-0">
                Monthly recurring{' '}
                <span className="text-neon-cyan font-semibold tabular-nums">
                  {formatMoney(mrrCents / 100)}
                </span>
                /mo
              </p>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card variant="subtle" className="!p-4">
            <div className="flex items-center gap-2 text-text-muted mb-1.5">
              <Shield className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[10px] font-sans font-semibold tracking-widest uppercase">
                Reserved
              </span>
            </div>
            <div className="text-lg sm:text-xl font-semibold text-white tabular-nums">
              {formatMoney(reserved)}
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              Taxes and obligations ({reserveTargetPct}% of net)
            </p>
          </Card>

          <Card variant="subtle" className="!p-4">
            <div className="flex items-center gap-2 text-text-muted mb-1.5">
              <Wallet className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[10px] font-sans font-semibold tracking-widest uppercase">
                Gross received
              </span>
            </div>
            <div className="text-lg sm:text-xl font-semibold text-white tabular-nums">
              {formatMoney(gross)}
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              {paymentCount} payment{paymentCount === 1 ? '' : 's'} all time
            </p>
          </Card>

          <Card variant="subtle" className="!p-4">
            <div className="flex items-center gap-2 text-text-muted mb-1.5">
              <Percent className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[10px] font-sans font-semibold tracking-widest uppercase">
                Processing fees
              </span>
            </div>
            <div className="text-lg sm:text-xl font-semibold text-text-secondary tabular-nums">
              {formatMoney(fees, { cents: fees > 0 && fees < 10 })}
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              Estimated payment processing
            </p>
          </Card>

          <Card variant="subtle" className="!p-4">
            <div className="flex items-center gap-2 text-text-muted mb-1.5">
              <Landmark className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[10px] font-sans font-semibold tracking-widest uppercase">
                Net received
              </span>
            </div>
            <div className="text-lg sm:text-xl font-semibold text-white tabular-nums">
              {formatMoney(netReceived)}
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              After processing fees
            </p>
          </Card>
        </div>
      </section>

      {/* History & use */}
      <section aria-labelledby="finance-history-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-neon-purple mb-1">
              History and use
            </div>
            <h3
              id="finance-history-heading"
              className="text-xl sm:text-2xl font-bold text-white"
            >
              What has come in and where it went
            </h3>
            <p className="text-sm text-text-secondary mt-1 max-w-2xl">
              Lifetime support and recorded spending. Separate from current
              balances so cumulative spend does not confuse available funds.
            </p>
          </div>
          <Badge variant="default" className="self-start sm:self-auto">
            Lifetime
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Card variant="subtle" className="!p-5">
            <div className="flex items-center gap-2 text-text-muted mb-2">
              <ArrowDownCircle className="w-4 h-4 text-neon-cyan" />
              <span className="text-[10px] font-sans font-semibold tracking-widest uppercase">
                Total received
              </span>
            </div>
            <div className="text-3xl font-bold text-white tabular-nums">
              {formatMoney(gross)}
            </div>
            <p className="text-xs text-text-muted mt-2">
              All-time studio support (gross) · {paymentCount} payment
              {paymentCount === 1 ? '' : 's'}
            </p>
          </Card>

          <Card variant="subtle" className="!p-5">
            <div className="flex items-center gap-2 text-text-muted mb-2">
              <ArrowUpCircle className="w-4 h-4 text-neon-purple" />
              <span className="text-[10px] font-sans font-semibold tracking-widest uppercase">
                Total spent
              </span>
            </div>
            <div className="text-3xl font-bold text-white tabular-nums">
              {formatMoney(spent)}
            </div>
            <p className="text-xs text-text-muted mt-2">
              {hasSpendHistory
                ? 'Recorded studio spending to date'
                : 'No published spending yet - reports will list expenses here'}
            </p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3 !p-5 sm:!p-6">
            <div className="mb-5">
              <div className="text-[10px] font-sans font-semibold tracking-widest uppercase text-neon-purple mb-1">
                Spend by category
              </div>
              <h4 className="text-lg font-semibold text-white">
                Where money has gone
              </h4>
              <p className="text-sm text-text-secondary mt-1">
                {hasSpendHistory
                  ? 'Breakdown of recorded spending across studio work.'
                  : 'Categories are ready. Amounts stay at $0 until spending is published.'}
              </p>
            </div>

            <div className="space-y-5">
              {SPEND_CATEGORIES.map((row) => (
                <HudProgressBar
                  key={row.key}
                  label={row.label}
                  pct={0}
                  valueLabel={formatMoney(0)}
                  desc={row.desc}
                  tone={row.tone}
                />
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2 !p-5 sm:!p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-neon-cyan" />
              <span className="text-[10px] font-sans font-semibold tracking-widest uppercase text-text-muted">
                Support over time
              </span>
            </div>
            <h4 className="text-base font-semibold text-white mb-1">
              Money in
            </h4>
            <p className="text-xs text-text-muted mb-4">
              Monthly contributions. Money-out trend appears when spend reports
              are live.
            </p>
            <div className="flex-1 min-h-[6rem] flex items-center">
              <SparkLine values={inflowTrend} height={110} />
            </div>
          </Card>
        </div>
      </section>

      <div className="text-xs text-text-muted">
        <p className="leading-relaxed">
          {source === 'supabase'
            ? 'Studio totals reflect completed support payments. Processing fees are estimated from standard card rates.'
            : source === 'local'
              ? 'Totals reflect recent activity recorded on this device. Public totals update as payments settle.'
              : 'No studio support has been recorded yet. Numbers stay at zero until the first contribution.'}{' '}
          Personal runway funding is tracked separately on{' '}
          <Link to="/support-runway" className="text-neon-cyan hover:underline">
            Runway Support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** Catch render failures so Transparency never white-screens. */
class FinanceDashboard extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[FinanceDashboard]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card variant="subtle" className="!p-6">
          <p className="text-sm text-text-secondary">
            Financial totals could not be displayed right now. Please refresh
            the page, or visit{' '}
            <Link to="/donate" className="text-neon-cyan hover:underline">
              Support
            </Link>{' '}
            for ways to contribute.
          </p>
        </Card>
      );
    }
    return <FinanceDashboardView {...this.props} />;
  }
}

export default FinanceDashboard;
