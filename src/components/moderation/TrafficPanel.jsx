/**
 * Staff-only Traffic tab. Aggregates only — no identities.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Eye, Loader2, RefreshCw, Users } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Buttons';
import TimeSeriesChart from '../ui/dashboard/TimeSeriesChart';
import { mergeTrafficPages } from '../../utils/trafficPageLabel';
import {
  TRAFFIC_ACTIVE_POLL_MS,
  TRAFFIC_DEFAULT_RANGE,
  TRAFFIC_RANGES,
  TRAFFIC_REPORT_POLL_MS,
  isTrafficRangeId,
} from '../../constants/traffic';
import {
  getTrafficActiveNow,
  getTrafficReport,
} from '../../services/trafficService';

function formatTick(iso, range) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const shortTime = ['1h', '6h', '12h', '24h'].includes(range);
  if (shortTime) {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (['3d', '7d', '14d', '21d', '30d'].includes(range)) {
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
    });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: range === 'lifetime' || range === '3y' ? 'numeric' : undefined,
  });
}

function formatInt(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('en-US').format(v);
}

const emptyReport = {
  uniqueVisitors: 0,
  pageviews: 0,
  signedInVisitors: 0,
  guestVisitors: 0,
  signedInPageviews: 0,
  guestPageviews: 0,
  series: [],
  topPages: [],
  bucket: '',
};

const TrafficPanel = () => {
  const [range, setRange] = useState(TRAFFIC_DEFAULT_RANGE);
  const [metric, setMetric] = useState('concurrent');
  const [activeNow, setActiveNow] = useState(0);
  const [report, setReport] = useState(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [setupHint, setSetupHint] = useState(false);

  const loadActive = useCallback(async () => {
    try {
      const live = await getTrafficActiveNow();
      setActiveNow(live.activeNow);
    } catch (e) {
      if (e?.code === 'TABLE_MISSING') setSetupHint(true);
    }
  }, []);

  const loadReport = useCallback(async (nextRange, { silent } = {}) => {
    const id = isTrafficRangeId(nextRange) ? nextRange : TRAFFIC_DEFAULT_RANGE;
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getTrafficReport(id);
      setReport(data);
      setActiveNow(data.activeNow);
      setSetupHint(false);
    } catch (e) {
      if (e?.code === 'TABLE_MISSING') {
        setSetupHint(true);
        setReport(emptyReport);
      } else {
        setError(e?.message || 'Could not load traffic.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(range);
    void loadActive();
    const liveId = window.setInterval(() => {
      void loadActive();
    }, TRAFFIC_ACTIVE_POLL_MS);
    const reportId = window.setInterval(() => {
      void loadReport(range, { silent: true });
    }, TRAFFIC_REPORT_POLL_MS);
    return () => {
      window.clearInterval(liveId);
      window.clearInterval(reportId);
    };
  }, [range, loadReport, loadActive]);

  const chartPoints = useMemo(() => {
    const key = metric === 'pageviews' ? 'pageviews' : 'concurrent';
    return (report.series || []).map((p) => ({ t: p.t, v: p[key] || 0 }));
  }, [report.series, metric]);

  const pageRows = useMemo(
    () => mergeTrafficPages(report.topPages),
    [report.topPages]
  );

  const uniqueTotal =
    report.signedInVisitors + report.guestVisitors || report.uniqueVisitors;
  const signedPct =
    uniqueTotal > 0 ? (report.signedInVisitors / uniqueTotal) * 100 : 0;
  const guestPct =
    uniqueTotal > 0 ? (report.guestVisitors / uniqueTotal) * 100 : 0;

  return (
    <section aria-labelledby="traffic-heading" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2
            id="traffic-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Traffic
          </h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="gap-2 self-start"
          onClick={() => {
            void loadActive();
            void loadReport(range);
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {setupHint ? (
        <Card variant="subtle" className="!p-4">
          <p className="text-sm text-text-secondary">
            Traffic tables are not on this project yet. Apply{' '}
            <span className="font-mono text-xs text-neon-cyan">
              supabase/sql/supabase_traffic.sql
            </span>{' '}
            on staging, browse the site in another tab, then refresh.
          </p>
        </Card>
      ) : null}

      {error ? (
        <Card className="bg-red-400/10 border-red-400/40 !p-4">
          <p className="text-sm text-red-100" role="alert">
            {error}
          </p>
        </Card>
      ) : null}

      <Card variant="panel" className="!p-5 sm:!p-6 border-neon-cyan/35">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-neon-cyan" />
          <span className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-neon-cyan">
            Active now
          </span>
        </div>
        <div className="text-5xl sm:text-6xl font-bold text-neon-cyan tabular-nums tracking-tight leading-none">
          {formatInt(activeNow)}
        </div>
      </Card>

      <div>
        <p className="text-[10px] font-mono tracking-widest uppercase text-text-muted mb-2">
          Range
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Time range">
          {TRAFFIC_RANGES.map((r) => {
            const on = range === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono tracking-wide uppercase border transition-colors ${
                  on
                    ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                    : 'border-cyber-border text-text-muted hover:border-neon-cyan/40 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card variant="subtle" className="!p-4">
          <div className="flex items-center gap-2 text-text-muted mb-1.5">
            <Users className="w-3.5 h-3.5" />
            <span className="text-[10px] font-sans font-semibold tracking-widest uppercase">
              Unique visitors
            </span>
          </div>
          <div className="text-2xl font-semibold text-white tabular-nums">
            {formatInt(report.uniqueVisitors)}
          </div>
          <p className="text-[11px] text-text-muted mt-1">
            Short-lived sessions, not accounts
          </p>
        </Card>
        <Card variant="subtle" className="!p-4">
          <div className="flex items-center gap-2 text-text-muted mb-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[10px] font-sans font-semibold tracking-widest uppercase">
              Pageviews
            </span>
          </div>
          <div className="text-2xl font-semibold text-white tabular-nums">
            {formatInt(report.pageviews)}
          </div>
          <p className="text-[11px] text-text-muted mt-1">
            Path changes in this range
          </p>
        </Card>
        <Card variant="subtle" className="!p-4">
          <span className="text-[10px] font-sans font-semibold tracking-widest uppercase text-text-muted">
            Signed in
          </span>
          <div className="text-2xl font-semibold text-white tabular-nums mt-1.5">
            {formatInt(report.signedInVisitors)}
          </div>
          <p className="text-[11px] text-text-muted mt-1">
            {formatInt(report.signedInPageviews)} pageviews
          </p>
        </Card>
        <Card variant="subtle" className="!p-4">
          <span className="text-[10px] font-sans font-semibold tracking-widest uppercase text-text-muted">
            Guests
          </span>
          <div className="text-2xl font-semibold text-white tabular-nums mt-1.5">
            {formatInt(report.guestVisitors)}
          </div>
          <p className="text-[11px] text-text-muted mt-1">
            {formatInt(report.guestPageviews)} pageviews
          </p>
        </Card>
      </div>

      <Card className="!p-5 sm:!p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <div className="text-[10px] font-sans font-semibold tracking-widest uppercase text-neon-cyan mb-1">
              Over time
            </div>
            <h3 className="text-lg font-semibold text-white">
              {metric === 'pageviews'
                ? 'Pageviews'
                : 'Concurrent active visitors'}
            </h3>
            <p className="text-xs text-text-muted mt-1">
              {report.bucket
                ? `Buckets: ${report.bucket}`
                : 'Buckets widen on longer ranges so the chart stays readable.'}
            </p>
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Chart metric">
            {[
              { id: 'concurrent', label: 'Concurrent' },
              { id: 'pageviews', label: 'Pageviews' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono tracking-wide uppercase border ${
                  metric === m.id
                    ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                    : 'border-cyber-border text-text-muted hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {loading && !report.series.length ? (
          <div className="flex items-center justify-center h-44 text-text-muted gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-neon-cyan" />
            <span className="text-sm font-mono tracking-widest uppercase">
              Loading
            </span>
          </div>
        ) : (
          <TimeSeriesChart
            points={chartPoints}
            tone={metric === 'pageviews' ? 'purple' : 'cyan'}
            formatTick={(iso) => formatTick(iso, range)}
            emptyLabel="No traffic in this range yet. Open the site in another tab, click around, then refresh."
          />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="!p-5 sm:!p-6 flex flex-col h-80">
          <h3 className="text-base font-semibold text-white shrink-0">
            Signed-in vs guest
          </h3>
          {uniqueTotal > 0 ? (
            <div className="flex-1 min-h-0 flex flex-col justify-evenly gap-5 pt-2">
              <div>
                <div className="flex items-end justify-between gap-3 mb-2">
                  <span className="text-lg font-semibold text-white">
                    Signed in
                  </span>
                  <span className="text-3xl font-bold text-neon-cyan tabular-nums leading-none">
                    {formatInt(report.signedInVisitors)}
                  </span>
                </div>
                <div className="h-3.5 w-full bg-cyber-surface/90 border border-cyber-border/80 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-neon-cyan/50 to-neon-cyan"
                    style={{ width: `${signedPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-end justify-between gap-3 mb-2">
                  <span className="text-lg font-semibold text-white">
                    Guests
                  </span>
                  <span className="text-3xl font-bold text-neon-purple tabular-nums leading-none">
                    {formatInt(report.guestVisitors)}
                  </span>
                </div>
                <div className="h-3.5 w-full bg-cyber-surface/90 border border-cyber-border/80 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-neon-purple/60 to-neon-purple"
                    style={{ width: `${guestPct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="flex-1 flex items-center justify-center text-sm text-text-muted border border-dashed border-cyber-border/70 bg-cyber-surface/30 px-3 mt-3">
              No sessions in this range yet. Zero is a quiet site, not an error.
            </p>
          )}
        </Card>

        <Card className="!p-5 sm:!p-6 flex flex-col h-80">
          <h3 className="text-xl sm:text-2xl font-bold text-white shrink-0">
            Pages
          </h3>
          {pageRows.length ? (
            <div
              className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain dashboard-panel-scroll pr-3"
              style={{ scrollbarGutter: 'stable' }}
            >
              <ul className="divide-y divide-cyber-border border-y border-cyber-border pr-2">
                {pageRows.map((row) => (
                  <li
                    key={row.group}
                    className="flex items-center justify-between gap-4 py-3 pr-1"
                  >
                    <div className="min-w-0">
                      <div className="text-base sm:text-lg font-medium text-white truncate">
                        {row.label}
                      </div>
                      {row.uniquePages > 1 ? (
                        <div className="text-xs text-text-muted mt-0.5">
                          {formatInt(row.uniquePages)} pages
                        </div>
                      ) : null}
                    </div>
                    <span className="text-xl sm:text-2xl font-semibold tabular-nums text-white shrink-0">
                      {formatInt(row.pageviews)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex-1 flex items-center justify-center text-sm text-text-muted border border-dashed border-cyber-border/70 bg-cyber-surface/30 px-3 mt-3">
              No pageviews recorded in this range.
            </p>
          )}
        </Card>
      </div>
    </section>
  );
};

export default TrafficPanel;
