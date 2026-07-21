/**
 * Private workspace hub at /dashboard.
 * Active claims, join requests, personal stats, quick actions.
 * Public identity lives on /profile (edit) and /u/:username (public).
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
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
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import tasksService, {
  NEW_USER_CLAIM_LIMIT,
  MAX_ACTIVE_CLAIMS,
  CLAIM_LIMIT_UNLOCK_COMPLETIONS,
} from '../services/tasksService';
import UserAvatar from '../components/ui/UserAvatar';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { publicProfilePath } from '../utils/profileLinks';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [quota, setQuota] = useState(null);
  const [claims, setClaims] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [ideaCount, setIdeaCount] = useState(0);
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
        setLoading(false);
        return;
      }

      const [profileRes, quotaRes, claimsRes, joinsRes, ideasRes] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, username, avatar_url, bio, email')
            .eq('id', current.id)
            .maybeSingle(),
          tasksService.getMyClaimQuota(),
          tasksService.listMyActiveClaims(),
          tasksService.listMyPendingJoinRequests(),
          supabase
            .from('ideas')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', current.id),
        ]);

      setProfile(profileRes.data || null);
      setQuota(quotaRes?.signedIn ? quotaRes : null);
      setClaims(claimsRes || []);
      setJoinRequests(joinsRes || []);
      setIdeaCount(ideasRes.count ?? 0);
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Not signed in: point to login on Profile
  if (!loading && !user) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="border-b border-white/10 bg-cyber-surface py-16">
          <div className="container-custom">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />{' '}
              BACK TO HOME
            </Link>
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

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg">
      <div className="border-b border-white/10 bg-cyber-surface py-12 sm:py-16">
        <div className="container-custom">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />{' '}
            BACK TO HOME
          </Link>

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
          <div className="cyber-card p-12 flex flex-col items-center justify-center min-h-[200px]">
            <div className="w-8 h-8 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-text-muted text-sm">Loading dashboard…</p>
          </div>
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
              <Card className="bg-cyber-card/80 text-center py-5">
                <Lightbulb className="w-5 h-5 text-neon-cyan mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold text-neon-cyan">
                  {ideaCount}
                </div>
                <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                  Ideas submitted
                </div>
              </Card>
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
