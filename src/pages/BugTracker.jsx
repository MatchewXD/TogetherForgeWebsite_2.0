/**
 * Public bug tracker / Known Issues.
 * Staff can triage status: Reported → Confirmed → In Progress → Fixed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bug,
  Loader2,
  Plus,
  RefreshCw,
  Filter,
  ExternalLink,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import useIsModerator from '../hooks/useIsModerator';
import bugReportsService, {
  BUG_STATUSES,
  OPEN_BUG_STATUSES,
  severityBadgeVariant,
  statusBadgeVariant,
} from '../services/bugReportsService';

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'all', label: 'All' },
  { id: 'Reported', label: 'Reported' },
  { id: 'Confirmed', label: 'Confirmed' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Fixed', label: 'Fixed' },
];

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

const BugTracker = () => {
  const { isModerator } = useIsModerator();
  const [filter, setFilter] = useState('open');
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 6000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await bugReportsService.listBugs({
        status: filter,
        limit: 80,
      });
      setBugs(rows);
    } catch (err) {
      setError(err.message || 'Failed to load bugs');
      setBugs([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { open: 0 };
    for (const b of bugs) {
      if (OPEN_BUG_STATUSES.includes(b.status)) c.open += 1;
    }
    return c;
  }, [bugs]);

  const handleStatus = async (id, status) => {
    if (!isModerator) return;
    setBusyId(id);
    try {
      const updated = await bugReportsService.updateStatus(id, status);
      setBugs((prev) => prev.map((b) => (b.id === id ? updated : b)));
      showToast(`Status → ${status}`);
      if (filter === 'open' && !OPEN_BUG_STATUSES.includes(status)) {
        setBugs((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err) {
      showToast(err.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="border-b border-white/10 bg-cyber-surface py-12 md:py-16">
        <div className="container-custom">
          <Link
            to="/"
            className="flex w-fit items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
            BACK TO HOME
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="section-header !block mb-3">Transparency</div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                Bug Tracker
              </h1>
              <p className="text-text-secondary mt-3 text-sm sm:text-base leading-relaxed">
                Known issues and community reports. Workflow:{' '}
                <span className="text-white">Reported</span> → Confirmed → In
                Progress → Fixed. Anyone can report; staff updates status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link to="/bugs/report">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Report a Bug
                </Button>
              </Link>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-custom py-10 max-w-4xl space-y-6">
        {toast && (
          <div
            role="status"
            className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-2 text-sm text-neon-cyan"
          >
            {toast}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono tracking-widest border transition-colors ${
                filter === f.id
                  ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
                  : 'border-white/15 text-text-muted hover:border-white/30'
              }`}
            >
              {f.label}
            </button>
          ))}
          {!loading && filter === 'open' && (
            <span className="text-xs font-mono text-text-muted ml-1">
              {counts.open} open on this page
            </span>
          )}
        </div>

        {error && (
          <Card className="bg-cyber-card/80 border-amber-400/30 text-amber-100/90 text-sm">
            {error}
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
            Loading bugs…
          </div>
        ) : bugs.length === 0 ? (
          <Card className="bg-cyber-card/80 text-center py-14 space-y-3">
            <Bug className="w-10 h-10 text-neon-cyan mx-auto opacity-70" />
            <p className="text-text-secondary text-sm">
              No bugs in this filter. Quiet forges are happy forges.
            </p>
            <Link
              to="/bugs/report"
              className="inline-block text-xs font-mono text-neon-cyan hover:underline"
            >
              Report something you found →
            </Link>
          </Card>
        ) : (
          <ul className="space-y-4">
            {bugs.map((bug) => {
              const open = expandedId === bug.id;
              return (
                <li key={bug.id}>
                  <Card className="bg-cyber-card/80 !p-0 overflow-hidden">
                    <button
                      type="button"
                      className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
                      onClick={() =>
                        setExpandedId(open ? null : bug.id)
                      }
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-base sm:text-lg font-semibold text-white">
                            {bug.title}
                          </h2>
                          <p className="text-xs font-mono text-text-muted mt-1">
                            {formatDate(bug.createdAt)}
                            {bug.reporterName
                              ? ` · ${bug.reporterName}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <Badge variant={severityBadgeVariant(bug.severity)}>
                            {bug.severity}
                          </Badge>
                          <Badge variant={statusBadgeVariant(bug.status)}>
                            {bug.status}
                          </Badge>
                        </div>
                      </div>
                      {!open && (
                        <p className="text-sm text-text-secondary line-clamp-2 mt-3">
                          {bug.description}
                        </p>
                      )}
                    </button>

                    {open && (
                      <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
                        <div>
                          <div className="text-[10px] font-mono tracking-widest text-text-muted mb-1">
                            DESCRIPTION
                          </div>
                          <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                            {bug.description}
                          </p>
                        </div>

                        {bug.stepsToReproduce && (
                          <div>
                            <div className="text-[10px] font-mono tracking-widest text-text-muted mb-1">
                              STEPS TO REPRODUCE
                            </div>
                            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                              {bug.stepsToReproduce}
                            </p>
                          </div>
                        )}

                        {(bug.browserInfo || bug.deviceInfo) && (
                          <div className="text-xs text-text-muted font-mono space-y-1">
                            {bug.browserInfo && (
                              <p className="break-all">
                                Browser: {bug.browserInfo}
                              </p>
                            )}
                            {bug.deviceInfo && (
                              <p>Device: {bug.deviceInfo}</p>
                            )}
                          </div>
                        )}

                        {bug.screenshotUrl && (
                          <a
                            href={bug.screenshotUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-xs text-neon-cyan hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View screenshot
                          </a>
                        )}

                        {isModerator && (
                          <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 p-3 space-y-2">
                            <div className="text-[10px] font-mono tracking-widest text-neon-cyan">
                              STAFF TRIAGE
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {BUG_STATUSES.filter((s) => s !== 'Closed').map(
                                (s) => (
                                  <Button
                                    key={s}
                                    size="sm"
                                    variant={
                                      bug.status === s ? 'primary' : 'outline'
                                    }
                                    disabled={busyId === bug.id || bug.status === s}
                                    onClick={() => handleStatus(bug.id, s)}
                                  >
                                    {s}
                                  </Button>
                                )
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === bug.id}
                                onClick={() => handleStatus(bug.id, 'Closed')}
                              >
                                Closed
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        {isModerator && (
          <p className="text-xs text-text-muted font-mono text-center pt-4">
            Signed in as staff — expand a bug to change status.
          </p>
        )}
      </div>
    </div>
  );
};

export default BugTracker;
