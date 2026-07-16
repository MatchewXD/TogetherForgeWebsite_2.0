/**
 * Basic Moderator Dashboard (staff only).
 * Users, idea moderation, content reports / pending queue.
 * Access: useIsModerator (moderator | admin | project_lead).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  Users,
  Lightbulb,
  Flag,
  Loader2,
  RefreshCw,
  Trash2,
  ExternalLink,
  Ban,
  PauseCircle,
  CheckCircle2,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import UserAvatar from '../components/ui/UserAvatar';
import useIsModerator from '../hooks/useIsModerator';
import moderationService, {
  WORKFLOW_STATUSES,
} from '../services/moderationService';
import { STATUS_LABELS } from '../utils/ideaStatus';

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'reports', label: 'Reports', icon: Flag },
];

const formatDate = (iso) => {
  if (!iso) return 'n/a';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'n/a';
  }
};

const ModeratorDashboard = () => {
  const navigate = useNavigate();
  const { isModerator, loading: roleLoading } = useIsModerator();

  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportsMissing, setReportsMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyKey, setBusyKey] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const load = useCallback(async () => {
    if (!isModerator) return;
    setLoading(true);
    setError('');
    // Load independently so a missing reports table does not break users/ideas
    const results = await Promise.allSettled([
      moderationService.listUsers({ limit: 60 }),
      moderationService.listIdeas({ limit: 50 }),
      moderationService.listReports({ status: 'all', limit: 50 }),
    ]);

    const errs = [];

    if (results[0].status === 'fulfilled') {
      setUsers(results[0].value || []);
    } else {
      setUsers([]);
      console.error('[ModeratorDashboard] users', results[0].reason);
      errs.push(results[0].reason?.message || 'Could not load users');
    }

    if (results[1].status === 'fulfilled') {
      setIdeas(results[1].value || []);
    } else {
      setIdeas([]);
      console.error('[ModeratorDashboard] ideas', results[1].reason);
      errs.push(results[1].reason?.message || 'Could not load ideas');
    }

    if (results[2].status === 'fulfilled') {
      const r = results[2].value || {};
      setReports(r.reports || []);
      setReportsMissing(!!r.tableMissing);
    } else {
      setReports([]);
      setReportsMissing(true);
      console.warn('[ModeratorDashboard] reports', results[2].reason);
      // Do not treat missing reports table as a hard page error
    }

    if (errs.length) setError(errs.join(' · '));
    setLoading(false);
  }, [isModerator]);

  useEffect(() => {
    if (!roleLoading && isModerator) load();
  }, [roleLoading, isModerator, load]);

  const runAction = async (key, fn, successMsg) => {
    setBusyKey(key);
    setError('');
    try {
      await fn();
      if (successMsg) showToast(successMsg);
      await load();
    } catch (e) {
      console.error('[ModeratorDashboard] action', e);
      setError(e?.message || 'Action failed. You may need staff RLS policies.');
    } finally {
      setBusyKey(null);
    }
  };

  if (roleLoading) {
    return (
      <div className="pt-28 min-h-screen flex items-center justify-center text-text-muted gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
        <span className="font-mono text-sm tracking-widest uppercase">
          Checking access
        </span>
      </div>
    );
  }

  if (!isModerator) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
        <div className="container-custom py-16 max-w-lg">
          <Card className="bg-cyber-card/80 text-center py-10 px-6">
            <Shield className="w-10 h-10 text-text-muted mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Staff only</h1>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              This dashboard is for moderators, admins, and project leads.
              If you need access, contact a site admin to set your profile role.
            </p>
            <Button variant="secondary" onClick={() => navigate('/')}>
              Back home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.04)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg border border-cyber-border bg-cyber-surface text-sm shadow-lg"
        >
          {toast}
        </div>
      )}

      <div className="relative z-10 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 md:py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-6 group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
            BACK TO HOME
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="section-header mb-0">Staff tools</div>
                <Badge variant="neon">Moderator</Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Moderator Dashboard
              </h1>
              <p className="text-text-secondary mt-2 text-sm sm:text-base max-w-xl">
                Basic user, idea, and report tools. Keep it light. Prefer archive
                over hard delete when possible.
              </p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 self-start sm:self-auto"
              onClick={load}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap gap-2" role="tablist">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono tracking-widest uppercase border transition-colors ${
                    active
                      ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                      : 'border-cyber-border text-text-muted hover:border-neon-cyan/40 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {t.id === 'reports' && pendingCount > 0 && (
                    <span className="ml-1 text-xs bg-neon-magenta/20 text-neon-magenta px-1.5 py-0.5 rounded">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container-custom relative z-10 py-10 md:py-12 max-w-5xl space-y-6">
        {error && (
          <Card className="bg-red-400/10 border-red-400/40">
            <p className="text-sm text-red-100" role="alert">
              {error}
            </p>
          </Card>
        )}

        {loading && !users.length && !ideas.length && (
          <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
            <span className="text-sm font-mono tracking-widest uppercase">
              Loading
            </span>
          </div>
        )}

        {/* ---------- Users ---------- */}
        {tab === 'users' && (
          <section aria-labelledby="users-heading">
            <h2 id="users-heading" className="sr-only">
              Users
            </h2>
            <div className="space-y-3">
              {users.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No profiles found (or staff read policy not applied yet).
                </Card>
              )}
              {users.map((u) => {
                const status = u.moderation_status || 'active';
                const busy = busyKey === `user-${u.id}`;
                return (
                  <Card
                    key={u.id}
                    className="bg-cyber-card/80 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <UserAvatar
                        src={u.avatar_url}
                        name={u.username || 'User'}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white truncate">
                            {u.username || 'Unnamed'}
                          </span>
                          <Badge variant="default">{u.role || 'user'}</Badge>
                          {status !== 'active' && (
                            <Badge
                              variant={
                                status === 'banned' ? 'purple' : 'default'
                              }
                            >
                              {status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-mono text-text-muted mt-1 truncate">
                          {u.id?.slice(0, 8)}… · joined{' '}
                          {formatDate(u.joined_at || u.created_at)}
                        </p>
                        {u.moderation_note && (
                          <p className="text-xs text-text-secondary mt-1">
                            Note: {u.moderation_note}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {u.username && (
                        <Link
                          to={`/u/${u.username}`}
                          className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:underline px-2"
                        >
                          Profile <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy || status === 'active'}
                        className="gap-1"
                        onClick={() =>
                          runAction(
                            `user-${u.id}`,
                            () =>
                              moderationService.setUserModerationStatus(
                                u.id,
                                'active',
                                null
                              ),
                            'User restored to active'
                          )
                        }
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || status === 'suspended'}
                        className="gap-1"
                        onClick={() =>
                          runAction(
                            `user-${u.id}`,
                            () =>
                              moderationService.setUserModerationStatus(
                                u.id,
                                'suspended',
                                'Suspended by staff'
                              ),
                            'User suspended'
                          )
                        }
                      >
                        <PauseCircle className="w-3.5 h-3.5" />
                        Suspend
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || status === 'banned'}
                        className="gap-1 text-red-300 hover:text-red-200"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Ban ${u.username || 'this user'}? They should not participate while banned.`
                            )
                          ) {
                            return;
                          }
                          runAction(
                            `user-${u.id}`,
                            () =>
                              moderationService.setUserModerationStatus(
                                u.id,
                                'banned',
                                'Banned by staff'
                              ),
                            'User banned'
                          );
                        }}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Ban
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- Ideas ---------- */}
        {tab === 'ideas' && (
          <section aria-labelledby="ideas-heading">
            <h2 id="ideas-heading" className="sr-only">
              Ideas
            </h2>
            <div className="space-y-3">
              {ideas.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No ideas found.
                </Card>
              )}
              {ideas.map((idea) => {
                const busy = busyKey === `idea-${idea.id}`;
                const status = idea.status || 'Proposed';
                return (
                  <Card
                    key={idea.id}
                    className="bg-cyber-card/80 flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white truncate">
                            {idea.title || 'Untitled'}
                          </h3>
                          <Badge variant="default">
                            {STATUS_LABELS[status] || status}
                          </Badge>
                          <span className="text-xs font-mono text-text-muted">
                            {idea.votes ?? 0} votes
                          </span>
                        </div>
                        <p className="text-xs text-text-muted font-mono">
                          #{idea.id} · {formatDate(idea.created_at)}
                          {idea.category ? ` · ${idea.category}` : ''}
                        </p>
                        {idea.summary && (
                          <p className="text-sm text-text-secondary mt-2 line-clamp-2">
                            {idea.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Link
                          to={`/ideas/${idea.id}`}
                          className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:underline px-2 py-1"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </Link>
                        <select
                          className="text-xs bg-cyber-surface border border-cyber-border rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-neon-cyan"
                          value={
                            WORKFLOW_STATUSES.includes(status)
                              ? status
                              : 'Proposed'
                          }
                          disabled={busy}
                          onChange={(e) => {
                            const next = e.target.value;
                            runAction(
                              `idea-${idea.id}`,
                              () =>
                                moderationService.updateIdeaStatus(
                                  idea.id,
                                  next
                                ),
                              `Status → ${STATUS_LABELS[next] || next}`
                            );
                          }}
                          aria-label={`Status for ${idea.title}`}
                        >
                          {WORKFLOW_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s] || s}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-red-300"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete idea "${idea.title}"? This cannot be undone.`
                              )
                            ) {
                              return;
                            }
                            runAction(
                              `idea-${idea.id}`,
                              () => moderationService.deleteIdea(idea.id),
                              'Idea deleted'
                            );
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- Reports ---------- */}
        {tab === 'reports' && (
          <section aria-labelledby="reports-heading">
            <h2 id="reports-heading" className="sr-only">
              Reports
            </h2>

            {reportsMissing && (
              <Card className="bg-cyber-card/80 border-amber-500/30 mb-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  The <code className="text-neon-cyan text-xs font-mono">content_reports</code>{' '}
                  table is not available yet. Run{' '}
                  <code className="text-neon-cyan text-xs font-mono">
                    supabase_moderation.sql
                  </code>{' '}
                  in Supabase to enable the reports queue. Pending items will
                  show here afterward.
                </p>
              </Card>
            )}

            <div className="space-y-3">
              {!reportsMissing && reports.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No reports in the queue. Looking good.
                </Card>
              )}
              {reports.map((r) => {
                const busy = busyKey === `report-${r.id}`;
                return (
                  <Card key={r.id} className="bg-cyber-card/80">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge
                            variant={
                              r.status === 'pending' ? 'neon' : 'default'
                            }
                          >
                            {r.status}
                          </Badge>
                          <span className="text-xs font-mono text-text-muted uppercase tracking-widest">
                            {r.target_type} · {r.target_id}
                          </span>
                        </div>
                        <p className="text-sm text-white font-medium">
                          {r.reason || 'No reason given'}
                        </p>
                        {r.details && (
                          <p className="text-sm text-text-secondary mt-1">
                            {r.details}
                          </p>
                        )}
                        <p className="text-xs font-mono text-text-muted mt-2">
                          #{r.id} · {formatDate(r.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {r.target_type === 'idea' && (
                          <Link
                            to={`/ideas/${r.target_id}`}
                            className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:underline px-2 py-1"
                          >
                            View idea <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy || r.status === 'reviewing'}
                          onClick={() =>
                            runAction(
                              `report-${r.id}`,
                              () =>
                                moderationService.resolveReport(
                                  r.id,
                                  'reviewing'
                                ),
                              'Marked reviewing'
                            )
                          }
                        >
                          Reviewing
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || r.status === 'resolved'}
                          onClick={() =>
                            runAction(
                              `report-${r.id}`,
                              () =>
                                moderationService.resolveReport(
                                  r.id,
                                  'resolved'
                                ),
                              'Report resolved'
                            )
                          }
                        >
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || r.status === 'dismissed'}
                          onClick={() =>
                            runAction(
                              `report-${r.id}`,
                              () =>
                                moderationService.resolveReport(
                                  r.id,
                                  'dismissed'
                                ),
                              'Report dismissed'
                            )
                          }
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <Card className="bg-cyber-surface/50 border-dashed text-xs text-text-muted leading-relaxed">
          Tip: set <code className="text-neon-cyan">profiles.role</code> to{' '}
          <code className="text-neon-cyan">moderator</code>,{' '}
          <code className="text-neon-cyan">admin</code>, or{' '}
          <code className="text-neon-cyan">project_lead</code> for staff access.
          Apply <code className="text-neon-cyan">supabase_moderation.sql</code> for
          ban/suspend columns, report queue, and staff RLS.
        </Card>
      </div>
    </div>
  );
};

export default ModeratorDashboard;
