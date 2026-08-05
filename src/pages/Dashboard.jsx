/**
 * Private workspace hub at /dashboard.
 * Active claims, join requests, personal stats, quick actions.
 * Public identity lives on /profile (edit) and /u/:username (public).
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  CLAIM_LIMIT_UNLOCK_COMPLETIONS,
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
        setLoading(false);
        return;
      }

      const [
        profileRes,
        quotaRes,
        claimsRes,
        joinsRes,
        ideasRes,
        draftsRes,
        showcaseRes,
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
        ]);

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

      setProfile(profileRes.data || null);
      setQuota(quotaRes?.signedIn ? quotaRes : null);
      setClaims(claimsRes || []);
      setJoinRequests(joinsRes || []);
      setShowcaseSubs(showcaseRes || []);
      setMyIdeas(withActivity);
      setIdeaCount(withActivity.length);
      setMyDrafts(draftsRes || []);
    } catch (err) {
      console.error('[Dashboard]', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => listener.subscription.unsubscribe();
  }, [load]);

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

  // Not signed in: point to login on Profile
  if (!loading && !user) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="border-b border-white/10 bg-cyber-surface py-16">
          <div className="container-custom">
            <div className="section-header">DASHBOARD</div>
            <h1 className="text-5xl font-bold tracking-tight text-white">
              My Dashboard
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
              to="/profile"
              className="btn-primary btn-neon inline-flex px-6 py-3 mt-2"
            >
              LOG IN
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const publicPath = publicProfilePath(profile?.username);
  const activeCount = quota?.activeClaims ?? claims.length;
  const completedCount = quota?.completedClaims ?? 0;
  const claimLimit = quota?.claimLimit ?? NEW_USER_CLAIM_LIMIT;
  const slotsLeft = Math.max(0, claimLimit - activeCount);
  const displayName = profile?.username || user?.email || 'Volunteer';
  const pendingShowcase = showcaseSubs.filter((s) => s.status === 'pending');
  const showcasePendingCount = pendingShowcase.length;

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg">
      <div className="border-b border-white/10 bg-cyber-surface py-12 sm:py-16">
        <div className="container-custom">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <div className="section-header">DASHBOARD</div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                My Dashboard
              </h1>
              <p className="text-text-secondary mt-2 text-sm max-w-xl">
                Private workspace: active work, requests, and shortcuts. Your
                public-facing identity lives on Profile.
              </p>
            </div>

            {!loading && user && (
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={profile?.avatar_url}
                  name={displayName}
                  size="md"
                  className="!w-12 !h-12"
                  borderClass="border border-white/20"
                  alt=""
                />
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">
                    {displayName}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Link
                      to="/profile"
                      className="text-xs text-neon-cyan hover:underline"
                    >
                      Edit profile
                    </Link>
                    {publicPath && (
                      <>
                        <span className="text-text-muted text-xs">·</span>
                        <Link
                          to={publicPath}
                          className="text-xs text-neon-cyan hover:underline inline-flex items-center gap-1"
                        >
                          Public profile
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

      <div className="container-custom py-10 max-w-6xl space-y-8">
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
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-cyber-card/80 text-center py-5">
                <ListTodo className="w-5 h-5 text-neon-magenta mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold text-white">
                  {activeCount}
                  <span className="text-text-muted text-base font-normal">
                    /{claimLimit}
                  </span>
                </div>
                <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                  Active claims
                </div>
              </Card>
              <Card className="bg-cyber-card/80 text-center py-5">
                <CheckCircle2 className="w-5 h-5 text-neon-purple mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold text-white">
                  {completedCount}
                </div>
                <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                  Completed
                </div>
              </Card>
              <Card className="bg-cyber-card/80 text-center py-5">
                <HandHelping className="w-5 h-5 text-neon-cyan mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold text-white">
                  {slotsLeft}
                </div>
                <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                  Claim slots left
                </div>
              </Card>
              <a href="#my-ideas" className="block group">
                <Card className="bg-cyber-card/80 text-center py-5 group-hover:border-neon-cyan/40 transition-colors">
                  <Lightbulb className="w-5 h-5 text-neon-cyan mx-auto mb-2" />
                  <div className="text-2xl font-mono font-bold text-neon-cyan">
                    {ideaCount}
                  </div>
                  <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                    Ideas submitted
                  </div>
                  {myIdeas.some((i) => i.hasNewActivity) && (
                    <div className="mt-2 text-[10px] font-mono tracking-widest uppercase text-forge-gold">
                      New activity
                    </div>
                  )}
                </Card>
              </a>
            </div>

            {quota && completedCount < CLAIM_LIMIT_UNLOCK_COMPLETIONS && (
              <p className="text-xs text-text-muted font-mono">
                New volunteers start with {NEW_USER_CLAIM_LIMIT} claim slots.
                Complete {CLAIM_LIMIT_UNLOCK_COMPLETIONS} tasks to unlock up to{' '}
                {MAX_ACTIVE_CLAIMS}.
              </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main: claims + join requests */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="bg-cyber-card/80">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-mono tracking-widest text-neon-cyan flex items-center gap-2">
                      <ListTodo className="w-4 h-4" />
                      ACTIVE TASKS
                    </div>
                    <Link
                      to="/projects"
                      className="text-xs text-neon-cyan hover:underline"
                    >
                      Browse projects
                    </Link>
                  </div>

                  {claims.length === 0 ? (
                    <div className="text-sm text-text-secondary py-6 text-center border border-dashed border-white/10 rounded-lg">
                      <p className="mb-3">No active claims yet.</p>
                      <Link
                        to="/projects"
                        className="btn-neon text-xs px-4 py-2 inline-flex"
                      >
                        FIND WORK
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {claims.map((c) => (
                        <li
                          key={c.claimId}
                          className="rounded-lg border border-white/10 bg-cyber-surface/50 p-4 hover:border-neon-cyan/40 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                to={
                                  c.projectPath
                                    ? `/projects/${c.projectPath}`
                                    : '/projects'
                                }
                                className="font-semibold text-white hover:text-neon-cyan transition-colors"
                              >
                                {c.taskTitle}
                              </Link>
                              <div className="text-xs text-text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span>{c.projectTitle}</span>
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
                                  <Badge>{c.category}</Badge>
                                )}
                              </div>
                              <div className="mt-3 max-w-xs">
                                <div className="flex justify-between text-[10px] font-mono text-text-muted mb-1">
                                  <span>Progress</span>
                                  <span>{c.progressPercent}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full bg-neon-cyan/80 rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(100, Math.max(0, c.progressPercent))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            {c.projectPath && (
                              <Link
                                to={`/projects/${c.projectPath}`}
                                className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-white/20 hover:border-neon-cyan text-neon-cyan self-start"
                              >
                                Open workspace
                              </Link>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card className="bg-cyber-card/80">
                  <div className="text-sm font-mono tracking-widest text-neon-cyan flex items-center gap-2 mb-4">
                    <HandHelping className="w-4 h-4" />
                    PENDING JOIN REQUESTS
                  </div>

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
                </Card>

                {/* Showcase submissions status */}
                <Card
                  id="showcase-submissions"
                  className="bg-cyber-card/80 scroll-mt-24"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="text-sm font-mono tracking-widest text-neon-cyan flex items-center gap-2">
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
                </Card>

                {/* My submitted ideas */}
                <Card id="my-ideas" className="bg-cyber-card/80 scroll-mt-24">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
                    <div className="relative">
                      <ul className="task-scroll space-y-3 max-h-[28rem] overflow-y-auto overscroll-contain">
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
                      {/* Themed scroll hint: fade edge instead of native scrollbar */}
                      {myIdeas.length > 3 && (
                        <div
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-cyber-card via-cyber-card/80 to-transparent flex items-end justify-center pb-1"
                          aria-hidden="true"
                        >
                          <span className="text-[10px] font-mono tracking-widest uppercase text-neon-cyan/60">
                            Scroll for more
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* Private idea drafts */}
                <Card
                  id="my-drafts"
                  className="bg-cyber-card/80 scroll-mt-24"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="text-sm font-mono tracking-widest text-neon-cyan flex items-center gap-2">
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
                </Card>

                {/* Lightweight activity / notices placeholder */}
                <Card className="bg-cyber-card/80">
                  <div className="text-sm font-mono tracking-widest text-neon-cyan mb-3">
                    NOTICES
                  </div>
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
                </Card>
              </div>

              {/* Sidebar: quick actions */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="bg-cyber-card/80">
                  <div className="text-sm font-mono tracking-widest text-neon-cyan mb-4">
                    QUICK ACTIONS
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      to="/projects"
                      className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-cyan hover:text-white transition-colors"
                    >
                      <FolderKanban className="w-4 h-4 text-neon-cyan shrink-0" />
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
                      to="/profile"
                      className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-cyan hover:text-white transition-colors"
                    >
                      <User className="w-4 h-4 text-neon-cyan shrink-0" />
                      Edit profile &amp; bio
                    </Link>
                    {publicPath && (
                      <Link
                        to={publicPath}
                        className="flex items-center gap-3 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-neon-cyan hover:border-neon-cyan transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 shrink-0" />
                        View public profile
                      </Link>
                    )}
                    <Link
                      to="/get-involved"
                      className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-text-secondary hover:border-neon-cyan hover:text-white transition-colors"
                    >
                      <HandHelping className="w-4 h-4 text-neon-cyan shrink-0" />
                      Get involved
                    </Link>
                  </div>
                </Card>

                <Card className="bg-cyber-card/80">
                  <div className="text-sm font-mono tracking-widest text-neon-cyan mb-3">
                    ABOUT THIS PAGE
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    <strong className="text-white">Dashboard</strong> is private
                    (only you).{' '}
                    <strong className="text-white">Profile</strong> is where you
                    edit how you appear and manage account details.{' '}
                    <strong className="text-white">Public profile</strong> (
                    <code className="text-neon-cyan">/u/username</code>) is what
                    others see.
                  </p>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
