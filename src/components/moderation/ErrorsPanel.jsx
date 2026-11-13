/**
 * Staff "Site errors" tab: browser-side errors reported by visitors,
 * grouped by message (public.get_client_errors).
 */

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import LoadingScreen from '../ui/LoadingScreen';
import { supabase } from '../../lib/supabase';

const RANGES = [
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 720, label: '30 days' },
];

const KIND_LABELS = {
  render: 'Page crash',
  chunk: 'Failed to load page code',
  error: 'Script error',
  unhandledrejection: 'Unhandled request failure',
};

function formatWhen(iso) {
  if (!iso) return 'n/a';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'n/a';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isMissing(error) {
  return /could not find the function|does not exist|schema cache|PGRST202|42883/i.test(
    `${error?.code || ''} ${error?.message || ''}`
  );
}

async function fetchClientErrors(hours) {
  const { data, error } = await supabase.rpc('get_client_errors', {
    p_hours: hours,
    p_limit: 100,
  });
  if (error) {
    if (isMissing(error)) return { rows: [], missing: true };
    throw error;
  }
  return { rows: Array.isArray(data) ? data : [], missing: false };
}

export default function ErrorsPanel() {
  const [hours, setHours] = useState(72);
  const [rows, setRows] = useState([]);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchClientErrors(hours);
      setRows(result.rows);
      setMissing(result.missing);
    } catch (e) {
      setError(e?.message || 'Could not load site errors.');
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-labelledby="site-errors-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2
            id="site-errors-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Site errors
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">
            Errors that happened in visitors&apos; browsers, grouped by message.
            No accounts or IP addresses are recorded. Entries are kept for 30
            days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="site-errors-range" className="sr-only">
            Time range
          </label>
          <select
            id="site-errors-range"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary"
          >
            {RANGES.map((r) => (
              <option key={r.hours} value={r.hours}>
                Last {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-white disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingScreen variant="inline" message="Loading…" />
      ) : error ? (
        <Card variant="subtle" className="!p-6">
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        </Card>
      ) : missing ? (
        <Card variant="subtle" className="!p-6">
          <p className="text-sm text-text-secondary">
            Error reporting is not set up on this database yet. Run{' '}
            <code className="text-neon-cyan">supabase/sql/supabase_launch_prep.sql</code>.
          </p>
        </Card>
      ) : rows.length === 0 ? (
        <Card variant="subtle" className="!p-6">
          <p className="text-sm text-text-secondary">
            No errors reported in this period.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const key = `${row.kind}|${row.message}`;
            const open = openKey === key;
            return (
              <li key={key}>
                <Card variant="subtle" className="!p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-white break-words">
                        {row.message}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {KIND_LABELS[row.kind] || row.kind} · last seen{' '}
                        {formatWhen(row.last_seen)}
                        {row.sample_path ? ` on ${row.sample_path}` : ''} ·
                        first seen {formatWhen(row.first_seen)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge>{Number(row.occurrences)} times</Badge>
                      <Badge>{Number(row.sessions)} visitors</Badge>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? null : key)}
                    className="mt-3 text-xs font-mono tracking-widest text-neon-cyan hover:underline"
                  >
                    {open ? 'Hide details' : 'Show details'}
                  </button>
                  {open && (
                    <div className="mt-3 space-y-2 text-xs text-text-secondary">
                      <p>
                        <span className="text-text-muted">Browser:</span>{' '}
                        {row.sample_user_agent || 'unknown'}
                      </p>
                      <p>
                        <span className="text-text-muted">Build:</span>{' '}
                        {row.sample_build || 'unknown'}
                      </p>
                      {row.sample_stack ? (
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 font-mono text-[11px] text-text-secondary">
                          {row.sample_stack}
                        </pre>
                      ) : (
                        <p>No stack trace was captured.</p>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
