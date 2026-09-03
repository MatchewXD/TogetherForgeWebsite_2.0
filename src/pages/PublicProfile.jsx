/**
 * Profile page at /u/:username (and /profile/:username).
 * Contribution credit surface: ideas, completed tasks, official media, support.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Lightbulb,
  CheckCircle2,
  ListTodo,
  Calendar,
  Copy,
  Check,
  Heart,
  Hammer,
  Award,
  Film,
  Hexagon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { supabase } from '../lib/supabase';
import UserAvatar from '../components/ui/UserAvatar';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LoadingScreen from '../components/ui/LoadingScreen';
import { bannerObjectPosition } from '../utils/bannerPosition';
import {
  DiscordIcon,
  XIcon,
  GithubIcon,
  YoutubeIcon,
  TwitchIcon,
  SOCIAL_BRAND,
} from '../components/profile/BrandSocialIcon';
import {
  normalizeGithubHref,
  normalizeYoutubeHref,
  normalizeTwitchHref,
  normalizeXHref,
  formatYoutubeLabel,
  formatTwitchLabel,
  formatCentsUsd,
} from '../utils/socialLinks';
import { displayProjectTitle } from '../utils/ideaStatus';
import {
  fetchPublicProfileByUsername,
  fetchOwnProfileShell,
} from '../utils/publicProfileLookup';
import { badgesService } from '../services/badgesService';
import { sortBadgesByCatalog } from '../constants/badges';
import BadgeIcon from '../components/badges/BadgeIcon';
import {
  listUserOfficialMediaCredits,
  listUserStaffCredits,
} from '../services/contributorsService';
import { STAFF_CREDIT_SOURCE_LABEL } from '../constants/staffCredit';
import { fetchPublicForgeMarksProfile } from '../services/forgeMarksService';
import {
  formatForgeMarks,
  resolveForgeAwardTier,
  sortAwardTotalsByTier,
} from '../utils/forgeMarks';
import ForgeMarksHoverHint from '../components/awards/ForgeMarksHoverHint';
import { AwardTierIcon } from '../components/awards/awardIcons';
import ReportContentButton from '../components/conduct/ReportContentButton';
import OpenConductCaseButton from '../components/conduct/OpenConductCaseButton';
import useIsModerator from '../hooks/useIsModerator';

const chip = (text) =>
  (text || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/** Fixed-height scroll panels for contribution lists */
const scrollCardBody =
  'task-scroll max-h-56 overflow-y-auto overscroll-contain pr-1 space-y-0 divide-y divide-cyber-border';

const sectionTone = {
  cyan: 'text-neon-cyan',
  purple: 'text-neon-purple',
  magenta: 'text-neon-magenta',
  gold: 'text-semantic-achievement',
  green: 'text-neon-green',
};

function SectionLabel({ children, tone = 'cyan' }) {
  return (
    <div
      className={`font-mono tracking-widest text-xs mb-3 ${sectionTone[tone] || sectionTone.cyan}`}
    >
      {children}
    </div>
  );
}

function mapClaimRow(row) {
  const task = row.tasks || row.task || null;
  const project = task?.projects || task?.project || null;
  const title = task?.title || 'Task';
  const projectTitle = project
    ? displayProjectTitle({
        slug: project.slug,
        title: project.title,
      })
    : null;
  const projectSlug = project?.slug || null;
  return {
    id: row.id,
    title,
    projectTitle,
    projectSlug,
    status: row.status,
    taskId: task?.id || row.task_id,
  };
}

const PublicProfile = () => {
  const { username: rawUsername } = useParams();
  const username = rawUsername ? decodeURIComponent(rawUsername) : '';

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    ideas: 0,
    tasksCompleted: 0,
    tasksActive: 0,
  });
  const [recentIdeas, setRecentIdeas] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [activeClaims, setActiveClaims] = useState([]);
  const [support, setSupport] = useState(null);
  const [officialMediaCredits, setOfficialMediaCredits] = useState([]);
  const [forgeMarks, setForgeMarks] = useState(null);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [pinnedBadgeKey, setPinnedBadgeKey] = useState(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const { isModerator } = useIsModerator();
  const [viewerId, setViewerId] = useState(null);
  const [viewerShell, setViewerShell] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [discordCopied, setDiscordCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setViewerId(session?.user?.id || null);
    });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [username]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotFound(false);
      setUnavailable(false);
      setLoadError(null);

      const { data, error } = await fetchPublicProfileByUsername(username);

      if (!mounted) return;

      if (error || !data) {
        setNotFound(true);
        setProfile(null);
        setOfficialMediaCredits([]);
        setForgeMarks(null);
        setLoadError(error?.message || null);
        // Help the signed-in viewer understand their own account state
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (uid) {
          const shell = await fetchOwnProfileShell(uid);
          if (mounted) setViewerShell(shell);
        } else if (mounted) {
          setViewerShell(null);
        }
        setLoading(false);
        return;
      }

      if (data.moderation_status === 'banned') {
        setUnavailable(true);
        setNotFound(false);
        setProfile(null);
        setOfficialMediaCredits([]);
        setForgeMarks(null);
        setLoading(false);
        return;
      }
      setUnavailable(false);

      const {
        moderation_status: _ms,
        moderation_note: _mn,
        email: _e,
        ...publicRow
      } = data;
      setProfile(publicRow);
      setViewerShell(null);

      const claimsSelect = `
        id, status, task_id,
        tasks:task_id (
          id, title, project_id,
          projects:project_id ( title, slug )
        )
      `;

      const [
        ideasRes,
        completedCountRes,
        activeCountRes,
        ideasListRes,
        completedListRes,
        activeListRes,
        supportRes,
        officialMediaRes,
        forgeMarksRes,
        staffCreditsRes,
      ] = await Promise.all([
        supabase
          .from('ideas')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', data.id),
        supabase
          .from('task_claims')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', data.id)
          .eq('status', 'Completed'),
        supabase
          .from('task_claims')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', data.id)
          .in('status', ['Active', 'PendingReview']),
        supabase
          .from('ideas')
          .select('id, title, votes, created_at, status')
          .eq('user_id', data.id)
          .order('votes', { ascending: false })
          .limit(30),
        supabase
          .from('task_claims')
          .select(claimsSelect)
          .eq('user_id', data.id)
          .eq('status', 'Completed')
          .order('reviewed_at', { ascending: false, nullsFirst: false })
          .limit(40),
        supabase
          .from('task_claims')
          .select(claimsSelect)
          .eq('user_id', data.id)
          .in('status', ['Active', 'PendingReview'])
          .order('claimed_at', { ascending: false })
          .limit(40),
        supabase.rpc('get_public_profile_support', {
          p_user_id: data.id,
        }),
        listUserOfficialMediaCredits(data.id),
        fetchPublicForgeMarksProfile(data.id).catch(() => null),
        listUserStaffCredits(data.id),
      ]);

      if (!mounted) return;

      setStats({
        ideas: ideasRes.count ?? 0,
        tasksCompleted: completedCountRes.count ?? 0,
        tasksActive: activeCountRes.count ?? 0,
      });

      const ideas = ideasListRes.data || [];
      // Ensure most-voted first (DB order may fail if votes null)
      ideas.sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0));
      setRecentIdeas(ideas);

      const taskCredits = !completedListRes.error && completedListRes.data
        ? completedListRes.data.map((row) => ({
            ...mapClaimRow(row),
            kind: 'task',
          }))
        : [];
      const staffCredits = Array.isArray(staffCreditsRes)
        ? staffCreditsRes
        : [];
      setCompletedTasks([...taskCredits, ...staffCredits]);

      if (!activeListRes.error && activeListRes.data) {
        setActiveClaims(activeListRes.data.map(mapClaimRow));
      } else {
        setActiveClaims([]);
      }

      if (!supportRes.error && supportRes.data) {
        const s = supportRes.data;
        setSupport({
          isSupporter: Boolean(s.is_supporter),
          showTotal: Boolean(s.show_total),
          totalCents:
            s.total_cents == null ? null : Number(s.total_cents) || 0,
          donationCount: Number(s.donation_count) || 0,
          projects: Array.isArray(s.projects)
            ? s.projects.map((p) => ({
                label: p.label || 'Together Forge',
                projectSlug: p.project_slug || null,
              }))
            : [],
        });
      } else {
        setSupport(null);
      }

      setOfficialMediaCredits(
        Array.isArray(officialMediaRes) ? officialMediaRes : []
      );
      setForgeMarks(forgeMarksRes && !forgeMarksRes.missing ? forgeMarksRes : null);

      // Badges: owner soft-sync then load collection
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id === data.id) {
          await badgesService.syncMyBadges();
        }
      } catch {
        /* optional */
      }
      const badgePack = await badgesService.getPublicUserBadges(data.id);
      if (!mounted) return;
      setEarnedBadges(sortBadgesByCatalog(badgePack.badges || []));
      setPinnedBadgeKey(badgePack.pinnedBadgeKey || null);

      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [username]);

  const copyDiscord = async () => {
    if (!profile?.discord) return;
    try {
      await navigator.clipboard.writeText(String(profile.discord).trim());
      setDiscordCopied(true);
      window.setTimeout(() => setDiscordCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handlePinBadge = async (key) => {
    if (!viewerId || !profile?.id || viewerId !== profile.id || pinBusy) return;
    setPinBusy(true);
    try {
      const next = pinnedBadgeKey === key ? null : key;
      await badgesService.setPinnedBadge(next);
      setPinnedBadgeKey(next);
    } catch (e) {
      console.warn('[PublicProfile] pin badge', e?.message || e);
    } finally {
      setPinBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg">
        <LoadingScreen variant="section" message="Loading profile…" />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg">
        <div className="container-custom py-12 max-w-3xl">
          <Card className="bg-cyber-card/80 text-center py-12 px-6 space-y-3">
            <h1 className="text-2xl font-bold text-white">
              This profile is unavailable
            </h1>
            <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
              This account is not listed right now.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    const ownName = (viewerShell?.username || '').trim();
    const lookingFor = (username || '').trim();
    const ownMatches =
      ownName && lookingFor && ownName.toLowerCase() === lookingFor.toLowerCase();

    return (
      <div className="pt-20 min-h-screen bg-cyber-bg">
        <div className="container-custom py-12 max-w-3xl">
          <Card className="bg-cyber-card/80 text-center py-12 px-6 space-y-4">
            <h1 className="text-2xl font-bold text-white">
              Profile not found
            </h1>
            <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
              No public profile for{' '}
              <span className="text-neon-cyan font-mono">
                /u/{lookingFor || '…'}
              </span>
              .
            </p>

            {viewerId && (
              <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 px-4 py-3 text-left text-sm text-text-secondary max-w-md mx-auto space-y-2">
                <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
                  Your signed-in account
                </p>
                {!viewerShell ? (
                  <p>
                    We could not load a profiles row for your account yet. Open
                    Account → Profile, set a username, and click Save.
                  </p>
                ) : !ownName ? (
                  <p>
                    Your account has a profile row but{' '}
                    <span className="text-white font-medium">no username</span>{' '}
                    yet. Choose one under Account → Profile and save — then open{' '}
                    <span className="font-mono text-neon-cyan">/u/yourname</span>
                    .
                  </p>
                ) : ownMatches ? (
                  <p>
                    Your username is{' '}
                    <span className="font-mono text-neon-cyan">{ownName}</span>,
                    but the public page still could not load it
                    {loadError ? ` (${loadError})` : ''}. Try saving your
                    profile again, or check Supabase RLS allows public read on{' '}
                    <span className="font-mono">profiles</span>.
                  </p>
                ) : (
                  <p>
                    Your public username is{' '}
                    <span className="font-mono text-neon-cyan">{ownName}</span>
                    , not{' '}
                    <span className="font-mono text-text-muted">
                      {lookingFor}
                    </span>
                    . Open your page at{' '}
                    <Link
                      to={`/u/${encodeURIComponent(ownName)}`}
                      className="text-neon-cyan hover:underline font-mono"
                    >
                      /u/{ownName}
                    </Link>
                    .
                  </p>
                )}
              </div>
            )}

            {!viewerId && (
              <p className="text-text-muted text-xs max-w-md mx-auto leading-relaxed">
                If this is your account, sign in, open Account → Profile, set
                username to <span className="font-mono">{lookingFor || '…'}</span>{' '}
                (or another name), click Save, then visit that /u/ link.
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {viewerId ? (
                <Link
                  to="/account/profile"
                  className="btn-neon text-sm px-5 py-2.5 inline-flex"
                >
                  {ownName ? 'Edit profile' : 'Set my username'}
                </Link>
              ) : (
                <Link
                  to="/account"
                  className="btn-neon text-sm px-5 py-2.5 inline-flex"
                >
                  Sign in
                </Link>
              )}
              {ownName && !ownMatches && (
                <Link
                  to={`/u/${encodeURIComponent(ownName)}`}
                  className="text-sm px-5 py-2.5 rounded-full border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10"
                >
                  Open /u/{ownName}
                </Link>
              )}
              <Link
                to="/projects"
                className="text-sm px-5 py-2.5 rounded-full border border-cyber-border text-text-secondary hover:text-white hover:border-neon-cyan/40"
              >
                Browse projects
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const isOwn = viewerId && profile.id === viewerId;
  const memberSince = (() => {
    if (!profile.joined_at) return null;
    const d = new Date(profile.joined_at);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  })();

  const githubHref = normalizeGithubHref(profile.github);
  const youtubeHref = normalizeYoutubeHref(profile.youtube);
  const twitchHref = normalizeTwitchHref(profile.twitch);
  const xHref = normalizeXHref(profile.x_handle);
  const hasSocial =
    profile.discord || githubHref || youtubeHref || twitchHref || xHref;
  const showForgeMarksCard = Boolean(
    forgeMarks && (forgeMarks.lifetimeEarned > 0 || isOwn)
  );

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.06)_0%,transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(0,249,255,0.05)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(255,0,128,0.04)_0%,transparent_40%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 pt-4 sm:pt-5 pb-12 max-w-5xl">
        {/* Banner + identity */}
        <div className="relative mb-8">
          <div className="relative h-48 sm:h-56 md:h-64 w-full rounded-xl overflow-hidden bg-cyber-surface border border-cyber-border">
            {profile.banner_url ? (
              <img
                src={profile.banner_url}
                alt=""
                className="w-full h-full object-cover"
                style={{
                  objectPosition: bannerObjectPosition(profile.banner_position),
                }}
                loading="eager"
                decoding="async"
              />
            ) : (
              <div
                className="w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(168,85,247,0.18)_0%,transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,249,255,0.12)_0%,transparent_50%),radial-gradient(circle_at_50%_100%,rgba(255,0,128,0.1)_0%,transparent_40%)]"
                aria-hidden
              />
            )}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
              aria-hidden
            />
          </div>
          <div className="-mt-20 sm:-mt-24 ml-4 sm:ml-6 relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
            <UserAvatar
              src={profile.avatar_url}
              name={profile.username}
              username={profile.username}
              linkProfile={false}
              size="xl"
              className="!w-28 !h-28 ring-4 ring-cyber-bg shadow-[0_8px_24px_rgba(0,0,0,0.75)]"
              borderClass="border-0"
              alt={`${profile.username}'s avatar`}
            />
            <div className="flex-1 min-w-0">
              <div className="inline-flex max-w-full flex-col gap-1.5 rounded-xl bg-cyber-bg px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
                    {profile.username}
                  </h1>
                  {pinnedBadgeKey ? (
                    <span className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                      <BadgeIcon badgeKey={pinnedBadgeKey} size="xl" />
                    </span>
                  ) : null}
                  {isOwn && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-widest bg-neon-cyan text-cyber-bg border-2 border-neon-cyan shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
                      You
                    </span>
                  )}
                  {!isOwn && profile.id && (
                    <ReportContentButton
                      contentType="profile"
                      contentId={profile.id}
                      targetUserId={profile.id}
                      contentPath={`/u/${encodeURIComponent(profile.username || '')}`}
                    />
                  )}
                  {isModerator && !isOwn && profile.id && (
                    <OpenConductCaseButton
                      targetUserId={profile.id}
                      contentType="profile"
                      contentId={profile.id}
                      contentPath={`/u/${encodeURIComponent(profile.username || '')}`}
                    />
                  )}
                  {support?.isSupporter &&
                    !earnedBadges.some((b) => b.key === 'status_donor') && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-widest bg-cyber-bg text-semantic-achievement border-2 border-semantic-achievement shadow-[0_2px_12px_rgba(0,0,0,0.75)] ring-1 ring-black/40">
                      <Heart className="w-3 h-3 fill-semantic-achievement/30" />
                      Supporter
                    </span>
                  )}
                </div>
                {memberSince && (
                  <p className="text-xs text-text-muted font-mono inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-neon-purple" />
                    Member since {memberSince}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contribution stats */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 ${
            showForgeMarksCard ? 'lg:grid-cols-4' : ''
          } gap-4 mb-8`}
        >
          <Card className="bg-cyber-card/80 text-center py-5 border-neon-cyan/20">
            <Lightbulb className="w-5 h-5 text-neon-cyan mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-neon-cyan">
              {stats.ideas}
            </div>
            <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
              Ideas submitted
            </div>
          </Card>
          <Card className="bg-cyber-card/80 text-center py-5 border-neon-purple/20">
            <CheckCircle2 className="w-5 h-5 text-neon-purple mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-neon-purple">
              {stats.tasksCompleted}
            </div>
            <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
              Tasks completed
            </div>
          </Card>
          <Card className="bg-cyber-card/80 text-center py-5 border-neon-magenta/20">
            <ListTodo className="w-5 h-5 text-neon-magenta mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-neon-magenta">
              {stats.tasksActive}
            </div>
            <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
              Active claims
            </div>
          </Card>
          {showForgeMarksCard && (
            <div className="relative h-full">
              {isOwn && (
                <div className="absolute bottom-full right-0 mb-2 flex flex-wrap justify-end gap-2">
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center px-4 py-2 text-sm rounded-lg border border-neon-purple/40 bg-neon-purple/10 text-neon-purple hover:border-neon-purple transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/account/profile"
                    className="inline-flex items-center justify-center px-4 py-2 text-sm rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:border-neon-cyan transition-colors"
                  >
                    Edit profile
                  </Link>
                </div>
              )}
              <Card className="bg-cyber-card/80 text-center py-5 border-forge-gold/25 h-full">
                <ForgeMarksHoverHint className="w-full">
                  <Hexagon className="w-5 h-5 text-forge-gold mx-auto mb-2" />
                  <div className="text-2xl font-mono font-bold text-forge-gold">
                    {formatForgeMarks(forgeMarks.balance)}
                  </div>
                  <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                    Forge Marks
                  </div>
                </ForgeMarksHoverHint>
              </Card>
            </div>
          )}
        </div>

        {/* Two balanced columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* Left: identity details in one card (like private Profile) */}
          <div className="space-y-6 min-w-0">
            <Card className="bg-cyber-card border border-cyber-border border-l-2 border-l-neon-cyan/50 space-y-6">
              {/* Bio */}
              <div>
                <SectionLabel tone="cyan">BIO</SectionLabel>
                {profile.bio ? (
                  <div className="prose prose-invert max-w-none text-sm sm:text-base">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {profile.bio}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-text-muted text-sm">No bio yet.</p>
                )}
              </div>

              {/* Interests / favorites */}
              {(chip(profile.interests).length > 0 ||
                chip(profile.favorite_games).length > 0 ||
                chip(profile.favorite_game_types).length > 0) && (
                <div className="pt-5 border-t border-white/10">
                  <SectionLabel tone="purple">DETAILS</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    {chip(profile.interests).length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-[2px] text-neon-purple/80 mb-1.5">
                          Interests
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {chip(profile.interests).map((t, i) => (
                            <span
                              key={`int-${t}-${i}`}
                              className="inline-block px-3 py-1 text-xs rounded-full border border-neon-purple/30 bg-neon-purple/5 text-text-secondary"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {chip(profile.favorite_games).length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-[2px] text-neon-magenta/80 mb-1.5">
                          Favorite Games
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {chip(profile.favorite_games).map((t, i) => (
                            <span
                              key={`fg-${t}-${i}`}
                              className="inline-block px-3 py-1 text-xs rounded-full border border-neon-magenta/30 bg-neon-magenta/5 text-text-secondary"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {chip(profile.favorite_game_types).length > 0 && (
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase tracking-[2px] text-neon-green/80 mb-1.5">
                          Favorite Game Types
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {chip(profile.favorite_game_types).map((t, i) => (
                            <span
                              key={`fgt-${t}-${i}`}
                              className="inline-block px-3 py-1 text-xs rounded-full border border-neon-green/30 bg-neon-green/5 text-text-secondary"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Links — button grid to fill the section */}
              <div className="pt-5 border-t border-white/10">
                <SectionLabel tone="magenta">LINKS</SectionLabel>
                {hasSocial ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {profile.discord && (
                      <button
                        type="button"
                        onClick={() => void copyDiscord()}
                        title="Copy Discord username"
                        className="flex items-center gap-3 rounded-xl border border-[#5865F2]/35 bg-[#5865F2]/10 hover:bg-[#5865F2]/18 hover:border-[#5865F2]/55 px-3.5 py-3 text-left transition-colors min-h-[3.5rem] w-full"
                      >
                        <span className={`${SOCIAL_BRAND.discord.color} shrink-0`}>
                          <DiscordIcon className="w-5 h-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-mono tracking-widest uppercase text-text-muted">
                            Discord
                          </span>
                          <span className="block text-sm font-semibold text-white truncate">
                            {profile.discord}
                          </span>
                        </span>
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-text-muted">
                          {discordCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-semantic-success" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </>
                          )}
                        </span>
                      </button>
                    )}
                    {xHref && (
                      <a
                        href={xHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/35 px-3.5 py-3 transition-colors min-h-[3.5rem]"
                      >
                        <span className={`${SOCIAL_BRAND.x.color} shrink-0`}>
                          <XIcon className="w-5 h-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-mono tracking-widest uppercase text-text-muted">
                            X
                          </span>
                          <span className="block text-sm font-semibold text-white truncate">
                            @{String(profile.x_handle || '').replace(/^@/, '')}
                          </span>
                        </span>
                      </a>
                    )}
                    {githubHref && (
                      <a
                        href={githubHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/35 px-3.5 py-3 transition-colors min-h-[3.5rem]"
                      >
                        <span className={`${SOCIAL_BRAND.github.color} shrink-0`}>
                          <GithubIcon className="w-5 h-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-mono tracking-widest uppercase text-text-muted">
                            GitHub
                          </span>
                          <span className="block text-sm font-semibold text-white truncate">
                            {String(profile.github || '')
                              .replace(
                                /^https?:\/\/(www\.)?github\.com\//i,
                                ''
                              )
                              .replace(/\/$/, '') || 'Profile'}
                          </span>
                        </span>
                      </a>
                    )}
                    {youtubeHref && (
                      <a
                        href={youtubeHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 hover:border-red-500/50 px-3.5 py-3 transition-colors min-h-[3.5rem]"
                      >
                        <span className={`${SOCIAL_BRAND.youtube.color} shrink-0`}>
                          <YoutubeIcon className="w-5 h-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-mono tracking-widest uppercase text-text-muted">
                            YouTube
                          </span>
                          <span className="block text-sm font-semibold text-white truncate">
                            {formatYoutubeLabel(profile.youtube) || 'YouTube'}
                          </span>
                        </span>
                      </a>
                    )}
                    {twitchHref && (
                      <a
                        href={twitchHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-purple-400/35 bg-purple-500/10 hover:bg-purple-500/15 hover:border-purple-400/55 px-3.5 py-3 transition-colors min-h-[3.5rem]"
                      >
                        <span className={`${SOCIAL_BRAND.twitch.color} shrink-0`}>
                          <TwitchIcon className="w-5 h-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-mono tracking-widest uppercase text-text-muted">
                            Twitch
                          </span>
                          <span className="block text-sm font-semibold text-white truncate">
                            {formatTwitchLabel(profile.twitch) || 'Twitch'}
                          </span>
                        </span>
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-text-muted text-sm">No public links set.</p>
                )}
              </div>
            </Card>

            {/* Support / donations — dense filled card */}
            {support?.isSupporter && (
              <Card className="bg-cyber-card border-2 border-semantic-achievement/60 shadow-[0_0_0_1px_rgba(0,0,0,0.4)] p-5 sm:p-6 space-y-5">
                <div>
                  <SectionLabel tone="gold">TOTAL SUPPORT</SectionLabel>
                  <div className="rounded-xl border border-semantic-achievement/35 bg-gradient-to-br from-semantic-achievement/15 via-cyber-surface/80 to-cyber-bg/60 px-4 py-5 sm:px-5 sm:py-6">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="min-w-0">
                        {support.showTotal && support.totalCents != null ? (
                          <p className="text-3xl sm:text-4xl font-mono font-bold text-semantic-achievement tracking-tight leading-none">
                            {formatCentsUsd(support.totalCents)}
                          </p>
                        ) : (
                          <p className="text-xl sm:text-2xl font-semibold text-semantic-achievement leading-none">
                            Supporter
                          </p>
                        )}
                        <p className="text-[11px] font-mono tracking-widest uppercase text-text-muted mt-2">
                          Public credit
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-semantic-achievement/40 bg-cyber-bg/50 px-2.5 py-1.5 text-[11px] font-mono text-semantic-achievement">
                          <Heart className="w-3.5 h-3.5 fill-semantic-achievement/30" />
                          {support.donationCount > 0
                            ? `${support.donationCount} gift${
                                support.donationCount === 1 ? '' : 's'
                              }`
                            : 'Active'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-cyber-bg/50 px-2.5 py-1.5 text-[11px] font-mono text-text-secondary">
                          {(support.projects?.length || 0) > 0
                            ? `${support.projects.length} project${
                                support.projects.length === 1 ? '' : 's'
                              }`
                            : 'Studio'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionLabel tone="gold">PROJECTS SUPPORTED</SectionLabel>
                  {support.projects?.length > 0 ? (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {support.projects.map((p) => {
                        const shell =
                          'flex w-full items-center justify-center gap-2.5 rounded-lg border border-semantic-achievement/25 bg-semantic-achievement/5 px-3 py-3 text-base sm:text-lg text-white min-h-[3rem] text-center';
                        const inner = (
                          <>
                            <span className="w-2 h-2 rounded-full bg-semantic-achievement shrink-0" />
                            <span className="font-semibold leading-snug break-words">
                              {p.label}
                            </span>
                          </>
                        );
                        return (
                          <li key={`${p.label}-${p.projectSlug || 'studio'}`}>
                            {p.projectSlug ? (
                              <Link
                                to={`/projects/${p.projectSlug}`}
                                className={`${shell} hover:border-semantic-achievement/50 hover:bg-semantic-achievement/10 transition-colors`}
                              >
                                {inner}
                              </Link>
                            ) : (
                              <div className={shell}>{inner}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="rounded-lg border border-dashed border-semantic-achievement/30 bg-semantic-achievement/5 px-3 py-4 text-sm text-text-secondary leading-relaxed text-center">
                      Studio support credited to Together Forge overall.
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6 min-w-0">
            <Card className="bg-cyber-card border border-cyber-border border-l-2 border-l-neon-purple/50">
              <SectionLabel tone="purple">COMPLETED TASKS</SectionLabel>
              {completedTasks.length === 0 ? (
                <p className="text-text-muted text-sm">
                  No credits yet.
                </p>
              ) : (
                <ul className={scrollCardBody}>
                  {completedTasks.map((t) => (
                    <li key={`${t.kind || 'task'}-${t.id}`} className="py-2.5 first:pt-0">
                      <div className="flex items-start gap-2 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-neon-purple shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">
                            {t.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {t.projectTitle && (
                              <span className="text-[11px] font-mono text-text-muted">
                                {t.projectSlug ? (
                                  <Link
                                    to={`/projects/${t.projectSlug}`}
                                    className="hover:text-neon-cyan"
                                  >
                                    {t.projectTitle}
                                  </Link>
                                ) : (
                                  t.projectTitle
                                )}
                              </span>
                            )}
                            {t.kind === 'staff' && (
                              <Badge
                                variant="default"
                                className="!normal-case text-[10px]"
                              >
                                {STAFF_CREDIT_SOURCE_LABEL}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {activeClaims.length > 0 && (
              <Card className="bg-cyber-card border border-cyber-border border-l-2 border-l-neon-magenta/50">
                <SectionLabel tone="magenta">ACTIVE CLAIMS</SectionLabel>
                <ul className={scrollCardBody}>
                  {activeClaims.map((t) => (
                    <li key={t.id} className="py-2.5 first:pt-0">
                      <div className="flex items-start gap-2 min-w-0">
                        <Hammer className="w-3.5 h-3.5 text-neon-magenta shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">
                            {t.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {t.projectTitle && (
                              <span className="text-[11px] font-mono text-text-muted">
                                {t.projectSlug ? (
                                  <Link
                                    to={`/projects/${t.projectSlug}/board`}
                                    className="hover:text-neon-cyan"
                                  >
                                    {t.projectTitle}
                                  </Link>
                                ) : (
                                  t.projectTitle
                                )}
                              </span>
                            )}
                            {t.status === 'PendingReview' && (
                              <Badge
                                variant="warning"
                                className="!normal-case text-[10px]"
                              >
                                In review
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {forgeMarks?.awards?.length > 0 && (
              <Card className="bg-cyber-card border border-cyber-border border-l-2 border-l-forge-gold/50">
                <SectionLabel tone="gold">COMMUNITY AWARDS</SectionLabel>
                {forgeMarks.totalsByTier?.length > 0 && (
                  <p className="text-[11px] font-mono text-text-muted mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {sortAwardTotalsByTier(forgeMarks.totalsByTier).map((t) => {
                      const tier = resolveForgeAwardTier(
                        t.awardTier || t.awardName
                      );
                      return (
                        <span
                          key={t.awardTier || t.awardName}
                          className="inline-flex items-center gap-1"
                        >
                          {tier && (
                            <AwardTierIcon
                              tierId={tier.id}
                              className="w-3.5 h-3.5"
                              alt=""
                            />
                          )}
                          {t.awardName} ×{t.awardCount}
                        </span>
                      );
                    })}
                  </p>
                )}
                <ul className={scrollCardBody}>
                  {forgeMarks.awards.map((a) => {
                    const href = a.targetUrl || null;
                    const tier = resolveForgeAwardTier(
                      a.awardTier || a.awardName
                    );
                    const inner = (
                      <>
                        {tier ? (
                          <AwardTierIcon
                            tierId={tier.id}
                            className={
                              tier.id === 'masterwork'
                                ? 'w-6 h-6 shrink-0 mt-0.5'
                                : 'w-5 h-5 shrink-0 mt-0.5'
                            }
                            alt=""
                          />
                        ) : (
                          <Award className="w-3.5 h-3.5 text-forge-gold shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate group-hover:text-neon-cyan">
                            {a.awardName}
                            {a.targetType === 'idea'
                              ? ' · Idea'
                              : a.targetType === 'showcase'
                                ? ' · Showcase'
                                : ''}
                          </div>
                          <div className="text-[11px] font-mono text-text-muted mt-0.5">
                            {a.createdAt
                              ? new Date(a.createdAt).toLocaleDateString(
                                  undefined,
                                  {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  }
                                )
                              : ''}
                            {a.giverUsername ? ` · from ${a.giverUsername}` : ''}
                            {href ? ' · View post' : ''}
                          </div>
                        </div>
                      </>
                    );
                    const rowClass = 'flex items-start gap-2 min-w-0';
                    return (
                      <li key={a.id} className="py-2.5 first:pt-0">
                        {href && href.startsWith('/') ? (
                          <Link to={href} className={`${rowClass} group`}>
                            {inner}
                          </Link>
                        ) : href ? (
                          <a
                            href={href}
                            className={`${rowClass} group`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {inner}
                          </a>
                        ) : (
                          <div className={rowClass}>{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            {officialMediaCredits.length > 0 && (
              <Card className="bg-cyber-card border border-cyber-border border-l-2 border-l-neon-cyan/50">
                <SectionLabel tone="cyan">OFFICIAL MEDIA</SectionLabel>
                <ul className={scrollCardBody}>
                  {officialMediaCredits.map((row) => {
                    const title =
                      row.projectTitleSnapshot ||
                      row.roleLabel ||
                      'Official Media';
                    return (
                      <li key={row.id} className="py-2.5 first:pt-0">
                        <Link
                          to="/media"
                          className="flex items-start gap-2 min-w-0 group"
                        >
                          <Film className="w-3.5 h-3.5 text-neon-cyan shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-sm text-white group-hover:text-neon-cyan transition-colors truncate">
                              {title}
                            </div>
                            <div className="text-[11px] font-mono text-text-muted mt-0.5">
                              {row.subcategory || 'Video'} · public credit
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            <Card className="bg-cyber-card border border-cyber-border border-l-2 border-l-neon-cyan/50">
              <SectionLabel tone="cyan">SHARED IDEAS</SectionLabel>
              {recentIdeas.length === 0 ? (
                <p className="text-text-muted text-sm">No public ideas yet.</p>
              ) : (
                <ul className={scrollCardBody}>
                  {recentIdeas.map((idea) => (
                    <li key={idea.id}>
                      <Link
                        to={`/ideas/${idea.id}`}
                        className="flex justify-between gap-3 py-2.5 text-sm group first:pt-0"
                      >
                        <span className="text-white group-hover:text-neon-cyan transition-colors truncate">
                          {idea.title}
                        </span>
                        <span className="text-xs font-mono text-neon-cyan/80 shrink-0">
                          {idea.votes ?? 0} votes
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Badges collection — fixed height, scroll list (below shared ideas) */}
            {(earnedBadges.length > 0 || isOwn) && (
              <Card className="bg-cyber-card/80 border border-forge-gold/25 border-l-2 border-l-forge-gold p-5 flex flex-col h-[22rem] sm:h-96 overflow-hidden">
                <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 mb-2">
                  <SectionLabel tone="gold">
                    <span className="inline-flex items-center gap-2">
                      <Award className="w-3.5 h-3.5" />
                      BADGES
                      {earnedBadges.length > 0 && (
                        <span className="text-text-muted font-normal normal-case tracking-normal">
                          ({earnedBadges.length})
                        </span>
                      )}
                    </span>
                  </SectionLabel>
                  <Link
                    to="/badges"
                    className="text-xs text-neon-cyan hover:underline font-mono tracking-widest"
                  >
                    All badges
                  </Link>
                </div>
                {isOwn && earnedBadges.length > 0 && (
                  <p className="shrink-0 text-xs text-text-muted mb-2">
                    Click a badge to pin it next to your name site-wide. Click
                    again to unpin.
                  </p>
                )}
                <div className="task-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain pr-0.5">
                  {earnedBadges.length === 0 ? (
                    <p className="text-sm text-text-muted py-2">
                      No badges yet.{' '}
                      <Link
                        to="/badges"
                        className="text-neon-cyan hover:underline"
                      >
                        See how to earn them
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2 content-start">
                      {earnedBadges.map((b) => {
                        const pinned = pinnedBadgeKey === b.key;
                        return (
                          <li key={b.key}>
                            <button
                              type="button"
                              disabled={!isOwn || pinBusy}
                              onClick={() => isOwn && handlePinBadge(b.key)}
                              className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                                pinned
                                  ? 'border-forge-gold/60 bg-forge-gold/10'
                                  : 'border-white/10 bg-cyber-surface/50 hover:border-white/25'
                              } ${isOwn ? 'cursor-pointer' : 'cursor-default'}`}
                              title={
                                isOwn
                                  ? pinned
                                    ? 'Unpin badge'
                                    : 'Pin badge'
                                  : b.description
                              }
                            >
                              <BadgeIcon
                                def={b}
                                size="lg"
                                showTooltip={!isOwn}
                              />
                              <span className="text-xs font-medium text-white">
                                {b.name}
                              </span>
                              {pinned && (
                                <span className="text-[9px] font-mono tracking-widest uppercase text-forge-gold">
                                  Pinned
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
