/**
 * Basic Moderator Dashboard (staff only).
 * Users, idea moderation, content reports / pending queue.
 * Access: staff (founder | moderator | admin | project_lead).
 * Role Management tab is Founder-only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
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
  Film,
  LayoutGrid,
  Search,
  SplitSquareVertical,
  Tags,
  BookOpen,
  UserCog,
  ScrollText,
  Receipt,
  MessageSquare,
  Eye,
  EyeOff,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import Modal from '../components/ui/Modal';
import UserAvatar from '../components/ui/UserAvatar';
import TaskCategoryBadge from '../components/ui/TaskCategoryBadge';
import LoadingScreen from '../components/ui/LoadingScreen';
import useStaffRole from '../hooks/useStaffRole';
import moderationService, {
  WORKFLOW_STATUSES,
  MODERATION_STATUSES,
  ASSIGNABLE_ROLES,
  roleLabel,
} from '../services/moderationService';
import { tasksService } from '../services/tasksService';
import { STATUS_LABELS, displayProjectTitle } from '../utils/ideaStatus';
import { listShowcaseForModeration } from '../services/showcaseService';
import IdeaTagsAdminPanel from '../components/ideas/IdeaTagsAdminPanel';
import DecisionLogsManager from '../components/transparency/DecisionLogsManager';
import StudioExpensesManager from '../components/transparency/StudioExpensesManager';
import platformSuggestionsService from '../services/platformSuggestionsService';
import {
  SUGGESTION_STATUSES,
  OPEN_SUGGESTION_STATUSES,
} from '../constants/platformSuggestions';
import UserNameWithBadge from '../components/badges/UserNameWithBadge';

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'suggestions', label: 'Suggestions', icon: MessageSquare },
  { id: 'tags', label: 'Tags', icon: Tags },
  { id: 'decisions', label: 'Decision logs', icon: ScrollText },
  { id: 'expenses', label: 'Studio expenses', icon: Receipt },
  { id: 'scope', label: 'Scope help', icon: SplitSquareVertical },
  { id: 'restrictions', label: 'Claim restrict', icon: Ban },
  { id: 'reports', label: 'Reports', icon: Flag },
];

const ROLES_TAB = { id: 'roles', label: 'Role Management', icon: UserCog };
const ALL_TABS = [...TABS, ROLES_TAB];

const SCOPE_RESOLUTION_LABELS = {
  breakdown: 'Broken into sub-tasks',
  promoted: 'Promoted / re-parented',
  adjusted: 'Adjusted in place',
  kept: 'Clarified / keep as-is',
  other: 'Other',
};

const filterControl =
  'w-full min-w-0 bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan';

const filterLabel =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

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

const formatDateTime = (iso) => {
  if (!iso) return 'n/a';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'n/a';
  }
};

function joinTime(u) {
  const t = Date.parse(u?.joined_at || u?.created_at || '');
  return Number.isFinite(t) ? t : 0;
}

function ideaTime(idea) {
  const t = Date.parse(idea?.created_at || '');
  return Number.isFinite(t) ? t : 0;
}

const ModeratorDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isModerator,
    isFounder,
    userId,
    loading: roleLoading,
  } = useStaffRole();

  const visibleTabs = useMemo(
    () => (isFounder ? ALL_TABS : TABS),
    [isFounder]
  );

  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState(
    ALL_TABS.some((t) => t.id === initialTab) ? initialTab : 'users'
  );

  // Deep-link: /moderator?tab=scope. Only follow the URL, never
  // overwrite a click while searchParams is still stale.
  useEffect(() => {
    if (roleLoading) return;
    const t = searchParams.get('tab');
    const next = visibleTabs.some((x) => x.id === t) ? t : 'users';
    setTab((cur) => (cur === next ? cur : next));
  }, [searchParams, visibleTabs, roleLoading]);
  const [users, setUsers] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportsMissing, setReportsMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [showcasePendingCount, setShowcasePendingCount] = useState(0);
  const [scopeRequests, setScopeRequests] = useState([]);
  const [scopeMissing, setScopeMissing] = useState(false);
  const [scopeLoadError, setScopeLoadError] = useState('');
  const [scopePendingCount, setScopePendingCount] = useState(0);
  const [scopeStatusFilter, setScopeStatusFilter] = useState('pending');
  /** Optional resolve notes keyed by request id */
  const [scopeStaffNotes, setScopeStaffNotes] = useState({});
  const [restrictionEvents, setRestrictionEvents] = useState([]);
  const [restrictionsMissing, setRestrictionsMissing] = useState(false);
  const [restrictionsLoadError, setRestrictionsLoadError] = useState('');
  /**
   * In-app confirm dialog (replaces window.confirm).
   * @type {null | { title: string, message: string, confirmLabel?: string, onConfirm: () => void }}
   */
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Users filters / sort
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userSort, setUserSort] = useState('newest');
  const [roleSearch, setRoleSearch] = useState('');
  const [roleLog, setRoleLog] = useState([]);
  const [roleLogMissing, setRoleLogMissing] = useState(false);

  // Ideas filters / sort
  const [ideaSearch, setIdeaSearch] = useState('');
  const [ideaStatusFilter, setIdeaStatusFilter] = useState('all');
  const [ideaCategoryFilter, setIdeaCategoryFilter] = useState('all');
  const [ideaSort, setIdeaSort] = useState('newest');

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsMissing, setSuggestionsMissing] = useState(false);
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState('all');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 8000);
  };

  const load = useCallback(async () => {
    if (!isModerator) return;
    setLoading(true);
    setError('');
    // Load independently so a missing reports table does not break users/ideas
    const results = await Promise.allSettled([
      moderationService.listUsers({ limit: 200 }),
      moderationService.listIdeas({ limit: 200 }),
      moderationService.listReports({ status: 'all', limit: 50 }),
      listShowcaseForModeration({ status: 'pending', limit: 100 }),
      tasksService.listScopeRequests({
        status: scopeStatusFilter === 'all' ? 'all' : scopeStatusFilter,
        limit: 150,
      }),
      tasksService.countPendingScopeRequests(),
      tasksService.listRestrictionEvents(80),
      platformSuggestionsService.list({ includeHidden: true, limit: 100 }),
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
      const reason = results[2].reason;
      console.warn('[ModeratorDashboard] reports', reason);
      const missing =
        reason?.code === 'PGRST205' ||
        reason?.code === '42P01' ||
        (/does not exist|schema cache|Could not find the table/i.test(
          reason?.message || ''
        ) &&
          !/permission denied/i.test(reason?.message || ''));
      setReportsMissing(missing);
      if (!missing && reason?.message) {
        errs.push(reason.message);
      }
    }

    if (results[3].status === 'fulfilled') {
      setShowcasePendingCount((results[3].value || []).length);
    } else {
      setShowcasePendingCount(0);
    }

    if (results[4].status === 'fulfilled') {
      setScopeRequests(results[4].value || []);
      setScopeMissing(false);
      setScopeLoadError('');
    } else {
      setScopeRequests([]);
      const reason = results[4].reason;
      console.warn('[ModeratorDashboard] scope', reason);
      const missing =
        reason?.code === 'SCOPE_TABLE_MISSING' ||
        (/Scope requests are not set up|does not exist|schema cache/i.test(
          reason?.message || ''
        ) &&
          !/permission denied/i.test(reason?.message || ''));
      setScopeMissing(missing);
      setScopeLoadError(
        missing
          ? ''
          : reason?.message ||
              'Could not load scope requests. Check the browser console and RLS policies.'
      );
    }

    if (results[5].status === 'fulfilled') {
      setScopePendingCount(results[5].value || 0);
    } else {
      setScopePendingCount(0);
    }

    if (results[6].status === 'fulfilled') {
      setRestrictionEvents(results[6].value || []);
      setRestrictionsMissing(false);
      setRestrictionsLoadError('');
    } else {
      setRestrictionEvents([]);
      const reason = results[6].reason;
      const missing =
        reason?.code === 'RESTRICTION_TABLE_MISSING' ||
        /task_restriction|list_recent_restriction|does not exist|schema cache/i.test(
          reason?.message || ''
        );
      setRestrictionsMissing(missing);
      setRestrictionsLoadError(
        missing
          ? ''
          : reason?.message || 'Could not load restriction audit events.'
      );
    }

    if (results[7].status === 'fulfilled') {
      setSuggestions(results[7].value || []);
      setSuggestionsMissing(false);
    } else {
      setSuggestions([]);
      const reason = results[7].reason;
      const missing =
        /platform_suggestions|not set up yet|does not exist|schema cache/i.test(
          reason?.message || ''
        );
      setSuggestionsMissing(missing);
      if (!missing && reason?.message) {
        errs.push(reason.message);
      }
    }

    if (isFounder) {
      try {
        const log = await moderationService.listRoleChanges({ limit: 50 });
        setRoleLog(log.entries || []);
        setRoleLogMissing(!!log.tableMissing);
      } catch (e) {
        setRoleLog([]);
        setRoleLogMissing(false);
        console.error('[ModeratorDashboard] role log', e);
        errs.push(e?.message || 'Could not load role change log');
      }
    } else {
      setRoleLog([]);
      setRoleLogMissing(false);
    }

    if (errs.length) setError(errs.join(' · '));
    setLoading(false);
  }, [isModerator, isFounder, scopeStatusFilter]);

  useEffect(() => {
    if (!roleLoading && isModerator) load();
  }, [roleLoading, isModerator, load]);

  const userRoles = useMemo(() => {
    const set = new Set();
    for (const u of users) {
      const r = String(u.role || 'user').trim();
      if (r) set.add(r);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [users]);

  const ideaCategories = useMemo(() => {
    const set = new Set();
    for (const idea of ideas) {
      const c = String(idea.category || '').trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  const openSuggestionCount = useMemo(
    () =>
      suggestions.filter((s) =>
        OPEN_SUGGESTION_STATUSES.includes(s.status)
      ).length,
    [suggestions]
  );

  const filteredSuggestions = useMemo(() => {
    if (suggestionStatusFilter === 'all') return suggestions;
    if (suggestionStatusFilter === 'hidden') {
      return suggestions.filter((s) => s.isHidden);
    }
    return suggestions.filter((s) => s.status === suggestionStatusFilter);
  }, [suggestions, suggestionStatusFilter]);

  const handleSuggestionStatus = async (id, status) => {
    setBusyKey(`sug-${id}`);
    setError('');
    try {
      const updated = await platformSuggestionsService.updateStatus(id, status);
      setSuggestions((prev) => prev.map((x) => (x.id === id ? updated : x)));
      showToast(`Status → ${status}`);
    } catch (e) {
      setError(e?.message || 'Could not update suggestion.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSuggestionHidden = async (id, hidden) => {
    setBusyKey(`sug-${id}`);
    setError('');
    try {
      const updated = await platformSuggestionsService.setHidden(id, hidden);
      setSuggestions((prev) => prev.map((x) => (x.id === id ? updated : x)));
      showToast(hidden ? 'Hidden from the public list' : 'Visible on the public list');
    } catch (e) {
      setError(e?.message || 'Could not update visibility.');
    } finally {
      setBusyKey(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    let list = users.filter((u) => {
      const status = u.moderation_status || 'active';
      const role = String(u.role || 'user');
      if (userRoleFilter !== 'all' && role !== userRoleFilter) return false;
      if (userStatusFilter !== 'all' && status !== userStatusFilter) return false;
      if (q) {
        const hay = `${u.username || ''} ${u.email || ''} ${u.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list];
    list.sort((a, b) => {
      switch (userSort) {
        case 'oldest':
          return joinTime(a) - joinTime(b);
        case 'name_az':
          return String(a.username || '').localeCompare(
            String(b.username || ''),
            undefined,
            { sensitivity: 'base' }
          );
        case 'name_za':
          return String(b.username || '').localeCompare(
            String(a.username || ''),
            undefined,
            { sensitivity: 'base' }
          );
        case 'role':
          return String(a.role || '').localeCompare(String(b.role || ''));
        case 'newest':
        default:
          return joinTime(b) - joinTime(a);
      }
    });
    return list;
  }, [users, userSearch, userRoleFilter, userStatusFilter, userSort]);

  const filteredRoleUsers = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    const list = q
      ? users.filter((u) => {
          const hay = `${u.username || ''} ${u.email || ''} ${u.id || ''}`.toLowerCase();
          return hay.includes(q);
        })
      : users;
    return [...list].sort((a, b) =>
      String(a.username || '').localeCompare(String(b.username || ''), undefined, {
        sensitivity: 'base',
      })
    );
  }, [users, roleSearch]);



  const filteredIdeas = useMemo(() => {
    const q = ideaSearch.trim().toLowerCase();
    let list = ideas.filter((idea) => {
      const status = idea.status || 'Proposed';
      const category = String(idea.category || '').trim();
      if (ideaStatusFilter !== 'all' && status !== ideaStatusFilter) return false;
      if (ideaCategoryFilter !== 'all' && category !== ideaCategoryFilter) {
        return false;
      }
      if (q) {
        const hay =
          `${idea.title || ''} ${idea.summary || ''} ${idea.category || ''} ${idea.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list];
    list.sort((a, b) => {
      switch (ideaSort) {
        case 'oldest':
          return ideaTime(a) - ideaTime(b);
        case 'votes_high':
          return (Number(b.votes) || 0) - (Number(a.votes) || 0);
        case 'votes_low':
          return (Number(a.votes) || 0) - (Number(b.votes) || 0);
        case 'title_az':
          return String(a.title || '').localeCompare(
            String(b.title || ''),
            undefined,
            { sensitivity: 'base' }
          );
        case 'newest':
        default:
          return ideaTime(b) - ideaTime(a);
      }
    });
    return list;
  }, [ideas, ideaSearch, ideaStatusFilter, ideaCategoryFilter, ideaSort]);

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
              This dashboard is for moderators.
              If you need access, contact the site owner.
            </p>
            <Button variant="secondary" to="/">
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
                over hard delete when possible. Base enforcement on the published{' '}
                <Link
                  to="/guidelines"
                  className="text-neon-cyan hover:underline"
                >
                  Community Guidelines
                </Link>
                .
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

          {/* Content queues + policy reference */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/guidelines" className="inline-flex">
              <Button
                type="button"
                variant="secondary"
                className="gap-2 min-h-[2.75rem]"
              >
                <BookOpen className="w-4 h-4 text-neon-green" aria-hidden />
                Community Guidelines
                <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                  Policy
                </span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" aria-hidden />
              </Button>
            </Link>
            <Link to="/media/edit" className="inline-flex">
              <Button
                type="button"
                variant="secondary"
                className="gap-2 min-h-[2.75rem]"
              >
                <Film className="w-4 h-4 text-neon-cyan" aria-hidden />
                Official Media
                <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                  Queue
                </span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" aria-hidden />
              </Button>
            </Link>
            <Link to="/moderator?tab=suggestions" className="inline-flex">
              <Button
                type="button"
                variant="secondary"
                className="gap-2 min-h-[2.75rem]"
              >
                <MessageSquare className="w-4 h-4 text-neon-cyan" />
                Suggestions
                <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                  Queue
                </span>
                {openSuggestionCount > 0 && (
                  <span className="text-xs font-mono tabular-nums bg-neon-cyan/20 text-neon-cyan px-1.5 py-0.5 rounded">
                    {openSuggestionCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/showcase/moderate" className="inline-flex">
              <Button
                type="button"
                variant="secondary"
                className="gap-2 min-h-[2.75rem]"
              >
                <LayoutGrid className="w-4 h-4 text-neon-purple" aria-hidden />
                Showcase Moderation
                <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                  Queue
                </span>
                {showcasePendingCount > 0 && (
                  <span className="text-xs font-mono tabular-nums bg-neon-magenta/20 text-neon-magenta px-1.5 py-0.5 rounded">
                    {showcasePendingCount}
                  </span>
                )}
                <ExternalLink className="w-3.5 h-3.5 opacity-60" aria-hidden />
              </Button>
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2" role="tablist">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(t.id);
                    setSearchParams({ tab: t.id }, { replace: true });
                  }}
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
                  {t.id === 'scope' && scopePendingCount > 0 && (
                    <span className="ml-1 text-xs bg-semantic-warning/20 text-semantic-warning px-1.5 py-0.5 rounded">
                      {scopePendingCount}
                    </span>
                  )}
                  {t.id === 'suggestions' && openSuggestionCount > 0 && (
                    <span className="ml-1 text-xs bg-neon-cyan/20 text-neon-cyan px-1.5 py-0.5 rounded">
                      {openSuggestionCount}
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
          <LoadingScreen variant="section" message="Loading…" />
        )}

        {/* ---------- Scope help (task breakdown requests) ---------- */}
        {tab === 'scope' && (
          <section aria-labelledby="scope-heading">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <h2
                  id="scope-heading"
                  className="text-xl sm:text-2xl font-bold text-white tracking-tight"
                >
                  Scope help
                </h2>
                <p className="text-sm text-text-secondary mt-1 max-w-xl">
                  Volunteers flagged work as larger than expected. Open the
                  board task, break it down or re-scope, then mark resolved.
                  Scope discovery is expected, not a failure.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="mod-scope-status">
                  Status filter
                </label>
                <select
                  id="mod-scope-status"
                  className={filterControl + ' w-auto min-w-[9rem]'}
                  value={scopeStatusFilter}
                  onChange={(e) => setScopeStatusFilter(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            {scopeMissing && (
              <Card className="bg-semantic-warning/10 border-semantic-warning/40 mb-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Scope requests table is not installed yet. Run{' '}
                  <code className="text-neon-cyan text-xs">
                    supabase/sql/supabase_task_scope_requests.sql
                  </code>{' '}
                  in the Supabase SQL Editor, then click Refresh.
                </p>
              </Card>
            )}

            {!scopeMissing && scopeLoadError && (
              <Card className="bg-red-400/10 border-red-400/40 mb-4">
                <p className="text-sm text-red-100" role="alert">
                  {scopeLoadError}
                </p>
              </Card>
            )}

            {!scopeMissing &&
              !scopeLoadError &&
              scopeRequests.length === 0 &&
              !loading && (
              <Card className="bg-cyber-card/80 text-center py-10 px-6">
                <SplitSquareVertical className="w-8 h-8 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary">
                  {scopeStatusFilter === 'pending'
                    ? 'No open scope help requests. When claimants flag oversized work, they appear here.'
                    : 'No requests in this filter.'}
                </p>
              </Card>
            )}

            <div className="space-y-3">
              {scopeRequests.map((req) => {
                const busy = busyKey === `scope-${req.id}`;
                return (
                  <Card
                    key={req.id}
                    className="bg-cyber-card/80 border-cyber-border"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                req.status === 'pending'
                                  ? 'warning'
                                  : req.status === 'resolved'
                                    ? 'success'
                                    : 'default'
                              }
                              className="!normal-case"
                            >
                              {req.status}
                            </Badge>
                            {req.resolution && (
                              <span className="text-[11px] font-mono text-text-muted">
                                {SCOPE_RESOLUTION_LABELS[req.resolution] ||
                                  req.resolution}
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-text-muted">
                              {formatDate(req.createdAt)}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold text-white truncate flex flex-wrap items-center gap-2">
                            {req.taskTitle}
                            {req.staffOnly && (
                              <Badge
                                variant="gold"
                                className="!normal-case tracking-wide !text-[10px]"
                              >
                                Staff Only
                              </Badge>
                            )}
                          </h3>
                          <p className="text-xs font-mono text-text-muted">
                            {displayProjectTitle({
                              title: req.projectTitle,
                              slug: req.projectSlug,
                            })}
                            {req.taskCategory ? ` · ${req.taskCategory}` : ''}
                            {req.taskDifficulty
                              ? ` · Difficulty: ${req.taskDifficulty}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <UserAvatar
                            src={req.avatarUrl}
                            name={req.username}
                            username={req.username}
                            size="sm"
                          />
                          <span className="text-sm text-text-secondary">
                            {req.username}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-text-secondary whitespace-pre-wrap border-l-2 border-semantic-warning/40 pl-3">
                        {req.note}
                      </p>

                      {req.staffNote && (
                        <p className="text-sm text-text-secondary whitespace-pre-wrap border-l-2 border-neon-cyan/30 pl-3">
                          <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted block mb-1">
                            Staff note
                          </span>
                          {req.staffNote}
                        </p>
                      )}

                      {req.taskCategory && (
                        <div>
                          <TaskCategoryBadge
                            category={req.taskCategory}
                            size="sm"
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Link to={req.boardPath}>
                          <Button size="sm" variant="secondary" className="gap-1.5">
                            Open board
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>

                      {req.status === 'pending' && (
                        <div className="space-y-2 pt-1 border-t border-cyber-border/60">
                          <label
                            className="block text-[10px] font-mono tracking-widest uppercase text-text-muted"
                            htmlFor={`scope-staff-note-${req.id}`}
                          >
                            Resolve note (optional)
                          </label>
                          <textarea
                            id={`scope-staff-note-${req.id}`}
                            rows={2}
                            maxLength={1000}
                            placeholder="What you did or told the volunteer (e.g. split into three Small tasks under this parent)."
                            className={`${filterControl} resize-y min-h-[3.5rem]`}
                            value={scopeStaffNotes[req.id] || ''}
                            onChange={(e) =>
                              setScopeStaffNotes((prev) => ({
                                ...prev,
                                [req.id]: e.target.value,
                              }))
                            }
                            disabled={busy}
                          />
                          <p className="text-[11px] text-text-muted">
                            Saved with the resolution on this request (and in
                            activity history). Optional but helpful for the
                            volunteer and future staff.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="success"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  `scope-${req.id}`,
                                  () =>
                                    tasksService.resolveScopeRequest(
                                      req.id,
                                      'breakdown',
                                      scopeStaffNotes[req.id] || ''
                                    ),
                                  'Marked as broken into sub-tasks'
                                )
                              }
                            >
                              Broken into sub-tasks
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  `scope-${req.id}`,
                                  () =>
                                    tasksService.resolveScopeRequest(
                                      req.id,
                                      'promoted',
                                      scopeStaffNotes[req.id] || ''
                                    ),
                                  'Marked as promoted / re-parented'
                                )
                              }
                            >
                              Promoted
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  `scope-${req.id}`,
                                  () =>
                                    tasksService.resolveScopeRequest(
                                      req.id,
                                      'adjusted',
                                      scopeStaffNotes[req.id] || ''
                                    ),
                                  'Marked as adjusted'
                                )
                              }
                            >
                              Adjusted
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  `scope-${req.id}`,
                                  () =>
                                    tasksService.resolveScopeRequest(
                                      req.id,
                                      'kept',
                                      scopeStaffNotes[req.id] || ''
                                    ),
                                  'Closed as clarified'
                                )
                              }
                            >
                              Clarified / keep
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- Users ---------- */}
        {tab === 'users' && (
          <section aria-labelledby="users-heading">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
              <div>
                <h2
                  id="users-heading"
                  className="text-xl sm:text-2xl font-bold text-white tracking-tight"
                >
                  All Users
                </h2>
                <p className="text-xs font-mono text-text-muted mt-1">
                  Showing {filteredUsers.length}
                  {filteredUsers.length !== users.length
                    ? ` of ${users.length}`
                    : ''}
                </p>
              </div>
              {(userSearch ||
                userRoleFilter !== 'all' ||
                userStatusFilter !== 'all' ||
                userSort !== 'newest') && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setUserSearch('');
                    setUserRoleFilter('all');
                    setUserStatusFilter('all');
                    setUserSort('newest');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            <Card className="bg-cyber-card/80 mb-4 p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className={filterLabel} htmlFor="mod-user-search">
                    Search
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                      aria-hidden
                    />
                    <input
                      id="mod-user-search"
                      type="search"
                      className={`${filterControl} pl-9`}
                      placeholder="Username, email, id…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={filterLabel} htmlFor="mod-user-role">
                    Role
                  </label>
                  <select
                    id="mod-user-role"
                    className={filterControl}
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                  >
                    <option value="all">All roles</option>
                    {userRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={filterLabel} htmlFor="mod-user-status">
                    Status
                  </label>
                  <select
                    id="mod-user-status"
                    className={filterControl}
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {MODERATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={filterLabel} htmlFor="mod-user-sort">
                    Sort
                  </label>
                  <select
                    id="mod-user-sort"
                    className={filterControl}
                    value={userSort}
                    onChange={(e) => setUserSort(e.target.value)}
                  >
                    <option value="newest">Newest joined</option>
                    <option value="oldest">Oldest joined</option>
                    <option value="name_az">Name A–Z</option>
                    <option value="name_za">Name Z–A</option>
                    <option value="role">Role</option>
                  </select>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              {users.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No profiles found (or staff read policy not applied yet).
                </Card>
              )}
              {users.length > 0 && filteredUsers.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No users match these filters.
                </Card>
              )}
              {filteredUsers.map((u) => {
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
                          <Badge variant="default">
                            {roleLabel(u.role || 'user')}
                          </Badge>
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
                          setConfirmDialog({
                            title: 'Ban user',
                            message: `Ban ${u.username || 'this user'}? They will not be able to participate while banned.`,
                            confirmLabel: 'Ban user',
                            onConfirm: () =>
                              runAction(
                                `user-${u.id}`,
                                () =>
                                  moderationService.setUserModerationStatus(
                                    u.id,
                                    'banned',
                                    'Banned by staff'
                                  ),
                                'User banned'
                              ),
                          });
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

        {/* ---------- Platform suggestions ---------- */}
        {tab === 'suggestions' && (
          <section aria-labelledby="suggestions-heading">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <h2
                  id="suggestions-heading"
                  className="text-xl sm:text-2xl font-bold text-white tracking-tight"
                >
                  Platform suggestions
                </h2>
                <p className="text-sm text-text-secondary mt-1 max-w-xl">
                  Site feedback (not game ideas). Set status, or hide a row from
                  the public list.
                </p>
                <Link
                  to="/suggestions"
                  className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan hover:underline mt-2"
                >
                  View public list
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div>
                <label className={filterLabel} htmlFor="mod-sug-status">
                  Status
                </label>
                <select
                  id="mod-sug-status"
                  className={filterControl}
                  value={suggestionStatusFilter}
                  onChange={(e) => setSuggestionStatusFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  {SUGGESTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>

            {suggestionsMissing && (
              <Card className="bg-cyber-card/80 border-amber-500/30 mb-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Platform suggestions are not set up yet. Run{' '}
                  <code className="text-neon-cyan text-xs font-mono">
                    supabase/sql/supabase_platform_suggestions.sql
                  </code>{' '}
                  in Supabase, then refresh.
                </p>
              </Card>
            )}

            {!suggestionsMissing &&
              filteredSuggestions.length === 0 &&
              !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No suggestions in this view.
                </Card>
              )}

            <div className="space-y-3">
              {filteredSuggestions.map((item) => {
                const busy = busyKey === `sug-${item.id}`;
                return (
                  <Card
                    key={item.id}
                    className={`bg-cyber-card/80 ${
                      item.isHidden ? 'opacity-80 border-amber-400/30' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <h3 className="text-base font-semibold text-white pr-2">
                        {item.title}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <Badge variant="default">{item.category}</Badge>
                        <Badge
                          variant={
                            item.status === 'Done'
                              ? 'success'
                              : item.status === 'Under consideration'
                                ? 'neon'
                                : 'default'
                          }
                        >
                          {item.status}
                        </Badge>
                        {item.isHidden && (
                          <Badge variant="warning">Hidden</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-text-muted font-mono">
                      <UserAvatar
                        src={
                          item.creator?.avatar_url || item.creator?.avatarUrl
                        }
                        name={item.creator?.username || 'Member'}
                        username={item.creator?.username}
                        size="xs"
                      />
                      <UserNameWithBadge
                        username={item.creator?.username}
                        displayName={item.creator?.username || 'Member'}
                        pinnedBadgeKey={
                          item.creator?.pinnedBadgeKey ||
                          item.creator?.pinned_badge_key ||
                          null
                        }
                        linkClassName="text-neon-cyan hover:underline"
                      />
                      {item.createdAt && (
                        <span className="opacity-70">
                          · {formatDate(item.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 mt-3">
                      <select
                        className="bg-cyber-surface border border-cyber-border rounded-lg px-2 py-1.5 text-xs text-white"
                        value={item.status}
                        disabled={busy}
                        onChange={(e) =>
                          void handleSuggestionStatus(item.id, e.target.value)
                        }
                      >
                        {SUGGESTION_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleSuggestionHidden(item.id, !item.isHidden)
                        }
                        className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-white border border-white/15 rounded-lg px-2 py-1.5"
                      >
                        {item.isHidden ? (
                          <>
                            <Eye className="w-3 h-3" /> Unhide
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" /> Hide
                          </>
                        )}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- Idea tags (hybrid catalog) ---------- */}
        {tab === 'tags' && (
          <section aria-labelledby="tags-heading">
            <IdeaTagsAdminPanel />
          </section>
        )}

        {tab === 'decisions' && (
          <section aria-labelledby="decisions-heading">
            <div className="mb-4">
              <h2
                id="decisions-heading"
                className="text-xl sm:text-2xl font-bold text-white tracking-tight"
              >
                Decision logs
              </h2>
              <p className="text-sm text-text-secondary mt-1 max-w-xl">
                Public notes on the Transparency Hub. Archive to hide an entry
                without deleting it.
              </p>
              <Link
                to="/transparency#decisions"
                className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan hover:underline mt-2"
              >
                View public list
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            <DecisionLogsManager userId={userId} />
          </section>
        )}

        {tab === 'expenses' && (
          <section aria-labelledby="expenses-heading">
            <div className="mb-4">
              <h2
                id="expenses-heading"
                className="text-xl sm:text-2xl font-bold text-white tracking-tight"
              >
                Studio expenses
              </h2>
              <p className="text-sm text-text-secondary mt-1 max-w-xl">
                Published Together Forge LLC spend from Relay Operating. This is
                the Transparency expense report, not a bank feed. Do not add
                Stripe payouts, tax withholding, refunds, or Runway/Ko-fi.
              </p>
              <Link
                to="/transparency#financials"
                className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan hover:underline mt-2"
              >
                View public report
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            <StudioExpensesManager userId={userId} />
          </section>
        )}

        {/* ---------- Ideas ---------- */}
        {tab === 'ideas' && (
          <section aria-labelledby="ideas-heading">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
              <div>
                <h2
                  id="ideas-heading"
                  className="text-xl sm:text-2xl font-bold text-white tracking-tight"
                >
                  All Ideas
                </h2>
                <p className="text-xs font-mono text-text-muted mt-1">
                  Showing {filteredIdeas.length}
                  {filteredIdeas.length !== ideas.length
                    ? ` of ${ideas.length}`
                    : ''}
                </p>
              </div>
              {(ideaSearch ||
                ideaStatusFilter !== 'all' ||
                ideaCategoryFilter !== 'all' ||
                ideaSort !== 'newest') && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIdeaSearch('');
                    setIdeaStatusFilter('all');
                    setIdeaCategoryFilter('all');
                    setIdeaSort('newest');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            <Card className="bg-cyber-card/80 mb-4 p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className={filterLabel} htmlFor="mod-idea-search">
                    Search
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                      aria-hidden
                    />
                    <input
                      id="mod-idea-search"
                      type="search"
                      className={`${filterControl} pl-9`}
                      placeholder="Title, summary, id…"
                      value={ideaSearch}
                      onChange={(e) => setIdeaSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={filterLabel} htmlFor="mod-idea-status">
                    Status
                  </label>
                  <select
                    id="mod-idea-status"
                    className={filterControl}
                    value={ideaStatusFilter}
                    onChange={(e) => setIdeaStatusFilter(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {WORKFLOW_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s] || s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={filterLabel} htmlFor="mod-idea-category">
                    Category
                  </label>
                  <select
                    id="mod-idea-category"
                    className={filterControl}
                    value={ideaCategoryFilter}
                    onChange={(e) => setIdeaCategoryFilter(e.target.value)}
                  >
                    <option value="all">All categories</option>
                    {ideaCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={filterLabel} htmlFor="mod-idea-sort">
                    Sort
                  </label>
                  <select
                    id="mod-idea-sort"
                    className={filterControl}
                    value={ideaSort}
                    onChange={(e) => setIdeaSort(e.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="votes_high">Most votes</option>
                    <option value="votes_low">Fewest votes</option>
                    <option value="title_az">Title A–Z</option>
                  </select>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              {ideas.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No ideas found.
                </Card>
              )}
              {ideas.length > 0 && filteredIdeas.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No ideas match these filters.
                </Card>
              )}
              {filteredIdeas.map((idea) => {
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
                            setConfirmDialog({
                              title: 'Delete idea',
                              message: `Delete idea “${idea.title || 'Untitled'}”? This cannot be undone.`,
                              confirmLabel: 'Delete idea',
                              onConfirm: () =>
                                runAction(
                                  `idea-${idea.id}`,
                                  () => moderationService.deleteIdea(idea.id),
                                  'Idea deleted'
                                ),
                            });
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

        {/* ---------- Claim restrictions audit ---------- */}
        {tab === 'restrictions' && (
          <section aria-labelledby="restrictions-heading" className="space-y-4">
            <div>
              <h2
                id="restrictions-heading"
                className="text-lg font-semibold text-white"
              >
                Claim restriction audit
              </h2>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                Fake-work rejections and claim privilege restrictions. Use
                “Reject as fake work” on a Ready for Review task to log events
                here. Escalation: 2 flags → 7 days, 3 → 30 days, 4+ → permanent.
              </p>
            </div>

            {restrictionsMissing && (
              <Card className="bg-cyber-card/80 border-amber-500/30">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Restriction audit is not set up yet. Run{' '}
                  <code className="text-neon-cyan text-xs font-mono">
                    supabase/sql/supabase_task_anti_abuse.sql
                  </code>{' '}
                  in Supabase after the review workflow scripts.
                </p>
              </Card>
            )}

            {restrictionsLoadError && (
              <Card className="bg-red-400/10 border-red-400/40">
                <p className="text-sm text-red-100">{restrictionsLoadError}</p>
              </Card>
            )}

            {!restrictionsMissing &&
              !restrictionsLoadError &&
              restrictionEvents.length === 0 && (
                <Card className="bg-cyber-card/80">
                  <p className="text-sm text-text-muted">
                    No restriction events yet. When staff flag fake work on the
                    Task Board, entries appear here.
                  </p>
                </Card>
              )}

            <div className="space-y-3">
              {restrictionEvents.map((ev) => {
                const userLabel =
                  users.find((u) => u.id === ev.userId)?.username ||
                  ev.userId?.slice?.(0, 8) ||
                  'user';
                const actorLabel =
                  users.find((u) => u.id === ev.actorId)?.username ||
                  (ev.actorId ? ev.actorId.slice(0, 8) : 'system');
                return (
                  <Card key={ev.id} className="bg-cyber-card/80">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              ev.eventType === 'fake_reject' ||
                              ev.eventType === 'auto_restrict' ||
                              ev.eventType === 'restrict'
                                ? 'danger'
                                : 'default'
                            }
                            className="!normal-case tracking-wide"
                          >
                            {ev.eventType}
                          </Badge>
                          <span className="text-sm text-white font-medium">
                            {userLabel}
                          </span>
                          <span className="text-xs font-mono text-text-muted">
                            by {actorLabel}
                          </span>
                        </div>
                        {ev.reason && (
                          <p className="text-sm text-text-secondary leading-relaxed">
                            {ev.reason}
                          </p>
                        )}
                        <p className="text-[11px] font-mono text-text-muted">
                          {formatDate(ev.createdAt)}
                          {ev.metadata?.fake_rejection_count != null
                            ? ` · fake flags: ${ev.metadata.fake_rejection_count}`
                            : ''}
                          {ev.metadata?.is_restricted
                            ? ' · restricted'
                            : ''}
                          {ev.taskId
                            ? ` · task ${String(ev.taskId).slice(0, 8)}…`
                            : ''}
                        </p>
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
                    supabase/sql/supabase_moderation.sql
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

        {/* ---------- Role Management (Founder only) ---------- */}
        {tab === 'roles' && isFounder && (
          <section aria-labelledby="roles-heading">
            <div className="mb-4">
              <h2
                id="roles-heading"
                className="text-xl sm:text-2xl font-bold text-white tracking-tight"
              >
                Role Management
              </h2>
              <p className="text-sm text-text-secondary mt-1 max-w-xl">
                Change a user&apos;s role. Only a Founder can do this. There
                can be one Founder.
              </p>
              <p className="text-xs font-mono text-text-muted mt-1">
                Showing {filteredRoleUsers.length}
                {filteredRoleUsers.length !== users.length
                  ? ` of ${users.length}`
                  : ''}
              </p>
            </div>

            <Card className="bg-cyber-card/80 mb-4 p-4 sm:p-5">
              <label className={filterLabel} htmlFor="mod-role-search">
                Search
              </label>
              <div className="relative max-w-md">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                  aria-hidden
                />
                <input
                  id="mod-role-search"
                  type="search"
                  className={`${filterControl} pl-9`}
                  placeholder="Username, email, id…"
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                />
              </div>
            </Card>

            <div className="space-y-3">
              {users.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No profiles found (or staff read policy not applied yet).
                </Card>
              )}
              {users.length > 0 && filteredRoleUsers.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No users match this search.
                </Card>
              )}
              {filteredRoleUsers.map((u) => {
                const current = String(u.role || 'user');
                const busy = busyKey === `role-${u.id}`;
                const isSelf = u.id === userId;
                const locked = isSelf || current === 'founder';
                const extraOption = !ASSIGNABLE_ROLES.includes(current);
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
                          <Badge variant="default">{roleLabel(current)}</Badge>
                        </div>
                        <p className="text-xs font-mono text-text-muted mt-1 truncate">
                          {u.id?.slice(0, 8)}… · joined{' '}
                          {formatDate(u.joined_at || u.created_at)}
                          {isSelf ? ' · you' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label className="sr-only" htmlFor={`mod-role-${u.id}`}>
                        Role for {u.username || 'user'}
                      </label>
                      <select
                        id={`mod-role-${u.id}`}
                        key={`${u.id}-${current}`}
                        className={filterControl + ' w-auto min-w-[10rem]'}
                        value={current}
                        disabled={busy || locked}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === current) return;
                          setConfirmDialog({
                            title: 'Change role',
                            message: `Set ${u.username || 'this user'} from ${roleLabel(current)} to ${roleLabel(next)}?`,
                            confirmLabel: 'Change role',
                            onConfirm: () =>
                              runAction(
                                `role-${u.id}`,
                                () =>
                                  moderationService.setUserRole(u.id, next),
                                `${u.username || 'User'} is now ${roleLabel(next)}`
                              ),
                          });
                        }}
                      >
                        {extraOption && (
                          <option value={current}>{roleLabel(current)}</option>
                        )}
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Role changes
              </h3>
              <p className="text-sm text-text-secondary mt-1 mb-4">
                Who changed a role, and when.
              </p>

              {roleLogMissing && (
                <Card className="bg-semantic-warning/10 border-semantic-warning/40">
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Role audit log is not installed yet. Run{' '}
                    <code className="text-neon-cyan text-xs">
                      supabase/sql/supabase_role_management.sql
                    </code>{' '}
                    in the Supabase SQL Editor, then click Refresh.
                  </p>
                </Card>
              )}

              {!roleLogMissing && roleLog.length === 0 && !loading && (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  No role changes recorded yet.
                </Card>
              )}

              {!roleLogMissing && roleLog.length > 0 && (
                <div className="space-y-2">
                  {roleLog.map((entry) => (
                    <Card
                      key={entry.id}
                      className="bg-cyber-card/80 py-3 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <p className="text-sm text-text-secondary">
                        <span className="text-white font-medium">
                          {entry.changed_by_username || 'Founder'}
                        </span>{' '}
                        set{' '}
                        <span className="text-white font-medium">
                          {entry.username || 'a user'}
                        </span>{' '}
                        from {roleLabel(entry.old_role)} to{' '}
                        {roleLabel(entry.new_role)}
                      </p>
                      <p className="text-xs font-mono text-text-muted shrink-0">
                        {formatDateTime(entry.created_at)}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <Modal
        isOpen={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || 'Confirm'}
        size="sm"
      >
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {confirmDialog?.message}
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmDialog(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              const action = confirmDialog?.onConfirm;
              setConfirmDialog(null);
              action?.();
            }}
          >
            {confirmDialog?.confirmLabel || 'Confirm'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ModeratorDashboard;
