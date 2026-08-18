/**
 * Private workspace hub at /dashboard.
 * Active claims, join requests, personal stats, quick actions.
 * Account settings: /account. Profile page: /u/:username.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ListTodo,
  CheckCircle2,
  Clock,
  ExternalLink,
  User,
  Lightbulb,
  FolderKanban,
  HandHelping,
  AlertCircle,
  FolderOpen,
  Pencil,
  Trash2,
  MessageCircle,
  Sparkles,
  Film,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import tasksService, {
  NEW_USER_CLAIM_LIMIT,
  MAX_ACTIVE_CLAIMS,
  ESTABLISHED_CLAIM_LIMIT,
  CLAIM_LIMIT_UNLOCK_COMPLETIONS,
  TRUSTED_CLAIM_UNLOCK_COMPLETIONS,
  CLAIM_AUTO_RELEASE_POLICY_COPY,
  getClaimAutoReleaseInfo,
} from '../services/tasksService';
import { ideasService } from '../services/ideasService';
import { listMyShowcaseSubmissions } from '../services/showcaseService';
import UserAvatar from '../components/ui/UserAvatar';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LoadingScreen from '../components/ui/LoadingScreen';
import { publicProfilePath } from '../utils/profileLinks';
import {
  deriveIdeaStatus,
  statusChipClasses,
  statusLabel,
} from '../utils/ideaStatus';
import {
  getIdeaLastViewedMap,
  ideaHasNewActivity,
  formatIdeaActivityHint,
} from '../utils/ideaActivity';
import useIsModerator from '../hooks/useIsModerator';
import {
  ensureUsernameFromSignup,
} from '../utils/ensureUserProfile';
import {
  resolveOAuthReturnState,
} from '../utils/authIdentities';

function showcaseStatusVariant(status) {
  if (status === 'approved') return 'neon';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function showcaseStatusLabel(status) {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending review';
}

/** Equal-height dashboard panels; body scrolls when content overflows. */
const DASH_PANEL =
  'h-[26rem] sm:h-[32rem] flex flex-col overflow-hidden min-h-0';
const DASH_PANEL_BODY =
  'dashboard-panel-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain';

const Dashboard = () => {
  const { isModerator } = useIsModerator();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [quota, setQuota] = useState(null);
  const [claims, setClaims] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [ideaCount, setIdeaCount] = useState(0);
  const [myIdeas, setMyIdeas] = useState([]);
  const [myDrafts, setMyDrafts] = useState([]);
  const [showcaseSubs, setShowcaseSubs] = useState([]);
  const [deletingDraftId, setDeletingDraftId] = useState(null);
  const [error, setError] = useState('');
  const [autoReleaseNotices, setAutoReleaseNotices] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const current = session?.user || null;
      setUser(current);

      if (!current) {
        setProfile(null);
        setQuota(null);
        setClaims([]);
        setJoinRequests([]);
        setIdeaCount(0);
        setMyIdeas([]);
        setMyDrafts([]);
        setShowcaseSubs([]);
        setAutoReleaseNotices([]);
        setLoading(false);
        return;
      }

      // Housekeeping: dual-rule auto-release before loading claims
      try {
        await tasksService.runClaimAutoRelease();
      } catch {
        /* optional migration */
      }

      const [
        profileRes,
        quotaRes,
        claimsRes,
        joinsRes,
        ideasRes,
        draftsRes,
        showcaseRes,
        autoRes,
      ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, username, avatar_url, bio, email')
            .eq('id', current.id)
            .maybeSingle(),
          tasksService.getMyClaimQuota(),
          tasksService.listMyActiveClaims(),
          tasksService.listMyPendingJoinRequests(),
          ideasService.getMyIdeasWithActivity(current.id).catch((err) => {
            console.warn('[Dashboard] getMyIdeasWithActivity', err);
            return [];
          }),
          ideasService.getMyDrafts(current.id).catch((err) => {
            console.warn('[Dashboard] getMyDrafts', err);
            return [];
          }),
          listMyShowcaseSubmissions().catch((err) => {
            console.warn('[Dashboard] listMyShowcaseSubmissions', err);
            return [];
          }),
          tasksService.listMyRecentAutoReleases({ days: 14, limit: 8 }).catch(
            () => []
          ),
        ]);

      // Apply username from email sign-up if still missing (avoid second gate loop)
      let profileRow = profileRes.data || null;
      if (!String(profileRow?.username || '').trim()) {
        profileRow = await ensureUsernameFromSignup(current, profileRow);
      }
      if (profileRes.data !== profileRow) {
        // keep rest of load using updated profile
      }

      const ideasList = ideasRes || [];
      const lastViewed = getIdeaLastViewedMap(current.id);
      const withActivity = ideasList.map((idea) => {
        const lastIso = lastViewed[String(idea.id)] || null;
        const baseline = lastIso
          ? new Date(lastIso).getTime()
          : new Date(idea.created_at || 0).getTime();

        // Count comments from others after last view
        let newCommentCount = 0;
        if (idea.latestCommentAt) {
          const t = new Date(idea.latestCommentAt).getTime();
          if (t > baseline && (idea.commentsByOthers || 0) > 0) {
            // We only know latest time + total-by-others; use total-by-others
            // as a conservative "has new" signal (exact delta needs per-comment filter)
            newCommentCount = idea.commentsByOthers || 0;
          }
        }

        const hasNew = ideaHasNewActivity(idea, lastIso);
        return {
          ...idea,
          hasNewActivity: hasNew,
          newCommentCount: hasNew ? newCommentCount : 0,
          activityHint: formatIdeaActivityHint({
            ...idea,
            hasNewActivity: hasNew,
            newCommentCount: hasNew ? newCommentCount : 0,
          }),
        };
      });

      setProfile(profileRow);
      setQuota(quotaRes?.signedIn ? quotaRes : null);
      setClaims(claimsRes || []);
      setJoinRequests(joinsRes || []);
      setShowcaseSubs(showcaseRes || []);
      setMyIdeas(withActivity);
      setIdeaCount(withActivity.length);
      setMyDrafts(draftsRes || []);

      // Show auto-release notices not yet dismissed
      const notices = autoRes || [];
      try {
        const seen = JSON.parse(
          localStorage.getItem('tf_auto_release_seen') || '[]'
        );
        setAutoReleaseNotices(notices.filter((n) => !seen.includes(n.id)));
      } catch {
        setAutoReleaseNotices(notices);
      }
    } catch (err) {
      console.error('[Dashboard]', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissAutoReleaseNotices = () => {
    setAutoReleaseNotices((prev) => {
      try {
        const seen = JSON.parse(
          localStorage.getItem('tf_auto_release_seen') || '[]'
        );
        const next = [...new Set([...seen, ...prev.map((n) => n.id)])].slice(
          -50
        );
        localStorage.setItem('tf_auto_release_seen', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return [];
    });
  };

  useEffect(() => {
    // Avoid reloading on every token refresh / noise event (OAuth can fire many).
    let cancelled = false;
    const run = () => {
      if (!cancelled) void load();
    };
    run();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED'
      ) {
        run();
      }
    });
    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe?.();
    };
  }, [load]);

  // OAuth return: clean ?sso= params (banner optional; username gate above)
  useEffect(() => {
    try {
      const href = window.location.href;
      if (!/[?&#]sso=|error=|provider=/.test(href)) return;
      const result = resolveOAuthReturnState({
        user,
        href,
        consumeIntent: true,
      });
      if (result.cleanPath) {
        window.history.replaceState({}, '', result.cleanPath);
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  // Deep-link: /dashboard#my-drafts | #my-ideas | #showcase-submissions
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash;
    if (
      hash !== '#my-drafts' &&
      hash !== '#my-ideas' &&
      hash !== '#showcase-submissions'
    ) {
      return;
    }
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, myDrafts.length, myIdeas.length, showcaseSubs.length]);

  const handleDeleteDraft = async (draftId) => {
    if (!user?.id || !draftId) return;
    if (!window.confirm('Delete this draft permanently?')) return;
    setDeletingDraftId(draftId);
    try {
      await ideasService.deleteDraft(draftId, user.id);
      setMyDrafts((list) => list.filter((d) => d.id !== draftId));
    } catch (err) {
      console.error('[Dashboard] delete draft', err);
      setError(err?.message || 'Could not delete draft.');
    } finally {
      setDeletingDraftId(null);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Not signed in: point to login
  if (!loading && !user) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="border-b border-white/10 bg-cyber-surface py-16">
          <div className="container-custom">
            <h1 className="section-header dashboard-page-title !mb-0 !text-3xl sm:!text-5xl !font-bold !tracking-[0.14em]">
              DASHBOARD
            </h1>
          </div>
        </div>
        <div className="container-custom py-16 max-w-xl">
          <Card className="bg-cyber-card/80 text-center py-12 space-y-4">
            <LayoutDashboard className="w-10 h-10 text-neon-cyan mx-auto opacity-80" />
            <h2 className="text-xl font-bold text-white">Sign in required</h2>
            <p className="text-sm text-text-secondary max-w-sm mx-auto">
              Your dashboard is a private workspace for claims, requests, and
              quick actions. Sign in to continue.
            </p>
            <Link
              to="/account"
              className="btn-primary btn-neon inline-flex px-6 py-3 mt-2"
            >
              LOG IN
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  // OAuth / first-time users without a username → Account gate (single username step)
  if (
    !loading &&
    user &&
    !String(profile?.username || '').trim()
  ) {
    return <Navigate to="/account" replace />;
  }

  const publicPath = publicProfilePath(profile?.username);
  // Prefer live list length (Active + PendingReview); fall back to quota
  const activeCount =
    claims.length > 0
      ? claims.length
      : Number(quota?.activeClaims) || 0;
  const inReviewCount = claims.filter((c) => c.inReview).length;
  const workingCount = Math.max(0, activeCount - inReviewCount);
  const completedCount = quota?.completedClaims ?? 0;
  const claimLimit = quota?.claimLimit ?? NEW_USER_CLAIM_LIMIT;
  const slotsLeft = Math.max(0, claimLimit - activeCount);
  const displayName = profile?.username || user?.email || 'Volunteer';
  const pendingShowcase = showcaseSubs.filter((s) => s.status === 'pending');
  const showcasePendingCount = pendingShowcase.length;

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(168,85,247,0.06)_0%,transparent_45%),radial-gradient(ellipse_at_top_right,rgba(0,249,255,0.05)_0%,transparent_40%),radial-gradient(ellipse_at_bottom,rgba(255,0,128,0.04)_0%,transparent_45%)]"
        aria-hidden
      />
      <div className="border-b border-white/10 bg-cyber-surface/90 py-10 sm:py-12 relative">
        <div className="container-custom">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <h1 className="section-header dashboard-page-title text-neon-purple !mb-0 !text-3xl sm:!text-5xl !font-bold !tracking-[0.14em]">
                DASHBOARD
              </h1>
            </div>

            {!loading && user && (
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={profile?.avatar_url}
                  name={displayName}
                  size="md"
                  className="!w-12 !h-12"
                  borderClass="border border-neon-purple/40"
                  alt=""
                />
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">
                    {displayName}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Link
                      to="/account/profile"
                      className="text-xs text-neon-cyan hover:underline"
                    >
                      Account
                    </Link>
                    {publicPath && (
                      <>
                        <span className="text-text-muted text-xs">·</span>
                        <Link
                          to={publicPath}
                          className="text-xs text-neon-magenta hover:underline inline-flex items-center gap-1"
                        >
                          Profile
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container-custom relative z-10 py-10 max-w-7xl space-y-8">
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <LoadingScreen variant="section" message="Loading dashboard…" />
        ) : (
          <>
            {autoReleaseNotices.length > 0 && (
              <div className="rounded-xl border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 flex flex-col sm:flex-row gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs font-mono tracking-widest text-semantic-warning uppercase">
                    Claim auto-released
                  </p>
                  {autoReleaseNotices.map((n) => (
                    <p
                      key={n.id}
                      className="text-sm text-text-secondary leading-snug"
                    >
                      {n.message}
                      {n.taskTitle ? (
                        <span className="text-text-muted">
                          {' '}
                          · {n.taskTitle}
                        </span>
                      ) : null}
                    </p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={dismissAutoReleaseNotices}
                  className="shrink-0 self-start text-xs font-semibold text-semantic-warning hover:text-white border border-semantic-warning/40 rounded-lg px-3 py-1.5"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <Card className="bg-cyber-card text-center py-5 h-full border border-neon-magenta/25 border-t-2 border-t-neon-magenta">
                <ListTodo className="w-5 h-5 text-neon-magenta mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold text-neon-magenta">
                  {activeCount}
                  <span className="text-text-muted text-base font-normal">
                    /{claimLimit}
                  </span>
                </div>
                <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                  Open claims
                </div>
                {(workingCount > 0 || inReviewCount > 0) && (
                  <div className="mt-2 text-[10px] font-mono text-text-muted">
                    {workingCount} working
                    {inReviewCount > 0 ? ` · ${inReviewCount} in review` : ''}
                  </div>
                )}
              </Card>
              <Card className="bg-cyber-card text-center py-5 h-full border border-neon-purple/25 border-t-2 border-t-neon-purple">
                <CheckCircle2 className="w-5 h-5 text-neon-purple mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold text-neon-purple">
                  {completedCount}
                </div>
                <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                  Completed
                </div>
              </Card>
              <Card className="bg-cyber-card text-center py-5 h-full border border-neon-green/25 border-t-2 border-t-neon-green">
                <HandHelping className="w-5 h-5 text-neon-green mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold text-neon-green">
                  {slotsLeft}
                </div>
                <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                  Claim slots left
                </div>
              </Card>
              <a href="#my-ideas" className="block group h-full min-h-0">
                <Card className="bg-cyber-card text-center py-5 h-full border border-neon-cyan/25 border-t-2 border-t-neon-cyan group-hover:border-neon-cyan/50 transition-colors">
                  <Lightbulb className="w-5 h-5 text-neon-cyan mx-auto mb-2" />
                  <div className="text-2xl font-mono font-bold text-neon-cyan">
                    {ideaCount}
                  </div>
                  <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                    Ideas submitted
                  </div>
                  {myIdeas.some((i) => i.hasNewActivity) && (
                    <div className="mt-2 text-[10px] font-mono tracking-widest uppercase text-semantic-achievement">
                      New activity
                    </div>
                  )}
                </Card>
              </a>
            </div>

            {quota && completedCount < TRUSTED_CLAIM_UNLOCK_COMPLETIONS && (
              <p className="text-xs text-text-muted font-mono">
                Progressive trust: {NEW_USER_CLAIM_LIMIT} claim slots to start →{' '}
                {ESTABLISHED_CLAIM_LIMIT} after {CLAIM_LIMIT_UNLOCK_COMPLETIONS}{' '}
                accepted reviews → {MAX_ACTIVE_CLAIMS} after{' '}
                {TRUSTED_CLAIM_UNLOCK_COMPLETIONS}. Limits rise only when work is
                accepted, not merely submitted.
              </p>
            )}
            {quota?.isRestricted && (
              <p className="text-xs text-red-300 font-mono">
                Claim privileges are currently limited
                {quota.restrictedUntil
                  ? ` until ${new Date(quota.restrictedUntil).toLocaleDateString()}`
                  : ''}
                . Message a Project Lead on Discord to appeal.
              </p>
            )}

            {/* Full-width quick actions (avoids empty sidebar column) */}
            <Card className="bg-cyber-card border border-neon-purple/20 border-l-2 border-l-neon-purple">
              <div className="text-sm font-mono tracking-widest text-neon-purple mb-4">
                QUICK ACTIONS
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                <Link
                  to="/projects"
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-magenta hover:text-white transition-colors"
                >
                  <FolderKanban className="w-4 h-4 text-neon-magenta shrink-0" />
                  Browse projects
                </Link>
                <Link
                  to="/ideas"
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-cyan hover:text-white transition-colors"
                >
                  <Lightbulb className="w-4 h-4 text-neon-cyan shrink-0" />
                  Game ideas
                </Link>
                <Link
                  to="/ideas/wizard"
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-cyan hover:text-white transition-colors"
                >
                  <Lightbulb className="w-4 h-4 text-neon-magenta shrink-0" />
                  Idea wizard
                </Link>
                <a
                  href="#my-ideas"
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-cyan hover:text-white transition-colors"
                >
                  <Lightbulb className="w-4 h-4 text-neon-cyan shrink-0" />
                  <span className="flex-1">My ideas</span>
                  {ideaCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-neon-cyan/40 text-neon-cyan">
                      {ideaCount}
                    </span>
                  )}
                </a>
                <a
                  href="#my-drafts"
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-cyan hover:text-white transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-neon-cyan shrink-0" />
                  <span className="flex-1">My idea drafts</span>
                  {myDrafts.length > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-neon-cyan/40 text-neon-cyan">
                      {myDrafts.length}
                    </span>
                  )}
                </a>
                <Link
                  to="/account"
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-cyan hover:text-white transition-colors"
                >
                  <User className="w-4 h-4 text-neon-cyan shrink-0" />
                  Edit profile &amp; bio
                </Link>
                {publicPath ? (
                  <Link
                    to={publicPath}
                    className="flex items-center gap-3 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-neon-cyan hover:border-neon-cyan transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    View profile
                  </Link>
                ) : null}
                <Link
                  to="/get-involved"
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-cyan hover:text-white transition-colors"
                >
                  <HandHelping className="w-4 h-4 text-neon-cyan shrink-0" />
                  Get involved
                </Link>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <Card
                  className={`${DASH_PANEL} bg-cyber-card border border-neon-magenta/20 border-l-2 border-l-neon-magenta`}
                >
                  <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="text-sm font-mono tracking-widest text-neon-magenta flex items-center gap-2">
                      <ListTodo className="w-4 h-4" />
                      ACTIVE TASKS
                      {claims.length > 0 && (
                        <Badge variant="default" className="!normal-case">
                          {claims.length}
                        </Badge>
                      )}
                    </div>
                    <Link
                      to="/projects"
                      className="text-xs text-neon-magenta hover:underline"
                    >
                      Browse projects
                    </Link>
                  </div>
                  <div className={DASH_PANEL_BODY}>
                  <p className="text-[11px] text-text-muted mb-3">
                    Open claims: work in progress and submissions waiting for
                    review (both use a claim slot). {CLAIM_AUTO_RELEASE_POLICY_COPY}
                  </p>

                  {claims.length === 0 ? (
                    <div className="text-sm text-text-secondary py-6 text-center border border-dashed border-neon-magenta/25 rounded-lg bg-neon-magenta/5">
                      <p className="mb-3">No open claims yet.</p>
                      <Link
                        to="/projects"
                        className="btn-neon text-xs px-4 py-2 inline-flex"
                      >
                        FIND WORK
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {claims.map((c) => {
                        const releaseInfo = c.inReview
                          ? null
                          : getClaimAutoReleaseInfo({
                              status: 'Active',
                              claimedAt: c.claimedAt,
                              lastActivityAt: c.lastActivityAt,
                            });
                        return (
                        <li
                          key={c.claimId}
                          className={`rounded-lg border bg-cyber-surface/60 p-4 transition-colors ${
                            c.inReview
                              ? 'border-semantic-warning/40 hover:border-semantic-warning/60'
                              : 'border-white/10 hover:border-neon-magenta/40'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  to={
                                    c.boardPath ||
                                    (c.projectPath
                                      ? `/projects/${c.projectPath}`
                                      : '/projects')
                                  }
                                  className="font-semibold text-white hover:text-neon-magenta transition-colors"
                                >
                                  {c.taskTitle}
                                </Link>
                                {c.inReview ? (
                                  <Badge
                                    variant="warning"
                                    className="!normal-case tracking-wide"
                                  >
                                    Ready for review
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="purple"
                                    className="!normal-case tracking-wide"
                                  >
                                    In progress
                                  </Badge>
                                )}
                                {releaseInfo?.warn && (
                                  <Badge
                                    variant="warning"
                                    className="!normal-case tracking-wide"
                                    title={releaseInfo.detailLabel}
                                  >
                                    {releaseInfo.shortLabel || 'Needs attention'}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-neon-purple/90">
                                  {c.projectTitle}
                                </span>
                                {c.heldLabel && (
                                  <>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {c.heldLabel}
                                    </span>
                                  </>
                                )}
                                {c.category && (
                                  <Badge className="!normal-case">
                                    {c.category}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-3 max-w-xs">
                                <div className="flex justify-between text-[10px] font-mono text-text-muted mb-1">
                                  <span>
                                    {c.inReview ? 'Submitted' : 'Progress'}
                                  </span>
                                  <span
                                    className={
                                      c.inReview
                                        ? 'text-semantic-warning'
                                        : 'text-neon-magenta'
                                    }
                                  >
                                    {Math.min(100, Math.max(0, c.progressPercent))}
                                    %
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      c.inReview
                                        ? 'bg-semantic-warning'
                                        : 'bg-neon-magenta/90'
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, c.progressPercent))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            {(c.boardPath || c.projectPath) && (
                              <Link
                                to={
                                  c.boardPath ||
                                  `/projects/${c.projectPath}`
                                }
                                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border self-start ${
                                  c.inReview
                                    ? 'border-semantic-warning/50 text-semantic-warning hover:bg-semantic-warning/10'
                                    : 'border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/10'
                                }`}
                              >
                                {c.inReview ? 'Open board' : 'Continue work'}
                              </Link>
                            )}
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                  </div>
                </Card>

                <Card
                  className={`${DASH_PANEL} bg-cyber-card border border-neon-green/20 border-l-2 border-l-neon-green`}
                >
                  <div className="shrink-0 text-sm font-mono tracking-widest text-neon-green flex items-center gap-2 mb-3">
                    <HandHelping className="w-4 h-4" />
                    PENDING JOIN REQUESTS
                  </div>

                  <div className={DASH_PANEL_BODY}>
                  {joinRequests.length === 0 ? (
                    <p className="text-sm text-text-muted py-2">
                      No pending requests to join other people&apos;s claims.
                      Request to join from a task card when a claim is already
                      taken.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {joinRequests.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-lg border border-white/10 bg-cyber-surface/50 p-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <div className="font-medium text-white">
                                {r.taskTitle}
                              </div>
                              <div className="text-xs text-text-muted mt-0.5">
                                {r.projectTitle}
                                {r.createdAt && (
                                  <>
                                    {' '}
                                    · requested{' '}
                                    {new Date(r.createdAt).toLocaleDateString()}
                                  </>
                                )}
                              </div>
                              {r.message && (
                                <p className="text-xs text-text-secondary mt-2 italic">
                                  “{r.message}”
                                </p>
                              )}
                            </div>
                            <Badge variant="neon">Pending</Badge>
                          </div>
                          {r.projectPath && (
                            <Link
                              to={`/projects/${r.projectPath}`}
                              className="text-xs text-neon-cyan hover:underline mt-2 inline-block"
                            >
                              View project →
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  </div>
                </Card>

                {/* Showcase submissions status */}
                <Card
                  id="showcase-submissions"
                  className={`${DASH_PANEL} bg-cyber-card border border-semantic-achievement/20 border-l-2 border-l-semantic-achievement scroll-mt-24`}
                >
                  <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="text-sm font-mono tracking-widest text-semantic-achievement flex items-center gap-2">
                      <Film className="w-4 h-4" />
                      SHOWCASE SUBMISSIONS
                      {showcasePendingCount > 0 && (
                        <Badge variant="warning">
                          {showcasePendingCount} pending
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <Link
                        to="/showcase/submit"
                        className="text-neon-cyan hover:underline"
                      >
                        Submit content
                      </Link>
                      <Link
                        to="/showcase"
                        className="text-text-muted hover:text-neon-cyan"
                      >
                        View Showcase
                      </Link>
                      {isModerator && (
                        <Link
                          to="/showcase/moderate"
                          className="text-forge-gold hover:underline"
                        >
                          Moderate queue
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className={DASH_PANEL_BODY}>
                  {showcaseSubs.length === 0 ? (
                    <div className="text-sm text-text-secondary py-4 text-center border border-dashed border-white/10 rounded-lg">
                      <p className="mb-2">
                        No Showcase submissions yet. Share a clip, stream, or
                        art for community review.
                      </p>
                      <p className="text-xs text-text-muted mb-3">
                        Sign in when you submit so status shows up here.
                      </p>
                      <Link
                        to="/showcase/submit"
                        className="btn-neon text-xs px-4 py-2 inline-flex"
                      >
                        SUBMIT CONTENT
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {showcaseSubs.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-lg border border-white/10 bg-cyber-surface/50 p-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-white truncate">
                                {s.title}
                              </div>
                              <div className="text-xs text-text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="capitalize">{s.type}</span>
                                {s.createdAt && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      Submitted{' '}
                                      {new Date(
                                        s.createdAt
                                      ).toLocaleDateString()}
                                    </span>
                                  </>
                                )}
                              </div>
                              {s.status === 'pending' && (
                                <p className="text-xs text-text-secondary mt-2">
                                  In the moderation queue. This usually takes a
                                  few days.
                                </p>
                              )}
                              {s.status === 'approved' && (
                                <p className="text-xs text-neon-cyan mt-2">
                                  Live on the Showcase
                                  {s.isFeatured ? ' · Featured' : ''}.
                                </p>
                              )}
                              {s.status === 'rejected' && (
                                <p className="text-xs text-text-secondary mt-2">
                                  Not approved
                                  {s.moderatorNote
                                    ? `: ${s.moderatorNote}`
                                    : '.'}{' '}
                                  You can submit a revised version anytime.
                                </p>
                              )}
                            </div>
                            <Badge variant={showcaseStatusVariant(s.status)}>
                              {showcaseStatusLabel(s.status)}
                            </Badge>
                          </div>
                          {s.status === 'approved' && (
                            <Link
                              to="/showcase"
                              className="text-xs text-neon-cyan hover:underline mt-2 inline-block"
                            >
                              Open Showcase →
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  </div>
                </Card>

                {/* My submitted ideas */}
                <Card
                  id="my-ideas"
                  className={`${DASH_PANEL} bg-cyber-card border border-neon-cyan/20 border-l-2 border-l-neon-cyan scroll-mt-24`}
                >
                  <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="text-sm font-mono tracking-widest text-neon-cyan flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      MY IDEAS
                      <Badge variant="default">{ideaCount}</Badge>
                      {myIdeas.filter((i) => i.hasNewActivity).length > 0 && (
                        <Badge
                          variant="gold"
                          className="!normal-case tracking-wide"
                        >
                          {
                            myIdeas.filter((i) => i.hasNewActivity).length
                          }{' '}
                          with activity
                        </Badge>
                      )}
                    </div>
                    <Link
                      to="/ideas/submit"
                      className="text-xs text-neon-cyan hover:underline font-mono tracking-widest"
                    >
                      + New idea
                    </Link>
                  </div>

                  <div className={DASH_PANEL_BODY}>
                  {myIdeas.length === 0 ? (
                    <div className="text-sm text-text-secondary py-6 text-center border border-dashed border-white/10 rounded-lg">
                      <p className="mb-3">You have not submitted any ideas yet.</p>
                      <Link
                        to="/ideas/submit"
                        className="btn-neon text-xs px-4 py-2 inline-flex"
                      >
                        SUBMIT AN IDEA
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                        {myIdeas.map((idea) => {
                          const chip = deriveIdeaStatus(idea);
                          const submitted = idea.created_at
                            ? new Date(idea.created_at).toLocaleDateString()
                            : null;
                          return (
                            <li
                              key={idea.id}
                              className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
                                idea.hasNewActivity
                                  ? 'border-forge-gold/40 bg-forge-gold/5'
                                  : 'border-white/10 bg-cyber-surface/50 hover:border-neon-cyan/30'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  {idea.hasNewActivity && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono tracking-widest uppercase text-forge-gold">
                                      <Sparkles className="w-3 h-3" />
                                      New activity
                                    </span>
                                  )}
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wide border ${statusChipClasses(
                                      chip
                                    )}`}
                                  >
                                    {statusLabel(chip)}
                                  </span>
                                  {idea.category && (
                                    <span className="text-[10px] font-mono text-text-muted">
                                      {idea.category}
                                    </span>
                                  )}
                                </div>
                                <Link
                                  to={`/ideas/${idea.id}`}
                                  className="font-semibold text-white hover:text-neon-cyan transition-colors block truncate"
                                >
                                  {idea.title || 'Untitled idea'}
                                </Link>
                                <div className="text-xs text-text-muted mt-1 flex flex-wrap gap-x-2 gap-y-1">
                                  {submitted && (
                                    <span>Submitted {submitted}</span>
                                  )}
                                  {(idea.commentCount || 0) > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                      <MessageCircle className="w-3 h-3" />
                                      {idea.commentCount} comment
                                      {idea.commentCount === 1 ? '' : 's'}
                                    </span>
                                  )}
                                  {(idea.votes || 0) > 0 && (
                                    <span>{idea.votes} votes</span>
                                  )}
                                </div>
                                {idea.activityHint && (
                                  <p className="text-xs text-forge-gold mt-1.5">
                                    {idea.activityHint}
                                  </p>
                                )}
                                {idea.summary && (
                                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                                    {idea.summary}
                                  </p>
                                )}
                              </div>
                              <Link
                                to={`/ideas/${idea.id}`}
                                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-neon-cyan/40 text-neon-cyan text-xs font-mono tracking-widest uppercase hover:bg-neon-cyan/10 transition-colors self-start sm:self-center"
                              >
                                Open idea
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                  </div>
                </Card>

                {/* Private idea drafts */}
                <Card
                  id="my-drafts"
                  className={`${DASH_PANEL} bg-cyber-card border border-neon-purple/20 border-l-2 border-l-neon-purple scroll-mt-24`}
                >
                  <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="text-sm font-mono tracking-widest text-neon-purple flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      MY DRAFTS
                      {myDrafts.length > 0 && (
                        <Badge variant="default">{myDrafts.length}</Badge>
                      )}
                    </div>
                    <Link
                      to="/ideas/submit"
                      className="text-xs text-neon-cyan hover:underline font-mono tracking-widest"
                    >
                      + New idea
                    </Link>
                  </div>

                  <div className={DASH_PANEL_BODY}>
                  {myDrafts.length === 0 ? (
                    <p className="text-sm text-text-secondary">
                      No idea drafts yet. While creating an idea, choose{' '}
                      <span className="text-neon-cyan font-mono text-xs">
                        Save as Draft
                      </span>{' '}
                      to continue later from here.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {myDrafts.map((d) => (
                        <li
                          key={d.id}
                          className="rounded-lg border border-white/10 bg-cyber-surface/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">
                              {d.title || 'Untitled draft'}
                            </div>
                            <div className="text-xs text-text-muted mt-1 flex flex-wrap gap-x-2 gap-y-1">
                              {d.category && <span>{d.category}</span>}
                              {(d.updated_at || d.created_at) && (
                                <span>
                                  Saved{' '}
                                  {new Date(
                                    d.updated_at || d.created_at
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {d.summary && (
                              <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                                {d.summary}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <Link
                              to={`/ideas/submit?draft=${d.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neon-cyan/40 text-neon-cyan text-xs font-mono tracking-widest uppercase hover:bg-neon-cyan/10 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Continue
                            </Link>
                            <Link
                              to={`/ideas/wizard?draft=${d.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyber-border text-text-muted text-xs font-mono tracking-widest uppercase hover:border-neon-purple hover:text-neon-purple transition-colors"
                            >
                              Wizard
                            </Link>
                            <button
                              type="button"
                              disabled={deletingDraftId === d.id}
                              onClick={() => handleDeleteDraft(d.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400/30 text-red-300 text-xs font-mono tracking-widest uppercase hover:bg-red-400/10 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {deletingDraftId === d.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  </div>
                </Card>

                {/* Lightweight activity / notices placeholder */}
                <Card
                  className={`${DASH_PANEL} bg-cyber-card border border-semantic-warning/25 border-l-2 border-l-semantic-warning`}
                >
                  <div className="shrink-0 text-sm font-mono tracking-widest text-semantic-warning mb-3">
                    NOTICES
                  </div>
                  <div className={DASH_PANEL_BODY}>
                  <p className="text-sm text-text-secondary">
                    Claim cooldowns, join approvals, and project updates will
                    surface here. For now, check active tasks and join requests
                    above.
                  </p>
                  {quota?.cooldownEndsAt &&
                    new Date(quota.cooldownEndsAt).getTime() > Date.now() && (
                      <p className="text-xs text-amber-300/90 mt-3 font-mono">
                        Claim cooldown until{' '}
                        {new Date(quota.cooldownEndsAt).toLocaleTimeString()}.
                      </p>
                    )}
                  </div>
                </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
